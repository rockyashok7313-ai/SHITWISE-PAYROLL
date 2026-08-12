-- Multi-tenancy isolation: restrict every table to the companies a user
-- actually belongs to.
--
-- ============================================================
-- WHY
-- ============================================================
-- The app does not restrict data access itself. It fetches companies with a
-- bare `select *` (no filter at all) and scopes the other tables with
-- `.eq('company_id', ...)` in the QUERY. A client-side filter is not a
-- security boundary: anyone with the public anon key and any login can call
-- the REST API directly with a different company_id, or simply read the
-- unfiltered companies list. Isolation rests entirely on RLS.
--
-- Confirmed hole: migration 0001 created the vouchers policy as
--   for all to authenticated using (true) with check (true)
-- `using (true)` means every signed-in user can read and write EVERY
-- company's vouchers. This replaces it. The employees/attendance/companies
-- policies predate this work and are replaced too rather than trusted.
--
-- ============================================================
-- SAFE TO RUN AS ONE PASTE
-- ============================================================
-- This script CANNOT lock you out. Step 1 backfills ownership automatically,
-- and Step 2 is a hard guard that ABORTS the whole transaction before any
-- policy is applied if even one company would be left unreachable. If it
-- aborts, nothing has changed and the message tells you what to fix.
--
-- Run the whole file in the Supabase SQL editor.

begin;

-- ============================================================
-- STEP 1 -- give ownerless companies an owner, automatically
-- ============================================================
-- The localStorage->cloud migration path used to upsert companies without
-- owner_id, so existing rows can have owner_id NULL. Under the policies
-- below an ownerless company with no members is invisible to everyone.
--
-- This assigns them to the single account on the project. It deliberately
-- only fires when there is EXACTLY ONE user -- with more than one, "who owns
-- this" is a real question that must not be guessed, and Step 2 will stop
-- the script so it can be answered by hand.

update public.companies c
   set owner_id = (select u.id from auth.users u order by u.created_at limit 1)
 where c.owner_id is null
   and (select count(*) from auth.users) = 1;

-- ============================================================
-- STEP 2 -- hard guard: refuse to proceed if anything would be orphaned
-- ============================================================
-- A company is reachable if it has an owner OR at least one member. Anything
-- else would vanish for every user once policies apply, so abort instead.

do $$
declare
  orphan_count int;
  orphan_names text;
begin
  select count(*), coalesce(string_agg(c.name, ', '), '')
    into orphan_count, orphan_names
    from public.companies c
   where c.owner_id is null
     and not exists (
       select 1 from public.company_members m where m.company_id = c.id
     );

  if orphan_count > 0 then
    raise exception
      'ABORTED, nothing changed. % company(ies) have no owner and no members and would become invisible: %. Fix with:  update public.companies set owner_id = ''<your-user-uuid>'' where owner_id is null;  -- find your uuid via: select id, email from auth.users;',
      orphan_count, orphan_names;
  end if;
end $$;

-- ============================================================
-- STEP 3 -- access predicate
-- ============================================================
-- SECURITY DEFINER on purpose: the function reads companies/company_members
-- itself, so without it the companies policy would recurse into itself.
-- Definer rights apply *inside the function only*; it returns a boolean and
-- leaks nothing.

create or replace function public.user_can_access_company(cid text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
     where c.id = cid and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.company_members m
     where m.company_id = cid and m.user_id = auth.uid()
  );
$$;

revoke all on function public.user_can_access_company(text) from public, anon;
grant execute on function public.user_can_access_company(text) to authenticated;

-- ============================================================
-- STEP 4 -- policies
-- ============================================================
-- WITH CHECK matters as much as USING: without it a user could still WRITE
-- rows into a company they cannot read.

alter table public.companies enable row level security;
drop policy if exists companies_authenticated_all on public.companies;
drop policy if exists companies_all on public.companies;
drop policy if exists companies_access on public.companies;
create policy companies_access
  on public.companies for all to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.company_members m
                where m.company_id = companies.id and m.user_id = auth.uid())
  )
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.company_members m
                where m.company_id = companies.id and m.user_id = auth.uid())
  );

alter table public.employees enable row level security;
drop policy if exists employees_authenticated_all on public.employees;
drop policy if exists employees_all on public.employees;
drop policy if exists employees_access on public.employees;
create policy employees_access
  on public.employees for all to authenticated
  using (public.user_can_access_company(company_id))
  with check (public.user_can_access_company(company_id));

alter table public.attendance enable row level security;
drop policy if exists attendance_authenticated_all on public.attendance;
drop policy if exists attendance_all on public.attendance;
drop policy if exists attendance_access on public.attendance;
create policy attendance_access
  on public.attendance for all to authenticated
  using (public.user_can_access_company(company_id))
  with check (public.user_can_access_company(company_id));

-- Replaces the `using (true)` policy from migration 0001.
alter table public.vouchers enable row level security;
drop policy if exists vouchers_authenticated_all on public.vouchers;
drop policy if exists vouchers_owner_all on public.vouchers;
drop policy if exists vouchers_access on public.vouchers;
create policy vouchers_access
  on public.vouchers for all to authenticated
  using (public.user_can_access_company(company_id))
  with check (public.user_can_access_company(company_id));

-- audit_logs: scoped the same way, but INSERT/SELECT only so history stays
-- append-only (migration 0005). Deliberately not `for all`.
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select
  on public.audit_logs for select to authenticated
  using (public.user_can_access_company(company_id));

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert
  on public.audit_logs for insert to authenticated
  with check (public.user_can_access_company(company_id));

revoke update, delete on public.audit_logs from authenticated, anon;

commit;

-- ============================================================
-- STEP 5 -- verify (run after the commit above succeeds)
-- ============================================================
-- Every row should be scoped -- no `true` in the qual column:
--   select tablename, policyname, cmd, qual
--     from pg_policies
--    where tablename in ('companies','employees','attendance','vouchers','audit_logs')
--    order by tablename;
--
-- No company left unreachable (expect 0):
--   select count(*) from public.companies c
--    where c.owner_id is null
--      and not exists (select 1 from public.company_members m where m.company_id = c.id);
--
-- Then open the app and confirm your data is all still there.
--
-- ROLLBACK (restores the previous permissive behaviour AND the lack of
-- isolation -- emergency use only):
--   drop policy if exists companies_access  on public.companies;
--   drop policy if exists employees_access  on public.employees;
--   drop policy if exists attendance_access on public.attendance;
--   drop policy if exists vouchers_access   on public.vouchers;
--   create policy companies_access  on public.companies  for all to authenticated using (true) with check (true);
--   create policy employees_access  on public.employees  for all to authenticated using (true) with check (true);
--   create policy attendance_access on public.attendance for all to authenticated using (true) with check (true);
--   create policy vouchers_access   on public.vouchers   for all to authenticated using (true) with check (true);

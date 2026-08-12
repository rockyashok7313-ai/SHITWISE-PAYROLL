-- Multi-tenancy isolation: restrict every table to the companies a user
-- actually belongs to.
--
-- ============================================================
-- WHY THIS IS NEEDED
-- ============================================================
-- The app does NOT restrict data access itself. It fetches companies with a
-- bare `select *` (no filter at all) and scopes employees/attendance/vouchers
-- with `.eq('company_id', ...)` in the QUERY. Client-side filters are not
-- security -- anyone with the public anon key and a login can call the REST
-- API directly with any company_id, or simply read the unfiltered companies
-- list. Isolation therefore rests ENTIRELY on RLS policies.
--
-- Confirmed hole: migration 0001 created the vouchers policy as
--   for all to authenticated using (true) with check (true)
-- `using (true)` means every signed-in user can read and write EVERY
-- company's vouchers. That policy shipped with a commented-out owner-scoped
-- alternative which was never adopted. This migration replaces it.
--
-- The employees/attendance/companies policies predate this work and could not
-- be inspected with the anon key. Run supabase/verify_rls.sql first to see
-- what they currently are.
--
-- ============================================================
-- !! READ BEFORE RUNNING -- THIS CAN LOCK YOU OUT !!
-- ============================================================
-- Access is granted only to a company you OWN (companies.owner_id) or are a
-- MEMBER of (company_members). Any company whose owner_id is NULL and which
-- has no company_members row becomes invisible to everyone.
--
-- That is a real risk here: the localStorage->cloud migration path in
-- app-provider upserts companies WITHOUT owner_id, so companies created that
-- way have owner_id NULL right now. STEP 1 fixes that and is NOT optional.
--
-- Do the steps in order and check the counts as you go.

-- ============================================================
-- STEP 0 -- look before you leap
-- ============================================================
-- Which companies would become orphaned (invisible) if policies applied now?
--   select id, name, owner_id from public.companies where owner_id is null;
--
-- Your user id and email:
--   select id, email from auth.users order by created_at;

-- ============================================================
-- STEP 1 -- REQUIRED: claim ownership of orphaned companies
-- ============================================================
-- Replace the UUID below with YOUR user id from Step 0, then run this.
-- Skipping this on a database with owner_id IS NULL rows will hide those
-- companies from every user, including you.
--
--   update public.companies
--      set owner_id = 'PASTE-YOUR-USER-UUID-HERE'
--    where owner_id is null;
--
-- Confirm zero rows remain:
--   select count(*) from public.companies where owner_id is null;   -- expect 0

-- ============================================================
-- STEP 2 -- access predicate
-- ============================================================
-- SECURITY DEFINER on purpose: the function reads companies/company_members
-- itself, so without it the companies policy would recurse into itself.
-- Definer rights bypass RLS *inside the function only*; it returns a plain
-- boolean and leaks nothing.

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
-- STEP 3 -- policies
-- ============================================================

-- companies: you see one you own or belong to.
alter table public.companies enable row level security;
drop policy if exists companies_authenticated_all on public.companies;
drop policy if exists companies_all on public.companies;
drop policy if exists companies_access on public.companies;
create policy companies_access
  on public.companies
  for all
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.company_members m
       where m.company_id = companies.id and m.user_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.company_members m
       where m.company_id = companies.id and m.user_id = auth.uid()
    )
  );

-- employees / attendance / vouchers: scoped through the company.
-- WITH CHECK matters as much as USING here -- without it a user could WRITE
-- rows into another company even while unable to read them.

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

-- audit_logs: same scoping, but INSERT/SELECT only -- history stays
-- append-only (see migration 0005). Not folded into the `for all` pattern
-- above precisely so UPDATE/DELETE are never granted.
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

-- ============================================================
-- STEP 4 -- verify
-- ============================================================
-- Expect one policy per table, none of them `true` for USING:
--   select tablename, policyname, cmd, qual
--     from pg_policies
--    where tablename in ('companies','employees','attendance','vouchers','audit_logs')
--    order by tablename;
--
-- Then, in the app: log in and confirm your own data is all still visible.
-- If anything vanished, Step 1 was almost certainly skipped or used the
-- wrong user id -- re-check `select count(*) from public.companies where
-- owner_id is null;`.
--
-- ROLLBACK (restores the previous permissive behaviour, and the previous
-- lack of isolation -- for emergency use only):
--   drop policy if exists companies_access  on public.companies;
--   drop policy if exists employees_access  on public.employees;
--   drop policy if exists attendance_access on public.attendance;
--   drop policy if exists vouchers_access   on public.vouchers;
--   create policy companies_access  on public.companies  for all to authenticated using (true) with check (true);
--   create policy employees_access  on public.employees  for all to authenticated using (true) with check (true);
--   create policy attendance_access on public.attendance for all to authenticated using (true) with check (true);
--   create policy vouchers_access   on public.vouchers   for all to authenticated using (true) with check (true);

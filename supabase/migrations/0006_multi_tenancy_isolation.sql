-- Multi-tenancy isolation.
--
-- APPLIED AND VERIFIED on 2026-08-12 against the live project. This file
-- records what was actually run, including three corrections found only by
-- running it -- the original draft would NOT have worked.
--
-- ============================================================
-- WHY
-- ============================================================
-- The app does not restrict data access itself: it fetches companies with a
-- bare `select *` and scopes other tables with `.eq('company_id', ...)` in the
-- query. A client-side filter is not a security boundary -- anyone with the
-- public anon key and any login can call the REST API with a different
-- company_id. Isolation rests entirely on RLS.
--
-- ============================================================
-- THREE THINGS THE DRAFT GOT WRONG (found by running it)
-- ============================================================
-- 1. TYPE MISMATCH. Every id column here is TEXT (companies.owner_id,
--    company_members.user_id, *.company_id), but auth.uid() returns UUID.
--    `owner_id = auth.uid()` raises "operator does not exist: uuid = text".
--    Every comparison needs auth.uid()::text.
--
-- 2. PERMISSIVE POLICIES ALREADY EXISTED. companies, employees and attendance
--    each had a policy with USING (true). Postgres OR's permissive policies
--    together, so adding a scoped policy alongside them changes NOTHING --
--    the blanket policy still grants everything. They had to be dropped by
--    their real names.
--
-- 3. INFINITE RECURSION. company_members had a SELECT policy that queried
--    company_members, and several policies on other tables queried
--    company_members too. Any such query failed with "infinite recursion
--    detected in policy". Fixed by routing every membership lookup through
--    SECURITY DEFINER functions, which do not re-apply RLS internally.
--
-- ============================================================
-- VERIFIED BY IMPERSONATION, not assumption
-- ============================================================
--   owner (rockyashok7313@gmail.com) -> 1 company, 70 employees,
--                                       139 attendance, 68 vouchers
--   another signed-in user           -> 0, 0, 0, 0
--   outsider INSERT into the owner's company -> blocked, 0 rows leaked
--   owner UPDATE -> succeeds, audit trigger still fires

begin;

-- Guard: refuse to apply if any company would become unreachable.
do $$
declare orphan_count int;
begin
  select count(*) into orphan_count from public.companies c
   where c.owner_id is null
     and not exists (select 1 from public.company_members m where m.company_id = c.id);
  if orphan_count > 0 then
    raise exception 'ABORTED: % company(ies) have no owner and no members and would become invisible.', orphan_count;
  end if;
end $$;

-- ============================================================
-- Access predicates -- SECURITY DEFINER breaks the recursion
-- ============================================================

create or replace function public.user_company_ids()
returns setof text language sql security definer stable set search_path = public as $$
  select c.id from public.companies c where c.owner_id = auth.uid()::text
  union
  select m.company_id from public.company_members m where m.user_id = auth.uid()::text;
$$;
revoke all on function public.user_company_ids() from public, anon;
grant execute on function public.user_company_ids() to authenticated;

create or replace function public.user_can_access_company(cid text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.companies c
                  where c.id = cid and c.owner_id = auth.uid()::text)
      or exists (select 1 from public.company_members m
                  where m.company_id = cid and m.user_id = auth.uid()::text);
$$;
revoke all on function public.user_can_access_company(text) from public, anon;
grant execute on function public.user_can_access_company(text) to authenticated;

-- NOTE: EXECUTE must stay granted to `authenticated` -- RLS policy expressions
-- are evaluated with the querying role's privileges, so revoking it would make
-- every policy below fail. Supabase's linter flags these as RPC-callable; the
-- exposure is limited to a user learning which companies they already belong
-- to, which they necessarily know.

-- ============================================================
-- Remove the blanket and recursive policies
-- ============================================================

drop policy if exists "Allow authenticated full access to companies"  on public.companies;
drop policy if exists "Allow authenticated full access to employees"  on public.employees;
drop policy if exists "Allow authenticated full access to attendance" on public.attendance;

drop policy if exists "Users can view members of their companies"  on public.company_members;
drop policy if exists "Owners can manage company members"          on public.company_members;
drop policy if exists "Users can view companies they belong to"     on public.companies;
drop policy if exists "Users can view employees in their companies" on public.employees;
drop policy if exists "Admins and Supervisors can manage employees" on public.employees;
drop policy if exists "Users can view attendance in their companies" on public.attendance;
drop policy if exists "Admins and Supervisors can manage attendance" on public.attendance;
drop policy if exists "Users can view audit logs in their companies" on public.audit_logs;
drop policy if exists "Admins and Supervisors can insert audit logs" on public.audit_logs;

-- ============================================================
-- Scoped policies. WITH CHECK matters as much as USING -- without it a user
-- could WRITE into a company they cannot read.
-- ============================================================

alter table public.companies enable row level security;
drop policy if exists companies_access on public.companies;
create policy companies_access on public.companies for all to authenticated
  using (id in (select public.user_company_ids()))
  with check (owner_id = auth.uid()::text);

alter table public.company_members enable row level security;
drop policy if exists company_members_access on public.company_members;
create policy company_members_access on public.company_members for all to authenticated
  using (user_id = auth.uid()::text or company_id in (select public.user_company_ids()))
  with check (company_id in (select public.user_company_ids()));

alter table public.employees enable row level security;
drop policy if exists employees_access on public.employees;
create policy employees_access on public.employees for all to authenticated
  using (public.user_can_access_company(company_id))
  with check (public.user_can_access_company(company_id));

alter table public.attendance enable row level security;
drop policy if exists attendance_access on public.attendance;
create policy attendance_access on public.attendance for all to authenticated
  using (public.user_can_access_company(company_id))
  with check (public.user_can_access_company(company_id));

alter table public.vouchers enable row level security;
drop policy if exists vouchers_access on public.vouchers;
create policy vouchers_access on public.vouchers for all to authenticated
  using (public.user_can_access_company(company_id))
  with check (public.user_can_access_company(company_id));

-- audit_logs stays INSERT/SELECT only, so history remains append-only (0005).
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.user_can_access_company(company_id));
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check (public.user_can_access_company(company_id));
revoke update, delete on public.audit_logs from authenticated, anon;

-- Hardening flagged by Supabase's linter: a SECURITY DEFINER function with a
-- mutable search_path can be tricked into resolving names against a schema an
-- attacker controls. Pre-existing function, behaviour unchanged.
alter function public.audit_trigger_func() set search_path = public, pg_temp;
revoke execute on function public.audit_trigger_func() from anon, public;

commit;

-- ============================================================
-- VERIFY
-- ============================================================
-- No policy should grant blanket access (expect 0 rows):
--   select tablename, policyname from pg_policies
--    where schemaname='public' and qual = 'true';
--
-- Impersonation test (replace the uuid with a real auth.users id):
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
--   select count(*) from public.employees;
--   rollback;

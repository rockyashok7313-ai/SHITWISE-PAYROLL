-- RLS verification helper.
--
-- Run in the Supabase SQL editor (needs catalog access -- the app's anon key
-- cannot read pg_policies, so this cannot be checked from the client).
--
-- Purpose: confirm the vouchers policies created by 0001/0002 match how
-- employees and attendance are actually configured. Compare the rows for
-- 'vouchers' against 'employees'/'attendance' -- same cmd, same roles, same
-- USING / WITH CHECK expressions means they match. If employees/attendance use
-- an owner-scoped predicate (e.g. owner_id = auth.uid() via a join to
-- companies) and vouchers shows `true`, tighten the vouchers policy to match
-- (the owner-scoped alternative is in 0001_create_vouchers.sql).

-- 1) Is RLS enabled (and forced) on each table?
select
  c.relname                as table_name,
  c.relrowsecurity         as rls_enabled,
  c.relforcerowsecurity    as rls_forced
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('companies', 'employees', 'attendance', 'vouchers')
order by c.relname;

-- 2) The policies themselves, side by side.
select
  tablename,
  policyname,
  cmd                       as command,      -- SELECT / INSERT / UPDATE / DELETE / ALL
  roles,                                       -- e.g. {authenticated}
  permissive,
  qual                      as using_expr,    -- USING (...)
  with_check                as with_check_expr -- WITH CHECK (...)
from pg_policies
where schemaname = 'public'
  and tablename in ('companies', 'employees', 'attendance', 'vouchers')
order by tablename, cmd, policyname;

-- 3) Table-level privilege grants per role (a second gate alongside RLS).
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('companies', 'employees', 'attendance', 'vouchers')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

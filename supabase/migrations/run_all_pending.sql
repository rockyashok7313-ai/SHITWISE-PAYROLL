-- Combined migration: 0001 + 0002 + 0003, in order.
--
-- As of this run, NONE of the three have been applied to the live database:
--   - public.vouchers does not exist at all (every voucher save/load fails)
--   - public.employees and public.attendance exist but are missing
--     updated_at/deleted_at, so every save to either has been failing with
--     `42703: column does not exist` and silently falling back to local-only
--     storage (logged to the browser console, not shown to the user).
--
-- Safe to run as a whole: every statement is `if not exists`, so re-running
-- this later (or having partially run pieces before) does not error or
-- duplicate anything.
--
-- Run this entire file once in the Supabase SQL editor.

-- ============================================================
-- 0001: vouchers table
-- ============================================================

create table if not exists public.vouchers (
  id            text primary key,
  company_id    text not null,
  employee_id   text,
  employee_name text,
  month         text,
  date          date,
  amount        numeric not null default 0,
  payment_method text,
  remarks       text,
  created_at    timestamptz not null default now()
);

create index if not exists vouchers_company_idx on public.vouchers (company_id);
create index if not exists vouchers_company_month_idx on public.vouchers (company_id, month);

alter table public.vouchers enable row level security;

drop policy if exists vouchers_authenticated_all on public.vouchers;
create policy vouchers_authenticated_all
  on public.vouchers
  for all
  to authenticated
  using (true)
  with check (true);

-- IMPORTANT: the policy above grants any authenticated user full access,
-- matching how the app already queries (scoping by company_id in the query
-- itself). If your employees/attendance tables instead restrict rows to the
-- owning user, use this owner-scoped version INSTEAD:
--
-- create policy vouchers_owner_all
--   on public.vouchers
--   for all
--   to authenticated
--   using (exists (
--     select 1 from public.companies c
--     where c.id = vouchers.company_id and c.owner_id = auth.uid()
--   ))
--   with check (exists (
--     select 1 from public.companies c
--     where c.id = vouchers.company_id and c.owner_id = auth.uid()
--   ));

-- ============================================================
-- 0002: voucher sync columns
-- ============================================================

alter table public.vouchers
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

create index if not exists vouchers_company_live_idx
  on public.vouchers (company_id)
  where deleted_at is null;

-- ============================================================
-- 0003: employee + attendance sync columns
-- ============================================================

alter table public.employees
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.attendance
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

create index if not exists employees_company_live_idx
  on public.employees (company_id)
  where deleted_at is null;

create index if not exists attendance_company_live_idx
  on public.attendance (company_id)
  where deleted_at is null;

-- Deliberately no updated_at triggers anywhere above: the client owns the
-- version key (it must survive the load-time write-back verbatim), so a
-- trigger resetting it to now() on every UPDATE would make two devices
-- flip-flop on sync. This is intentional, not an oversight.

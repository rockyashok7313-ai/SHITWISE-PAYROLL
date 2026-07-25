-- Vouchers table.
--
-- Until now salary vouchers lived only in localStorage (vouchers_<companyId>),
-- so they were per-browser: created on one machine, invisible on another, and
-- lost if the browser store was cleared. This table persists them alongside
-- employees and attendance. Payroll "Paid" status is derived from voucher
-- existence, so persisting vouchers is what makes Paid status cross-device too.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- The app degrades gracefully until then: if the table is missing, every
-- voucher query errors and the provider falls back to localStorage, exactly as
-- it did before -- so nothing breaks while this is pending.

create table if not exists public.vouchers (
  id            text primary key,
  company_id    text not null,
  employee_id   text,
  employee_name text,
  month         text,                         -- stored period label, e.g. "May 2027"
  date          date,
  amount        numeric not null default 0,
  payment_method text,                        -- 'Bank' | 'Cash'
  remarks       text,
  created_at    timestamptz not null default now()
);

-- Register/report queries filter by company_id and month; index the hot path.
create index if not exists vouchers_company_idx on public.vouchers (company_id);
create index if not exists vouchers_company_month_idx on public.vouchers (company_id, month);

-- Row Level Security.
--
-- IMPORTANT: match this to how your existing `employees` and `attendance`
-- tables are configured. The app authenticates via supabase.auth and then
-- queries with the anon key, scoping by company_id in the query itself -- the
-- same trust model those tables already use. The policies below grant the
-- authenticated role full access, mirroring that model. If your other tables
-- instead scope rows to the owning user, replace the policies with the
-- owner-scoped version shown in the comment beneath, and if those tables have
-- RLS disabled entirely, disable it here too (`alter table ... disable row level security;`).

alter table public.vouchers enable row level security;

drop policy if exists vouchers_authenticated_all on public.vouchers;
create policy vouchers_authenticated_all
  on public.vouchers
  for all
  to authenticated
  using (true)
  with check (true);

-- Owner-scoped alternative (use INSTEAD of the policy above if your other
-- tables restrict rows to the company owner):
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

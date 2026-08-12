-- Employee loans.
--
-- APPLIED to the live project on 2026-08-12; this file records it.
--
-- Deliberately NO repayments table. The attendance grid already has a `loan`
-- column that deducts from a worker's net pay, and payroll already treats it
-- as a deduction. Recording repayments a second time would create two sources
-- of truth that drift apart -- this codebase has been bitten by exactly that
-- more than once (four divergent pay formulas, a duplicated net-payout
-- calculation). So a loan's balance is derived:
--
--     outstanding = sum(loans.amount) - sum(attendance.loan)
--
-- A supervisor recovers a loan by typing an amount into Loan (-) each month,
-- exactly as before; the balance just reflects what has already been entered.
--
-- ON DELETE CASCADE on company_id matches employees/attendance/audit_logs.
-- NOTE: there is deliberately no FK to employees -- attendance already has one
-- and it cascades, so a mis-click deleting an employee would silently erase
-- their loan history too. Loans should outlive an employee record being
-- tidied up; orphaned rows are preferable to vanished debt.

create table if not exists public.loans (
  id           text primary key,
  company_id   text not null references public.companies(id) on delete cascade,
  employee_id  text,
  amount       numeric not null default 0,
  issue_date   date,
  remarks      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists loans_company_idx on public.loans (company_id);
create index if not exists loans_company_live_idx on public.loans (company_id) where deleted_at is null;
create index if not exists loans_employee_idx on public.loans (company_id, employee_id);

-- Same tenant scoping as every other table (see 0006).
alter table public.loans enable row level security;
drop policy if exists loans_access on public.loans;
create policy loans_access on public.loans for all to authenticated
  using (public.user_can_access_company(company_id))
  with check (public.user_can_access_company(company_id));

-- Merge-based sync columns for employees and attendance.
--
-- Same fix as 0002 did for vouchers, now for the other two synced tables. They
-- used the same count-based model (more rows wins, deletes inferred from a
-- shorter array), so a record deleted on one machine could reappear when a
-- machine with a stale cache synced.
--
-- Deletes become soft deletes: a tombstone that propagates, instead of a row
-- vanishing (which the old model could not tell from "not yet synced").
--
-- Run after 0001/0002. Adds columns to existing tables; existing rows get
-- updated_at = now() and stay live (deleted_at null). Idempotent.
--
-- Same partial-application caveat as 0002: with the table present but these
-- columns missing, writes that reference them error and are logged, and the
-- local soft-delete still hides the row on that machine but does not propagate
-- until the columns exist.

alter table public.employees
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.attendance
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- Live-record reads filter on deleted_at; index it alongside company_id.
create index if not exists employees_company_live_idx
  on public.employees (company_id)
  where deleted_at is null;

create index if not exists attendance_company_live_idx
  on public.attendance (company_id)
  where deleted_at is null;

-- No updated_at trigger, for the same reason as 0002: the client owns the
-- version key, which must survive the load-time write-back verbatim.

-- Merge-based sync columns for vouchers.
--
-- The provider used to decide sync by row COUNT: the side with more rows won,
-- and its extra rows were pushed to the other. That cannot express a deletion,
-- so a voucher deleted on one machine came back the next time a machine with a
-- stale cache synced -- a resurrected payout.
--
-- Sync is now per record, by id, using these two columns:
--   updated_at -- version key; the newer version of a record wins.
--   deleted_at -- tombstone; a soft delete that propagates, instead of a row
--                 vanishing (which the old model could not tell from "not yet
--                 synced"). Deletes now clear deleted_at rather than removing
--                 the row.
--
-- Run after 0001. Adds columns to the existing table; existing rows get
-- updated_at = now() and remain live (deleted_at null). Idempotent.
--
-- The app degrades gracefully if this has not run: writes touching these
-- columns error and are logged, and the local soft-delete still hides the row
-- on that machine -- it just will not propagate until the columns exist.

alter table public.vouchers
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- Live-record reads filter on deleted_at; index it alongside company_id.
create index if not exists vouchers_company_live_idx
  on public.vouchers (company_id)
  where deleted_at is null;

-- Deliberately NO updated_at trigger. The client is authoritative for
-- updated_at: it is the merge version key and must survive verbatim through the
-- load-time write-back upsert. A trigger resetting it to now() on every update
-- would rewrite the version on each sync and make two machines flip-flop.

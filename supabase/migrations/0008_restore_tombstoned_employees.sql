-- RECOVERY: bring back staff that were soft-deleted by the Staff Management
-- stale-save bug.
--
-- ============================================================
-- WHAT HAPPENED
-- ============================================================
-- employee-profiles.tsx had `propEmployees` in the dependency array of the
-- effect that pushes local edits back to the provider. Effects run after
-- render, so when the provider delivered the staff list (arriving from the
-- cloud after the initial empty render), that effect re-ran in the same
-- commit while local state still held the OLD, empty value -- and pushed the
-- empty list back as though every worker had been deleted.
--
-- handleEmployeesChange reconciles a whole-array save by tombstoning anything
-- absent from the incoming array, so every staff member got deleted_at set,
-- and the tombstones synced to Supabase.
--
-- Nothing was hard-deleted. The rows are intact with deleted_at set, which is
-- exactly why this is recoverable.
--
-- ============================================================
-- WHY updated_at MUST ALSO BE BUMPED
-- ============================================================
-- Sync merges per record and the NEWER updated_at wins (lib/sync). Browsers
-- still hold the tombstoned copies locally. Clearing deleted_at alone would
-- leave the cloud row OLDER than the local tombstone, and the next sync would
-- simply re-delete everyone. Setting updated_at = now() makes the restored
-- row the newest version, so it wins the merge and the restoration sticks.
--
-- Safe to re-run. Run in the Supabase SQL editor.

begin;

-- How many staff are currently tombstoned (run before, to know what to expect):
--   select count(*) from public.employees where deleted_at is not null;

update public.employees
   set deleted_at = null,
       updated_at = now()
 where deleted_at is not null;

-- Same fix for attendance, which the equivalent whole-array save could have
-- affected. Harmless if nothing there was tombstoned.
update public.attendance
   set deleted_at = null,
       updated_at = now()
 where deleted_at is not null;

commit;

-- ============================================================
-- AFTER RUNNING
-- ============================================================
-- Expect 0 from both:
--   select count(*) from public.employees  where deleted_at is not null;
--   select count(*) from public.attendance where deleted_at is not null;
--
-- Then HARD REFRESH the app (Ctrl+Shift+R). The restored rows are newer than
-- the local tombstones, so the merge pulls them back in.
--
-- NOTE: vouchers are deliberately NOT included. Voucher deletions are a real,
-- deliberate user action recorded in the audit trail -- blanket-undeleting
-- them would resurrect payments that were intentionally removed.

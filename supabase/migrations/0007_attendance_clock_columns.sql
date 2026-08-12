-- Add the clock-in/clock-out columns that attendance writes have always sent.
--
-- ROOT CAUSE of "Saved on this device -- cloud sync failed" on the Attendance
-- screen: app-provider's attendanceToRow writes clock_in and clock_out, but
-- neither column exists on public.attendance. PostgREST rejects the whole
-- upsert (PGRST204, "Could not find the 'clock_in' column"), so EVERY
-- attendance save has been failing to reach Supabase and silently falling back
-- to local-only storage.
--
-- The columns are genuinely used -- the attendance grid has Clock In / Clock
-- Out fields and derives worked hours from them -- so the fix is to add them
-- rather than stop sending them, which would drop real data on sync.
--
-- Stored as text, matching the "HH:mm" format the time inputs produce and
-- consistent with attendance.date, which is also text (it has to be: multi-day
-- entries are stored as "YYYY-MM-DD to YYYY-MM-DD", which is not a valid date).
--
-- Idempotent. Run in the Supabase SQL editor.

alter table public.attendance
  add column if not exists clock_in  text,
  add column if not exists clock_out text;

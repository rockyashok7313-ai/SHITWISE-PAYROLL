-- Employee profile columns that the app collects but never persisted.
--
-- The Employee Profiles form has always captured gender, mobile, bank details
-- and a photo URL, but app-provider's employeeToRow only ever wrote
-- id/name/role/shift/rate/status -- so every one of these fields was silently
-- dropped on sync to Supabase and lost on reload from cloud. Verified against
-- the live database: none of these columns existed.
--
-- gender in particular is now load-bearing: the Add Attendance dialog derives
-- the default shift from it (male -> 12-hour, female -> 9-hour), which cannot
-- work if gender does not survive a save.
--
-- Idempotent; safe to run more than once. Run in the Supabase SQL editor.

alter table public.employees
  add column if not exists gender         text,
  add column if not exists mobile         text,
  add column if not exists bank_name      text,
  add column if not exists account_number text,
  add column if not exists ifsc_code      text,
  add column if not exists photo_url      text;

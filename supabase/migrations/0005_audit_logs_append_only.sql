-- Append-only policies for audit_logs.
--
-- The audit_logs table and the Activity screen that reads it already existed,
-- but nothing ever wrote to it. The app now records wage-rate changes and
-- voucher deletions there. Two things this migration guarantees:
--
--   1. INSERT is actually permitted. If RLS has no INSERT policy, every audit
--      write is silently rejected -- and because audit writes are deliberately
--      non-blocking (they must never fail a payroll edit), that rejection would
--      only ever appear in the browser console. The trail would look like it
--      was working while recording nothing.
--
--   2. UPDATE and DELETE are NOT granted. An audit trail that can be edited or
--      erased by the same people it audits is worth very little in a dispute --
--      anyone can change a wage, then rewrite the record of having done so.
--      There are deliberately no UPDATE or DELETE policies below, so with RLS
--      enabled those operations are denied by default.
--
-- Idempotent. Run in the Supabase SQL editor.

alter table public.audit_logs enable row level security;

-- Anyone signed in may write an audit row...
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert
  on public.audit_logs
  for insert
  to authenticated
  with check (true);

-- ...and read the history.
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select
  on public.audit_logs
  for select
  to authenticated
  using (true);

-- Remove any pre-existing broad policy that would allow rewriting history.
-- (Named policies only -- a policy created under a different name will still
--  need dropping by hand; list them with:
--    select policyname, cmd from pg_policies where tablename = 'audit_logs';)
drop policy if exists audit_logs_all on public.audit_logs;
drop policy if exists audit_logs_authenticated_all on public.audit_logs;
drop policy if exists audit_logs_update on public.audit_logs;
drop policy if exists audit_logs_delete on public.audit_logs;

-- Belt and braces: even a future permissive policy cannot re-grant what is
-- revoked at the table level.
revoke update, delete on public.audit_logs from authenticated, anon;

-- Verify afterwards -- expect INSERT and SELECT only:
--   select policyname, cmd from pg_policies where tablename = 'audit_logs';

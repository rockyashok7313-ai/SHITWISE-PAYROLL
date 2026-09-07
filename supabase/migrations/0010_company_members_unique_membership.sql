-- One row per (company, user): lets the invite flow upsert cleanly
-- (e.g. re-inviting someone just updates their role) instead of risking
-- duplicate membership rows for the same person in the same company.
alter table public.company_members
  add constraint company_members_company_user_unique unique (company_id, user_id);

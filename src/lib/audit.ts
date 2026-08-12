/**
 * Audit trail for money-affecting changes.
 *
 * The `audit_logs` table and the Activity screen that reads it already
 * existed, but nothing in the app had ever written a row -- so the Activity
 * page has always been empty. This module supplies the two events that
 * matter most for payroll accountability:
 *
 *   - a labourer's wage rate changing (who changed it, from what, to what)
 *   - a salary voucher being deleted (the full record, so it is recoverable)
 *
 * Design rules, both important for an audit trail to be worth anything:
 *
 *   1. APPEND-ONLY IN SPIRIT. Nothing here updates or deletes an existing
 *      audit row. Enforcing that properly needs a DB policy (see the note in
 *      buildAuditRow) -- worth adding before this is relied on in a dispute.
 *   2. NEVER BLOCK THE REAL SAVE. Writing an audit row must not be able to
 *      fail a payroll edit. Callers wrap these in try/catch and log; a lost
 *      audit row is bad, a lost wage edit is worse.
 *
 * Shapes match the columns the existing Activity UI renders (it formats
 * `rate` and `amount` as rupees and diffs old_data against new_data), so
 * rows written here display correctly without touching that component.
 */

export interface AuditActor {
  userId: string | null;
  userEmail: string | null;
}

export interface AuditRow {
  company_id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id: string | null;
  user_email: string | null;
  timestamp: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
}

export interface AuditableEmployee {
  id: string;
  name?: string;
  rate?: number | string;
  [key: string]: any;
}

export interface WageChange {
  employeeId: string;
  employeeName: string;
  oldRate: number;
  newRate: number;
}

/**
 * Wage rate changes between two employee snapshots, matched by id.
 *
 * Only genuine CHANGES to an existing employee count. A newly added
 * employee is not a wage change (there is no previous rate to have changed
 * from), and a removed employee is not either -- both are separate events
 * from "someone altered this person's pay rate".
 *
 * Non-numeric or missing rates on either side are skipped rather than
 * recorded as a change to/from NaN, which would produce noise in the log
 * that looks like tampering.
 */
export function detectWageChanges(
  previous: AuditableEmployee[] | undefined,
  next: AuditableEmployee[] | undefined
): WageChange[] {
  const prevById = new Map<string, AuditableEmployee>((previous ?? []).map(e => [e.id, e]));
  const changes: WageChange[] = [];

  for (const updated of next ?? []) {
    const before = prevById.get(updated.id);
    if (!before) continue; // newly added, not a change

    const oldRate = Number(before.rate);
    const newRate = Number(updated.rate);
    if (!Number.isFinite(oldRate) || !Number.isFinite(newRate)) continue;
    if (oldRate === newRate) continue;

    changes.push({
      employeeId: updated.id,
      employeeName: updated.name || before.name || updated.id,
      oldRate,
      newRate,
    });
  }

  return changes;
}

/* NOTE ON IMMUTABILITY: these builders never set an id -- the database
 * assigns it -- and there is deliberately no update/delete helper in this
 * module. For a trail that holds up in a payroll dispute, the table should
 * also have an RLS policy granting INSERT and SELECT to authenticated users
 * but NOT UPDATE or DELETE, so a row cannot be rewritten after the fact.
 * That policy is not applied yet. */

export function buildWageChangeAudit(
  change: WageChange,
  companyId: string,
  actor: AuditActor,
  now: string = new Date().toISOString()
): AuditRow {
  return {
    company_id: companyId,
    table_name: 'employees',
    record_id: change.employeeId,
    action: 'UPDATE',
    user_id: actor.userId,
    user_email: actor.userEmail,
    timestamp: now,
    // Only the wage fields: the Activity UI diffs old vs new and shows every
    // differing key, so including unrelated fields would bury the actual
    // change. `name` is carried on both sides so it reads as context, not a
    // change (identical values are filtered out by the differ).
    old_data: { name: change.employeeName, rate: change.oldRate },
    new_data: { name: change.employeeName, rate: change.newRate },
  };
}

export function buildVoucherDeleteAudit(
  voucher: Record<string, any>,
  companyId: string,
  actor: AuditActor,
  now: string = new Date().toISOString()
): AuditRow {
  return {
    company_id: companyId,
    table_name: 'vouchers',
    record_id: String(voucher.id ?? ''),
    action: 'DELETE',
    user_id: actor.userId,
    user_email: actor.userEmail,
    timestamp: now,
    // The whole voucher, so a deletion can be reconstructed from the log
    // alone -- that is the point of auditing a delete.
    old_data: {
      employeeName: voucher.employeeName ?? null,
      employeeId: voucher.employeeId ?? null,
      month: voucher.month ?? null,
      date: voucher.date ?? null,
      amount: voucher.amount ?? null,
      paymentMethod: voucher.paymentMethod ?? null,
      remarks: voucher.remarks || null,
    },
    new_data: null,
  };
}

/**
 * Reconciling stored voucher amounts against the current calculation.
 *
 * When the pay calculation was unified into lib/payroll, its fallback rules for
 * shift, rate and attendance-row matching changed. Vouchers generated before
 * that can therefore hold an amount that no longer equals what the app now
 * computes for the same employee and period. This recomputes the net for each
 * voucher and reports the difference so it can be reviewed and, if wanted,
 * corrected -- it never changes anything itself.
 *
 * Pure and dependency-light so the comparison is testable; the UI supplies the
 * live vouchers, employees and attendance.
 */

import { AttendanceEntry, EmployeeDefaults, calculateNetPay, filterAttendanceForPeriod } from './payroll';
import { parsePeriod } from './voucher-period';

export type ReconcileStatus =
  | 'match'          // stored amount equals the recomputed net
  | 'mismatch'       // stored amount differs, and there is attendance to compute from
  | 'no-attendance'  // no attendance rows for the period -- likely a manual amount, not drift
  | 'no-employee';   // the voucher's employee no longer exists; cannot recompute

export interface VoucherReconcileResult {
  voucherId: string;
  employeeId: string;
  employeeName: string;
  month: string;
  storedAmount: number;
  /** The freshly computed net, or null when it cannot be computed. */
  computedNet: number | null;
  /** storedAmount - computedNet, or null when not computable. Positive = overpaid vs current calc. */
  delta: number | null;
  recordCount: number;
  status: ReconcileStatus;
}

export interface VoucherLite {
  id: string;
  employeeId?: string;
  employeeName?: string;
  month?: string;
  amount?: string | number;
}

export interface EmployeeLite extends EmployeeDefaults {
  id: string;
}

export function reconcileVoucher(
  voucher: VoucherLite,
  employees: EmployeeLite[],
  attendance: AttendanceEntry[]
): VoucherReconcileResult {
  const storedAmount = Number(voucher.amount) || 0;
  const base = {
    voucherId: voucher.id,
    employeeId: voucher.employeeId || '',
    employeeName: voucher.employeeName || '',
    month: voucher.month || '',
    storedAmount,
  };

  const parsed = parsePeriod(voucher.month);
  const emp = (employees || []).find(e => e.id === voucher.employeeId);
  if (!emp || !parsed) {
    return { ...base, computedNet: null, delta: null, recordCount: 0, status: 'no-employee' };
  }

  const records = filterAttendanceForPeriod(attendance, voucher.employeeId || '', parsed.month, parsed.year);
  const computedNet = calculateNetPay(records, { rate: emp.rate, shift: emp.shift });
  const delta = storedAmount - computedNet;

  let status: ReconcileStatus;
  if (records.length === 0) {
    status = 'no-attendance';   // nothing to compute from; do not call it drift
  } else {
    status = delta === 0 ? 'match' : 'mismatch';
  }

  return { ...base, computedNet, delta, recordCount: records.length, status };
}

export interface PeriodReconcileSummary {
  results: VoucherReconcileResult[];
  total: number;
  matched: number;
  mismatched: number;
  unverifiable: number;   // no-attendance + no-employee
  /** Sum of deltas across mismatches only. Signed: positive = stored above computed. */
  netVariance: number;
  /** Sum of absolute deltas across mismatches. */
  absVariance: number;
}

/**
 * Reconciles every voucher in the given list (already filtered to a period by
 * the caller). Only 'mismatch' rows contribute to the variance totals.
 */
export function reconcilePeriod(
  vouchers: VoucherLite[],
  employees: EmployeeLite[],
  attendance: AttendanceEntry[]
): PeriodReconcileSummary {
  const results = (vouchers || []).map(v => reconcileVoucher(v, employees, attendance));

  let matched = 0;
  let mismatched = 0;
  let unverifiable = 0;
  let netVariance = 0;
  let absVariance = 0;

  for (const r of results) {
    if (r.status === 'match') matched++;
    else if (r.status === 'mismatch') {
      mismatched++;
      netVariance += r.delta || 0;
      absVariance += Math.abs(r.delta || 0);
    } else {
      unverifiable++;
    }
  }

  return { results, total: results.length, matched, mismatched, unverifiable, netVariance, absVariance };
}

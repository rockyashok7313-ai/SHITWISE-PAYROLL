/**
 * Voucher pay-period helpers, and the derivation of payroll "Paid" status.
 *
 * A voucher stores its period as a display string, e.g. "May 2027". These
 * functions parse and compare that format tolerantly (case, spacing), and --
 * the point of this module -- derive whether an employee has been paid for a
 * period purely from whether a voucher exists.
 *
 * "Paid" used to be a separate localStorage store (payroll_status_*) that the
 * register wrote by hand and the voucher screen mirrored on every create,
 * update and delete. Two writers, one browser, and they drifted: an employee
 * could stay marked Paid after their voucher was deleted, or read Paid on one
 * machine and Unpaid on another. Deriving it from the voucher record removes
 * the store, and with it the drift.
 */

import { MONTHS } from './payroll';

/** The stored period format, e.g. periodLabel("May", "2027") -> "May 2027". */
export function periodLabel(monthName: string, year: string | number): string {
  return `${monthName} ${year}`;
}

/** Parses "May 2027" tolerantly. Returns null if it is not a real month + year. */
export function parsePeriod(value?: string): { month: string; year: string } | null {
  if (!value) return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const month = MONTHS.find(m => m.toLowerCase() === parts[0].toLowerCase());
  if (!month) return null;
  return { month, year: parts[1] };
}

/**
 * Whether two stored period strings mean the same month + year, ignoring case
 * and spacing. Falls back to raw equality when either side is unparseable so a
 * malformed value can still match itself.
 */
export function samePeriod(a?: string, b?: string): boolean {
  const pa = parsePeriod(a);
  const pb = parsePeriod(b);
  if (!pa || !pb) return a === b;
  return pa.month === pb.month && pa.year === pb.year;
}

/** Whether a voucher's stored `month` string falls in the given month + year. */
export function isVoucherForPeriod(
  voucherMonth: string | undefined,
  monthName: string,
  year: string | number
): boolean {
  return samePeriod(voucherMonth, periodLabel(monthName, year));
}

/** Minimal shape this module needs from a voucher. */
export interface VoucherLike {
  employeeId?: string;
  month?: string;
  /** "Bank" or "Cash". Free text in the store, so compared case-insensitively. */
  paymentMethod?: string;
  /** Stored as a string; every read site has to Number() it. */
  amount?: number | string;
}

/**
 * The set of employee ids that have at least one voucher in the given period.
 *
 * This is the payroll "Paid" status: membership means paid, absence means
 * unpaid. Because it reads the live voucher list, creating a voucher marks an
 * employee Paid, deleting it marks them Unpaid, and moving a voucher to another
 * employee or month moves the status with it -- no separate store to keep in
 * step.
 */
export function paidEmployeeIds(
  vouchers: VoucherLike[] | undefined,
  monthName: string,
  year: string | number
): Set<string> {
  const ids = new Set<string>();
  if (!vouchers) return ids;
  for (const v of vouchers) {
    if (v.employeeId && isVoucherForPeriod(v.month, monthName, year)) {
      ids.add(v.employeeId);
    }
  }
  return ids;
}

/* ------------------------------------------------------------------ */
/* Payment method: the Bank Paid / Cash Paid reports                   */
/* ------------------------------------------------------------------ */

export type PaymentMethod = 'Bank' | 'Cash';

/** Case/space-tolerant match, since paymentMethod is free text in the store. */
export function isPaymentMethod(value: string | undefined, method: PaymentMethod): boolean {
  return (value || '').trim().toLowerCase() === method.toLowerCase();
}

/**
 * Total actually paid to one employee in a period by a given method.
 *
 * Sums rather than taking the first match: a period can legitimately hold more
 * than one voucher for the same person (a correction, or a split payment), and
 * a report that silently showed only one of them would under-state what left
 * the bank.
 *
 * Returns null when they have no voucher of that method in the period, which
 * is how callers tell "paid nothing by bank" from "not on the bank list".
 */
export function amountPaidByMethod(
  vouchers: VoucherLike[] | undefined,
  employeeId: string,
  monthName: string,
  year: string | number,
  method: PaymentMethod
): number | null {
  if (!vouchers || !employeeId) return null;
  let total = 0;
  let found = false;
  for (const v of vouchers) {
    if (v.employeeId !== employeeId) continue;
    if (!isVoucherForPeriod(v.month, monthName, year)) continue;
    if (!isPaymentMethod(v.paymentMethod, method)) continue;
    found = true;
    const n = Number(v.amount);
    total += Number.isFinite(n) ? n : 0;
  }
  return found ? total : null;
}

/**
 * Employee ids paid by a given method in a period, with what each was paid.
 *
 * This is the Bank Paid / Cash Paid report: it lists who was paid that way and
 * the amount that actually went out, taken from the voucher rather than
 * recomputed from attendance. The two can differ -- the vouchers screen has a
 * reconcile action for exactly that -- and a payment report has to agree with
 * the money, not with the calculation.
 */
export function paidByMethod(
  vouchers: VoucherLike[] | undefined,
  monthName: string,
  year: string | number,
  method: PaymentMethod
): Map<string, number> {
  const out = new Map<string, number>();
  if (!vouchers) return out;
  for (const v of vouchers) {
    if (!v.employeeId) continue;
    if (!isVoucherForPeriod(v.month, monthName, year)) continue;
    if (!isPaymentMethod(v.paymentMethod, method)) continue;
    const n = Number(v.amount);
    out.set(v.employeeId, (out.get(v.employeeId) ?? 0) + (Number.isFinite(n) ? n : 0));
  }
  return out;
}

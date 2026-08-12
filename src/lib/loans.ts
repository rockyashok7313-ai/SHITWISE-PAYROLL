/**
 * Employee loans: issue a loan, then recover it through the monthly `loan`
 * deduction that already exists on each attendance record.
 *
 * The key design decision is that there is NO separate repayment table. The
 * attendance grid has always had a `loan` column that subtracts from a
 * worker's net pay, and payroll already treats it as a deduction. Recording
 * repayments a second time would create two sources of truth that drift --
 * this codebase has been bitten by exactly that several times (the four pay
 * formulas, the duplicated net payout). So:
 *
 *     outstanding = (sum of loans issued) - (sum of `loan` deducted in attendance)
 *
 * A supervisor recovers a loan by typing an amount into the Loan (-) field
 * each month, exactly as before. The balance simply reflects it.
 */

export interface LoanRecord {
  id: string;
  employeeId?: string;
  /** Principal advanced to the worker. */
  amount?: number | string;
  issueDate?: string;
  remarks?: string;
  deletedAt?: string | null;
}

/** The shape this needs from an attendance row. */
export interface LoanRepaymentRow {
  id?: string;
  employeeRefId?: string;
  /** Amount recovered in that period. */
  loan?: number | string;
  deletedAt?: string | null;
}

export interface LoanBalance {
  /** Total principal advanced. */
  issued: number;
  /** Total recovered through attendance deductions. */
  repaid: number;
  /** issued - repaid. Never negative -- see `overpaid`. */
  outstanding: number;
  /** Amount recovered BEYOND the loan, if deductions exceeded what was lent.
   *  Surfaced rather than hidden: it usually means a deduction was entered
   *  against a loan that was already settled. */
  overpaid: number;
  /** True when there was a loan and it is now fully recovered. */
  isCleared: boolean;
  /** True when the worker never had a loan at all -- distinct from cleared. */
  hasNoLoan: boolean;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isLive(r: { deletedAt?: string | null }): boolean {
  return !r.deletedAt;
}

/** Employee id a repayment row belongs to, matching the app's usual fallback. */
function repaymentEmployeeId(row: LoanRepaymentRow): string {
  return row.employeeRefId || (row.id ? String(row.id).split('-')[0] : '');
}

/**
 * Loan position for one employee.
 *
 * Tombstoned loans and tombstoned attendance rows are both excluded, so
 * deleting either side updates the balance correctly.
 */
export function loanBalanceFor(
  employeeId: string,
  loans: LoanRecord[] | undefined,
  attendance: LoanRepaymentRow[] | undefined
): LoanBalance {
  const issued = (loans ?? [])
    .filter(l => isLive(l) && l.employeeId === employeeId)
    .reduce((sum, l) => sum + num(l.amount), 0);

  const repaid = (attendance ?? [])
    .filter(a => isLive(a) && repaymentEmployeeId(a) === employeeId)
    .reduce((sum, a) => sum + num(a.loan), 0);

  const net = issued - repaid;

  return {
    issued,
    repaid,
    outstanding: Math.max(0, net),
    overpaid: Math.max(0, -net),
    isCleared: issued > 0 && net <= 0,
    hasNoLoan: issued === 0,
  };
}

/** Balances for every employee who has ever had a loan, keyed by employee id. */
export function loanBalances(
  loans: LoanRecord[] | undefined,
  attendance: LoanRepaymentRow[] | undefined
): Map<string, LoanBalance> {
  const ids = new Set<string>();
  for (const l of loans ?? []) if (isLive(l) && l.employeeId) ids.add(l.employeeId);

  const out = new Map<string, LoanBalance>();
  for (const id of ids) out.set(id, loanBalanceFor(id, loans, attendance));
  return out;
}

/**
 * How much to recover this month: the smaller of the requested instalment and
 * what is actually still owed, so a deduction can never push a loan past
 * settled. Returns 0 when nothing is owed.
 */
export function cappedInstalment(requested: number | string, outstanding: number): number {
  const want = Math.max(0, num(requested));
  return Math.min(want, Math.max(0, outstanding));
}

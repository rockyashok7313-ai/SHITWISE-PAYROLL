/**
 * Shared payroll calculation.
 *
 * SINGLE SOURCE OF TRUTH. Every screen that shows a rupee figure -- the payroll
 * register, the payslip, the bonus calculator, the salary voucher -- must
 * compute it here.
 *
 * Before this module the app had four different formulas:
 *
 *   1. salary-vouchers.tsx  gross = days x (rate x shiftHours)
 *   2. payroll-reports.tsx  gross = days x (rate x shiftHours)   [register]
 *   3. payroll-reports.tsx  gross = days x rate                  [bonus calc -- MISSING
 *                                                                 the shift multiplier,
 *                                                                 so bonuses were computed
 *                                                                 on 1/9th or 1/12th of
 *                                                                 real earnings]
 *   4. lib/payroll-calculator.ts  gross = hours x rate           [accepted shiftType and
 *                                                                 ignored it; was dead code
 *                                                                 with tests asserting the
 *                                                                 wrong result -- DELETED]
 *
 * (1) and (2) agreed on the formula but disagreed on the fallbacks -- see
 * `calculateEntryBreakdown` below. This module resolves all four.
 *
 * If you change anything here, the change lands everywhere at once. That is the
 * point. Do not add a local variant in a component.
 */

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const LONG_SHIFT_LABEL = "12-hour";
export const LONG_SHIFT_HOURS = 12;
export const DEFAULT_SHIFT_HOURS = 9;

export interface AttendanceEntry {
  /** Preferred employee link. */
  employeeRefId?: string;
  /** Legacy link: either the bare employee id or "<employeeId>-<suffix>". */
  id?: string;
  /** Stored as YYYY-MM-DD. */
  date?: string;
  /** "12-hour" for a long shift. Falls back to the employee's default shift. */
  shift?: string;
  /**
   * Despite the name this is a DAY COUNT, not a clock-hour count -- it is
   * multiplied by a full day's salary below. 1 = full day, 0.5 = half day.
   * Renaming the field needs a data migration; until then, read this comment.
   */
  hours?: number;
  /** Per-hour rate for this entry. Falls back to the employee's default rate. */
  rate?: number;
  incentive?: number;
  weeklyAdvance?: number;
  loan?: number;
}

/** The employee-level values used when an attendance row does not carry its own. */
export interface EmployeeDefaults {
  rate: number;
  shift?: string;
}

export interface PayBreakdown {
  /** Rate actually applied (entry override, else the employee default). */
  rate: number;
  shiftHours: number;
  /** rate x shiftHours */
  perDaySalary: number;
  /** The `hours` field, named for what it actually holds. */
  days: number;
  gross: number;
  incentive: number;
  weeklyAdvance: number;
  loan: number;
  /** weeklyAdvance + loan */
  deductions: number;
  /** Rounded. gross + incentive - deductions. NOT clamped at zero. */
  net: number;
}

export function shiftHoursFor(shift?: string): number {
  return shift === LONG_SHIFT_LABEL ? LONG_SHIFT_HOURS : DEFAULT_SHIFT_HOURS;
}

/**
 * Full breakdown for one attendance entry.
 *
 * FALLBACK RULES -- the register and the voucher disagreed on both of these,
 * which is how the same employee could show two different figures:
 *
 *   shift: `entry.shift || defaults.shift`. The voucher used to read ONLY
 *     `entry.shift`, so an attendance row saved without a shift was paid at 9
 *     hours even for a 12-hour employee -- a 33% shortfall against the register,
 *     which already fell back to the employee's shift. The register's rule wins.
 *
 *   rate: `entry.rate || defaults.rate`, i.e. a zero or missing entry rate falls
 *     back to the employee rate. The voucher used to check `!== undefined`, so a
 *     row with rate 0 paid nothing while the register paid the employee's normal
 *     rate. A stored 0 is data entry meaning "not recorded", not "works for
 *     free". The register's rule wins here too.
 *
 * Both changes move the voucher onto the register's numbers, so vouchers are the
 * side that changes. Reconcile any in-flight vouchers before shipping.
 */
export function calculateEntryBreakdown(entry: AttendanceEntry, defaults: EmployeeDefaults): PayBreakdown {
  const rate = entry.rate || defaults.rate || 0;
  const shiftHours = shiftHoursFor(entry.shift || defaults.shift);
  const perDaySalary = rate * shiftHours;
  const days = entry.hours || 0;
  const gross = days * perDaySalary;

  const incentive = entry.incentive || 0;
  const weeklyAdvance = entry.weeklyAdvance || 0;
  const loan = entry.loan || 0;
  const deductions = weeklyAdvance + loan;

  return {
    rate,
    shiftHours,
    perDaySalary,
    days,
    gross,
    incentive,
    weeklyAdvance,
    loan,
    deductions,
    net: Math.round(gross + incentive - deductions)
  };
}

export function calculateEntryNet(entry: AttendanceEntry, defaults: EmployeeDefaults): number {
  return calculateEntryBreakdown(entry, defaults).net;
}

export interface PeriodTotals {
  entryCount: number;
  days: number;
  gross: number;
  incentive: number;
  weeklyAdvance: number;
  loan: number;
  deductions: number;
  /**
   * Sum of the PER-ENTRY rounded nets. Not clamped at zero -- deductions can
   * legitimately exceed gross. Clamp at the display layer if that is the policy.
   */
  net: number;
  /**
   * The same figure rounded ONCE at the end instead of per entry.
   *
   * These two can differ by a few rupees, and only `netRoundedOnce` reconciles
   * against the gross/incentive/deductions columns. The app currently uses `net`
   * everywhere. Pick ONE convention -- `net` if the total must equal the sum of
   * the daily rows a supervisor can tick off by hand, `netRoundedOnce` if it
   * must equal gross + incentive - deductions.
   */
  netRoundedOnce: number;
}

export function calculatePeriodTotals(entries: AttendanceEntry[], defaults: EmployeeDefaults): PeriodTotals {
  const totals: PeriodTotals = {
    entryCount: entries.length,
    days: 0,
    gross: 0,
    incentive: 0,
    weeklyAdvance: 0,
    loan: 0,
    deductions: 0,
    net: 0,
    netRoundedOnce: 0
  };

  for (const entry of entries) {
    const b = calculateEntryBreakdown(entry, defaults);
    totals.days += b.days;
    totals.gross += b.gross;
    totals.incentive += b.incentive;
    totals.weeklyAdvance += b.weeklyAdvance;
    totals.loan += b.loan;
    totals.deductions += b.deductions;
    totals.net += b.net;
  }

  totals.netRoundedOnce = Math.round(totals.gross + totals.incentive - totals.deductions);
  return totals;
}

export function calculateNetPay(entries: AttendanceEntry[], defaults: EmployeeDefaults): number {
  return calculatePeriodTotals(entries, defaults).net;
}

/* ------------------------------------------------------------------ */
/* Row selection                                                       */
/* ------------------------------------------------------------------ */

/**
 * Whether an attendance row belongs to an employee.
 *
 * The three screens each matched differently -- the voucher on `employeeRefId`
 * only, the register on a three-way fallback, the bonus calculator on `id`
 * alone -- so they operated on different row sets even before the formulas
 * diverged. This is the register's rule, which is the superset.
 */
export function matchesEmployee(entry: AttendanceEntry, employeeId: string): boolean {
  if (!employeeId) return false;
  if (entry.employeeRefId) return entry.employeeRefId === employeeId;
  if (entry.id === employeeId) return true;
  return !!entry.id && entry.id.split("-")[0] === employeeId;
}

/**
 * Calendar month/year of an entry, parsed rather than string-prefixed so a
 * non-zero-padded date ("2026-5-01") still matches.
 */
export function entryPeriod(entry: AttendanceEntry): { year: string; month: string } | null {
  if (!entry.date) return null;
  const parts = entry.date.split("-");
  if (parts.length < 3) return null;
  const monthIndex = parseInt(parts[1], 10) - 1;
  if (isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  return { year: parts[0], month: MONTHS[monthIndex] };
}

export function isInPeriod(entry: AttendanceEntry, monthName: string, year: string | number): boolean {
  const period = entryPeriod(entry);
  return !!period && period.month === monthName && period.year === `${year}`;
}

/**
 * Attendance rows for one employee in one month. Shared so no two screens can
 * disagree about which rows belong to a period.
 */
export function filterAttendanceForPeriod(
  attendance: AttendanceEntry[],
  employeeId: string,
  monthName: string,
  year: string | number
): AttendanceEntry[] {
  if (!attendance || !employeeId) return [];
  return attendance.filter(a => matchesEmployee(a, employeeId) && isInPeriod(a, monthName, year));
}

/* ------------------------------------------------------------------ */
/* Financial year                                                      */
/* ------------------------------------------------------------------ */

/**
 * The calendar month the financial year starts in, as a MONTHS index.
 *
 * October (index 9): the business runs an October -> September fiscal year, so
 * FY "2026-2027" spans October 2026 through September 2027.
 *
 * This is the SINGLE definition of the convention. yearForMonth derives from
 * it, and the bonus calculator, the register and the voucher period defaults
 * all go through yearForMonth -- there is deliberately no second copy of this
 * boundary to drift out of step. (Change this to 3 to switch back to an
 * April -> March year.)
 */
export const FISCAL_YEAR_START_MONTH_INDEX = 9; // October

/**
 * The calendar year a month falls in within a financial year.
 *
 * With an October -> September year, October/November/December belong to the
 * starting calendar year and January -> September to the ending one. So for
 * FY "2026-2027": December -> 2026, but April, July and September -> 2027.
 */
export function yearForMonth(monthName: string, financialYear: string): string {
  const [startStr, endStr] = (financialYear || "").split("-");
  const start = Number(startStr);
  if (!start) return `${new Date().getFullYear()}`;
  const end = Number(endStr) || start + 1;
  const monthIndex = MONTHS.indexOf(monthName);
  if (monthIndex < 0) return `${start}`;
  return monthIndex >= FISCAL_YEAR_START_MONTH_INDEX ? `${start}` : `${end}`;
}

/**
 * Calendar-year options for a period picker, generated around the active
 * financial year. Replaces the hardcoded ["2023".."2027"] lists, which would
 * have silently stopped offering the current year in 2028.
 */
export function yearOptions(financialYear: string): string[] {
  const start = Number((financialYear || "").split("-")[0]) || new Date().getFullYear();
  const years: string[] = [];
  for (let y = start - 3; y <= start + 2; y++) years.push(`${y}`);
  return years;
}

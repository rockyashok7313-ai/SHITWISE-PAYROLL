/**
 * Migrating v1 bonus ledgers.
 *
 * v1 ledgers were computed with a gross of `hours x rate`, omitting the
 * shift-hours multiplier every other screen applies, so their computed figures
 * understate earnings ninefold for 9-hour staff and twelvefold for 12-hour.
 *
 * The ledger also holds real user work -- hand-typed monthly salaries, custom
 * percentages, month inclusion toggles. Discarding the whole ledger throws that
 * away; keeping it whole reintroduces the wrong numbers. The functions here let
 * the two be told apart.
 *
 * These live outside the component so they can be tested. The classification in
 * particular decides whether someone's typed figure survives, which is not
 * something to verify by reading.
 */

import { MONTHS } from './payroll';

/** Months of the financial year that fall in its second calendar year. */
const SECOND_YEAR_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September'
];

/**
 * Which calendar year a month's attendance belongs to for the bonus ledger.
 *
 * NOTE: this treats January-September as the second year, i.e. a financial year
 * running October-September. That is a DIFFERENT convention from yearForMonth()
 * in ./payroll, which runs April-March. Both are preserved as they are on
 * purpose -- changing this one would change which months of attendance feed
 * each bonus year, silently altering every bonus figure. Reconcile the two
 * deliberately, not as a side effect.
 */
export function resolveBonusYear(monthName: string, year: string): string {
  if (!year.includes('-')) return year;
  const fyParts = year.split('-');
  return SECOND_YEAR_MONTHS.includes(monthName) ? fyParts[1] : fyParts[0];
}

/** Yearly total across only the months the user left ticked. */
export function sumIncludedMonths(
  salaries: Record<string, number>,
  includedMonths: string[]
): number {
  return MONTHS.reduce(
    (sum, m) => (includedMonths.includes(m) ? sum + (salaries[m] || 0) : sum),
    0
  );
}

export interface LegacyAttendanceLog {
  id?: string;
  date?: string;
  hours?: number;
  rate?: number;
  incentive?: number;
  weeklyAdvance?: number;
  loan?: number;
}

/**
 * Reproduces the PRE-FIX monthly figure exactly as a v1 ledger would have
 * stored it: gross = hours x rate with no shift multiplier, employee matched on
 * `id` alone, falling back to the default month salary when there are no logs.
 *
 * Its only purpose is classification -- see `isHandEdited`. Never use it to pay
 * anyone.
 */
export function legacyMonthlySalary(
  employeeId: string,
  attendance: LegacyAttendanceLog[],
  monthName: string,
  expectedYear: string,
  defaultMonthlySalary: number
): number {
  const logs = (attendance || []).filter(entry => {
    if (entry.id !== employeeId) return false;
    const parts = (entry.date || '').split('-');
    if (parts.length < 3) return false;
    return MONTHS[parseInt(parts[1], 10) - 1] === monthName && parts[0] === expectedYear;
  });

  if (logs.length === 0) return defaultMonthlySalary;

  const total = logs.reduce((sum, log) => {
    const gross = (log.hours || 0) * (log.rate || 0);
    return sum + gross + (log.incentive || 0) - (log.weeklyAdvance || 0) - (log.loan || 0);
  }, 0);

  return total > 0 ? total : defaultMonthlySalary;
}

/**
 * Whether a stored v1 cell was typed by a person rather than computed.
 *
 * v1 recorded no provenance, so a cell holding 5000 could be a figure someone
 * entered or the wrong computed value. Recomputing what v1 would have produced
 * and comparing is the only signal available: matching means computed, and
 * differing means edited.
 *
 * The failure mode is knowable and one-directional -- if someone happened to
 * type exactly the value v1 computed, their edit is indistinguishable from the
 * computed figure and gets replaced with the corrected one. That loses a
 * redundant edit, never a meaningful one.
 */
export function isHandEdited(
  storedValue: unknown,
  employeeId: string,
  attendance: LegacyAttendanceLog[],
  monthName: string,
  expectedYear: string,
  defaultMonthlySalary: number
): storedValue is number {
  if (typeof storedValue !== 'number') return false;
  return storedValue !== legacyMonthlySalary(
    employeeId,
    attendance,
    monthName,
    expectedYear,
    defaultMonthlySalary
  );
}

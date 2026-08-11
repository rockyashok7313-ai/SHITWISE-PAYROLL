/**
 * Which month + year an attendance row belongs to, for scoping the
 * attendance logger's view to a single selected period.
 *
 * Pulled out of the component so it can be tested directly -- this is
 * exactly the logic that replaced the logger's old behaviour of rewriting
 * every row's date to match whatever month was currently selected (which is
 * what made a genuinely empty month show, and then persist, the previous
 * month's attendance instead of appearing blank).
 */

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * entry.date is usually "YYYY-MM-DD" but can also be a range like
 * "YYYY-MM-DD to YYYY-MM-DD" (multi-day entries). Taking the text before the
 * first space handles both, using the range's start date.
 */
export function entryYearMonth(dateStr: string): { year: string; month: string } | null {
  if (!dateStr) return null;
  const parts = dateStr.split(' ')[0].split('-');
  if (parts.length < 2) return null;
  const monthIndex = parseInt(parts[1], 10) - 1;
  if (isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  return { year: parts[0], month: MONTHS[monthIndex] };
}

export function isInSelectedPeriod(entry: { date: string }, selectedMonth: string, selectedYear: string): boolean {
  const ym = entryYearMonth(entry.date);
  return !!ym && ym.month === selectedMonth && ym.year === selectedYear;
}

/**
 * Last calendar day of a given month (1 = January), e.g. lastDayOfMonth(2027, 2) -> 28.
 * `new Date(year, month, 0)` rolls back from day 0 of the FOLLOWING month to
 * the last day of the target one -- handles 30 vs 31-day months and leap
 * years for free, without a lookup table.
 */
export function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

/**
 * The default payroll period the attendance screen opens to (period
 * selector, and therefore Add Attendance's date range) -- the PREVIOUS
 * calendar month, not the current one.
 *
 * This is a confirmed arrears workflow: attendance for a month is finalised
 * and processed the following month (e.g. opening the screen in August
 * should default to July, the month actually being processed). An earlier
 * version of this function defaulted to the current calendar month instead;
 * that was reverted after direct confirmation that arrears is the correct
 * behaviour here -- do not "fix" this back to the current month without
 * re-confirming, the two have been swapped once already.
 *
 * Only the DEFAULT changes. Editing an existing entry always shows that
 * entry's real stored date regardless of this function -- this never
 * overrides actual data, only what a fresh screen load opens to.
 *
 * `now` is injectable so this is actually testable, not just true by
 * inspection.
 */
export function currentPayrollPeriod(now: () => Date = () => new Date()): { month: string; year: string } {
  const date = now();
  // Day 1 deliberately, not date.getDate(): every month has a 1st, so this
  // can never overflow. Subtracting the month via date.setMonth() on the
  // ORIGINAL day instead would break on the 29th-31st -- e.g. Dec 31 minus
  // one month lands back on Dec 1, not November, because November has only
  // 30 days and Date silently rolls the overflow into the next month rather
  // than clamping. new Date(year, month, 1) also correctly rolls the YEAR
  // back for January (month index -1 normalises to December of the prior
  // year), so no separate year-boundary check is needed either.
  const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return { month: MONTHS[prev.getMonth()], year: prev.getFullYear().toString() };
}

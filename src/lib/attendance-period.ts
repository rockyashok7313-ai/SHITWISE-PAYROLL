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

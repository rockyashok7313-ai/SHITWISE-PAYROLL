import { describe, it, expect } from 'vitest';
import { entryYearMonth, isInSelectedPeriod, lastDayOfMonth, currentPayrollPeriod, MONTHS } from '../../src/lib/attendance-period';

/**
 * This is the period-scoping logic that replaced the attendance logger's old
 * behaviour of rewriting every entry's date to match whatever month was
 * currently selected (which is what made a genuinely empty month show, and
 * persist, the previous month's attendance). These functions decide which
 * rows belong to the page you're looking at, without touching the data.
 */

describe('entryYearMonth', () => {
  it('parses a clean YYYY-MM-DD date', () => {
    expect(entryYearMonth('2027-06-15')).toEqual({ year: '2027', month: 'June' });
  });

  it('takes the start date from a "YYYY-MM-DD to YYYY-MM-DD" range', () => {
    // handleAddAttendance stores multi-day entries this way.
    expect(entryYearMonth('2027-06-01 to 2027-06-15')).toEqual({ year: '2027', month: 'June' });
  });

  it('handles January and December at the boundaries', () => {
    expect(entryYearMonth('2027-01-05')?.month).toBe('January');
    expect(entryYearMonth('2027-12-25')?.month).toBe('December');
  });

  it('returns null for empty, malformed, or out-of-range input', () => {
    expect(entryYearMonth('')).toBeNull();
    expect(entryYearMonth('2027')).toBeNull();
    expect(entryYearMonth('not-a-date')).toBeNull();
    expect(entryYearMonth('2027-13-01')).toBeNull();
    expect(entryYearMonth('2027-00-01')).toBeNull();
  });

  it('does not throw on a user-typed garbage date (the raw date field is free text)', () => {
    expect(() => entryYearMonth('whatever the user typed')).not.toThrow();
  });
});

describe('isInSelectedPeriod', () => {
  it('matches an entry to the month and year it actually belongs to', () => {
    expect(isInSelectedPeriod({ date: '2027-06-15' }, 'June', '2027')).toBe(true);
  });

  it('rejects a different month in the same year', () => {
    expect(isInSelectedPeriod({ date: '2027-05-15' }, 'June', '2027')).toBe(false);
  });

  it('rejects the same month in a different year -- the actual regression case', () => {
    // Before the fix, switching months rewrote a record's date to match
    // whatever was selected; this is the check that now keeps a June 2026
    // record out of the June 2027 view instead of forcing it in.
    expect(isInSelectedPeriod({ date: '2026-06-15' }, 'June', '2027')).toBe(false);
  });

  it('excludes a record with no parseable date rather than showing it everywhere', () => {
    expect(isInSelectedPeriod({ date: '' }, 'June', '2027')).toBe(false);
    expect(isInSelectedPeriod({ date: 'garbage' }, 'June', '2027')).toBe(false);
  });

  it('a genuinely empty month has nothing match it', () => {
    // The actual bug report: a brand-new month should show blank, not
    // inherit the previous month's rows.
    const priorMonthOnly = [{ date: '2027-05-10' }, { date: '2027-05-20' }];
    const matches = priorMonthOnly.filter(e => isInSelectedPeriod(e, 'June', '2027'));
    expect(matches).toHaveLength(0);
  });
});

describe('lastDayOfMonth', () => {
  it('gives 31 for the 31-day months', () => {
    for (const m of [1, 3, 5, 7, 8, 10, 12]) expect(lastDayOfMonth(2027, m)).toBe(31);
  });

  it('gives 30 for the 30-day months', () => {
    for (const m of [4, 6, 9, 11]) expect(lastDayOfMonth(2027, m)).toBe(30);
  });

  it('gives 28 for February in a non-leap year', () => {
    expect(lastDayOfMonth(2027, 2)).toBe(28);
  });

  it('gives 29 for February in a leap year', () => {
    expect(lastDayOfMonth(2028, 2)).toBe(29);   // 2028 is a leap year
    expect(lastDayOfMonth(2000, 2)).toBe(29);   // divisible by 400 -- leap
    expect(lastDayOfMonth(1900, 2)).toBe(28);   // divisible by 100 not 400 -- not leap
  });
});

describe('currentPayrollPeriod', () => {
  it('gives the CURRENT month, not the previous one -- the reported bug', () => {
    // Opening the attendance screen in August used to default the whole
    // period (and Add Attendance's date range) to July.
    const inAugust = () => new Date(2027, 7, 15); // JS months are 0-indexed: 7 = August
    expect(currentPayrollPeriod(inAugust)).toEqual({ month: 'August', year: '2027' });
  });

  it('is correct at both ends of the year, where an off-by-one would roll into the wrong year', () => {
    const inJanuary = () => new Date(2027, 0, 1);
    expect(currentPayrollPeriod(inJanuary)).toEqual({ month: 'January', year: '2027' });

    const inDecember = () => new Date(2027, 11, 31);
    expect(currentPayrollPeriod(inDecember)).toEqual({ month: 'December', year: '2027' });
  });

  it('defaults to the real current date when no clock is injected', () => {
    const now = new Date();
    expect(currentPayrollPeriod()).toEqual({
      month: MONTHS[now.getMonth()],
      year: now.getFullYear().toString(),
    });
  });
});

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
  // Confirmed arrears workflow: attendance for a month is processed the
  // FOLLOWING month, so the screen should default to last month, not the
  // current calendar one. (An earlier version of this test asserted the
  // opposite -- current-month defaulting -- which was tried and then
  // reverted after direct confirmation this is the intended behaviour.)

  it('gives the PREVIOUS month, not the current one', () => {
    const inAugust = () => new Date(2027, 7, 15); // JS months are 0-indexed: 7 = August
    expect(currentPayrollPeriod(inAugust)).toEqual({ month: 'July', year: '2027' });
  });

  it('rolls back a calendar year in January -- the previous month is last December', () => {
    const inJanuary = () => new Date(2027, 0, 15);
    expect(currentPayrollPeriod(inJanuary)).toEqual({ month: 'December', year: '2026' });
  });

  it('does not roll the year back anywhere else', () => {
    const inDecember = () => new Date(2027, 11, 31);
    expect(currentPayrollPeriod(inDecember)).toEqual({ month: 'November', year: '2027' });
  });

  it('is correct on the 29th-31st, where a naive "subtract a month" overflows into the wrong month', () => {
    // The bug this guards: date.setMonth(date.getMonth() - 1) on a day that
    // doesn't exist in the target month rolls FORWARD past it instead of
    // clamping. E.g. Dec 31 minus one month landed back on Dec 1, not
    // November, because November only has 30 days.
    expect(currentPayrollPeriod(() => new Date(2027, 0, 31))).toEqual({ month: 'December', year: '2026' }); // Jan 31 -> Dec
    expect(currentPayrollPeriod(() => new Date(2027, 2, 31))).toEqual({ month: 'February', year: '2027' }); // Mar 31 -> Feb (28 days)
    expect(currentPayrollPeriod(() => new Date(2028, 2, 31))).toEqual({ month: 'February', year: '2028' }); // Mar 31 -> Feb, leap year (29 days)
    expect(currentPayrollPeriod(() => new Date(2027, 4, 31))).toEqual({ month: 'April', year: '2027' });    // May 31 -> Apr (30 days)
  });

  it('defaults to one month before the real current date when no clock is injected', () => {
    const now = new Date();
    const expected = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    expect(currentPayrollPeriod()).toEqual({
      month: MONTHS[expected.getMonth()],
      year: expected.getFullYear().toString(),
    });
  });
});

import { describe, it, expect } from 'vitest';
import { entryYearMonth, isInSelectedPeriod } from '../../src/lib/attendance-period';

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

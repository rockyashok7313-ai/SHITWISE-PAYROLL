import { describe, it, expect } from 'vitest';
import type { AttendanceEntry } from '../../src/lib/payroll';
import {
  MONTHS,
  shiftHoursFor,
  calculateEntryBreakdown,
  calculateEntryNet,
  calculatePeriodTotals,
  calculateNetPay,
  matchesEmployee,
  entryPeriod,
  isInPeriod,
  filterAttendanceForPeriod,
  yearForMonth,
  yearOptions,
  perDaySalary,
  monthlySalary,
  rateFromMonthlySalary,
  rateFromPerDaySalary,
  MONTHLY_WORKING_DAYS
} from '../../src/lib/payroll';

/**
 * These tests pin the shared payroll calculation.
 *
 * The `regressions` block at the bottom is the important part: each case there
 * corresponds to a formula that was live in the app and produced a different
 * rupee figure from the others. If one of those fails, two screens have started
 * disagreeing about someone's pay again.
 */

describe('shiftHoursFor', () => {
  it('treats "12-hour" as a long shift', () => {
    expect(shiftHoursFor('12-hour')).toBe(12);
  });

  it('defaults to 9 hours for anything else', () => {
    expect(shiftHoursFor('9-hour')).toBe(9);
    expect(shiftHoursFor(undefined)).toBe(9);
    expect(shiftHoursFor('')).toBe(9);
    expect(shiftHoursFor('night')).toBe(9);
  });
});

describe('calculateEntryBreakdown', () => {
  it('computes gross as days x rate x shift hours', () => {
    const b = calculateEntryBreakdown({ hours: 26, rate: 100 }, { rate: 100 });

    expect(b.shiftHours).toBe(9);
    expect(b.perDaySalary).toBe(900);
    expect(b.days).toBe(26);
    expect(b.gross).toBe(23400);
  });

  it('pays a 12-hour shift at 12 hours per day', () => {
    const b = calculateEntryBreakdown({ hours: 26, rate: 100, shift: '12-hour' }, { rate: 100 });

    expect(b.perDaySalary).toBe(1200);
    expect(b.gross).toBe(31200);
  });

  it('handles a half day', () => {
    const b = calculateEntryBreakdown({ hours: 0.5, rate: 100 }, { rate: 100 });
    expect(b.gross).toBe(450);
  });

  it('adds incentive and subtracts advance and loan', () => {
    const b = calculateEntryBreakdown(
      { hours: 1, rate: 100, incentive: 200, weeklyAdvance: 300, loan: 100 },
      { rate: 100 }
    );

    expect(b.gross).toBe(900);
    expect(b.incentive).toBe(200);
    expect(b.deductions).toBe(400);
    expect(b.net).toBe(700);
  });

  it('rounds the net to the nearest rupee', () => {
    // 0.5 days x 1/hr x 9h = 4.5
    const b = calculateEntryBreakdown({ hours: 0.5, rate: 1 }, { rate: 1 });

    expect(b.gross).toBe(4.5);
    expect(b.net).toBe(5);
  });

  it('does not clamp a negative net', () => {
    // Deductions exceeding gross is a real case -- the balance carries forward.
    // Clamping is a display decision, not a calculation one.
    const b = calculateEntryBreakdown({ hours: 1, rate: 100, loan: 2000 }, { rate: 100 });
    expect(b.net).toBe(-1100);
  });

  it('treats every missing money field as zero', () => {
    const b = calculateEntryBreakdown({}, { rate: 100 });

    expect(b.days).toBe(0);
    expect(b.gross).toBe(0);
    expect(b.incentive).toBe(0);
    expect(b.deductions).toBe(0);
    expect(b.net).toBe(0);
  });

  describe('rate resolution', () => {
    it('prefers the rate stored on the entry', () => {
      const b = calculateEntryBreakdown({ hours: 1, rate: 150 }, { rate: 100 });
      expect(b.rate).toBe(150);
      expect(b.gross).toBe(1350);
    });

    it('falls back to the employee rate when the entry has none', () => {
      const b = calculateEntryBreakdown({ hours: 1 }, { rate: 100 });
      expect(b.rate).toBe(100);
      expect(b.gross).toBe(900);
    });

    it('treats a stored rate of 0 as "not recorded" and falls back', () => {
      // A 0 in this column is data entry meaning "blank", not "works for free".
      const b = calculateEntryBreakdown({ hours: 1, rate: 0 }, { rate: 100 });
      expect(b.rate).toBe(100);
      expect(b.gross).toBe(900);
    });

    it('yields zero when neither the entry nor the employee has a rate', () => {
      const b = calculateEntryBreakdown({ hours: 5 }, { rate: 0 });
      expect(b.rate).toBe(0);
      expect(b.gross).toBe(0);
    });
  });

  describe('shift resolution', () => {
    it('prefers the shift stored on the entry', () => {
      const b = calculateEntryBreakdown(
        { hours: 1, rate: 100, shift: '12-hour' },
        { rate: 100, shift: '9-hour' }
      );
      expect(b.shiftHours).toBe(12);
    });

    it('falls back to the employee shift when the entry has none', () => {
      const b = calculateEntryBreakdown({ hours: 1, rate: 100 }, { rate: 100, shift: '12-hour' });
      expect(b.shiftHours).toBe(12);
      expect(b.gross).toBe(1200);
    });

    it('defaults to 9 hours when neither carries a shift', () => {
      const b = calculateEntryBreakdown({ hours: 1, rate: 100 }, { rate: 100 });
      expect(b.shiftHours).toBe(9);
    });
  });
});

describe('calculateEntryNet', () => {
  it('returns the net from the full breakdown', () => {
    const entry: AttendanceEntry = { hours: 2, rate: 100, incentive: 50, loan: 25 };
    const defaults = { rate: 100 };

    expect(calculateEntryNet(entry, defaults)).toBe(calculateEntryBreakdown(entry, defaults).net);
    expect(calculateEntryNet(entry, defaults)).toBe(1825); // 1800 + 50 - 25
  });
});

describe('calculatePeriodTotals', () => {
  it('aggregates every column across entries', () => {
    const entries: AttendanceEntry[] = [
      { hours: 10, rate: 100, incentive: 500, weeklyAdvance: 200 },
      { hours: 5, rate: 100, loan: 1000 }
    ];

    const t = calculatePeriodTotals(entries, { rate: 100 });

    expect(t.entryCount).toBe(2);
    expect(t.days).toBe(15);
    expect(t.gross).toBe(13500);
    expect(t.incentive).toBe(500);
    expect(t.weeklyAdvance).toBe(200);
    expect(t.loan).toBe(1000);
    expect(t.deductions).toBe(1200);
    expect(t.net).toBe(12800);
  });

  it('returns zeroes for an empty period', () => {
    const t = calculatePeriodTotals([], { rate: 100 });

    expect(t.entryCount).toBe(0);
    expect(t.days).toBe(0);
    expect(t.gross).toBe(0);
    expect(t.net).toBe(0);
    expect(t.netRoundedOnce).toBe(0);
  });

  it('exposes the two rounding conventions, which can disagree', () => {
    // Two entries of 4.5 each. Rounding per entry gives 5 + 5 = 10;
    // rounding the sum once gives round(9) = 9. Only `netRoundedOnce`
    // reconciles against the gross column.
    const entries: AttendanceEntry[] = [
      { hours: 0.5, rate: 1 },
      { hours: 0.5, rate: 1 }
    ];

    const t = calculatePeriodTotals(entries, { rate: 1 });

    expect(t.gross).toBe(9);
    expect(t.net).toBe(10);
    expect(t.netRoundedOnce).toBe(9);
  });

  it('does not clamp a negative period net', () => {
    const t = calculatePeriodTotals([{ hours: 1, rate: 100, loan: 5000 }], { rate: 100 });
    expect(t.net).toBe(-4100);
  });
});

describe('calculateNetPay', () => {
  it('matches the net from calculatePeriodTotals', () => {
    const entries: AttendanceEntry[] = [
      { hours: 26, rate: 100, shift: '12-hour', incentive: 1000, weeklyAdvance: 2000 }
    ];

    expect(calculateNetPay(entries, { rate: 100 })).toBe(
      calculatePeriodTotals(entries, { rate: 100 }).net
    );
    expect(calculateNetPay(entries, { rate: 100 })).toBe(30200); // 31200 + 1000 - 2000
  });
});

describe('matchesEmployee', () => {
  it('matches on employeeRefId', () => {
    expect(matchesEmployee({ employeeRefId: 'E1' }, 'E1')).toBe(true);
    expect(matchesEmployee({ employeeRefId: 'E2' }, 'E1')).toBe(false);
  });

  it('lets employeeRefId win over id when both are present', () => {
    // Otherwise a re-linked row would be counted for both employees.
    expect(matchesEmployee({ employeeRefId: 'E2', id: 'E1' }, 'E1')).toBe(false);
    expect(matchesEmployee({ employeeRefId: 'E2', id: 'E1' }, 'E2')).toBe(true);
  });

  it('falls back to an exact id match', () => {
    expect(matchesEmployee({ id: 'E1' }, 'E1')).toBe(true);
  });

  it('falls back to the id prefix for legacy composite ids', () => {
    expect(matchesEmployee({ id: 'E1-2026-05-14' }, 'E1')).toBe(true);
    expect(matchesEmployee({ id: 'E12-2026-05-14' }, 'E1')).toBe(false);
  });

  it('never matches an empty employee id or an unlinked row', () => {
    expect(matchesEmployee({ id: 'E1' }, '')).toBe(false);
    expect(matchesEmployee({}, 'E1')).toBe(false);
  });
});

describe('entryPeriod', () => {
  it('reads a zero-padded date', () => {
    expect(entryPeriod({ date: '2026-05-14' })).toEqual({ year: '2026', month: 'May' });
  });

  it('reads a date that is not zero-padded', () => {
    // startsWith("2026-05") missed these; parsing does not.
    expect(entryPeriod({ date: '2026-5-14' })).toEqual({ year: '2026', month: 'May' });
  });

  it('handles January and December at the boundaries', () => {
    expect(entryPeriod({ date: '2026-01-01' })?.month).toBe('January');
    expect(entryPeriod({ date: '2026-12-31' })?.month).toBe('December');
  });

  it('returns null for unusable dates', () => {
    expect(entryPeriod({})).toBeNull();
    expect(entryPeriod({ date: '' })).toBeNull();
    expect(entryPeriod({ date: '2026-05' })).toBeNull();
    expect(entryPeriod({ date: '2026-13-01' })).toBeNull();
    expect(entryPeriod({ date: '2026-00-01' })).toBeNull();
    expect(entryPeriod({ date: 'not-a-date' })).toBeNull();
  });
});

describe('isInPeriod', () => {
  it('matches on month name and year', () => {
    expect(isInPeriod({ date: '2026-05-14' }, 'May', '2026')).toBe(true);
    expect(isInPeriod({ date: '2026-05-14' }, 'June', '2026')).toBe(false);
    expect(isInPeriod({ date: '2025-05-14' }, 'May', '2026')).toBe(false);
  });

  it('accepts the year as a number', () => {
    expect(isInPeriod({ date: '2026-05-14' }, 'May', 2026)).toBe(true);
  });

  it('is false for an entry with no usable date', () => {
    expect(isInPeriod({}, 'May', '2026')).toBe(false);
  });
});

describe('filterAttendanceForPeriod', () => {
  const attendance: AttendanceEntry[] = [
    { employeeRefId: 'E1', date: '2026-05-01', hours: 1 },
    { employeeRefId: 'E1', date: '2026-05-20', hours: 1 },
    { employeeRefId: 'E1', date: '2026-06-01', hours: 1 },  // wrong month
    { employeeRefId: 'E2', date: '2026-05-05', hours: 1 },  // wrong employee
    { id: 'E1-2026-05-09', date: '2026-05-09', hours: 1 },  // legacy link
    { employeeRefId: 'E1', hours: 1 }                        // no date
  ];

  it('returns only the rows for that employee in that month', () => {
    const rows = filterAttendanceForPeriod(attendance, 'E1', 'May', '2026');

    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.date)).toEqual(['2026-05-01', '2026-05-20', '2026-05-09']);
  });

  it('returns an empty array for a period with no rows', () => {
    expect(filterAttendanceForPeriod(attendance, 'E1', 'January', '2026')).toEqual([]);
  });

  it('returns an empty array for missing inputs', () => {
    expect(filterAttendanceForPeriod(attendance, '', 'May', '2026')).toEqual([]);
    expect(filterAttendanceForPeriod(undefined as any, 'E1', 'May', '2026')).toEqual([]);
  });
});

describe('yearForMonth', () => {
  // The fiscal year runs October -> September (see FISCAL_YEAR_START_MONTH_INDEX).
  it('puts October through December in the starting calendar year', () => {
    expect(yearForMonth('October', '2026-2027')).toBe('2026');
    expect(yearForMonth('November', '2026-2027')).toBe('2026');
    expect(yearForMonth('December', '2026-2027')).toBe('2026');
  });

  it('puts January through September in the ending calendar year', () => {
    expect(yearForMonth('January', '2026-2027')).toBe('2027');
    expect(yearForMonth('March', '2026-2027')).toBe('2027');
    // April..September sit in the ending year too -- this is the point of the
    // October->September convention, and where it differs from April->March.
    expect(yearForMonth('April', '2026-2027')).toBe('2027');
    expect(yearForMonth('July', '2026-2027')).toBe('2027');
    expect(yearForMonth('September', '2026-2027')).toBe('2027');
  });

  it('derives the end year (start + 1) when the financial year is a single year', () => {
    expect(yearForMonth('October', '2026')).toBe('2026');
    expect(yearForMonth('January', '2026')).toBe('2027');
    expect(yearForMonth('April', '2026')).toBe('2027');
  });

  it('falls back to the current year for an unusable financial year', () => {
    const thisYear = String(new Date().getFullYear());
    expect(yearForMonth('April', '')).toBe(thisYear);
    expect(yearForMonth('April', 'not-a-year')).toBe(thisYear);
  });

  it('treats an unknown month as the starting calendar year', () => {
    expect(yearForMonth('Smarch', '2026-2027')).toBe('2026');
  });
});

describe('yearOptions', () => {
  it('spans three years back to two years forward from the financial year start', () => {
    expect(yearOptions('2026-2027')).toEqual(['2023', '2024', '2025', '2026', '2027', '2028']);
  });

  it('always includes the financial year start and the year after it', () => {
    const years = yearOptions('2026-2027');
    expect(years).toContain('2026');
    expect(years).toContain('2027');
  });

  it('centres on the current year when the financial year is unusable', () => {
    const now = new Date().getFullYear();
    expect(yearOptions('')).toContain(String(now));
    expect(yearOptions('not-a-year')).toContain(String(now));
  });

  it('moves with the financial year rather than being frozen', () => {
    // The hardcoded ["2023".."2027"] lists would not have offered 2030.
    expect(yearOptions('2030-2031')).toContain('2030');
    expect(yearOptions('2030-2031')).not.toContain('2023');
  });
});

describe('regressions', () => {
  /* Each case below was a live formula in the app that disagreed with the
   * others. The comment names where it lived. */

  it('bonus calculator: gross must include the shift-hours multiplier', () => {
    // payroll-reports.tsx computed `gross = log.hours * log.rate`, omitting
    // shift hours -- so bonuses were calculated on 1/9th of real earnings.
    const b = calculateEntryBreakdown({ hours: 26, rate: 100 }, { rate: 100 });

    expect(b.gross).toBe(23400);
    expect(b.gross).not.toBe(2600); // the old, unmultiplied figure
  });

  it('voucher: an entry without a shift uses the employee shift, not 9 hours', () => {
    // salary-vouchers.tsx read only `entry.shift`, so a row saved without one
    // paid a 12-hour employee at 9 hours -- a 33% shortfall vs the register.
    const b = calculateEntryBreakdown({ hours: 26, rate: 100 }, { rate: 100, shift: '12-hour' });

    expect(b.gross).toBe(31200);
    expect(b.gross).not.toBe(23400); // what the voucher used to pay
  });

  it('voucher: an entry rate of 0 falls back to the employee rate', () => {
    // salary-vouchers.tsx checked `entry.rate !== undefined`, so a row storing
    // 0 paid nothing while the register paid the employee's normal rate.
    const b = calculateEntryBreakdown({ hours: 26, rate: 0 }, { rate: 100 });

    expect(b.gross).toBe(23400);
    expect(b.gross).not.toBe(0); // what the voucher used to pay
  });

  it('voucher: rows linked by legacy id are not dropped', () => {
    // salary-vouchers.tsx matched on `employeeRefId` only, so it silently
    // skipped rows the register counted.
    expect(matchesEmployee({ id: 'E1-2026-05-14' }, 'E1')).toBe(true);
  });

  it('all three screens produce one figure for the same period', () => {
    // Same employee, same month, rows linked both ways and with the shift and
    // rate left off individual entries -- every fallback exercised at once.
    const attendance: AttendanceEntry[] = [
      { employeeRefId: 'E1', date: '2026-05-01', hours: 10, rate: 100, shift: '12-hour' },
      { employeeRefId: 'E1', date: '2026-05-11', hours: 10 },              // no rate, no shift
      { id: 'E1-2026-05-21', date: '2026-05-21', hours: 6, rate: 0 }       // legacy link, rate 0
    ];
    const defaults = { rate: 100, shift: '12-hour' };

    const rows = filterAttendanceForPeriod(attendance, 'E1', 'May', '2026');
    expect(rows).toHaveLength(3);

    // Every row resolves to 100/hr x 12h = 1200/day.
    const totals = calculatePeriodTotals(rows, defaults);
    expect(totals.days).toBe(26);
    expect(totals.gross).toBe(31200);
    expect(totals.net).toBe(31200);

    // The voucher path and the register path are the same number.
    expect(calculateNetPay(rows, defaults)).toBe(totals.net);
  });
});

describe('MONTHS', () => {
  it('is a 12-month list ordered so index + 1 is the calendar month number', () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe('January');
    expect(MONTHS[11]).toBe('December');
    expect(MONTHS.indexOf('May') + 1).toBe(5);
  });
});

describe('salary conversions (hourly <-> per-day <-> monthly)', () => {
  it('per-day is the hourly rate times the shift hours', () => {
    expect(perDaySalary(300, '12-hour')).toBe(3600);
    expect(perDaySalary(300, '9-hour')).toBe(2700);
  });

  it('monthly is per-day times the standard working days', () => {
    // The screenshot case: Rs300/hr on a 12-hour shift.
    expect(MONTHLY_WORKING_DAYS).toBe(26);
    expect(monthlySalary(300, '12-hour')).toBe(93600); // 3600 * 26
    expect(monthlySalary(300, '9-hour')).toBe(70200);  // 2700 * 26
  });

  it('round-trips: entering a monthly salary yields a rate that reproduces it', () => {
    // This is what makes the field two-way and trustworthy.
    for (const shift of ['9-hour', '12-hour']) {
      const rate = rateFromMonthlySalary(93600, shift);
      expect(monthlySalary(rate, shift)).toBeCloseTo(93600, 6);
    }
  });

  it('accepts numeric strings straight from the form input', () => {
    expect(perDaySalary('300', '12-hour')).toBe(3600);
    expect(monthlySalary('300', '12-hour')).toBe(93600);
    expect(rateFromMonthlySalary('93600', '12-hour')).toBe(300);
  });

  it('treats blank or unusable input as zero rather than NaN', () => {
    expect(perDaySalary('', '12-hour')).toBe(0);
    expect(monthlySalary(undefined as any, '12-hour')).toBe(0);
    expect(rateFromMonthlySalary('abc', '12-hour')).toBe(0);
  });

  it('defaults to the 9-hour shift when none is given, like the rest of payroll', () => {
    expect(perDaySalary(100)).toBe(900);
    expect(monthlySalary(100)).toBe(23400);
  });
});

describe('rateFromPerDaySalary', () => {
  // The factory's real figures: Rs.620/day before the increment, Rs.675 after.
  it('converts a 12-hour day rate to an hourly rate', () => {
    expect(rateFromPerDaySalary(620, '12-hour')).toBeCloseTo(51.6667, 4);
    expect(rateFromPerDaySalary(675, '12-hour')).toBe(56.25);
  });

  it('converts a 9-hour day rate to an hourly rate', () => {
    expect(rateFromPerDaySalary(450, '9-hour')).toBe(50);
  });

  it('defaults to the 9-hour shift when none is given', () => {
    expect(rateFromPerDaySalary(450)).toBe(50);
  });

  it('round-trips exactly through perDaySalary', () => {
    for (const shift of ['9-hour', '12-hour']) {
      for (const perDay of [450, 500, 620, 675, 1000, 1785]) {
        expect(perDaySalary(rateFromPerDaySalary(perDay, shift), shift)).toBeCloseTo(perDay, 9);
      }
    }
  });

  it('accepts a numeric string straight from the form input', () => {
    expect(rateFromPerDaySalary('675', '12-hour')).toBe(56.25);
  });

  it('treats an unusable amount as zero rather than NaN', () => {
    expect(rateFromPerDaySalary('abc', '12-hour')).toBe(0);
    expect(rateFromPerDaySalary(undefined as any, '12-hour')).toBe(0);
    expect(rateFromPerDaySalary('', '12-hour')).toBe(0);
  });

  it('a day rate entered in the dialog produces the gross the register will show', () => {
    // What the supervisor types -> what payroll computes, end to end.
    const rate = rateFromPerDaySalary(620, '12-hour');
    const pay = calculateEntryBreakdown(
      { hours: 26, rate, shift: '12-hour', incentive: 0, weeklyAdvance: 0, loan: 0 },
      { rate, shift: '12-hour' }
    );
    expect(pay.perDaySalary).toBe(620);
    expect(pay.gross).toBe(16120);
    expect(pay.net).toBe(16120);
  });
});

import { describe, it, expect } from 'vitest';
import type { LegacyAttendanceLog } from '../../src/lib/bonus-migration';
import {
  sumIncludedMonths,
  legacyMonthlySalary,
  isHandEdited
} from '../../src/lib/bonus-migration';

/**
 * These cover the v1 bonus ledger migration. The classification decides whether
 * a figure someone typed survives the upgrade or is overwritten, so it is
 * tested rather than eyeballed.
 */

const DEFAULT_MONTHLY = 23400; // 26 days x 100/hr x 9h

/* The bonus month -> year mapping is now yearForMonth in @/lib/payroll, tested
 * in payroll.test.ts. The bonus view and the register share one convention
 * (October -> September), so there is no separate resolveBonusYear to test. */

describe('sumIncludedMonths', () => {
  const salaries: Record<string, number> = {
    January: 100, February: 200, March: 300, April: 400, May: 500, June: 600,
    July: 700, August: 800, September: 900, October: 1000, November: 1100, December: 1200
  };

  it('sums every month when all are included', () => {
    expect(sumIncludedMonths(salaries, [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ])).toBe(7800);
  });

  it('counts only the ticked months', () => {
    expect(sumIncludedMonths(salaries, ['January', 'March'])).toBe(400);
  });

  it('returns zero when nothing is included', () => {
    expect(sumIncludedMonths(salaries, [])).toBe(0);
  });

  it('ignores month names that are not real months', () => {
    expect(sumIncludedMonths(salaries, ['January', 'Smarch'])).toBe(100);
  });

  it('treats a missing month as zero rather than NaN', () => {
    expect(sumIncludedMonths({ January: 100 }, ['January', 'February'])).toBe(100);
  });
});

describe('legacyMonthlySalary', () => {
  const attendance: LegacyAttendanceLog[] = [
    { id: 'E1', date: '2026-05-10', hours: 10, rate: 100 },
    { id: 'E1', date: '2026-05-20', hours: 16, rate: 100 }
  ];

  it('reproduces the v1 formula: hours x rate, no shift multiplier', () => {
    // 26 days x 100 = 2600, NOT 26 x 100 x 9 = 23400.
    expect(legacyMonthlySalary('E1', attendance, 'May', '2026', DEFAULT_MONTHLY)).toBe(2600);
  });

  it('applies incentive and deductions the way v1 did', () => {
    const logs: LegacyAttendanceLog[] = [
      { id: 'E1', date: '2026-05-10', hours: 10, rate: 100, incentive: 500, weeklyAdvance: 200, loan: 100 }
    ];
    expect(legacyMonthlySalary('E1', logs, 'May', '2026', DEFAULT_MONTHLY)).toBe(1200);
  });

  it('matches on id alone, as v1 did', () => {
    // v1 never looked at employeeRefId, so a row linked only that way was
    // invisible to it and must stay invisible here.
    const logs: LegacyAttendanceLog[] = [
      { id: 'OTHER', date: '2026-05-10', hours: 10, rate: 100 }
    ];
    expect(legacyMonthlySalary('E1', logs, 'May', '2026', DEFAULT_MONTHLY)).toBe(DEFAULT_MONTHLY);
  });

  it('falls back to the default month salary when there are no logs', () => {
    expect(legacyMonthlySalary('E1', [], 'May', '2026', DEFAULT_MONTHLY)).toBe(DEFAULT_MONTHLY);
    expect(legacyMonthlySalary('E1', attendance, 'June', '2026', DEFAULT_MONTHLY)).toBe(DEFAULT_MONTHLY);
    expect(legacyMonthlySalary('E1', attendance, 'May', '2025', DEFAULT_MONTHLY)).toBe(DEFAULT_MONTHLY);
  });

  it('falls back to the default when deductions wiped the month out', () => {
    const logs: LegacyAttendanceLog[] = [
      { id: 'E1', date: '2026-05-10', hours: 10, rate: 100, loan: 5000 }
    ];
    expect(legacyMonthlySalary('E1', logs, 'May', '2026', DEFAULT_MONTHLY)).toBe(DEFAULT_MONTHLY);
  });

  it('skips rows with an unusable date', () => {
    const logs: LegacyAttendanceLog[] = [{ id: 'E1', hours: 10, rate: 100 }];
    expect(legacyMonthlySalary('E1', logs, 'May', '2026', DEFAULT_MONTHLY)).toBe(DEFAULT_MONTHLY);
  });
});

describe('isHandEdited', () => {
  const attendance: LegacyAttendanceLog[] = [
    { id: 'E1', date: '2026-05-10', hours: 10, rate: 100 },
    { id: 'E1', date: '2026-05-20', hours: 16, rate: 100 }
  ];

  const check = (stored: unknown) =>
    isHandEdited(stored, 'E1', attendance, 'May', '2026', DEFAULT_MONTHLY);

  it('treats a value matching the v1 computation as computed, not edited', () => {
    // 2600 is exactly what v1 would have stored, so it is replaced by the
    // corrected figure rather than preserved.
    expect(check(2600)).toBe(false);
  });

  it('treats any other value as hand-edited', () => {
    expect(check(45000)).toBe(true);
    expect(check(1)).toBe(true);
    expect(check(0)).toBe(true);
  });

  it('does not mistake the corrected figure for a computed one', () => {
    // 23400 is what the FIXED formula gives. In a v1 ledger it can only have
    // got there by hand, so it must be preserved.
    expect(check(23400)).toBe(true);
  });

  it('treats a month with no logs as computed when it holds the default', () => {
    expect(isHandEdited(DEFAULT_MONTHLY, 'E1', [], 'May', '2026', DEFAULT_MONTHLY)).toBe(false);
    expect(isHandEdited(DEFAULT_MONTHLY + 1, 'E1', [], 'May', '2026', DEFAULT_MONTHLY)).toBe(true);
  });

  it('rejects anything that is not a number', () => {
    expect(check(undefined)).toBe(false);
    expect(check(null)).toBe(false);
    expect(check('2600')).toBe(false);
    expect(check(NaN)).toBe(true); // NaN !== anything, so it reads as edited
  });
});

describe('migration behaviour end to end', () => {
  /* A v1 ledger for one employee: eleven computed months and one the user
   * typed over. Only the typed cell should survive. */
  const attendance: LegacyAttendanceLog[] = [
    { id: 'E1', date: '2026-05-10', hours: 26, rate: 100 }
  ];

  it('preserves exactly the cells a person touched', () => {
    const storedLedger: Record<string, number> = {
      January: DEFAULT_MONTHLY,   // no logs -> v1 default -> computed
      February: DEFAULT_MONTHLY,
      March: DEFAULT_MONTHLY,
      April: DEFAULT_MONTHLY,
      May: 99000,                 // typed over the v1 figure of 2600
      June: DEFAULT_MONTHLY,
      July: DEFAULT_MONTHLY,
      August: DEFAULT_MONTHLY,
      September: DEFAULT_MONTHLY,
      October: DEFAULT_MONTHLY,
      November: DEFAULT_MONTHLY,
      December: DEFAULT_MONTHLY
    };

    const preserved = Object.keys(storedLedger).filter(month =>
      isHandEdited(storedLedger[month], 'E1', attendance, month, '2026', DEFAULT_MONTHLY)
    );

    expect(preserved).toEqual(['May']);
  });

  it('recomputes the yearly total from carried and corrected cells together', () => {
    // Nine months excluded, so only the ticked ones count -- the old code
    // summed all twelve regardless, ignoring the user's exclusions.
    const salaries: Record<string, number> = { January: 1000, February: 2000, March: 4000 };
    expect(sumIncludedMonths(salaries, ['January', 'March'])).toBe(5000);
  });
});

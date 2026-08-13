import { describe, it, expect } from 'vitest';
import { refreshEntryLabels, hasRateDrift, refreshEntryLabelsAll, previousRateFor } from '../../src/lib/wage-snapshot';
import { calculateEntryBreakdown, perDaySalary } from '../../src/lib/payroll';

// The real numbers from the factory: Rs.620/day on a 12-hour shift, plus a
// Rs.55/day increment to Rs.675/day.
const OLD_RATE = 620 / 12;   // 51.6667/hr
const NEW_RATE = 675 / 12;   // 56.25/hr

describe('refreshEntryLabels', () => {
  it('NEVER rewrites the rate when the employee gets an increment', () => {
    const june = { name: 'RAVI', role: 'Weaver', rate: OLD_RATE };
    const afterRaise = { id: 'LBR001', name: 'RAVI', role: 'Weaver', rate: NEW_RATE };

    expect(refreshEntryLabels(june, afterRaise).rate).toBe(OLD_RATE);
  });

  it('leaves the entry untouched (same reference) when only the rate changed', () => {
    const june = { name: 'RAVI', role: 'Weaver', rate: OLD_RATE };
    expect(refreshEntryLabels(june, { name: 'RAVI', role: 'Weaver', rate: NEW_RATE })).toBe(june);
  });

  it('still refreshes a corrected name, without touching the rate', () => {
    const entry = { name: 'RAVII', role: 'Weaver', rate: OLD_RATE };
    const out = refreshEntryLabels(entry, { name: 'RAVI', role: 'Weaver', rate: NEW_RATE });
    expect(out.name).toBe('RAVI');
    expect(out.rate).toBe(OLD_RATE);
  });

  it('still refreshes a changed role, without touching the rate', () => {
    const entry = { name: 'RAVI', role: 'Helper', rate: OLD_RATE };
    const out = refreshEntryLabels(entry, { name: 'RAVI', role: 'Weaver', rate: NEW_RATE });
    expect(out.role).toBe('Weaver');
    expect(out.rate).toBe(OLD_RATE);
  });

  it('returns the same reference when nothing changed', () => {
    const entry = { name: 'RAVI', role: 'Weaver', rate: OLD_RATE };
    expect(refreshEntryLabels(entry, { name: 'RAVI', role: 'Weaver', rate: OLD_RATE })).toBe(entry);
  });

  it('handles a missing employee record', () => {
    const entry = { name: 'RAVI', rate: OLD_RATE };
    expect(refreshEntryLabels(entry, undefined)).toBe(entry);
    expect(refreshEntryLabels(entry, null)).toBe(entry);
  });

  it('does not blank a name the employee record is missing', () => {
    const entry = { name: 'RAVI', role: 'Weaver', rate: OLD_RATE };
    const out = refreshEntryLabels(entry, { id: 'LBR001', rate: NEW_RATE });
    expect(out.name).toBe('RAVI');
    expect(out.role).toBe('Weaver');
  });
});

describe('the finalised-month guarantee', () => {
  it('a closed June still pays Rs.620/day after the increment to Rs.675', () => {
    // 26 days worked in June, snapshotted at the old rate.
    const juneEntry = { hours: 26, shift: '12-hour', rate: OLD_RATE, incentive: 0, weeklyAdvance: 0, loan: 0 };
    const employeeNow = { rate: NEW_RATE, shift: '12-hour' };

    const refreshed = refreshEntryLabels(juneEntry, { rate: NEW_RATE });
    const pay = calculateEntryBreakdown(refreshed, employeeNow);

    expect(pay.perDaySalary).toBe(620);
    expect(pay.gross).toBe(620 * 26);
    expect(pay.net).toBe(620 * 26);
  });

  it('a new July row created after the raise pays Rs.675/day', () => {
    // A new row snapshots the employee's CURRENT rate at creation.
    const julyEntry = { hours: 26, shift: '12-hour', rate: NEW_RATE, incentive: 0, weeklyAdvance: 0, loan: 0 };
    const pay = calculateEntryBreakdown(julyEntry, { rate: NEW_RATE, shift: '12-hour' });

    expect(pay.perDaySalary).toBe(675);
    expect(pay.net).toBe(675 * 26);
  });

  it('the increment is exactly Rs.55/day between the two periods', () => {
    expect(perDaySalary(NEW_RATE, '12-hour') - perDaySalary(OLD_RATE, '12-hour')).toBe(55);
  });

  it('a row with no stored rate still falls back to the current employee rate', () => {
    // Documented "not recorded" behaviour -- unchanged by the snapshot rule.
    const entry: { hours: number; shift: string; incentive: number; weeklyAdvance: number; loan: number; rate?: number } =
      { hours: 10, shift: '12-hour', incentive: 0, weeklyAdvance: 0, loan: 0 };
    const refreshed = refreshEntryLabels(entry, { rate: NEW_RATE });
    expect(refreshed.rate).toBeUndefined();
    expect(calculateEntryBreakdown(refreshed, { rate: NEW_RATE, shift: '12-hour' }).perDaySalary).toBe(675);
  });
});

describe('hasRateDrift', () => {
  it('flags a row priced at the old wage', () => {
    expect(hasRateDrift({ rate: OLD_RATE }, { rate: NEW_RATE })).toBe(true);
  });

  it('is false when the row is on the current wage', () => {
    expect(hasRateDrift({ rate: NEW_RATE }, { rate: NEW_RATE })).toBe(false);
  });

  it('is false when the row has no rate -- that falls back, it does not drift', () => {
    expect(hasRateDrift({}, { rate: NEW_RATE })).toBe(false);
    expect(hasRateDrift({ rate: 0 }, { rate: NEW_RATE })).toBe(false);
  });

  it('is false when the employee has no usable rate', () => {
    expect(hasRateDrift({ rate: OLD_RATE }, { rate: 0 })).toBe(false);
    expect(hasRateDrift({ rate: OLD_RATE }, undefined)).toBe(false);
  });
});

describe('previousRateFor', () => {
  it('offers the rate from the most recent differently-priced row', () => {
    const prev = previousRateFor('E1', [
      { employeeRefId: 'E1', date: '2026-05-14', rate: OLD_RATE, shift: '12-hour' },
      { employeeRefId: 'E1', date: '2026-06-14', rate: OLD_RATE, shift: '12-hour' },
    ], NEW_RATE);
    expect(prev).toMatchObject({ rate: OLD_RATE, date: '2026-06-14', shift: '12-hour' });
  });

  it('returns null when every row is already on the current rate', () => {
    expect(previousRateFor('E1', [
      { employeeRefId: 'E1', date: '2026-06-14', rate: NEW_RATE },
    ], NEW_RATE)).toBeNull();
  });

  it('returns null when the labourer has no attendance at all', () => {
    expect(previousRateFor('E1', [], NEW_RATE)).toBeNull();
    expect(previousRateFor('E1', undefined, NEW_RATE)).toBeNull();
  });

  it('picks the newest older rate when the wage changed more than once', () => {
    const OLDEST = 500 / 12;
    const prev = previousRateFor('E1', [
      { employeeRefId: 'E1', date: '2026-04-14', rate: OLDEST },
      { employeeRefId: 'E1', date: '2026-06-14', rate: OLD_RATE },
      { employeeRefId: 'E1', date: '2026-05-14', rate: OLDEST },
    ], NEW_RATE);
    expect(prev!.rate).toBe(OLD_RATE);
    expect(prev!.date).toBe('2026-06-14');
  });

  it('ignores other labourers entirely', () => {
    const prev = previousRateFor('E1', [
      { employeeRefId: 'E2', date: '2026-07-14', rate: 999 },
      { employeeRefId: 'E1', date: '2026-06-14', rate: OLD_RATE },
    ], NEW_RATE);
    expect(prev!.rate).toBe(OLD_RATE);
  });

  it('matches rows by the id prefix when employeeRefId is missing', () => {
    const prev = previousRateFor('E1', [
      { id: 'E1-1784007777769', date: '2026-06-14', rate: OLD_RATE },
    ], NEW_RATE);
    expect(prev!.rate).toBe(OLD_RATE);
  });

  it('skips rows with no usable rate rather than offering zero', () => {
    const prev = previousRateFor('E1', [
      { employeeRefId: 'E1', date: '2026-07-14', rate: 0 },
      { employeeRefId: 'E1', date: '2026-06-14', rate: OLD_RATE },
    ], NEW_RATE);
    expect(prev!.rate).toBe(OLD_RATE);
  });

  it('does not let an undated row outrank a dated one', () => {
    const prev = previousRateFor('E1', [
      { employeeRefId: 'E1', rate: 111 },
      { employeeRefId: 'E1', date: '2026-06-14', rate: OLD_RATE },
    ], NEW_RATE);
    expect(prev!.rate).toBe(OLD_RATE);
  });

  it('still offers a rate when the employee has no current rate set', () => {
    const prev = previousRateFor('E1', [
      { employeeRefId: 'E1', date: '2026-06-14', rate: OLD_RATE },
    ], undefined);
    expect(prev!.rate).toBe(OLD_RATE);
  });
});

describe('refreshEntryLabelsAll', () => {
  const find = (emps: any[]) => (e: any) => emps.find(x => x.id === e.employeeRefId);

  it('preserves array identity when no row changed', () => {
    const entries = [{ employeeRefId: 'A', name: 'RAVI', rate: OLD_RATE }];
    const emps = [{ id: 'A', name: 'RAVI', rate: NEW_RATE }];
    expect(refreshEntryLabelsAll(entries, emps, find(emps))).toBe(entries);
  });

  it('returns a new array when a name changed, keeping every rate', () => {
    const entries = [
      { employeeRefId: 'A', name: 'OLD NAME', rate: OLD_RATE },
      { employeeRefId: 'B', name: 'BABLU', rate: OLD_RATE },
    ];
    const emps = [{ id: 'A', name: 'RAVI', rate: NEW_RATE }, { id: 'B', name: 'BABLU', rate: NEW_RATE }];

    const out = refreshEntryLabelsAll(entries, emps, find(emps));
    expect(out).not.toBe(entries);
    expect(out[0].name).toBe('RAVI');
    expect(out.every(e => e.rate === OLD_RATE)).toBe(true);
  });

  it('handles an empty set', () => {
    const empty: any[] = [];
    expect(refreshEntryLabelsAll(empty, [], () => undefined)).toBe(empty);
  });
});

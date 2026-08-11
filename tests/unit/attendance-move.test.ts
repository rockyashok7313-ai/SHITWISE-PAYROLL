import { describe, it, expect } from 'vitest';
import type { MovableEntry } from '../../src/lib/attendance-move';
import { moveEntryDate, planPeriodMove } from '../../src/lib/attendance-move';

describe('moveEntryDate', () => {
  it('shifts a plain date into the target month, keeping the day', () => {
    expect(moveEntryDate('2027-07-15', 2027, 6)).toBe('2027-06-15');
  });

  it('clamps the day when the target month is shorter -- July 31 has no June equivalent', () => {
    expect(moveEntryDate('2027-07-31', 2027, 6)).toBe('2027-06-30');
  });

  it('clamps into February correctly, including the leap-year case', () => {
    expect(moveEntryDate('2027-01-30', 2027, 2)).toBe('2027-02-28');   // 2027 not leap
    expect(moveEntryDate('2028-01-30', 2028, 2)).toBe('2028-02-29');   // 2028 leap
  });

  it('shifts both ends of a "YYYY-MM-DD to YYYY-MM-DD" range independently', () => {
    expect(moveEntryDate('2027-07-01 to 2027-07-31', 2027, 6)).toBe('2027-06-01 to 2027-06-30');
  });

  it('can move across a year boundary', () => {
    expect(moveEntryDate('2027-01-10', 2026, 12)).toBe('2026-12-10');
  });

  it('leaves an unparseable date unchanged rather than guessing', () => {
    expect(moveEntryDate('garbage', 2027, 6)).toBe('garbage');
  });
});

interface TestEntry extends MovableEntry {
  name: string;
}

const e = (id: string, date: string, name = 'Worker', employeeRefId?: string): TestEntry =>
  ({ id, date, name, employeeRefId });

describe('planPeriodMove', () => {
  it('moves only entries in the from period, leaving everything else untouched', () => {
    const entries = [
      e('a', '2027-07-10'),   // moves
      e('b', '2027-07-20'),   // moves
      e('c', '2027-06-05'),   // already June -- stays
      e('d', '2027-08-01'),   // different month -- stays
    ];
    const plan = planPeriodMove(entries, 'July', '2027', 'June', '2027');

    expect(plan.moved.map(x => x.id).sort()).toEqual(['a', 'b']);
    expect(plan.moved.find(x => x.id === 'a')!.date).toBe('2027-06-10');
    expect(plan.result).toHaveLength(4);
    // untouched entries are the SAME object references, not rebuilt
    expect(plan.result.find(x => x.id === 'c')).toBe(entries[2]);
    expect(plan.result.find(x => x.id === 'd')).toBe(entries[3]);
  });

  it('marks moved entries isModified', () => {
    const plan = planPeriodMove([e('a', '2027-07-10')], 'July', '2027', 'June', '2027');
    expect((plan.moved[0] as any).isModified).toBe(true);
  });

  it('is a no-op when nothing is in the from period', () => {
    const entries = [e('a', '2027-06-10')];
    const plan = planPeriodMove(entries, 'July', '2027', 'June', '2027');
    expect(plan.moved).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.result).toEqual(entries);
  });

  it('handles an empty entries array', () => {
    const plan = planPeriodMove([], 'July', '2027', 'June', '2027');
    expect(plan).toMatchObject({ result: [], moved: [], conflicts: [] });
  });

  describe('conflict detection', () => {
    it('flags a collision when the same employee already has a record on the destination date', () => {
      const entries = [
        e('a', '2027-07-10', 'Asha', 'E1'),          // would move to 2027-06-10
        e('existing', '2027-06-10', 'Asha', 'E1'),   // already there
      ];
      const plan = planPeriodMove(entries, 'July', '2027', 'June', '2027');

      expect(plan.conflicts).toHaveLength(1);
      expect(plan.conflicts[0].moving.id).toBe('a');
      expect(plan.conflicts[0].collidesWith.id).toBe('existing');
      expect(plan.conflicts[0].newDate).toBe('2027-06-10');
    });

    it('does not flag a collision for a different employee on the same destination date', () => {
      const entries = [
        e('a', '2027-07-10', 'Asha', 'E1'),
        e('existing', '2027-06-10', 'Ravi', 'E2'),
      ];
      const plan = planPeriodMove(entries, 'July', '2027', 'June', '2027');
      expect(plan.conflicts).toHaveLength(0);
    });

    it('does not flag two entries being moved together as conflicting with each other', () => {
      // Both move from July to June on different days -- no collision between them.
      const entries = [
        e('a', '2027-07-10', 'Asha', 'E1'),
        e('b', '2027-07-20', 'Asha', 'E1'),
      ];
      const plan = planPeriodMove(entries, 'July', '2027', 'June', '2027');
      expect(plan.conflicts).toHaveLength(0);
    });

    it('falls back to the id prefix for employee matching when employeeRefId is absent', () => {
      const entries = [
        { id: 'E1-2027-07-10', date: '2027-07-10' },
        { id: 'E1-2027-06-10', date: '2027-06-10' },
      ];
      const plan = planPeriodMove(entries, 'July', '2027', 'June', '2027');
      expect(plan.conflicts).toHaveLength(1);
    });
  });

  it('can move across a year boundary (December -> January)', () => {
    const entries = [e('a', '2026-12-15')];
    const plan = planPeriodMove(entries, 'December', '2026', 'January', '2027');
    expect(plan.moved[0].date).toBe('2027-01-15');
  });
});

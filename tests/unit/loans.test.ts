import { describe, it, expect } from 'vitest';
import { loanBalanceFor, loanBalances, cappedInstalment } from '../../src/lib/loans';

const T = '2027-05-01T00:00:00.000Z';

describe('loanBalanceFor', () => {
  it('outstanding is the principal until anything is recovered', () => {
    const b = loanBalanceFor('E1', [{ id: 'L1', employeeId: 'E1', amount: 10000 }], []);
    expect(b).toMatchObject({ issued: 10000, repaid: 0, outstanding: 10000, isCleared: false });
  });

  it('subtracts monthly deductions taken in attendance', () => {
    const b = loanBalanceFor('E1',
      [{ id: 'L1', employeeId: 'E1', amount: 10000 }],
      [{ employeeRefId: 'E1', loan: 2000 }, { employeeRefId: 'E1', loan: 3000 }]
    );
    expect(b.repaid).toBe(5000);
    expect(b.outstanding).toBe(5000);
    expect(b.isCleared).toBe(false);
  });

  it('marks the loan cleared once fully recovered', () => {
    const b = loanBalanceFor('E1',
      [{ id: 'L1', employeeId: 'E1', amount: 5000 }],
      [{ employeeRefId: 'E1', loan: 5000 }]
    );
    expect(b.outstanding).toBe(0);
    expect(b.isCleared).toBe(true);
  });

  it('sums multiple loans for the same worker', () => {
    const b = loanBalanceFor('E1', [
      { id: 'L1', employeeId: 'E1', amount: 5000 },
      { id: 'L2', employeeId: 'E1', amount: 3000 },
    ], []);
    expect(b.issued).toBe(8000);
  });

  it('never reports a negative outstanding -- surfaces overpayment separately', () => {
    // Deducting more than was lent usually means a deduction was entered
    // against an already-settled loan; hiding it as a negative balance would
    // quietly under-report what the worker is owed back.
    const b = loanBalanceFor('E1',
      [{ id: 'L1', employeeId: 'E1', amount: 5000 }],
      [{ employeeRefId: 'E1', loan: 6000 }]
    );
    expect(b.outstanding).toBe(0);
    expect(b.overpaid).toBe(1000);
    expect(b.isCleared).toBe(true);
  });

  it('does not count other employees\' loans or deductions', () => {
    const b = loanBalanceFor('E1',
      [{ id: 'L1', employeeId: 'E1', amount: 5000 }, { id: 'L2', employeeId: 'E2', amount: 9000 }],
      [{ employeeRefId: 'E1', loan: 1000 }, { employeeRefId: 'E2', loan: 4000 }]
    );
    expect(b.issued).toBe(5000);
    expect(b.repaid).toBe(1000);
    expect(b.outstanding).toBe(4000);
  });

  it('falls back to the id prefix when a row has no employeeRefId', () => {
    const b = loanBalanceFor('E1',
      [{ id: 'L1', employeeId: 'E1', amount: 5000 }],
      [{ id: 'E1-1786500000000', loan: 2000 }]
    );
    expect(b.repaid).toBe(2000);
  });

  it('ignores tombstoned loans and tombstoned attendance', () => {
    const b = loanBalanceFor('E1',
      [
        { id: 'L1', employeeId: 'E1', amount: 5000 },
        { id: 'L2', employeeId: 'E1', amount: 9999, deletedAt: T },   // deleted loan
      ],
      [
        { employeeRefId: 'E1', loan: 1000 },
        { employeeRefId: 'E1', loan: 7777, deletedAt: T },            // deleted attendance
      ]
    );
    expect(b.issued).toBe(5000);
    expect(b.repaid).toBe(1000);
    expect(b.outstanding).toBe(4000);
  });

  it('handles numeric strings straight from form inputs', () => {
    const b = loanBalanceFor('E1',
      [{ id: 'L1', employeeId: 'E1', amount: '10000' }],
      [{ employeeRefId: 'E1', loan: '2500' }]
    );
    expect(b.outstanding).toBe(7500);
  });

  it('treats unusable amounts as zero rather than NaN', () => {
    const b = loanBalanceFor('E1',
      [{ id: 'L1', employeeId: 'E1', amount: 'abc' }],
      [{ employeeRefId: 'E1', loan: undefined }]
    );
    expect(b.issued).toBe(0);
    expect(b.outstanding).toBe(0);
    expect(b.hasNoLoan).toBe(true);
  });

  it('distinguishes "never had a loan" from "loan cleared"', () => {
    const none = loanBalanceFor('E1', [], []);
    expect(none).toMatchObject({ hasNoLoan: true, isCleared: false });

    const cleared = loanBalanceFor('E1',
      [{ id: 'L1', employeeId: 'E1', amount: 1000 }],
      [{ employeeRefId: 'E1', loan: 1000 }]
    );
    expect(cleared).toMatchObject({ hasNoLoan: false, isCleared: true });
  });

  it('handles missing inputs', () => {
    expect(loanBalanceFor('E1', undefined, undefined).outstanding).toBe(0);
  });
});

describe('loanBalances', () => {
  it('returns a balance for every worker who has had a loan, and no others', () => {
    const map = loanBalances(
      [{ id: 'L1', employeeId: 'E1', amount: 5000 }, { id: 'L2', employeeId: 'E2', amount: 2000 }],
      [{ employeeRefId: 'E1', loan: 1000 }, { employeeRefId: 'E3', loan: 500 }]
    );
    expect([...map.keys()].sort()).toEqual(['E1', 'E2']);   // E3 never had a loan
    expect(map.get('E1')!.outstanding).toBe(4000);
    expect(map.get('E2')!.outstanding).toBe(2000);
  });

  it('excludes workers whose only loan is tombstoned', () => {
    const map = loanBalances([{ id: 'L1', employeeId: 'E1', amount: 5000, deletedAt: T }], []);
    expect(map.size).toBe(0);
  });
});

describe('cappedInstalment', () => {
  it('allows an instalment up to the outstanding balance', () => {
    expect(cappedInstalment(2000, 5000)).toBe(2000);
  });

  it('caps at the outstanding balance so a loan cannot be over-recovered', () => {
    expect(cappedInstalment(9000, 5000)).toBe(5000);
  });

  it('returns 0 when nothing is owed', () => {
    expect(cappedInstalment(2000, 0)).toBe(0);
  });

  it('never returns a negative instalment', () => {
    expect(cappedInstalment(-500, 5000)).toBe(0);
    expect(cappedInstalment(2000, -100)).toBe(0);
  });
});

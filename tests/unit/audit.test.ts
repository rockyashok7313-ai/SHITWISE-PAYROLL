import { describe, it, expect } from 'vitest';
import {
  detectWageChanges,
  buildWageChangeAudit,
  buildVoucherDeleteAudit,
  type AuditActor,
} from '../../src/lib/audit';

const ACTOR: AuditActor = { userId: 'u-1', userEmail: 'admin@factory.com' };
const NOW = '2027-08-11T10:00:00.000Z';

describe('detectWageChanges', () => {
  it('detects a rate change on an existing employee', () => {
    const prev = [{ id: 'E1', name: 'Asha', rate: 100 }];
    const next = [{ id: 'E1', name: 'Asha', rate: 120 }];
    expect(detectWageChanges(prev, next)).toEqual([
      { employeeId: 'E1', employeeName: 'Asha', oldRate: 100, newRate: 120 },
    ]);
  });

  it('detects a rate DECREASE too -- pay cuts matter at least as much', () => {
    const prev = [{ id: 'E1', name: 'Asha', rate: 120 }];
    const next = [{ id: 'E1', name: 'Asha', rate: 90 }];
    expect(detectWageChanges(prev, next)[0]).toMatchObject({ oldRate: 120, newRate: 90 });
  });

  it('ignores employees whose rate did not change', () => {
    const prev = [{ id: 'E1', name: 'Asha', rate: 100 }, { id: 'E2', name: 'Ravi', rate: 80 }];
    const next = [{ id: 'E1', name: 'Asha', rate: 100 }, { id: 'E2', name: 'Ravi', rate: 95 }];
    const changes = detectWageChanges(prev, next);
    expect(changes).toHaveLength(1);
    expect(changes[0].employeeId).toBe('E2');
  });

  it('ignores changes to fields other than the rate', () => {
    const prev = [{ id: 'E1', name: 'Asha', rate: 100, role: 'Weaver' }];
    const next = [{ id: 'E1', name: 'Asha', rate: 100, role: 'Supervisor' }];
    expect(detectWageChanges(prev, next)).toEqual([]);
  });

  it('does not treat a newly added employee as a wage change', () => {
    const prev = [{ id: 'E1', name: 'Asha', rate: 100 }];
    const next = [{ id: 'E1', name: 'Asha', rate: 100 }, { id: 'E2', name: 'New', rate: 80 }];
    expect(detectWageChanges(prev, next)).toEqual([]);
  });

  it('does not treat a removed employee as a wage change', () => {
    const prev = [{ id: 'E1', name: 'Asha', rate: 100 }, { id: 'E2', name: 'Ravi', rate: 80 }];
    const next = [{ id: 'E1', name: 'Asha', rate: 100 }];
    expect(detectWageChanges(prev, next)).toEqual([]);
  });

  it('treats a numeric string rate as equal to the same number (no false positive)', () => {
    // Rates come off form inputs as strings; "100" -> 100 is not a pay change.
    const prev = [{ id: 'E1', name: 'Asha', rate: 100 }];
    const next = [{ id: 'E1', name: 'Asha', rate: '100' }];
    expect(detectWageChanges(prev, next)).toEqual([]);
  });

  it('skips unusable rates rather than logging a change to/from NaN', () => {
    const prev = [{ id: 'E1', name: 'Asha', rate: 100 }];
    expect(detectWageChanges(prev, [{ id: 'E1', name: 'Asha', rate: 'abc' }])).toEqual([]);
    expect(detectWageChanges(prev, [{ id: 'E1', name: 'Asha' }])).toEqual([]);
    expect(detectWageChanges([{ id: 'E1', name: 'Asha' }], [{ id: 'E1', name: 'Asha', rate: 100 }])).toEqual([]);
  });

  it('handles empty and missing inputs', () => {
    expect(detectWageChanges([], [])).toEqual([]);
    expect(detectWageChanges(undefined, undefined)).toEqual([]);
    expect(detectWageChanges(undefined, [{ id: 'E1', rate: 100 }])).toEqual([]);
  });

  it('reports every changed employee when several change at once', () => {
    const prev = [{ id: 'E1', rate: 100 }, { id: 'E2', rate: 80 }, { id: 'E3', rate: 70 }];
    const next = [{ id: 'E1', rate: 110 }, { id: 'E2', rate: 80 }, { id: 'E3', rate: 75 }];
    expect(detectWageChanges(prev, next).map(c => c.employeeId)).toEqual(['E1', 'E3']);
  });
});

describe('buildWageChangeAudit', () => {
  const row = buildWageChangeAudit(
    { employeeId: 'E1', employeeName: 'Asha', oldRate: 100, newRate: 120 },
    'co_1', ACTOR, NOW
  );

  it('records who, when, and which record', () => {
    expect(row).toMatchObject({
      company_id: 'co_1',
      table_name: 'employees',
      record_id: 'E1',
      action: 'UPDATE',
      user_id: 'u-1',
      user_email: 'admin@factory.com',
      timestamp: NOW,
    });
  });

  it('records both the old and the new rate', () => {
    expect(row.old_data).toMatchObject({ rate: 100 });
    expect(row.new_data).toMatchObject({ rate: 120 });
  });

  it('carries the name identically on both sides so it reads as context, not a change', () => {
    expect(row.old_data!.name).toBe('Asha');
    expect(row.new_data!.name).toBe(row.old_data!.name);
  });

  it('assigns no id -- audit rows are inserted, never authored client-side', () => {
    expect('id' in row).toBe(false);
  });
});

describe('buildVoucherDeleteAudit', () => {
  const voucher = {
    id: 'v-1',
    employeeId: 'E1',
    employeeName: 'Asha',
    month: 'July 2027',
    date: '2027-07-31',
    amount: '31200',
    paymentMethod: 'Bank',
    remarks: 'Full month',
  };
  const row = buildVoucherDeleteAudit(voucher, 'co_1', ACTOR, NOW);

  it('records it as a DELETE against the voucher record', () => {
    expect(row).toMatchObject({
      table_name: 'vouchers',
      record_id: 'v-1',
      action: 'DELETE',
      user_email: 'admin@factory.com',
      timestamp: NOW,
    });
  });

  it('preserves the whole voucher so the deletion is reconstructable', () => {
    expect(row.old_data).toMatchObject({
      employeeName: 'Asha',
      month: 'July 2027',
      amount: '31200',
      paymentMethod: 'Bank',
    });
  });

  it('has no new_data -- nothing exists after a delete', () => {
    expect(row.new_data).toBeNull();
  });

  it('does not crash on a sparse voucher', () => {
    const sparse = buildVoucherDeleteAudit({ id: 'v-2' }, 'co_1', ACTOR, NOW);
    expect(sparse.record_id).toBe('v-2');
    expect(sparse.old_data).toMatchObject({ employeeName: null, amount: null });
  });
});

describe('actor attribution', () => {
  it('still records the event when the user is unknown', () => {
    // An unattributed audit row is far better than none.
    const row = buildWageChangeAudit(
      { employeeId: 'E1', employeeName: 'Asha', oldRate: 100, newRate: 120 },
      'co_1', { userId: null, userEmail: null }, NOW
    );
    expect(row.user_id).toBeNull();
    expect(row.user_email).toBeNull();
    expect(row.action).toBe('UPDATE');
  });
});

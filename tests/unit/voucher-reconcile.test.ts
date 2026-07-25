import { describe, it, expect } from 'vitest';
import type { AttendanceEntry } from '../../src/lib/payroll';
import type { VoucherLite, EmployeeLite } from '../../src/lib/voucher-reconcile';
import { reconcileVoucher, reconcilePeriod } from '../../src/lib/voucher-reconcile';

const employees: EmployeeLite[] = [
  { id: 'E1', rate: 100, shift: '12-hour' },
  { id: 'E2', rate: 100, shift: '9-hour' },
];

// E1 worked 26 days at 100/hr x 12h = 31200 net (no incentive/deductions).
const attendance: AttendanceEntry[] = [
  { employeeRefId: 'E1', date: '2027-05-15', hours: 26, rate: 100, shift: '12-hour' },
];

describe('reconcileVoucher', () => {
  it('reports a match when the stored amount equals the recomputed net', () => {
    const v: VoucherLite = { id: 'v1', employeeId: 'E1', month: 'May 2027', amount: '31200' };
    const r = reconcileVoucher(v, employees, attendance);
    expect(r.status).toBe('match');
    expect(r.computedNet).toBe(31200);
    expect(r.delta).toBe(0);
    expect(r.recordCount).toBe(1);
  });

  it('reports a mismatch with a signed delta when the stored amount differs', () => {
    // A pre-fix voucher paid at 9h (23400) that should now be 31200.
    const v: VoucherLite = { id: 'v1', employeeId: 'E1', month: 'May 2027', amount: '23400' };
    const r = reconcileVoucher(v, employees, attendance);
    expect(r.status).toBe('mismatch');
    expect(r.computedNet).toBe(31200);
    expect(r.delta).toBe(-7800);   // stored below computed
  });

  it('reads the stored amount whether it is a string or a number', () => {
    const asNum = reconcileVoucher({ id: 'v', employeeId: 'E1', month: 'May 2027', amount: 31200 }, employees, attendance);
    const asStr = reconcileVoucher({ id: 'v', employeeId: 'E1', month: 'May 2027', amount: '31200' }, employees, attendance);
    expect(asNum.status).toBe('match');
    expect(asStr.status).toBe('match');
  });

  it('flags no-attendance rather than mismatch when the period has no records', () => {
    // Employee exists, but the voucher is for a month with no attendance -- the
    // amount was likely entered by hand, so it is not drift.
    const v: VoucherLite = { id: 'v1', employeeId: 'E1', month: 'June 2027', amount: '5000' };
    const r = reconcileVoucher(v, employees, attendance);
    expect(r.status).toBe('no-attendance');
    expect(r.computedNet).toBe(0);
    expect(r.recordCount).toBe(0);
  });

  it('flags no-employee (uncomputable) when the employee is gone', () => {
    const v: VoucherLite = { id: 'v1', employeeId: 'GHOST', month: 'May 2027', amount: '5000' };
    const r = reconcileVoucher(v, employees, attendance);
    expect(r.status).toBe('no-employee');
    expect(r.computedNet).toBeNull();
    expect(r.delta).toBeNull();
  });

  it('flags no-employee when the period string is unparseable', () => {
    const v: VoucherLite = { id: 'v1', employeeId: 'E1', month: 'garbage', amount: '5000' };
    const r = reconcileVoucher(v, employees, attendance);
    expect(r.status).toBe('no-employee');
  });

  it('uses the shared calculation, so a shift-fallback voucher is caught', () => {
    // Attendance row without an explicit shift; employee is 12-hour. The old
    // voucher code paid 9h; the shared calc uses the employee shift (12h).
    const noShift: AttendanceEntry[] = [{ employeeRefId: 'E1', date: '2027-05-15', hours: 26, rate: 100 }];
    const r = reconcileVoucher({ id: 'v', employeeId: 'E1', month: 'May 2027', amount: '23400' }, employees, noShift);
    expect(r.computedNet).toBe(31200);  // 12h fallback
    expect(r.status).toBe('mismatch');
  });
});

describe('reconcilePeriod', () => {
  const vouchers: VoucherLite[] = [
    { id: 'v1', employeeId: 'E1', month: 'May 2027', amount: '31200' }, // match
    { id: 'v2', employeeId: 'E1', month: 'May 2027', amount: '23400' }, // mismatch -7800
    { id: 'v3', employeeId: 'E2', month: 'May 2027', amount: '5000' },  // no attendance for E2
    { id: 'v4', employeeId: 'GHOST', month: 'May 2027', amount: '9000' } // no employee
  ];

  it('tallies match / mismatch / unverifiable counts', () => {
    const s = reconcilePeriod(vouchers, employees, attendance);
    expect(s.total).toBe(4);
    expect(s.matched).toBe(1);
    expect(s.mismatched).toBe(1);
    expect(s.unverifiable).toBe(2);   // no-attendance + no-employee
  });

  it('sums variance across mismatches only', () => {
    const s = reconcilePeriod(vouchers, employees, attendance);
    expect(s.netVariance).toBe(-7800);
    expect(s.absVariance).toBe(7800);
  });

  it('returns a per-voucher result for every input voucher', () => {
    const s = reconcilePeriod(vouchers, employees, attendance);
    expect(s.results.map(r => r.voucherId)).toEqual(['v1', 'v2', 'v3', 'v4']);
  });

  it('handles an empty voucher list', () => {
    const s = reconcilePeriod([], employees, attendance);
    expect(s).toMatchObject({ total: 0, matched: 0, mismatched: 0, unverifiable: 0, netVariance: 0, absVariance: 0 });
  });
});

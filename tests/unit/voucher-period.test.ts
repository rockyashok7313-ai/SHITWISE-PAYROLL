import { describe, it, expect } from 'vitest';
import {
  periodLabel,
  parsePeriod,
  samePeriod,
  isVoucherForPeriod,
  paidEmployeeIds,
  isPaymentMethod,
  amountPaidByMethod,
  paidByMethod
} from '../../src/lib/voucher-period';

describe('periodLabel', () => {
  it('formats month and year as the stored string', () => {
    expect(periodLabel('May', '2027')).toBe('May 2027');
    expect(periodLabel('December', 2026)).toBe('December 2026');
  });
});

describe('parsePeriod', () => {
  it('parses a well-formed period', () => {
    expect(parsePeriod('May 2027')).toEqual({ month: 'May', year: '2027' });
  });

  it('is tolerant of case and extra spacing', () => {
    expect(parsePeriod('  may   2027 ')).toEqual({ month: 'May', year: '2027' });
    expect(parsePeriod('DECEMBER 2026')).toEqual({ month: 'December', year: '2026' });
  });

  it('returns null for anything that is not month + year', () => {
    expect(parsePeriod(undefined)).toBeNull();
    expect(parsePeriod('')).toBeNull();
    expect(parsePeriod('May')).toBeNull();
    expect(parsePeriod('Smarch 2027')).toBeNull();
  });
});

describe('samePeriod', () => {
  it('matches regardless of case and spacing', () => {
    expect(samePeriod('May 2027', 'may  2027')).toBe(true);
  });

  it('separates different months and years', () => {
    expect(samePeriod('May 2027', 'June 2027')).toBe(false);
    expect(samePeriod('May 2026', 'May 2027')).toBe(false);
  });

  it('falls back to raw equality when a value is unparseable', () => {
    expect(samePeriod('garbage', 'garbage')).toBe(true);
    expect(samePeriod('garbage', 'other')).toBe(false);
  });
});

describe('isVoucherForPeriod', () => {
  it('matches a voucher month string against a month + year', () => {
    expect(isVoucherForPeriod('May 2027', 'May', '2027')).toBe(true);
    expect(isVoucherForPeriod('May 2027', 'May', 2027)).toBe(true);
    expect(isVoucherForPeriod('May 2027', 'June', '2027')).toBe(false);
  });

  it('is false for a missing voucher month', () => {
    expect(isVoucherForPeriod(undefined, 'May', '2027')).toBe(false);
  });
});

describe('paidEmployeeIds', () => {
  const vouchers = [
    { employeeId: 'E1', month: 'May 2027' },
    { employeeId: 'E2', month: 'May 2027' },
    { employeeId: 'E3', month: 'June 2027' },   // different month
    { employeeId: 'E4', month: 'May 2026' },     // different year
    { employeeId: 'E5' },                          // no period
    { month: 'May 2027' }                          // no employee
  ];

  it('collects exactly the employees vouchered in the period', () => {
    const ids = paidEmployeeIds(vouchers, 'May', '2027');
    expect([...ids].sort()).toEqual(['E1', 'E2']);
  });

  it('reflects a newly added voucher (creating one marks Paid)', () => {
    const before = paidEmployeeIds(vouchers, 'May', '2027');
    expect(before.has('E9')).toBe(false);

    const after = paidEmployeeIds([...vouchers, { employeeId: 'E9', month: 'May 2027' }], 'May', '2027');
    expect(after.has('E9')).toBe(true);
  });

  it('reflects a removed voucher (deleting one marks Unpaid)', () => {
    const remaining = vouchers.filter(v => v.employeeId !== 'E1');
    expect(paidEmployeeIds(remaining, 'May', '2027').has('E1')).toBe(false);
  });

  it('counts an employee once even with duplicate vouchers', () => {
    const dupes = [
      { employeeId: 'E1', month: 'May 2027' },
      { employeeId: 'E1', month: 'May 2027' }
    ];
    const ids = paidEmployeeIds(dupes, 'May', '2027');
    expect(ids.size).toBe(1);
    expect(ids.has('E1')).toBe(true);
  });

  it('returns an empty set for missing or empty input', () => {
    expect(paidEmployeeIds(undefined, 'May', '2027').size).toBe(0);
    expect(paidEmployeeIds([], 'May', '2027').size).toBe(0);
  });

  it('matches the voucher period tolerantly (case/spacing)', () => {
    const ids = paidEmployeeIds([{ employeeId: 'E1', month: 'may  2027' }], 'May', '2027');
    expect(ids.has('E1')).toBe(true);
  });
});

describe('isPaymentMethod', () => {
  it('matches regardless of case and surrounding space', () => {
    expect(isPaymentMethod('Bank', 'Bank')).toBe(true);
    expect(isPaymentMethod('bank', 'Bank')).toBe(true);
    expect(isPaymentMethod('  BANK ', 'Bank')).toBe(true);
    expect(isPaymentMethod('Cash', 'Cash')).toBe(true);
  });

  it('does not confuse the two methods', () => {
    expect(isPaymentMethod('Cash', 'Bank')).toBe(false);
    expect(isPaymentMethod('Bank', 'Cash')).toBe(false);
  });

  it('treats a missing method as neither', () => {
    expect(isPaymentMethod(undefined, 'Bank')).toBe(false);
    expect(isPaymentMethod('', 'Cash')).toBe(false);
  });
});

describe('paidByMethod', () => {
  const vouchers = [
    { employeeId: 'E1', month: 'May 2027', paymentMethod: 'Bank', amount: '12000' },
    { employeeId: 'E2', month: 'May 2027', paymentMethod: 'Cash', amount: '8000' },
    { employeeId: 'E3', month: 'May 2027', paymentMethod: 'Bank', amount: '5000' },
    { employeeId: 'E1', month: 'April 2027', paymentMethod: 'Bank', amount: '9999' },
  ];

  it('lists only the employees paid by that method in that period', () => {
    const bank = paidByMethod(vouchers, 'May', '2027', 'Bank');
    expect([...bank.keys()].sort()).toEqual(['E1', 'E3']);
    expect(bank.get('E1')).toBe(12000);
    expect(bank.get('E3')).toBe(5000);
  });

  it('separates cash from bank', () => {
    const cash = paidByMethod(vouchers, 'May', '2027', 'Cash');
    expect([...cash.keys()]).toEqual(['E2']);
    expect(cash.get('E2')).toBe(8000);
  });

  it('does not leak another period into the report', () => {
    const bank = paidByMethod(vouchers, 'May', '2027', 'Bank');
    expect(bank.get('E1')).toBe(12000); // not 12000 + 9999
  });

  it('sums split payments rather than showing only one', () => {
    const split = paidByMethod([
      { employeeId: 'E1', month: 'May 2027', paymentMethod: 'Bank', amount: '5000' },
      { employeeId: 'E1', month: 'May 2027', paymentMethod: 'Bank', amount: '3000' },
    ], 'May', '2027', 'Bank');
    expect(split.get('E1')).toBe(8000);
  });

  it('matches the period and the method tolerantly', () => {
    const bank = paidByMethod(
      [{ employeeId: 'E1', month: 'may  2027', paymentMethod: ' bank ', amount: 700 }],
      'May', '2027', 'Bank'
    );
    expect(bank.get('E1')).toBe(700);
  });

  it('treats an unusable amount as zero rather than NaN', () => {
    const bank = paidByMethod(
      [{ employeeId: 'E1', month: 'May 2027', paymentMethod: 'Bank', amount: 'abc' }],
      'May', '2027', 'Bank'
    );
    expect(bank.get('E1')).toBe(0);
  });

  it('returns an empty map for missing input', () => {
    expect(paidByMethod(undefined, 'May', '2027', 'Bank').size).toBe(0);
    expect(paidByMethod([], 'May', '2027', 'Cash').size).toBe(0);
  });
});

describe('amountPaidByMethod', () => {
  const vouchers = [
    { employeeId: 'E1', month: 'May 2027', paymentMethod: 'Bank', amount: '12000' },
    { employeeId: 'E2', month: 'May 2027', paymentMethod: 'Cash', amount: '8000' },
  ];

  it('returns the amount paid by that method', () => {
    expect(amountPaidByMethod(vouchers, 'E1', 'May', '2027', 'Bank')).toBe(12000);
  });

  it('distinguishes "not on this list" from "paid zero"', () => {
    // E1 was paid by bank, so there is no cash entry at all.
    expect(amountPaidByMethod(vouchers, 'E1', 'May', '2027', 'Cash')).toBeNull();
    // A real zero-value voucher is not the same as being absent.
    expect(amountPaidByMethod(
      [{ employeeId: 'E9', month: 'May 2027', paymentMethod: 'Cash', amount: 0 }],
      'E9', 'May', '2027', 'Cash'
    )).toBe(0);
  });

  it('returns null for an employee with no vouchers at all', () => {
    expect(amountPaidByMethod(vouchers, 'E404', 'May', '2027', 'Bank')).toBeNull();
  });

  it('handles missing input', () => {
    expect(amountPaidByMethod(undefined, 'E1', 'May', '2027', 'Bank')).toBeNull();
    expect(amountPaidByMethod(vouchers, '', 'May', '2027', 'Bank')).toBeNull();
  });
});

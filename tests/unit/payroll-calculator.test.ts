import { describe, it, expect } from 'vitest';
import { calculatePayroll, calculateHoursBetween } from '../../src/lib/payroll-calculator';

describe('Payroll Calculator', () => {
  describe('calculatePayroll', () => {
    it('calculates gross and net correctly with no deductions or incentives', () => {
      const result = calculatePayroll({
        hoursWorked: 9,
        hourlyRate: 100,
        shiftType: '9-hour',
      });
      
      expect(result.grossPay).toBe(900);
      expect(result.totalDeductions).toBe(0);
      expect(result.netPay).toBe(900);
    });

    it('includes incentives in net pay', () => {
      const result = calculatePayroll({
        hoursWorked: 12,
        hourlyRate: 150,
        shiftType: '12-hour',
        incentive: 200,
      });
      
      expect(result.grossPay).toBe(1800);
      expect(result.netPay).toBe(2000);
    });

    it('subtracts weekly advance and loans from net pay', () => {
      const result = calculatePayroll({
        hoursWorked: 10,
        hourlyRate: 100,
        shiftType: '9-hour',
        weeklyAdvance: 300,
        loanDeduction: 100,
      });
      
      expect(result.grossPay).toBe(1000);
      expect(result.totalDeductions).toBe(400);
      expect(result.netPay).toBe(600);
    });

    it('calculates correctly with zero hours', () => {
      const result = calculatePayroll({
        hoursWorked: 0,
        hourlyRate: 150,
        shiftType: '9-hour',
        incentive: 100,
        weeklyAdvance: 50,
      });
      
      expect(result.grossPay).toBe(0);
      expect(result.netPay).toBe(50); // 0 + 100 - 50
    });
  });

  describe('calculateHoursBetween', () => {
    it('calculates standard shift hours', () => {
      expect(calculateHoursBetween('09:00', '18:00')).toBe(9);
    });

    it('calculates partial hours correctly', () => {
      expect(calculateHoursBetween('09:30', '18:00')).toBe(8.5);
    });

    it('handles overnight shifts correctly', () => {
      expect(calculateHoursBetween('20:00', '06:00')).toBe(10);
    });

    it('returns 0 for missing inputs', () => {
      expect(calculateHoursBetween('', '18:00')).toBe(0);
      expect(calculateHoursBetween('09:00', '')).toBe(0);
      expect(calculateHoursBetween('', '')).toBe(0);
    });
  });
});

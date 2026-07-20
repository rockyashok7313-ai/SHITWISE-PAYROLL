/**
 * Pure functions for payroll calculations.
 */

export interface PayrollCalculationInput {
  hoursWorked: number;
  hourlyRate: number;
  shiftType: '9-hour' | '12-hour';
  incentive?: number;
  weeklyAdvance?: number;
  loanDeduction?: number;
}

export interface PayrollCalculationOutput {
  grossPay: number;
  netPay: number;
  totalDeductions: number;
}

/**
 * Calculates the exact gross and net pay given the worked hours, rate, and adjustments.
 */
export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationOutput {
  const {
    hoursWorked,
    hourlyRate,
    incentive = 0,
    weeklyAdvance = 0,
    loanDeduction = 0
  } = input;

  const grossPay = hoursWorked * hourlyRate;
  const totalDeductions = weeklyAdvance + loanDeduction;
  const netPay = grossPay + incentive - totalDeductions;

  return {
    grossPay,
    netPay,
    totalDeductions
  };
}

/**
 * Helper to calculate decimal hours between two time strings (HH:mm)
 */
export function calculateHoursBetween(clockIn: string, clockOut: string): number {
  if (!clockIn || !clockOut) return 0;
  
  const [inHour, inMin] = clockIn.split(':').map(Number);
  const [outHour, outMin] = clockOut.split(':').map(Number);
  
  if (isNaN(inHour) || isNaN(inMin) || isNaN(outHour) || isNaN(outMin)) return 0;

  let inDate = new Date();
  inDate.setHours(inHour, inMin, 0, 0);

  let outDate = new Date();
  outDate.setHours(outHour, outMin, 0, 0);

  // Handle overnight shifts
  if (outDate < inDate) {
    outDate.setDate(outDate.getDate() + 1);
  }

  const diffMs = outDate.getTime() - inDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.max(0, Number(diffHours.toFixed(2))); // Round to 2 decimal places max for cleanliness
}

/**
 * @fileOverview A mock AI-powered audit tool for analyzing historical attendance data.
 *
 * Runs client-side to allow free static hosting without backend/Server Action requirements.
 */

import { z } from 'zod';

const PayrollAuditInputSchema = z.object({
  companyPayrollData: z.array(
    z.object({
      employeeId: z.string(),
      employeeName: z.string(),
      hourlyRate: z.number(),
      attendance: z.array(
        z.object({
          date: z.string(),
          scheduledShiftType: z.enum(['9-hour', '12-hour', 'custom']),
          actualClockIn: z.string().optional(),
          actualClockOut: z.string().optional(),
          totalHoursWorked: z.number().optional(), 
        })
      )
    })
  ),
  auditPeriod: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }).optional(),
  forecastPeriodMonths: z.number().optional(),
});
export type PayrollAuditInput = z.infer<typeof PayrollAuditInputSchema>;

const PayrollAuditOutputSchema = z.object({
  summary: z.string(),
  unusualShiftPatterns: z.array(
    z.object({
      employeeId: z.string(),
      employeeName: z.string(),
      patternDescription: z.string(),
      exampleDates: z.array(z.string()).optional(),
    })
  ),
  potentialPayrollDiscrepancies: z.array(
    z.object({
      employeeId: z.string(),
      employeeName: z.string(),
      date: z.string().optional(),
      discrepancyType: z.string(),
      details: z.string(),
      suggestedAction: z.string().optional(),
    })
  ),
  costForecast: z.object({
    period: z.string(),
    totalEstimatedLaborCost: z.number(),
    monthlyBreakdown: z.array(
      z.object({
        month: z.string(),
        estimatedCost: z.number(),
      })
    ).optional(),
    notes: z.string().optional(),
  }).optional(),
});
export type PayrollAuditOutput = z.infer<typeof PayrollAuditOutputSchema>;

export async function payrollAuditAssistant(input: PayrollAuditInput): Promise<PayrollAuditOutput> {
  // Simulate network/AI response latency
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    summary: "The payroll audit for the period of Oct 1st to Oct 3rd, 2023, shows high compliance but identifies 2 unusual shift patterns and 1 potential overpayment discrepancy. Labor costs are projected to stabilize in the next quarter.",
    unusualShiftPatterns: [
      {
        employeeId: "emp-1",
        employeeName: "Rajesh Kumar",
        patternDescription: "Excessive shift length exceeding the standard 12-hour shift on Oct 3rd.",
        exampleDates: ["2023-10-03"]
      },
      {
        employeeId: "emp-3",
        employeeName: "Sunita Devi",
        patternDescription: "Inconsistent shift duration, clocking under 12 hours on Oct 2nd.",
        exampleDates: ["2023-10-02"]
      }
    ],
    potentialPayrollDiscrepancies: [
      {
        employeeId: "emp-1",
        employeeName: "Rajesh Kumar",
        date: "2023-10-03",
        discrepancyType: "Unapproved Overtime",
        details: "Worked 13.25 hours instead of the scheduled 12 hours. Calculated overtime payout discrepancy of ₹350.",
        suggestedAction: "Verify supervisor authorization for the extra 1.25 hours."
      }
    ],
    costForecast: {
      period: "Next 3 months",
      totalEstimatedLaborCost: 425000,
      monthlyBreakdown: [
        { month: "2023-11", estimatedCost: 140000 },
        { month: "2023-12", estimatedCost: 142000 },
        { month: "2024-01", estimatedCost: 143000 }
      ],
      notes: "Cost forecast is calculated based on current employee rates and standard shift distribution."
    }
  };
}

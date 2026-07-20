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
  const response = await fetch('/api/gemini-audit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error invoking audit api:", data.error);
    throw new Error(data.error || "Failed to audit payroll data.");
  }

  return data as PayrollAuditOutput;
}

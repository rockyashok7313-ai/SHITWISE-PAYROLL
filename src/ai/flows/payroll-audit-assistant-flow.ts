'use server';
/**
 * @fileOverview An AI-powered audit tool for analyzing historical attendance data.
 *
 * - payrollAuditAssistant - A function that orchestrates the payroll audit process.
 * - PayrollAuditInput - The input type for the payrollAuditAssistant function.
 * - PayrollAuditOutput - The return type for the payrollAuditAssistant function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PayrollAuditInputSchema = z.object({
  companyPayrollData: z.array(
    z.object({
      employeeId: z.string().describe('Unique identifier for the employee.'),
      employeeName: z.string().describe('Name of the employee.'),
      hourlyRate: z.number().describe('The employee\'s hourly pay rate.'),
      attendance: z.array(
        z.object({
          date: z.string().describe('Date of the attendance record (YYYY-MM-DD).'),
          scheduledShiftType: z.enum(['9-hour', '12-hour', 'custom']).describe('Scheduled shift type for the day.'),
          actualClockIn: z.string().optional().describe('Actual clock-in time (HH:MM) if available.'),
          actualClockOut: z.string().optional().describe('Actual clock-out time (HH:MM) if available.'),
          totalHoursWorked: z.number().optional().describe('Total hours worked for the day.'), // Can be derived, but useful for explicit input
        })
      ).describe('List of daily attendance records for the employee.')
    })
  ).describe('Historical attendance data for multiple employees.'),
  auditPeriod: z.object({
    startDate: z.string().describe('Start date for the audit period (YYYY-MM-DD).'),
    endDate: z.string().describe('End date for the audit period (YYYY-MM-DD).'),
  }).optional().describe('Optional date range to focus the audit.'),
  forecastPeriodMonths: z.number().int().min(1).optional().describe('Number of months to forecast labor costs for.'),
});
export type PayrollAuditInput = z.infer<typeof PayrollAuditInputSchema>;

const PayrollAuditOutputSchema = z.object({
  summary: z.string().describe('A general summary of the payroll audit findings, including overall health and key insights.'),
  unusualShiftPatterns: z.array(
    z.object({
      employeeId: z.string().describe('Employee ID with the unusual pattern.'),
      employeeName: z.string().describe('Employee name with the unusual pattern.'),
      patternDescription: z.string().describe('Description of the unusual shift pattern observed.'),
      exampleDates: z.array(z.string()).optional().describe('Example dates where the pattern was observed (YYYY-MM-DD).'),
    })
  ).describe('Identified unusual shift patterns, such as frequent short shifts, excessive overtime, or inconsistent workdays.'),
  potentialPayrollDiscrepancies: z.array(
    z.object({
      employeeId: z.string().describe('Employee ID with the potential discrepancy.'),
      employeeName: z.string().describe('Employee name with the potential discrepancy.'),
      date: z.string().optional().describe('Date of the discrepancy (YYYY-MM-DD).'),
      discrepancyType: z.string().describe('Type of discrepancy (e.g., "Underpaid", "Overpaid", "Unapproved Overtime", "Incorrect Shift Calculation").'),
      details: z.string().describe('Detailed explanation of the discrepancy, including calculated versus expected values.'),
      suggestedAction: z.string().optional().describe('Suggested action to resolve the discrepancy.'),
    })
  ).describe('Potential payroll discrepancies, including under/overpayments, unapproved overtime, or incorrect shift calculations.'),
  costForecast: z.object({
    period: z.string().describe('The period for the forecast (e.g., "Next 3 months").'),
    totalEstimatedLaborCost: z.number().describe('Total estimated labor cost for the forecast period, in USD.'),
    monthlyBreakdown: z.array(
      z.object({
        month: z.string().describe('Month of the forecast (YYYY-MM).'),
        estimatedCost: z.number().describe('Estimated labor cost for that month, in USD.'),
      })
    ).optional().describe('Monthly breakdown of estimated labor costs.'),
    notes: z.string().optional().describe('Any assumptions, factors considered, or caveats regarding the forecast.'),
  }).optional().describe('Forecasted future labor costs based on historical data and identified patterns.'),
});
export type PayrollAuditOutput = z.infer<typeof PayrollAuditOutputSchema>;

export async function payrollAuditAssistant(input: PayrollAuditInput): Promise<PayrollAuditOutput> {
  return payrollAuditAssistantFlow(input);
}

const auditPrompt = ai.definePrompt({
  name: 'payrollAuditAssistantPrompt',
  input: { schema: PayrollAuditInputSchema },
  output: { schema: PayrollAuditOutputSchema },
  prompt: `You are an expert payroll auditor and financial analyst. Your task is to analyze historical attendance data to identify unusual shift patterns, potential payroll discrepancies, and forecast future labor costs.

Here is the historical payroll data for various employees in JSON format:

<DATA>
{{{JSON.stringify companyPayrollData}}}
</DATA>

Perform the following tasks:
1.  **Identify Unusual Shift Patterns**: Look for anomalies like frequent very short or very long shifts, inconsistent days worked, shifts without clock-out, or unusual shift type changes.
2.  **Detect Potential Payroll Discrepancies**: Compare scheduled vs. actual hours, ensure hourly rates are applied correctly, and identify any inconsistencies that could lead to underpayment or overpayment.
3.  **Forecast Labor Costs**: Based on the provided historical data and detected patterns, provide a labor cost forecast.

{{#if auditPeriod}}
Focus your audit specifically on the period from {{{auditPeriod.startDate}}} to {{{auditPeriod.endDate}}}.
{{/if}}

{{#if forecastPeriodMonths}}
Provide a labor cost forecast for the next {{{forecastPeriodMonths}}} months.
{{/if}}

Provide your analysis and findings in a JSON object strictly conforming to the PayrollAuditOutputSchema. Ensure all fields are populated and descriptions are detailed. If no unusual patterns or discrepancies are found, return empty arrays for those fields.`,
});

const payrollAuditAssistantFlow = ai.defineFlow(
  {
    name: 'payrollAuditAssistantFlow',
    inputSchema: PayrollAuditInputSchema,
    outputSchema: PayrollAuditOutputSchema,
  },
  async (input) => {
    const { output } = await auditPrompt(input);
    return output!;
  }
);

"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { payrollAuditAssistant, type PayrollAuditOutput } from "@/ai/flows/payroll-audit-assistant-flow";
import { EMPLOYEES } from "@/lib/mock-data";
import { Sparkles, Loader2, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PayrollAuditTool() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [results, setResults] = useState<PayrollAuditOutput | null>(null);

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      // Prepare mock historical data for the AI
      const mockHistoricalData = EMPLOYEES.map(emp => ({
        employeeId: emp.id,
        employeeName: emp.name,
        hourlyRate: emp.rate,
        attendance: [
          { date: '2023-10-01', scheduledShiftType: emp.shift as any, actualClockIn: '08:00', actualClockOut: '20:15', totalHoursWorked: 12.25 },
          { date: '2023-10-02', scheduledShiftType: emp.shift as any, actualClockIn: '08:05', actualClockOut: '19:55', totalHoursWorked: 11.8 },
          { date: '2023-10-03', scheduledShiftType: emp.shift as any, actualClockIn: '07:30', actualClockOut: '20:45', totalHoursWorked: 13.25 },
        ]
      }));

      const res = await payrollAuditAssistant({
        companyPayrollData: mockHistoricalData,
        forecastPeriodMonths: 3
      });
      setResults(res);
    } catch (error) {
      console.error("Audit failed", error);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-accent" />
                AI Payroll Audit Assistant
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Analyze historical logs to identify discrepancies and forecast labor costs.
              </CardDescription>
            </div>
            <Button 
              onClick={runAudit} 
              disabled={isAuditing}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isAuditing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Logs...
                </>
              ) : (
                "Run Global Audit"
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {results && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border h-[400px] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Detected Discrepancies
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-6">
                <div className="space-y-4 pb-6">
                  {results.potentialPayrollDiscrepancies.length > 0 ? (
                    results.potentialPayrollDiscrepancies.map((d, i) => (
                      <div key={i} className="p-3 border rounded-md bg-destructive/5 border-destructive/20 space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-sm">{d.employeeName}</span>
                          <Badge variant="destructive" className="text-[10px] uppercase">{d.discrepancyType}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{d.details}</p>
                        <div className="pt-2 text-[10px] text-accent font-medium">ACTION: {d.suggestedAction}</div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mb-2 text-accent/20" />
                      <p>No discrepancies found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="bg-card border-border h-[400px] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Cost Forecast & Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-6">
                <div className="space-y-4 pb-6">
                  <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                    <div className="text-xs text-muted-foreground uppercase mb-1">Total Predicted Labor Cost</div>
                    <div className="text-3xl font-headline font-bold text-accent">
                      ${results.costForecast?.totalEstimatedLaborCost.toLocaleString() ?? '0'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">{results.costForecast?.period}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Executive Summary</h4>
                    <p className="text-sm leading-relaxed">{results.summary}</p>
                  </div>

                  {results.costForecast?.monthlyBreakdown && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Monthly Breakdown</h4>
                      <div className="space-y-2">
                        {results.costForecast.monthlyBreakdown.map((m, i) => (
                          <div key={i} className="flex justify-between items-center text-sm p-2 border-b border-border/50">
                            <span>{m.month}</span>
                            <span className="font-mono text-primary">${m.estimatedCost.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

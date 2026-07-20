"use client"

import { PayrollReports } from "@/components/payroll/payroll-reports";

export default function ReportsPage() {
  return (
    <div className="p-8 h-full overflow-y-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground">
          Financial Reporting
        </h2>
        <p className="text-muted-foreground">Detailed payroll reports, bonuses, and tax calculations.</p>
      </header>

      <PayrollReports />
    </div>
  );
}

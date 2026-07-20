"use client"

import { PayrollAuditTool } from "@/components/payroll/audit-tool";

export default function AuditPage() {
  return (
    <div className="p-8 h-full overflow-y-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground">
          Payroll Intelligence
        </h2>
        <p className="text-muted-foreground">AI-powered audit for attendance patterns and payroll discrepancies.</p>
      </header>

      <PayrollAuditTool />
    </div>
  );
}

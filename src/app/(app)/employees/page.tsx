"use client"

import { EmployeeProfiles } from "@/components/dashboard/employee-profiles";

export default function EmployeesPage() {
  return (
    <div className="p-8 h-full overflow-y-auto space-y-6">
      <header className="mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground">
          Staff Management
        </h2>
        <p className="text-muted-foreground">Manage employee profiles, roles, and compensation details.</p>
      </header>

      <EmployeeProfiles />
    </div>
  );
}

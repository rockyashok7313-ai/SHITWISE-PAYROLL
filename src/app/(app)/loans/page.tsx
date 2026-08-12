import { EmployeeLoans } from "@/components/payroll/employee-loans";

export default function LoansPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div>
        <h1 className="font-headline text-2xl font-black tracking-tight">Loan Vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Advances issued to labourers, recovered month by month through the Loan (-) deduction in Attendance.
        </p>
      </div>
      <EmployeeLoans />
    </div>
  );
}

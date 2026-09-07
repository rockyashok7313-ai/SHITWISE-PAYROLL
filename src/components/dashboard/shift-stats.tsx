import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, IndianRupee, TrendingUp } from "lucide-react";

import { useAppContext } from "@/components/providers/app-provider";
import { TiltCard } from "@/components/ui/tilt-card";
import { calculateEntryBreakdown } from "@/lib/payroll";

export function ShiftStats() {
  const { employees = [], attendance = [] } = useAppContext();
  const activeEmployees = employees.length;
  const hoursToday = attendance.reduce((acc, curr) => acc + (curr.hours || 0), 0);

  // Was its own inline formula here -- gross = (hours / shiftHrs) * rate,
  // dividing by the shift length instead of multiplying by it. That very
  // nearly zeroed out gross pay, so any real loan/advance on the row swamped
  // it and this card showed a wildly negative "cost". Route through the
  // shared calculator (lib/payroll.ts) instead, same as the register, the
  // payslip and the voucher, so this card can't drift from those again.
  const projectedCost = attendance.reduce((acc, curr) => {
    const { net } = calculateEntryBreakdown(curr, { rate: 0 });
    return acc + net;
  }, 0);

  // Each stat gets its own hue (from the 5-colour chart palette in
  // globals.css) instead of alternating just primary/accent -- a colored
  // icon "chip" per metric is the current trending dashboard pattern, and
  // it doubles as a quick visual index so a glance at the row tells you
  // which number is which before reading any label.
  const stats = [
    {
      label: "Active Employees",
      value: activeEmployees.toString(),
      icon: Users,
      chip: "bg-[hsl(var(--chart-2))]/15 text-[hsl(var(--chart-2))]",
      ring: "hover:border-[hsl(var(--chart-2))]/50",
    },
    {
      label: "Total Logged Hrs",
      value: hoursToday.toString(),
      icon: Clock,
      chip: "bg-primary/15 text-primary",
      ring: "hover:border-primary/50",
    },
    {
      label: "Projected Cost",
      value: `₹${Math.round(projectedCost).toLocaleString('en-IN')}`,
      icon: IndianRupee,
      chip: "bg-[hsl(var(--chart-4))]/15 text-[hsl(var(--chart-4))]",
      ring: "hover:border-[hsl(var(--chart-4))]/50",
    },
    {
      label: "Efficiency",
      value: activeEmployees > 0 ? "98%" : "0%",
      icon: TrendingUp,
      chip: "bg-[hsl(var(--chart-3))]/15 text-[hsl(var(--chart-3))]",
      ring: "hover:border-[hsl(var(--chart-3))]/50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <TiltCard key={i}>
          <Card className={`bg-card/50 border-border transition-colors h-full ${stat.ring}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.chip}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-headline font-bold font-mono">{stat.value}</div>
            </CardContent>
          </Card>
        </TiltCard>
      ))}
    </div>
  );
}

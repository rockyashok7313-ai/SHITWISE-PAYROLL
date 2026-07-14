import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, IndianRupee, TrendingUp } from "lucide-react";

export interface ShiftStatsProps {
  employees?: any[];
  attendance?: any[];
}

export function ShiftStats({ employees = [], attendance = [] }: ShiftStatsProps) {
  const activeEmployees = employees.length;
  const hoursToday = attendance.reduce((acc, curr) => acc + (curr.hours || 0), 0);
  
  const projectedCost = attendance.reduce((acc, curr) => {
    const shiftHrs = curr.shift === '12-hour' ? 12 : 9;
    const rate = curr.rate || 0;
    const gross = (curr.hours / shiftHrs) * rate;
    const net = gross + (curr.incentive || 0) - (curr.weeklyAdvance || 0) - (curr.loan || 0);
    return acc + net;
  }, 0);

  const stats = [
    { label: "Active Employees", value: activeEmployees.toString(), icon: Users, accent: "text-accent" },
    { label: "Total Logged Hrs", value: hoursToday.toString(), icon: Clock, accent: "text-primary" },
    { label: "Projected Cost", value: `₹${Math.round(projectedCost).toLocaleString('en-IN')}`, icon: IndianRupee, accent: "text-accent" },
    { label: "Efficiency", value: activeEmployees > 0 ? "98%" : "0%", icon: TrendingUp, accent: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <Card key={i} className="bg-card/50 border-border hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {stat.label}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.accent}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-headline font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

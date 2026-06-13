import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, DollarSign, TrendingUp } from "lucide-react";

export function ShiftStats() {
  const stats = [
    { label: "Active Employees", value: "48", icon: Users, accent: "text-accent" },
    { label: "Hours Today", value: "432", icon: Clock, accent: "text-primary" },
    { label: "Projected Cost", value: "$12,450", icon: DollarSign, accent: "text-accent" },
    { label: "Efficiency", value: "94%", icon: TrendingUp, accent: "text-primary" },
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

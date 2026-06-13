"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { FileSpreadsheet, TrendingUp, IndianRupee, PieChart } from "lucide-react";

const data = [
  { month: "Jan", cost: 125000 },
  { month: "Feb", cost: 138000 },
  { month: "Mar", cost: 132000 },
  { month: "Apr", cost: 145000 },
  { month: "May", cost: 152000 },
  { month: "Jun", cost: 148000 },
];

export function PayrollReports() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/30 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <IndianRupee className="w-3 h-3 text-accent" />
              Total Payout (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-headline font-bold">₹4,82,450</div>
            <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +12.5% from last month
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <PieChart className="w-3 h-3 text-primary" />
              OT Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-headline font-bold">18.4%</div>
            <p className="text-[10px] text-muted-foreground mt-1 text-orange-400">Above target threshold (15%)</p>
          </CardContent>
        </Card>
        <Card className="bg-card/30 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <FileSpreadsheet className="w-3 h-3 text-accent" />
              Reports Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-headline font-bold">03</div>
            <p className="text-[10px] text-muted-foreground mt-1">Next audit due in 4 days</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/30 border-border">
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-accent" />
            Labor Cost Trends (2024)
          </CardTitle>
          <CardDescription>Monthly expenditure analysis across all operational units.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₹${value/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value) => [`₹${(value as number).toLocaleString('en-IN')}`, 'Cost']}
                />
                <Bar 
                  dataKey="cost" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

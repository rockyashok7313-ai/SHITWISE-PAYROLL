"use client"

import { ShiftStats } from "@/components/dashboard/shift-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { useAppContext } from "@/components/providers/app-provider";
import { TiltCard } from "@/components/ui/tilt-card";
import dynamic from "next/dynamic";

const LiveShiftGauge = dynamic(() => import("@/components/ui/shift-gauge").then(m => m.LiveShiftGauge), { ssr: false });

export default function DashboardPage() {
  const { attendance } = useAppContext();

  // Calculate some value for the gauge based on attendance
  // e.g. average efficiency or total logged hours vs expected
  const gaugeValue = attendance.length > 0 ? 0.8 : 0.2;

  return (
    <div className="p-8 h-full overflow-y-auto space-y-6">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground">
            Operations Hub
          </h2>
          <p className="text-muted-foreground">Precision shift management and payroll tracking system for India operations.</p>
        </div>
        <div className="w-48 h-48 hidden md:block">
           <LiveShiftGauge value={gaugeValue} />
        </div>
      </header>

      <ShiftStats />

      <TiltCard>
        <Card className="bg-card/30 border-border">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <History className="w-5 h-5 text-accent" />
              Verified Shift History
            </CardTitle>
            <CardDescription>Recent verified attendance and payout calculations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-background/30">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Clock In/Out</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No recent attendance logs found.
                      </TableCell>
                    </TableRow>
                  ) : attendance.slice(0, 5).map((record: any) => {
                    const shiftHrs = record.shift === '12-hour' ? 12 : 9;
                    const gross = (record.hours / shiftHrs) * (record.rate || 0);
                    const earnings = gross + (record.incentive || 0) - (record.weeklyAdvance || 0) - (record.loan || 0);
                    
                    return (
                      <TableRow key={record.id} className="border-border hover:bg-muted/10">
                        <TableCell className="font-medium text-muted-foreground">{record.date}</TableCell>
                        <TableCell className="font-semibold">{record.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={record.shift === '12-hour' ? 'text-accent border-accent/20' : 'text-primary border-primary/20'}>
                            {record.shift}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {record.hours} hrs logged
                        </TableCell>
                        <TableCell className="text-primary font-bold">
                          ₹{earnings.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            Logged
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TiltCard>
    </div>
  );
}

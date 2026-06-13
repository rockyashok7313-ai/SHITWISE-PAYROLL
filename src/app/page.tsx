import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ShiftStats } from "@/components/dashboard/shift-stats";
import { AttendanceLogger } from "@/components/dashboard/attendance-logger";
import { PayrollAuditTool } from "@/components/payroll/audit-tool";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, ListTodo, ShieldCheck, History } from "lucide-react";
import { ATTENDANCE_RECORDS } from "@/lib/mock-data";
import { Toaster } from "@/components/ui/toaster";

export default function Home() {
  return (
    <div className="flex min-h-screen bg-background font-body text-foreground">
      <SidebarNav />
      
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex flex-col gap-1">
          <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground flex items-center gap-3">
            Operations Hub
          </h2>
          <p className="text-muted-foreground">Precision shift management and payroll tracking system for India operations.</p>
        </header>

        <ShiftStats />

        <Tabs defaultValue="attendance" className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 w-fit">
            <TabsTrigger value="attendance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock className="w-4 h-4" />
              Daily Logging
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ShieldCheck className="w-4 h-4" />
              AI Audit
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="w-4 h-4" />
              Shift History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
            <Card className="bg-card/30 border-border">
              <CardContent className="p-6">
                <AttendanceLogger />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <PayrollAuditTool />
          </TabsContent>

          <TabsContent value="history" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Card className="bg-card/30 border-border">
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <History className="w-5 h-5 text-accent" />
                  Recent Shift Logs
                </CardTitle>
                <CardDescription>Comprehensive list of verified historical attendance and payout calculations.</CardDescription>
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
                        <TableHead>Hours</TableHead>
                        <TableHead>Earnings</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ATTENDANCE_RECORDS.map((record) => (
                        <TableRow key={record.id} className="border-border hover:bg-muted/10">
                          <TableCell className="font-medium text-muted-foreground">{record.date}</TableCell>
                          <TableCell className="font-semibold">{record.employeeName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={record.shiftType === '12-hour' ? 'text-accent border-accent/20' : 'text-primary border-primary/20'}>
                              {record.shiftType}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.clockIn} - {record.clockOut}
                          </TableCell>
                          <TableCell>{record.hours.toFixed(2)}</TableCell>
                          <TableCell className="text-primary font-bold">
                            ₹{record.earnings.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={record.status === 'Overtime' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}>
                              {record.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}

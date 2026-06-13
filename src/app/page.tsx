"use client"

import { useState } from "react";
import { SidebarNav, type TabValue } from "@/components/layout/sidebar-nav";
import { ShiftStats } from "@/components/dashboard/shift-stats";
import { AttendanceLogger } from "@/components/dashboard/attendance-logger";
import { PayrollAuditTool } from "@/components/payroll/audit-tool";
import { EmployeeProfiles } from "@/components/dashboard/employee-profiles";
import { PayrollReports } from "@/components/payroll/payroll-reports";
import { FactorySettings } from "@/components/settings/factory-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldCheck, History, Users, FileSpreadsheet, LayoutDashboard, Settings } from "lucide-react";
import { ATTENDANCE_RECORDS } from "@/lib/mock-data";
import { Toaster } from "@/components/ui/toaster";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");

  return (
    <div className="flex min-h-screen bg-background font-body text-foreground">
      <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8 flex flex-col gap-1">
          <h2 className="text-3xl font-headline font-bold tracking-tight text-foreground flex items-center gap-3">
            {activeTab === 'dashboard' && "Operations Hub"}
            {activeTab === 'attendance' && "Attendance Tracking"}
            {activeTab === 'employees' && "Staff Management"}
            {activeTab === 'audit' && "Payroll Intelligence"}
            {activeTab === 'reports' && "Financial Reporting"}
            {activeTab === 'settings' && "Factory Configuration"}
          </h2>
          <p className="text-muted-foreground">Precision shift management and payroll tracking system for India operations.</p>
        </header>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 w-fit">
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock className="w-4 h-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ShieldCheck className="w-4 h-4" />
              AI Audit
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileSpreadsheet className="w-4 h-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
            <ShiftStats />
            <div className="grid grid-cols-1 gap-6">
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
                        {ATTENDANCE_RECORDS.slice(0, 5).map((record) => (
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
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Card className="bg-card/30 border-border">
              <CardContent className="p-6">
                <AttendanceLogger />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <EmployeeProfiles />
          </TabsContent>

          <TabsContent value="audit" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <PayrollAuditTool />
          </TabsContent>

          <TabsContent value="reports" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <PayrollReports />
          </TabsContent>

          <TabsContent value="settings" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <FactorySettings />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}

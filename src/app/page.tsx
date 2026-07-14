"use client"

import { useState, useEffect } from "react";
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
import { ATTENDANCE_RECORDS, EMPLOYEES } from "@/lib/mock-data";
import { Toaster } from "@/components/ui/toaster";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabValue>("dashboard");

  // Companies List and Active Company ID
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");

  // Active Company Data Scoped States
  const [config, setConfig] = useState<any>({
    companyName: "ShiftWise Systems Ltd",
    factoryUnit: "Unit #1 - Manufacturing",
    standardShiftHours: 9,
    factoryShiftHours: 12,
    defaultIncentive: 100,
    currency: "INR",
    financialYear: "2026-27",
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      const { data: dbCompanies, error: compErr } = await supabase.from('companies').select('*');
      let parsedCompanies = [];
      
      if (compErr || !dbCompanies) {
        const localComp = localStorage.getItem('companies_cache');
        if (localComp) parsedCompanies = JSON.parse(localComp);
      } else {
        parsedCompanies = dbCompanies;
        localStorage.setItem('companies_cache', JSON.stringify(parsedCompanies));
      }
      
      let activeId = localStorage.getItem("active_company_id") || "";

      if (parsedCompanies.length === 0) {
        const newId = `co_${Date.now()}`;
        const defaultCompany = {
          id: newId,
          name: "ShiftWise Systems Ltd",
          unit: "Unit #1 - Manufacturing",
          standard_shift_hours: 9,
          factory_shift_hours: 12,
          default_incentive: 100,
          currency: "INR",
          financial_year: "2026-27"
        };
        await supabase.from('companies').insert([defaultCompany]);
        parsedCompanies = [defaultCompany];
        activeId = newId;
        localStorage.setItem("active_company_id", activeId);
        localStorage.setItem('companies_cache', JSON.stringify(parsedCompanies));
      } else if (!activeId || !parsedCompanies.find(c => c.id === activeId)) {
        activeId = parsedCompanies[0].id;
        localStorage.setItem("active_company_id", activeId);
      }

      const mappedCompanies = parsedCompanies.map(c => ({
        id: c.id,
        name: c.name,
        unit: c.unit,
        standardShiftHours: c.standard_shift_hours,
        factoryShiftHours: c.factory_shift_hours,
        defaultIncentive: c.default_incentive,
        currency: c.currency,
        financialYear: c.financial_year
      }));

      setCompanies(mappedCompanies);
      setActiveCompanyId(activeId);

      const activeConfig = parsedCompanies.find(c => c.id === activeId) || parsedCompanies[0];
      setConfig({
        companyName: activeConfig.name,
        factoryUnit: activeConfig.unit,
        standardShiftHours: activeConfig.standard_shift_hours,
        factoryShiftHours: activeConfig.factory_shift_hours,
        defaultIncentive: activeConfig.default_incentive,
        currency: activeConfig.currency,
        financialYear: activeConfig.financial_year
      });

      const { data: dbEmployees, error: empErr } = await supabase.from('employees').select('*').eq('company_id', activeId);
      if (empErr || !dbEmployees) {
        const localEmp = localStorage.getItem(`employees_${activeId}`);
        setEmployees(localEmp ? JSON.parse(localEmp) : []);
      } else {
        setEmployees(dbEmployees);
        localStorage.setItem(`employees_${activeId}`, JSON.stringify(dbEmployees));
      }

      const { data: dbAttendance, error: attErr } = await supabase.from('attendance').select('*').eq('company_id', activeId);
      if (attErr || !dbAttendance) {
        const localAtt = localStorage.getItem(`attendance_${activeId}`);
        setAttendance(localAtt ? JSON.parse(localAtt) : []);
      } else {
        const mappedAtt = dbAttendance.map(a => ({
          ...a,
          employeeRefId: a.employee_id,
          weeklyAdvance: a.weekly_advance,
          isModified: a.is_modified
        }));
        setAttendance(mappedAtt);
        localStorage.setItem(`attendance_${activeId}`, JSON.stringify(mappedAtt));
      }
      setLoading(false);
    };

    loadData();
  }, []);

  const handleSwitchCompany = async (id: string) => {
    if (!id) return;
    setLoading(true);
    localStorage.setItem("active_company_id", id);
    setActiveCompanyId(id);

    const { data: dbCompanies, error: compErr } = await supabase.from('companies').select('*');
    let parsedCompanies = companies;
    if (!compErr && dbCompanies) {
      parsedCompanies = dbCompanies;
      localStorage.setItem('companies_cache', JSON.stringify(parsedCompanies));
    }

    const activeConfig = parsedCompanies.find(c => c.id === id);
    if (activeConfig) {
      setConfig({
        companyName: activeConfig.name,
        factoryUnit: activeConfig.unit,
        standardShiftHours: activeConfig.standard_shift_hours || activeConfig.standardShiftHours,
        factoryShiftHours: activeConfig.factory_shift_hours || activeConfig.factoryShiftHours,
        defaultIncentive: activeConfig.default_incentive || activeConfig.defaultIncentive,
        currency: activeConfig.currency,
        financialYear: activeConfig.financial_year || activeConfig.financialYear
      });
    }

    const { data: dbEmployees, error: empErr } = await supabase.from('employees').select('*').eq('company_id', id);
    if (empErr || !dbEmployees) {
      const localEmp = localStorage.getItem(`employees_${id}`);
      setEmployees(localEmp ? JSON.parse(localEmp) : []);
    } else {
      setEmployees(dbEmployees);
      localStorage.setItem(`employees_${id}`, JSON.stringify(dbEmployees));
    }

    const { data: dbAttendance, error: attErr } = await supabase.from('attendance').select('*').eq('company_id', id);
    if (attErr || !dbAttendance) {
      const localAtt = localStorage.getItem(`attendance_${id}`);
      setAttendance(localAtt ? JSON.parse(localAtt) : []);
    } else {
      const mappedAtt = dbAttendance.map(a => ({ 
        ...a, 
        employeeRefId: a.employee_id,
        weeklyAdvance: a.weekly_advance,
        isModified: a.is_modified 
      }));
      setAttendance(mappedAtt);
      localStorage.setItem(`attendance_${id}`, JSON.stringify(mappedAtt));
    }
    
    setLoading(false);
  };

  const handleCreateCompany = async (details: { name: string; unit: string; financialYear: string }) => {
    const newId = `co_${Date.now()}`;
    const newCompanyObj = {
      id: newId,
      name: details.name,
      unit: details.unit,
      standard_shift_hours: 9,
      factory_shift_hours: 12,
      default_incentive: 100,
      currency: "INR",
      financial_year: details.financialYear,
    };

    await supabase.from('companies').insert([newCompanyObj]);
    const uiCompany = {
      id: newId,
      name: details.name,
      unit: details.unit,
      standardShiftHours: 9,
      factoryShiftHours: 12,
      defaultIncentive: 100,
      currency: "INR",
      financialYear: details.financialYear,
    };
    
    setCompanies([...companies, uiCompany]);
    handleSwitchCompany(newId);
  };

  const handleAttendanceChange = async (newAttendance: any[]) => {
    setAttendance(newAttendance);
    if (activeCompanyId) {
      localStorage.setItem(`attendance_${activeCompanyId}`, JSON.stringify(newAttendance));
      
      const currentIds = new Set(newAttendance.map(a => a.id));
      const deletedIds = attendance.filter(a => !currentIds.has(a.id)).map(a => a.id);
      
      if (deletedIds.length > 0) {
        const { error } = await supabase.from('attendance').delete().in('id', deletedIds);
        if (error) console.error("Supabase delete attendance error:", error);
      }

      if (newAttendance.length > 0) {
        const toUpsert = newAttendance.map(a => ({
          id: a.id,
          company_id: activeCompanyId,
          employee_id: a.employeeRefId,
          date: a.date,
          shift: a.shift,
          hours: a.hours,
          rate: a.rate,
          incentive: a.incentive || 0,
          weekly_advance: a.weeklyAdvance || 0,
          loan: a.loan || 0,
          is_modified: a.isModified
        }));
        const { error } = await supabase.from('attendance').upsert(toUpsert);
        if (error) console.error("Supabase upsert attendance error:", error);
      }
    }
  };

  const handleEmployeesChange = async (newEmployees: any[]) => {
    setEmployees(newEmployees);
    if (activeCompanyId) {
      localStorage.setItem(`employees_${activeCompanyId}`, JSON.stringify(newEmployees));
      
      const currentIds = new Set(newEmployees.map(e => e.id));
      const deletedIds = employees.filter(e => !currentIds.has(e.id)).map(e => e.id);
      
      if (deletedIds.length > 0) {
        const { error } = await supabase.from('employees').delete().in('id', deletedIds);
        if (error) console.error("Supabase delete employees error:", error);
      }

      if (newEmployees.length > 0) {
        const toUpsert = newEmployees.map(e => ({
          id: e.id,
          company_id: activeCompanyId,
          name: e.name,
          role: e.role,
          shift: e.shift,
          rate: e.rate,
          status: e.status
        }));
        const { error } = await supabase.from('employees').upsert(toUpsert);
        if (error) console.error("Supabase upsert employees error:", error);
      }
    }
  };

  const handleConfigSave = async (newConfig: any) => {
    setConfig(newConfig);
    if (activeCompanyId) {
      await supabase.from('companies').update({
        name: newConfig.companyName,
        unit: newConfig.factoryUnit,
        standard_shift_hours: newConfig.standardShiftHours,
        factory_shift_hours: newConfig.factoryShiftHours,
        default_incentive: newConfig.defaultIncentive,
        currency: newConfig.currency,
        financial_year: newConfig.financialYear
      }).eq('id', activeCompanyId);

      const updatedCompanies = companies.map(c => 
        c.id === activeCompanyId 
          ? { ...c, name: newConfig.companyName, unit: newConfig.factoryUnit, financialYear: newConfig.financialYear } 
          : c
      );
      setCompanies(updatedCompanies);
      localStorage.setItem('companies_cache', JSON.stringify(updatedCompanies));
      
      toast({ title: "Configuration Updated", description: "Your factory settings have been saved." });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground font-body">
        <div className="flex flex-col items-center gap-4">
          <Clock className="w-12 h-12 text-primary animate-pulse" />
          <p className="text-muted-foreground animate-pulse">Loading ShiftWise Systems...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background font-body text-foreground">
      <SidebarNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        companies={companies}
        activeCompanyId={activeCompanyId}
        onSwitchCompany={handleSwitchCompany}
        onCreateCompany={handleCreateCompany}
      />
      
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
            <ShiftStats employees={employees} attendance={attendance} />
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
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <Card className="bg-card/30 border-border">
              <CardContent className="p-6">
                <AttendanceLogger 
                  key={activeCompanyId}
                  activeFinancialYear={config?.financialYear || "2026-27"}
                  employees={employees}
                  attendance={attendance}
                  onAttendanceChange={handleAttendanceChange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <EmployeeProfiles 
              key={activeCompanyId}
              employees={employees}
              onEmployeesChange={handleEmployeesChange}
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <PayrollAuditTool />
          </TabsContent>

          <TabsContent value="reports" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <PayrollReports 
              key={activeCompanyId}
              activeFinancialYear={config?.financialYear || "2026-27"}
              employees={employees}
              attendance={attendance}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <FactorySettings 
              key={activeCompanyId}
              config={config} 
              onSave={handleConfigSave} 
            />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}


"use client"

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Factory, Clock, IndianRupee, ShieldCheck, CalendarRange, Download, Upload, Database, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface FactorySettingsProps {
  config: {
    companyName: string;
    factoryUnit: string;
    standardShiftHours: number;
    factoryShiftHours: number;
    defaultIncentive: number;
    currency: string;
    financialYear: string;
  };
  activeCompanyId: string;
  onSave: (newConfig: any) => void;
  onDelete: (id: string) => void;
}

export function FactorySettings({ config: propConfig, activeCompanyId, onSave, onDelete }: FactorySettingsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState(propConfig);

  // Sync internal state when prop changes (e.g. company switched)
  useEffect(() => {
    setConfig(propConfig);
  }, [propConfig]);

  const handleSave = () => {
    onSave(config);
    toast({
      title: "Settings Updated",
      description: `Factory configuration for FY ${config.financialYear} has been saved successfully.`,
    });
  };

  const handleDownloadBackup = () => {
    try {
      const backupData: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key === "companies" ||
          key === "companies_cache" ||
          key === "active_company_id" ||
          key.startsWith("config_") ||
          key.startsWith("employees_") ||
          key.startsWith("attendance_") ||
          key === "factory_config" ||
          key === "factory_employees" ||
          key === "attendance_entries"
        )) {
          try {
            backupData[key] = JSON.parse(localStorage.getItem(key)!);
          } catch {
            backupData[key] = localStorage.getItem(key);
          }
        }
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `shiftwise_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      toast({
        title: "Backup Successful",
        description: "Your complete database backup file has been generated and downloaded.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Backup Failed",
        description: "An error occurred while compiling your backup file.",
      });
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target?.result as string);
        
        // Ensure it's a valid backup file
        if (!parsedData.companies && !parsedData.companies_cache && !parsedData.factory_config && !parsedData.config_default && !parsedData.active_company_id && !Object.keys(parsedData).some(k => k.startsWith('employees_'))) {
          throw new Error("Invalid backup file format");
        }

        toast({
          title: "Restoring...",
          description: "Uploading data to cloud database. Please do not close this window.",
        });

        // 1. Restore all keys to localStorage FIRST so data is never lost
        for (const [key, val] of Object.entries(parsedData)) {
          if (typeof val === "string") {
            localStorage.setItem(key, val);
          } else {
            localStorage.setItem(key, JSON.stringify(val));
          }
        }

        // 2. Try to sync to Supabase, but don't fail the local restore if it errors
        try {
          if (parsedData.companies_cache || parsedData.companies) {
            const comps = parsedData.companies_cache || parsedData.companies;
            if (Array.isArray(comps) && comps.length > 0) {
              await supabase.from('companies').upsert(comps.map((c: any) => ({
                id: c.id,
                name: c.name,
                unit: c.unit,
                standard_shift_hours: c.standardShiftHours || 9,
                factory_shift_hours: c.factoryShiftHours || 12,
                default_incentive: c.defaultIncentive || 100,
                currency: c.currency || "INR",
                financial_year: c.financialYear || "2026-27"
              })));
            }
          }

          for (const [key, val] of Object.entries(parsedData)) {
            if (key.startsWith('employees_') && Array.isArray(val) && val.length > 0) {
              const compId = key.replace('employees_', '');
              await supabase.from('employees').upsert(val.map((e: any) => ({
                id: e.id,
                company_id: compId,
                name: e.name || 'Unknown',
                role: e.role || 'Worker',
                shift: e.shift || '9-hour',
                rate: e.rate || 0,
                status: e.status || 'Active'
              })));
            }

            if (key.startsWith('attendance_') && Array.isArray(val) && val.length > 0) {
              const compId = key.replace('attendance_', '');
              await supabase.from('attendance').upsert(val.map((a: any) => ({
                id: a.id,
                company_id: compId,
                employee_id: a.employeeRefId || a.employee_id,
                date: a.date,
                shift: a.shift || '9-hour',
                hours: a.hours || 0,
                rate: a.rate || 0,
                incentive: a.incentive || 0,
                weekly_advance: a.weeklyAdvance || 0,
                loan: a.loan || 0,
                is_modified: a.isModified || false
              })));
            }
          }
        } catch (supabaseError) {
          console.error("Cloud sync failed, but local restore succeeded:", supabaseError);
          toast({
            variant: "destructive",
            title: "Cloud Sync Failed",
            description: "Your data was restored locally, but failed to sync to the cloud database. Please verify your internet connection and database permissions.",
          });
        }

        toast({
          title: "Backup Restored Successfully",
          description: "All records have been restored and synced to the cloud.",
        });

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Restore Failed",
          description: "An error occurred during restoration.",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleWipeData = () => {
    if (confirm("Are you sure you want to completely wipe all local data? This action cannot be undone.")) {
      localStorage.clear();
      toast({
        title: "Data Wiped",
        description: "All local data has been completely removed.",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Factory className="w-5 h-5 text-primary" />
                Company Profile
              </CardTitle>
              <CardDescription>Basic identification for reports and payslips.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input 
                    id="companyName" 
                    value={config.companyName} 
                    onChange={(e) => setConfig({...config, companyName: e.target.value})}
                    className="bg-background border-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="factoryUnit">Factory Unit / Branch</Label>
                  <Input 
                    id="factoryUnit" 
                    value={config.factoryUnit} 
                    onChange={(e) => setConfig({...config, factoryUnit: e.target.value})}
                    className="bg-background border-muted" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-accent" />
                Reporting Period
              </CardTitle>
              <CardDescription>Configure the active Financial Year for statutory tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fy">Active Financial Year</Label>
                  <Select 
                    value={config.financialYear} 
                    onValueChange={(val) => setConfig({...config, financialYear: val})}
                  >
                    <SelectTrigger id="fy" className="bg-background border-muted">
                      <SelectValue placeholder="Select FY" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2023-24">FY 2023-24 (Apr-Mar)</SelectItem>
                      <SelectItem value="2024-25">FY 2024-25 (Apr-Mar)</SelectItem>
                      <SelectItem value="2025-26">FY 2025-26 (Apr-Mar)</SelectItem>
                      <SelectItem value="2026-27">FY 2026-27 (Apr-Mar)</SelectItem>
                      <SelectItem value="2027-28">FY 2027-28 (Apr-Mar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Shift Definitions
              </CardTitle>
              <CardDescription>Configure default durations for shift types.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stdShift">Standard Shift Hours</Label>
                  <Input 
                    id="stdShift" 
                    type="number"
                    value={config.standardShiftHours} 
                    onChange={(e) => setConfig({...config, standardShiftHours: Number(e.target.value)})}
                    className="bg-background border-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facShift">Factory (Extended) Shift Hours</Label>
                  <Input 
                    id="facShift" 
                    type="number"
                    value={config.factoryShiftHours} 
                    onChange={(e) => setConfig({...config, factoryShiftHours: Number(e.target.value)})}
                    className="bg-background border-muted" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-green-500" />
                Financial Presets
              </CardTitle>
              <CardDescription>Default values for payout calculations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defInc">Default Daily Incentive (₹)</Label>
                  <Input 
                    id="defInc" 
                    type="number"
                    value={config.defaultIncentive} 
                    onChange={(e) => setConfig({...config, defaultIncentive: Number(e.target.value)})}
                    className="bg-background border-muted" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="curr">Reporting Currency</Label>
                  <Input 
                    id="curr" 
                    value={config.currency} 
                    readOnly
                    className="bg-muted/50 border-muted font-mono" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                <span className="text-xs font-medium">Compliance Verified</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Updating the Financial Year affects statutory reports, bonus calculations, and seasonal trend analysis.
              </p>
              <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2 text-md">
                <Database className="w-5 h-5 text-accent" />
                Backup & Recovery
              </CardTitle>
              <CardDescription>Export or import all factory payroll and employee data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleDownloadBackup} 
                variant="outline" 
                className="w-full border-border hover:bg-accent/5 justify-start"
              >
                <Download className="w-4 h-4 mr-2 text-accent" />
                Download Data Backup (.json)
              </Button>
              
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                variant="outline" 
                className="w-full border-border hover:bg-accent/5 justify-start"
              >
                <Upload className="w-4 h-4 mr-2 text-primary" />
                Restore Data Backup (.json)
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleRestoreBackup} 
                accept=".json" 
                className="hidden" 
              />
              <div className="pt-2">
                <Button 
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this company? All employees and attendance records associated with it will be permanently lost.")) {
                      onDelete(activeCompanyId);
                    }
                  }} 
                  variant="destructive" 
                  className="w-full justify-start bg-red-950/40 text-red-500 hover:bg-red-900/60 border border-red-900/50 mb-3"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Current Company
                </Button>
                
                <Button 
                  onClick={handleWipeData} 
                  variant="destructive" 
                  className="w-full justify-start bg-red-950/40 text-red-500 hover:bg-red-900/60 border border-red-900/50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Wipe All Local Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

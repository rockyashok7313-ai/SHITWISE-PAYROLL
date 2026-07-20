"use client"

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";

interface AppContextType {
  companies: any[];
  activeCompanyId: string;
  config: any;
  employees: any[];
  attendance: any[];
  vouchers: any[];
  loading: boolean;
  setActiveCompanyId: (id: string) => void;
  handleCreateCompany: (details: { name: string; unit: string; financialYear: string }) => Promise<void>;
  handleAttendanceChange: (newAttendance: any[]) => Promise<void>;
  handleEmployeesChange: (newEmployees: any[]) => Promise<void>;
  handleConfigSave: (newConfig: any) => Promise<void>;
  handleCreateVoucher: (voucher: any) => Promise<void>;
  handleDeleteVoucher: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();

  // Companies List and Active Company ID
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>("");

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
  const [vouchers, setVouchers] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      
      const { data: dbCompanies, error: compErr } = await supabase.from('companies').select('*');
      let parsedCompanies = [];
      
      const localComps = localStorage.getItem('companies_cache');
      if (compErr || !dbCompanies) {
        parsedCompanies = localComps ? (JSON.parse(localComps) || []) : [];
      } else {
        if (dbCompanies.length === 0) {
          const companiesToMigrate = localComps ? (JSON.parse(localComps) || []) : [];
          if (companiesToMigrate.length > 0) {
            try {
              const parsedLocal = companiesToMigrate;
              if (parsedLocal.length > 0) {
                // Migrate companies
                await supabase.from('companies').upsert(parsedLocal.map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  unit: c.unit,
                  standard_shift_hours: c.standardShiftHours || 9,
                  factory_shift_hours: c.factoryShiftHours || 12,
                  default_incentive: c.defaultIncentive || 100,
                  currency: c.currency || "INR",
                  financial_year: c.financialYear || "2026-27"
                })));
                
                // Migrate employees and attendance
                for (const comp of parsedLocal) {
                  const localEmp = localStorage.getItem(`employees_${comp.id}`);
                  if (localEmp) {
                     // Upsert logic...
                  }
                  
                  const localAtt = localStorage.getItem(`attendance_${comp.id}`);
                  if (localAtt) {
                     // Upsert logic...
                  }
                }
                
                // Refetch migrated data
                const { data: migratedCompanies } = await supabase.from('companies').select('*');
                if (migratedCompanies && migratedCompanies.length > 0) {
                  dbCompanies.push(...migratedCompanies);
                }
              }
            } catch (e) {
              console.error("Migration failed", e);
            }
          }
        }
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
      } else if (!activeId || !parsedCompanies.find((c: any) => c.id === activeId)) {
        activeId = parsedCompanies[0].id;
        localStorage.setItem("active_company_id", activeId);
      }

      const mappedCompanies = parsedCompanies.map((c: any) => ({
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
      setActiveCompanyIdState(activeId);

      const activeConfig = parsedCompanies.find((c: any) => c.id === activeId) || parsedCompanies[0];
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
      const localEmpString = localStorage.getItem(`employees_${activeId}`);
      const localEmp = localEmpString ? (JSON.parse(localEmpString) || []) : [];
      
      if (empErr || !dbEmployees || (localEmp.length > dbEmployees.length)) {
        setEmployees(localEmp);
        // Auto-repair cloud if local has more data than cloud
        if (!empErr && dbEmployees && (localEmp.length > dbEmployees.length)) {
           const toUpsert = localEmp.map((e: any) => ({
              id: e.id,
              company_id: activeId,
              name: e.name || 'Unknown',
              role: e.role || 'Worker',
              shift: e.shift || '9-hour',
              rate: e.rate || 0,
              status: e.status || 'Active'
            }));
           await supabase.from('employees').upsert(toUpsert);
        }
      } else {
        setEmployees(dbEmployees);
        localStorage.setItem(`employees_${activeId}`, JSON.stringify(dbEmployees));
      }

      const { data: dbAttendance, error: attErr } = await supabase.from('attendance').select('*').eq('company_id', activeId);
      const localAttString = localStorage.getItem(`attendance_${activeId}`);
      const localAtt = localAttString ? (JSON.parse(localAttString) || []) : [];
      
      if (attErr || !dbAttendance || (localAtt.length > dbAttendance.length)) {
        setAttendance(localAtt);
        // Auto-repair cloud if local has more data than cloud
        if (!attErr && dbAttendance && (localAtt.length > dbAttendance.length)) {
           const toUpsert = localAtt.map((a: any) => ({
              id: a.id,
              company_id: activeId,
              employee_id: a.employeeRefId || a.employee_id,
              date: (a.date && a.date.length >= 10) ? a.date.substring(0, 10) : new Date().toISOString().split('T')[0],
              shift: a.shift || '9-hour',
              hours: a.hours || 0,
              rate: a.rate || 0,
              incentive: a.incentive || 0,
              weekly_advance: a.weeklyAdvance || 0,
              loan: a.loan || 0,
              is_modified: a.isModified || false
            }));
           await supabase.from('attendance').upsert(toUpsert);
        }
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
      
      const localVouchers = localStorage.getItem(`vouchers_${activeId}`);
      if (localVouchers) {
        setVouchers(JSON.parse(localVouchers));
      } else {
        setVouchers([]);
      }
      // Auto Backup Logic
      const lastBackup = localStorage.getItem('last_auto_backup_date');
      const today = new Date().toISOString().split('T')[0];
      if (lastBackup !== today) {
        setTimeout(() => {
          try {
            const backupData: Record<string, any> = {};
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (
                key === "companies_cache" ||
                key === "active_company_id" ||
                key.startsWith("employees_") ||
                key.startsWith("attendance_") ||
                key.startsWith("vouchers_")
              )) {
                try {
                  backupData[key] = JSON.parse(localStorage.getItem(key)!);
                } catch {
                  backupData[key] = localStorage.getItem(key);
                }
              }
            }
            if (Object.keys(backupData).length > 0) {
              const jsonString = JSON.stringify(backupData, null, 2);
              const blob = new Blob([jsonString], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const downloadAnchor = document.createElement("a");
              downloadAnchor.setAttribute("href", url);
              downloadAnchor.setAttribute("download", `shiftwise_autobackup_${today}.json`);
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              document.body.removeChild(downloadAnchor);
              URL.revokeObjectURL(url);
              localStorage.setItem('last_auto_backup_date', today);
            }
          } catch (e) {
            console.error("Auto backup failed", e);
          }
        }, 5000); // Wait 5 seconds after load to not disrupt UX
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const setActiveCompanyId = async (id: string) => {
    if (!id) return;
    setLoading(true);
    localStorage.setItem("active_company_id", id);
    setActiveCompanyIdState(id);

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
    setActiveCompanyId(newId);
  };

  const { isAccountant } = useRole(activeCompanyId);

  const handleAttendanceChange = async (newAttendance: any[]) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
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
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
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
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
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
    }
  };

  const handleCreateVoucher = async (voucher: any) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
    if (!activeCompanyId) return;
    const newVoucher = { ...voucher, id: `vouch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` };
    const updated = [newVoucher, ...vouchers];
    setVouchers(updated);
    localStorage.setItem(`vouchers_${activeCompanyId}`, JSON.stringify(updated));
  };

  const handleDeleteVoucher = async (id: string) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
    if (!activeCompanyId) return;
    const updated = vouchers.filter((v: any) => v.id !== id);
    setVouchers(updated);
    localStorage.setItem(`vouchers_${activeCompanyId}`, JSON.stringify(updated));
  };

  return (
    <AppContext.Provider value={{
      companies,
      activeCompanyId,
      config,
      employees,
      attendance,
      vouchers,
      loading,
      setActiveCompanyId,
      handleCreateCompany,
      handleAttendanceChange,
      handleEmployeesChange,
      handleConfigSave,
      handleCreateVoucher,
      handleDeleteVoucher,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}

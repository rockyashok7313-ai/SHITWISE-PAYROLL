"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { mergeById, liveRecords, recordsToPush, reconcileBulk, sameSyncState } from "@/lib/sync";
import { shouldAutoBackup, downloadBackupNow, DEFAULT_AUTO_BACKUP_INTERVAL_MS } from "@/lib/backup";
import {
  detectWageChanges,
  buildWageChangeAudit,
  buildVoucherDeleteAudit,
  type AuditRow,
  type AuditActor,
} from "@/lib/audit";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";

/** Lifecycle of a save, for the global save indicator. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AppContextType {
  companies: any[];
  activeCompanyId: string;
  config: any;
  employees: any[];
  attendance: any[];
  vouchers: any[];
  loans: any[];
  loading: boolean;
  saveStatus: SaveStatus;
  /** Why the last cloud save failed, if it did. */
  saveError: string | null;
  setActiveCompanyId: (id: string) => void;
  handleCreateCompany: (details: { name: string; unit: string; financialYear: string }) => Promise<void>;
  handleAttendanceChange: (newAttendance: any[]) => Promise<void>;
  handleEmployeesChange: (newEmployees: any[]) => Promise<void>;
  handleConfigSave: (newConfig: any) => Promise<void>;
  handleCreateVoucher: (voucher: any) => Promise<void>;
  handleUpdateVoucher: (id: string, updates: any) => Promise<void>;
  handleDeleteVoucher: (id: string) => Promise<void>;
  handleCreateLoan: (loan: any) => Promise<void>;
  handleDeleteLoan: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/* Voucher field mapping between the app's camelCase shape and the snake_case
 * `vouchers` table, mirroring how attendance/employees are mapped elsewhere in
 * this provider. */
const voucherToRow = (v: any, companyId: string) => ({
  id: v.id,
  company_id: companyId,
  employee_id: v.employeeId,
  employee_name: v.employeeName,
  month: v.month,
  date: v.date,
  amount: Number(v.amount) || 0,
  payment_method: v.paymentMethod,
  remarks: v.remarks || null,
  // Sync fields. updatedAt is the merge version key; default it so pre-sync
  // vouchers get a timestamp the first time they are written up.
  updated_at: v.updatedAt || new Date().toISOString(),
  deleted_at: v.deletedAt || null,
});

const rowToVoucher = (r: any) => ({
  id: r.id,
  employeeId: r.employee_id,
  employeeName: r.employee_name,
  month: r.month,
  date: r.date,
  amount: r.amount,
  paymentMethod: r.payment_method,
  remarks: r.remarks || "",
  updatedAt: r.updated_at || null,
  deletedAt: r.deleted_at || null,
});

/* Loans. Repayments are NOT stored here -- they are the `loan` deductions
 * already recorded on attendance, and the outstanding balance is derived from
 * the two (see lib/loans). Requires migration 0009. */
const loanToRow = (l: any, companyId: string) => ({
  id: l.id,
  company_id: companyId,
  employee_id: l.employeeId,
  amount: Number(l.amount) || 0,
  issue_date: l.issueDate || null,
  remarks: l.remarks || null,
  updated_at: l.updatedAt || new Date().toISOString(),
  deleted_at: l.deletedAt || null,
});

const rowToLoan = (r: any) => ({
  id: r.id,
  employeeId: r.employee_id,
  amount: r.amount,
  issueDate: r.issue_date,
  remarks: r.remarks || "",
  updatedAt: r.updated_at || null,
  deletedAt: r.deleted_at || null,
});

/* The profile fields below (gender, mobile, bank details, photo) were
 * collected by the Employee Profiles form but omitted from these mappers, so
 * they were silently dropped on every sync and lost on reload from cloud.
 * gender is now load-bearing -- Add Attendance derives the default shift from
 * it -- so it has to round-trip. Requires migration 0004. */
const employeeToRow = (e: any, companyId: string) => ({
  id: e.id,
  company_id: companyId,
  name: e.name,
  role: e.role,
  shift: e.shift,
  rate: e.rate,
  status: e.status,
  gender: e.gender || null,
  mobile: e.mobile || null,
  bank_name: e.bankName || null,
  account_number: e.accountNumber || null,
  ifsc_code: e.ifscCode || null,
  photo_url: e.photoUrl || null,
  updated_at: e.updatedAt || new Date().toISOString(),
  deleted_at: e.deletedAt || null,
});

const rowToEmployee = (r: any) => ({
  id: r.id,
  name: r.name,
  role: r.role,
  shift: r.shift,
  rate: r.rate,
  status: r.status,
  gender: r.gender || "",
  mobile: r.mobile || "",
  bankName: r.bank_name || "",
  accountNumber: r.account_number || "",
  ifscCode: r.ifsc_code || "",
  photoUrl: r.photo_url || "",
  updatedAt: r.updated_at || null,
  deletedAt: r.deleted_at || null,
});

const attendanceToRow = (a: any, companyId: string) => ({
  id: a.id,
  company_id: companyId,
  employee_id: a.employeeRefId,
  date: a.date,
  shift: a.shift,
  clock_in: a.clockIn,
  clock_out: a.clockOut,
  hours: a.hours,
  rate: a.rate,
  incentive: a.incentive || 0,
  weekly_advance: a.weeklyAdvance || 0,
  loan: a.loan || 0,
  is_modified: a.isModified || false,
  updated_at: a.updatedAt || new Date().toISOString(),
  deleted_at: a.deletedAt || null,
});

const rowToAttendance = (r: any) => ({
  id: r.id,
  employeeRefId: r.employee_id,
  date: r.date,
  shift: r.shift,
  clockIn: r.clock_in,
  clockOut: r.clock_out,
  hours: r.hours,
  rate: r.rate,
  incentive: r.incentive,
  weeklyAdvance: r.weekly_advance,
  loan: r.loan,
  isModified: r.is_modified,
  updatedAt: r.updated_at || null,
  deletedAt: r.deleted_at || null,
});

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
  const [loans, setLoans] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  /* Global save feedback. Every mutation handler below reports through
   * markSaving/markSaved/markSaveError, so the indicator is consistent across
   * attendance, employees, vouchers and settings rather than each screen
   * inventing its own. */
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  /* The reason a cloud save failed, surfaced in the indicator. Without this a
   * failure is just "sync failed" and diagnosing it means digging through the
   * browser console -- which is how a missing clock_in/clock_out column went
   * unnoticed while every attendance save silently failed. */
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSaveTimer = () => {
    if (saveResetTimer.current) {
      clearTimeout(saveResetTimer.current);
      saveResetTimer.current = null;
    }
  };

  const markSaving = () => { clearSaveTimer(); setSaveError(null); setSaveStatus('saving'); };

  const settleSave = (status: 'saved' | 'error') => {
    clearSaveTimer();
    setSaveStatus(status);
    // Errors linger longer -- they are worth reading before they disappear.
    saveResetTimer.current = setTimeout(() => setSaveStatus('idle'), status === 'saved' ? 1800 : 5000);
  };

  const markSaved = () => settleSave('saved');
  const markSaveError = (err?: { message?: string } | null) => {
    setSaveError(err?.message ?? null);
    settleSave('error');
  };

  /**
   * Writes audit rows, fire-and-forget.
   *
   * Deliberately swallows every failure: an audit write must never be able
   * to fail a payroll edit. A missing audit row is bad; a lost wage change
   * or a voucher that appears deleted but is not, is worse. Failures are
   * logged so they are still diagnosable.
   */
  const recordAudit = async (rows: AuditRow[]) => {
    if (!rows.length) return;
    try {
      const { error } = await supabase.from('audit_logs').insert(rows);
      if (error) console.error("Audit log write failed:", error);
    } catch (e) {
      console.error("Audit log write threw:", e);
    }
  };

  /** Current user for audit attribution. Never throws -- an unattributed
   *  audit row is far better than no audit row. */
  const getAuditActor = async (): Promise<AuditActor> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return { userId: user?.id ?? null, userEmail: user?.email ?? null };
    } catch {
      return { userId: null, userEmail: null };
    }
  };

  // Don't leave a timer running after unmount.
  useEffect(() => clearSaveTimer, []);

  /**
   * Auto-backup, throttled to at most once per DEFAULT_AUTO_BACKUP_INTERVAL_MS.
   *
   * Reads only localStorage -- no Supabase call, no session required. This is
   * deliberately called BEFORE the session check in loadData below: the
   * previous version of this backup lived after that check, so when auth
   * failed (a paused/unreachable Supabase project, expired session, etc.) the
   * function returned before backup code was ever reached -- the one moment a
   * backup mattered most was the one moment it silently never ran.
   */
  const maybeAutoBackup = () => {
    try {
      if (shouldAutoBackup(window.localStorage, DEFAULT_AUTO_BACKUP_INTERVAL_MS)) {
        downloadBackupNow(window.localStorage);
      }
    } catch (e) {
      console.error("Auto backup failed", e);
    }
  };

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      // Runs unconditionally, before auth. See maybeAutoBackup's comment.
      setTimeout(maybeAutoBackup, 1500);

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
                // Migrate companies.
                // owner_id is essential, not cosmetic: multi-tenancy RLS
                // (migration 0006) grants access only to companies you own or
                // are a member of. This path previously omitted it, so any
                // company migrated up from localStorage was left ownerless --
                // and would become invisible to everyone once isolation is
                // enforced.
                const { data: { user: migratingUser } } = await supabase.auth.getUser();
                await supabase.from('companies').upsert(parsedLocal.map((c: any) => ({
                  id: c.id,
                  owner_id: migratingUser?.id || null,
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
        const { data: { user } } = await supabase.auth.getUser();
        const newId = `co_${Date.now()}`;
        const defaultCompany = {
          id: newId,
          owner_id: user?.id ?? null,   // never "" -- an empty string fails the owner_id = auth.uid() RLS check and is not a valid uuid
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
      
      if (empErr || !dbEmployees) {
        setEmployees(localEmp);
      } else {
        const remoteEmp = dbEmployees.map(rowToEmployee);
        const mergedEmp = mergeById(localEmp, remoteEmp);
        setEmployees(mergedEmp);
        localStorage.setItem(`employees_${activeId}`, JSON.stringify(mergedEmp));
        const toPush = recordsToPush(mergedEmp, remoteEmp);
        if (toPush.length > 0) {
          const { error } = await supabase.from('employees').upsert(toPush.map((e: any) => employeeToRow(e, activeId)));
          if (error) console.error("Supabase upsert employees error:", error);
        }
      }

      const { data: dbAttendance, error: attErr } = await supabase.from('attendance').select('*').eq('company_id', activeId);
      const localAttString = localStorage.getItem(`attendance_${activeId}`);
      const localAtt = localAttString ? (JSON.parse(localAttString) || []) : [];
      
      if (attErr || !dbAttendance) {
        setAttendance(localAtt);
      } else {
        const remoteAtt = dbAttendance.map(rowToAttendance);
        const mergedAtt = mergeById(localAtt, remoteAtt);
        setAttendance(mergedAtt);
        localStorage.setItem(`attendance_${activeId}`, JSON.stringify(mergedAtt));
        const toPush = recordsToPush(mergedAtt, remoteAtt);
        if (toPush.length > 0) {
          const { error } = await supabase.from('attendance').upsert(toPush.map((a: any) => attendanceToRow(a, activeId)));
          if (error) console.error("Supabase upsert attendance error:", error);
        }
      }
      
      const { data: dbVouchers, error: vouchErr } = await supabase.from('vouchers').select('*').eq('company_id', activeId);
      const localVouchersString = localStorage.getItem(`vouchers_${activeId}`);
      const localVouchers = localVouchersString ? (JSON.parse(localVouchersString) || []) : [];

      if (vouchErr || !dbVouchers) {
        // Table missing (pre-migration) or offline: keep the local set as-is,
        // tombstones and all, so nothing is lost before the next successful sync.
        setVouchers(localVouchers);
      } else {
        // Merge per record by id (see @/lib/sync): newer updatedAt wins, tombstones
        // propagate. Persist the full merged set incl. tombstones, expose only the
        // live records, and push back just what remote is missing or behind on.
        const remoteVouchers = dbVouchers.map(rowToVoucher);
        const mergedVouchers = mergeById(localVouchers, remoteVouchers);
        setVouchers(mergedVouchers);
        localStorage.setItem(`vouchers_${activeId}`, JSON.stringify(mergedVouchers));

        const toPush = recordsToPush(mergedVouchers, remoteVouchers);
        if (toPush.length > 0) {
          const { error } = await supabase.from('vouchers').upsert(toPush.map((v: any) => voucherToRow(v, activeId)));
          if (error) console.error("Supabase upsert vouchers error:", error);
        }
      }

      // Loans. Same merge model as everything else.
      const { data: dbLoans, error: loanErr } = await supabase.from('loans').select('*').eq('company_id', activeId);
      const localLoansString = localStorage.getItem(`loans_${activeId}`);
      const localLoans = localLoansString ? (JSON.parse(localLoansString) || []) : [];
      if (loanErr || !dbLoans) {
        setLoans(localLoans);
      } else {
        const remoteLoans = dbLoans.map(rowToLoan);
        const mergedLoans = mergeById(localLoans, remoteLoans);
        setLoans(mergedLoans);
        localStorage.setItem(`loans_${activeId}`, JSON.stringify(mergedLoans));
        const loansToPush = recordsToPush(mergedLoans, remoteLoans);
        if (loansToPush.length > 0) {
          const { error } = await supabase.from('loans').upsert(loansToPush.map((l: any) => loanToRow(l, activeId)));
          if (error) console.error("Supabase upsert loans error:", error);
        }
      }

      // Second checkpoint: after a full successful sync, so the backup captures
      // the freshest merged data rather than whatever was cached before this
      // load if that happens to be more current. Throttled the same as the
      // early call, so this is a no-op unless the interval has genuinely
      // elapsed since then.
      maybeAutoBackup();

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
    const localEmpString = localStorage.getItem(`employees_${id}`);
    const localEmp = localEmpString ? (JSON.parse(localEmpString) || []) : [];
    if (empErr || !dbEmployees) {
      setEmployees(localEmp);
    } else {
      const remoteEmp = dbEmployees.map(rowToEmployee);
      const mergedEmp = mergeById(localEmp, remoteEmp);
      setEmployees(mergedEmp);
      localStorage.setItem(`employees_${id}`, JSON.stringify(mergedEmp));
      const toPush = recordsToPush(mergedEmp, remoteEmp);
      if (toPush.length > 0) {
        const { error } = await supabase.from('employees').upsert(toPush.map((e: any) => employeeToRow(e, id)));
        if (error) console.error("Supabase upsert employees error:", error);
      }
    }

    const { data: dbAttendance, error: attErr } = await supabase.from('attendance').select('*').eq('company_id', id);
    const localAttString = localStorage.getItem(`attendance_${id}`);
    const localAtt = localAttString ? (JSON.parse(localAttString) || []) : [];
    if (attErr || !dbAttendance) {
      setAttendance(localAtt);
    } else {
      const remoteAtt = dbAttendance.map(rowToAttendance);
      const mergedAtt = mergeById(localAtt, remoteAtt);
      setAttendance(mergedAtt);
      localStorage.setItem(`attendance_${id}`, JSON.stringify(mergedAtt));
      const toPush = recordsToPush(mergedAtt, remoteAtt);
      if (toPush.length > 0) {
        const { error } = await supabase.from('attendance').upsert(toPush.map((a: any) => attendanceToRow(a, id)));
        if (error) console.error("Supabase upsert attendance error:", error);
      }
    }

    // Vouchers were previously not reloaded on company switch, leaving the
    // prior company's vouchers in state. Load them here too.
    const { data: dbVouchers, error: vouchErr } = await supabase.from('vouchers').select('*').eq('company_id', id);
    const localVouchersString = localStorage.getItem(`vouchers_${id}`);
    const localVouchers = localVouchersString ? (JSON.parse(localVouchersString) || []) : [];
    if (vouchErr || !dbVouchers) {
      setVouchers(localVouchers);
    } else {
      const remoteVouchers = dbVouchers.map(rowToVoucher);
      const mergedVouchers = mergeById(localVouchers, remoteVouchers);
      setVouchers(mergedVouchers);
      localStorage.setItem(`vouchers_${id}`, JSON.stringify(mergedVouchers));

      const toPush = recordsToPush(mergedVouchers, remoteVouchers);
      if (toPush.length > 0) {
        const { error } = await supabase.from('vouchers').upsert(toPush.map((v: any) => voucherToRow(v, id)));
        if (error) console.error("Supabase upsert vouchers error:", error);
      }
    }

    // Loans for the newly selected company.
    const { data: dbLoans, error: loanErr } = await supabase.from('loans').select('*').eq('company_id', id);
    const localLoansString = localStorage.getItem(`loans_${id}`);
    const localLoans = localLoansString ? (JSON.parse(localLoansString) || []) : [];
    if (loanErr || !dbLoans) {
      setLoans(localLoans);
    } else {
      const mergedLoans = mergeById(localLoans, dbLoans.map(rowToLoan));
      setLoans(mergedLoans);
      localStorage.setItem(`loans_${id}`, JSON.stringify(mergedLoans));
    }

    setLoading(false);
  };

  const handleCreateCompany = async (details: { name: string; unit: string; financialYear: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const newId = `co_${Date.now()}`;
    const newCompanyObj = {
      id: newId,
      owner_id: user?.id ?? null,   // never "" -- an empty string fails the owner_id = auth.uid() RLS check and is not a valid uuid
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
    // The component hands back the whole LIVE array. Reconcile it against the
    // full set in state (tombstones included): unchanged rows keep their
    // version, changed/new rows are stamped, and rows the array dropped are
    // tombstoned rather than hard-deleted -- so the delete propagates instead
    // of a shorter array looking "behind" and the row being resurrected.
    const now = new Date().toISOString();
    const reconciled = reconcileBulk(attendance, newAttendance, now);
    // No real change (e.g. a component's load->save round-trip): skip the update
    // to preserve reference identity and avoid a render loop and redundant writes.
    if (sameSyncState(reconciled, attendance)) return;
    setAttendance(reconciled);
    if (activeCompanyId) {
      markSaving();
      localStorage.setItem(`attendance_${activeCompanyId}`, JSON.stringify(reconciled));
      maybeAutoBackup();
      if (reconciled.length > 0) {
        const { error } = await supabase.from('attendance').upsert(reconciled.map((a: any) => attendanceToRow(a, activeCompanyId)));
        if (error) { console.error("Supabase upsert attendance error:", error); markSaveError(error); return; }
      }
      markSaved();
    }
  };

  const handleEmployeesChange = async (newEmployees: any[]) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
    // Whole live array in; reconcile against the full set so drops become
    // tombstones (see handleAttendanceChange for the rationale).
    const now = new Date().toISOString();
    const reconciled = reconcileBulk(employees, newEmployees, now);
    if (sameSyncState(reconciled, employees)) return;
    // Diff BEFORE the state swap, against the previous employees snapshot --
    // this is the only point where both the old and new rates exist.
    const wageChanges = detectWageChanges(employees, newEmployees);

    setEmployees(reconciled);
    if (activeCompanyId) {
      markSaving();
      localStorage.setItem(`employees_${activeCompanyId}`, JSON.stringify(reconciled));
      maybeAutoBackup();
      if (reconciled.length > 0) {
        const { error } = await supabase.from('employees').upsert(reconciled.map((e: any) => employeeToRow(e, activeCompanyId)));
        if (error) { console.error("Supabase upsert employees error:", error); markSaveError(error); return; }
      }
      markSaved();

      if (wageChanges.length > 0) {
        const actor = await getAuditActor();
        await recordAudit(wageChanges.map(c => buildWageChangeAudit(c, activeCompanyId, actor)));
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
      markSaving();
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
      maybeAutoBackup();
      markSaved();
    }
  };

  const handleCreateVoucher = async (voucher: any) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
    if (!activeCompanyId) return;
    const now = new Date().toISOString();
    const newVoucher = {
      ...voucher,
      id: `vouch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      updatedAt: now,
      deletedAt: null,
    };
    const updated = [newVoucher, ...vouchers];
    setVouchers(updated);
    localStorage.setItem(`vouchers_${activeCompanyId}`, JSON.stringify(updated));
    maybeAutoBackup();

    markSaving();
    const { error } = await supabase.from('vouchers').insert([voucherToRow(newVoucher, activeCompanyId)]);
    if (error) { console.error("Supabase insert voucher error:", error); markSaveError(error); return; }
    markSaved();
  };

  const handleUpdateVoucher = async (id: string, updates: any) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
    if (!activeCompanyId) return;
    const now = new Date().toISOString();
    const updated = vouchers.map((v: any) => v.id === id ? { ...v, ...updates, updatedAt: now } : v);
    setVouchers(updated);
    localStorage.setItem(`vouchers_${activeCompanyId}`, JSON.stringify(updated));
    maybeAutoBackup();

    const changed = updated.find((v: any) => v.id === id);
    if (changed) {
      markSaving();
      const { error } = await supabase.from('vouchers').update(voucherToRow(changed, activeCompanyId)).eq('id', id);
      if (error) { console.error("Supabase update voucher error:", error); markSaveError(error); return; }
      markSaved();
    }
  };

  /* Loans. Only issuing and cancelling live here -- repayments are the `loan`
   * deductions already entered on attendance, so there is no separate repay
   * handler and no second source of truth to drift. */
  const handleCreateLoan = async (loan: any) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
    if (!activeCompanyId) return;
    const now = new Date().toISOString();
    const newLoan = {
      ...loan,
      id: `loan_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      updatedAt: now,
      deletedAt: null,
    };
    const updated = [newLoan, ...loans];
    setLoans(updated);
    localStorage.setItem(`loans_${activeCompanyId}`, JSON.stringify(updated));
    maybeAutoBackup();

    markSaving();
    const { error } = await supabase.from('loans').insert([loanToRow(newLoan, activeCompanyId)]);
    if (error) { console.error("Supabase insert loan error:", error); markSaveError(error); return; }
    markSaved();
  };

  const handleDeleteLoan = async (id: string) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
    if (!activeCompanyId) return;
    // Soft delete, same as vouchers, so the removal propagates between devices.
    const now = new Date().toISOString();
    const updated = loans.map((l: any) => l.id === id ? { ...l, deletedAt: now, updatedAt: now } : l);
    setLoans(updated);
    localStorage.setItem(`loans_${activeCompanyId}`, JSON.stringify(updated));
    maybeAutoBackup();

    markSaving();
    const { error } = await supabase.from('loans').update({ deleted_at: now, updated_at: now }).eq('id', id);
    if (error) { console.error("Supabase delete loan error:", error); markSaveError(error); return; }
    markSaved();
  };

  const handleDeleteVoucher = async (id: string) => {
    if (isAccountant) {
      toast({ variant: "destructive", title: "Access Denied", description: "Accountants have read-only access." });
      return;
    }
    if (!activeCompanyId) return;
    // Soft delete: write a tombstone rather than removing the row, so the delete
    // propagates to other machines instead of a shorter list looking "behind"
    // and the row being resurrected. Live-only exposure hides it from the UI.
    const now = new Date().toISOString();
    // Capture the voucher BEFORE tombstoning it -- afterwards the live view
    // filters it out and the record is no longer retrievable for the log.
    const deleted = vouchers.find((v: any) => v.id === id);

    const updated = vouchers.map((v: any) => v.id === id ? { ...v, deletedAt: now, updatedAt: now } : v);
    setVouchers(updated);
    localStorage.setItem(`vouchers_${activeCompanyId}`, JSON.stringify(updated));
    maybeAutoBackup();

    markSaving();
    const { error } = await supabase.from('vouchers').update({ deleted_at: now, updated_at: now }).eq('id', id);
    if (error) { console.error("Supabase delete voucher error:", error); markSaveError(error); return; }
    markSaved();

    if (deleted) {
      const actor = await getAuditActor();
      await recordAudit([buildVoucherDeleteAudit(deleted, activeCompanyId, actor, now)]);
    }
  };

  /* State holds the full merged sets including tombstones -- the handlers and
   * localStorage need those to keep deletions propagating. Consumers must only
   * ever see live records, so expose filtered views, memoised for stable
   * identity (consumers use them in useMemo/useEffect deps). */
  const visibleEmployees = useMemo(() => liveRecords(employees), [employees]);
  const visibleAttendance = useMemo(() => liveRecords(attendance), [attendance]);
  const visibleVouchers = useMemo(() => liveRecords(vouchers), [vouchers]);
  const visibleLoans = useMemo(() => liveRecords(loans), [loans]);

  return (
    <AppContext.Provider value={{
      companies,
      activeCompanyId,
      config,
      employees: visibleEmployees,
      attendance: visibleAttendance,
      vouchers: visibleVouchers,
      loans: visibleLoans,
      loading,
      saveStatus,
      saveError,
      setActiveCompanyId,
      handleCreateCompany,
      handleAttendanceChange,
      handleEmployeesChange,
      handleConfigSave,
      handleCreateVoucher,
      handleUpdateVoucher,
      handleDeleteVoucher,
      handleCreateLoan,
      handleDeleteLoan,
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

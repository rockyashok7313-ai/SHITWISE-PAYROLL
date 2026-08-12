
"use client"

import { useState, useEffect, useMemo, useRef } from "react";
import { paidEmployeeIds } from "@/lib/voucher-period";
import { isInSelectedPeriod, lastDayOfMonth, currentPayrollPeriod, entryYearMonth } from "@/lib/attendance-period";
import { defaultShiftForEmployee } from "@/lib/shift-rules";
import { calculateEntryBreakdown, perDaySalary } from "@/lib/payroll";
import { loanBalanceFor } from "@/lib/loans";
import { refreshEntryLabelsAll, hasRateDrift } from "@/lib/wage-snapshot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEES } from "@/lib/mock-data";
import { Save, Download, Edit2, Zap, Calculator, Coins, TrendingUp, Wallet, CalendarDays, Trash2, Clock, Calendar, FileDown, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog as ConfirmDialog,
  AlertDialogAction as ConfirmAction,
  AlertDialogCancel as ConfirmCancel,
  AlertDialogContent as ConfirmContent,
  AlertDialogDescription as ConfirmDescription,
  AlertDialogFooter as ConfirmFooter,
  AlertDialogHeader as ConfirmHeader,
  AlertDialogTitle as ConfirmTitle,
  AlertDialogTrigger as ConfirmTrigger,
} from "@/components/ui/alert-dialog";

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const YEARS = ["2023", "2024", "2025", "2026", "2027"];

export interface Employee {
  id: string;
  name: string;
  role: string;
  rate: number;
  shift: '9-hour' | '12-hour';
  mobile?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeRefId?: string;
  date: string;
  shift: '9-hour' | '12-hour';
  clockIn?: string;
  clockOut?: string;
  hours: number;
  incentive: number;
  weeklyAdvance: number;
  loan: number;
  isModified?: boolean;
  name: string;
  role: string;
  rate: number;
}

interface AttendanceLoggerProps {
  // Now using AppContext
}

// Thin wrapper so the four call sites below don't need to change.
// See lib/attendance-period.currentPayrollPeriod for the actual logic + tests.
const getDefaultPayrollPeriod = () => currentPayrollPeriod();

import { useAppContext } from "@/components/providers/app-provider";

export function AttendanceLogger() {
  const { activeCompanyId, config, employees, attendance, vouchers, loans, handleAttendanceChange: onAttendanceChange } = useAppContext();
  const activeFinancialYear = config.financialYear;
  const { toast } = useToast();
  const { isAdmin, isSupervisor, isAccountant } = useRole(activeCompanyId);
  const [editingDialogId, setEditingDialogId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEntryEmployeeId, setNewEntryEmployeeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogSearchQuery, setDialogSearchQuery] = useState("");
  
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getDefaultPayrollPeriod().month);
  const [selectedYear, setSelectedYear] = useState<string>(() => getDefaultPayrollPeriod().year);
  const [draftMonth, setDraftMonth] = useState<string>(() => getDefaultPayrollPeriod().month);
  const [draftYear, setDraftYear] = useState<string>(() => getDefaultPayrollPeriod().year);
  const [newEntryDetails, setNewEntryDetails] = useState({
    fromDate: "",
    toDate: "",
    shift: "9-hour",
    clockIn: "",
    clockOut: "",
    hours: 9,
    totalWage: "",
    incentive: 0,
    weeklyAdvance: 0,
    loan: 0,
  });
  /**
   * Loan position for a labourer, as it stood BEFORE the row being edited.
   *
   * The row's own `loan` deduction is excluded (by id) so the balance answers
   * "how much was still owed when I sat down to enter this month" rather than
   * shifting under the supervisor's cursor as they type into Loan (-). What is
   * left after this month's deduction is shown separately at each call site.
   */
  const loanBalanceExcludingRow = (employeeId: string, rowId?: string) =>
    loanBalanceFor(employeeId, loans, (attendance || []).filter((a: any) => !rowId || a.id !== rowId));

  const [entries, setEntries] = useState<AttendanceRecord[]>([]);
  /** The last list received FROM the provider, compared by reference so the
   *  save effect never pushes back a list it did not originate. */
  const lastFromProvider = useRef<AttendanceRecord[]>([]);
  const [bulkShift, setBulkShift] = useState<'9-hour' | '12-hour'>('12-hour');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  /*
   * Load/refresh entries from context. `entries` is the FULL canonical set --
   * every month, every year -- never scoped down to a single period. Scoping
   * happens separately in `visibleEntries` below.
   *
   * This used to also rewrite every entry's `date` to force it into whatever
   * month was currently selected, e.g. switching to June took May's real
   * attendance rows and reassigned their date to June -- which then got
   * pushed back to context and persisted, silently reassigning real
   * attendance history to whichever month was last viewed. That is what made
   * a genuinely empty month appear to have the previous month's data, and
   * made "the previous month's attendance" show up "in the next month too".
   * Removed entirely; only the harmless part (refreshing an entry's
   * name/role if the employee record changed) is kept.
   *
   * RATE IS NO LONGER REFRESHED HERE. It used to be, across the full set --
   * every month, every year -- so a single wage change re-priced all of
   * history. A labourer moved from Rs.620/day to Rs.675/day had their already
   * finalised and voucher-paid June silently restated at Rs.675. See
   * @/lib/wage-snapshot for the rule and its tests: a row's rate is the wage
   * in force when that period was worked, and an increment applies only to
   * rows created after it.
   */
  useEffect(() => {
    const loadedEntries = attendance || [];
    if (loadedEntries.length === 0) {
      lastFromProvider.current = loadedEntries;
      setEntries([]);
      return;
    }

    const currentEmployees = employees && employees.length > 0 ? employees : EMPLOYEES;
    const next = refreshEntryLabelsAll(
      loadedEntries,
      currentEmployees,
      (entry: AttendanceRecord) =>
        currentEmployees.find((e: Employee) => e.id === (entry.employeeRefId || entry.id.split('-')[0]))
    );
    // Record what came FROM the provider so the save effect below can tell a
    // real local edit apart from this component echoing the list back.
    lastFromProvider.current = next;
    setEntries(next);
  }, [attendance, employees]);

  /**
   * The rows for the currently selected month -- what the table, exports and
   * summary totals actually show. A month with no real attendance in it is
   * now genuinely empty, instead of inheriting whatever was last rewritten
   * into it.
   */
  const visibleEntries = useMemo(
    () => entries.filter(e => isInSelectedPeriod(e, selectedMonth, selectedYear)),
    [entries, selectedMonth, selectedYear]
  );

  /* Paid status is derived from voucher existence, shared with the register via
   * @/lib/voucher-period -- an employee is Paid for the period when a voucher
   * exists for them in it. No side store, so this screen and the register can
   * never disagree. */
  const paidIds = useMemo(
    () => paidEmployeeIds(vouchers, selectedMonth, selectedYear),
    [vouchers, selectedMonth, selectedYear]
  );
  const isPaid = (empId: string) => paidIds.has(empId);

  // Save entries to parent state on change. Always the FULL set (see above),
  // matching what handleAttendanceChange expects -- it treats whatever is
  // passed as the complete live array and tombstones anything missing from
  // it, so pushing back a month-filtered subset would delete every other
  // month's attendance.
  //
  // DATA-LOSS BUG THIS FIXES: `onAttendanceChange` was in this dependency
  // array. It comes from AppContext and is re-created on every provider
  // render, so this effect re-fired constantly and pushed whatever `entries`
  // happened to hold at the time. When that value was stale -- which it is
  // for a render or two after the provider delivers a new list --
  // handleAttendanceChange reconciled it as a whole-array save and
  // TOMBSTONED every record missing from it. Observed live: 79 restored July
  // records soft-deleted within minutes of being written.
  //
  // Depending only on `entries`, plus the ref check below, means this runs
  // for genuine local edits and never for a list the provider just supplied.
  useEffect(() => {
    if (entries === lastFromProvider.current) return;
    if (entries.length === 0) return;
    onAttendanceChange(entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // Sync selectedYear when activeFinancialYear prop changes
  useEffect(() => {
    const year = activeFinancialYear.split('-')[0];
    setSelectedYear(year);
    setDraftYear(year);
  }, [activeFinancialYear]);

  const handleExportCSV = () => {
    try {
      let csvContent = "Date,Staff ID,Name,Role,Shift,Days,Rate (per hr),Per Day Salary,Incentive,Weekly Advance,Loan,Roundoff,Net Payout\n";
      visibleEntries.forEach(entry => {
        const shiftHrs = entry.shift === '12-hour' ? 12 : 9;
        const grossWage = entry.hours * (entry.rate * shiftHrs);
        const rawNet = grossWage + entry.incentive - entry.weeklyAdvance - entry.loan;
        const netPayout = Math.round(rawNet);
        const roundoff = netPayout - rawNet;
        const perDaySalary = entry.rate * shiftHrs;
        csvContent += `"${entry.date}","${entry.id}","${entry.name}","${entry.role}","${entry.shift}",${entry.hours},${entry.rate.toFixed(2)},${perDaySalary.toFixed(2)},${entry.incentive},${entry.weeklyAdvance},${entry.loan},${roundoff.toFixed(2)},${netPayout}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const logDate = visibleEntries[0]?.date || new Date().toISOString().split('T')[0];
      link.setAttribute("download", `Daily_Attendance_Report_${logDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "CSV Exported",
        description: `Daily attendance logs for ${logDate} exported successfully.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "CSV Export Failed",
        description: "Could not export daily CSV file.",
      });
    }
  };

  const handleExportPDF = async (statusFilter?: 'Paid' | 'Unpaid') => {
    setIsExportingPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      
      let exportEntries = visibleEntries;
      if (statusFilter) {
         exportEntries = visibleEntries.filter(e => {
            const empId = e.employeeRefId || e.id.split('-')[0];
            const status = isPaid(empId) ? 'Paid' : 'Unpaid';
            return status === statusFilter;
         });
      }
      
      if (exportEntries.length === 0) {
         toast({
            title: "No Data",
            description: `There are no ${statusFilter ? statusFilter.toLowerCase() : ''} entries to export.`,
         });
         setIsExportingPDF(false);
         return;
      }
      
      const pdf = new jsPDF("l", "mm", "a4");
      
      const logDate = exportEntries[0]?.date || new Date().toISOString().split('T')[0];
      
      pdf.setFont("helvetica", "normal");
      
      // Header Accent Band
      pdf.setFillColor(31, 41, 55); 
      pdf.rect(15, 15, 267, 8, "F");
      
      // Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(31, 41, 55);
      const title = statusFilter 
        ? `${statusFilter.toUpperCase()} SALARY REPORT` 
        : "DAILY ATTENDANCE & PAYROLL REPORT";
      pdf.text(title, 15, 32);
      
      // Metadata
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("REPORT DATE:", 15, 42);
      pdf.setFont("helvetica", "normal");
      pdf.text(logDate, 42, 42);
      
      pdf.setFont("helvetica", "bold");
      pdf.text("FINANCIAL YEAR:", 15, 47);
      pdf.setFont("helvetica", "normal");
      pdf.text(activeFinancialYear, 47, 47);

      pdf.setFont("helvetica", "bold");
      pdf.text("TOTAL STAFF:", 180, 42);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(exportEntries.length), 220, 42);
      
      pdf.setFont("helvetica", "bold");
      pdf.text("STATUS:", 180, 47);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(16, 185, 129); 
      pdf.text("FINALIZED", 200, 47);
      
      // Divider
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.5);
      pdf.line(15, 52, 282, 52);
      
      // Table Header Setup
      const headers = [
        { label: "ID", x: 17, align: "left" },
        { label: "Name", x: 34, align: "left" },
        { label: "Role", x: 69, align: "left" },
        { label: "Shift", x: 94, align: "left" },
        { label: "Days", x: 130, align: "right" },
        { label: "Per Day", x: 160, align: "right" },
        { label: "Incent.", x: 190, align: "right" },
        { label: "Deductions", x: 220, align: "right" },
        { label: "Round", x: 245, align: "right" },
        { label: "Net Payout", x: 279, align: "right" }
      ];
      
      let pageNumber = 1;
      const colBounds = [15, 32, 67, 92, 112, 132, 162, 192, 222, 247, 282];
      
      const drawTableHeaders = (startY: number) => {
        pdf.setFillColor(243, 244, 246); 
        pdf.rect(15, startY - 5, 267, 7, "F");
        
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(55, 65, 81);
        
        headers.forEach(h => {
          pdf.text(h.label, h.x, startY, { align: h.align as any });
        });
        
        pdf.setDrawColor(156, 163, 175);
        pdf.rect(15, startY - 5, 267, 7, "S");
        colBounds.forEach(bx => {
          pdf.line(bx, startY - 5, bx, startY + 2);
        });
      };
      
      drawTableHeaders(61);
      
      let y = 68;
      let rowHeight = 7.5;
      let fontSize = 8.5;
      
      const checkPageBreak = (requiredSpace = 10) => {
        if (y + requiredSpace > 190) { // A4 Landscape height is 210mm
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(107, 114, 128);
          pdf.text(`Page ${pageNumber}`, 282, 200, { align: "right" });
          
          pdf.addPage();
          pageNumber++;
          y = 20;
          drawTableHeaders(y);
          y += 7;
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(0, 0, 0);
        }
      };
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);
      
      let totalHrs = 0;
      let totalIncentive = 0;
      let totalDeductions = 0;
      let totalNet = 0;
      let totalRoundoff = 0;
      
      exportEntries.forEach((entry, idx) => {
        const shiftHrs = entry.shift === '12-hour' ? 12 : 9;
        const perDaySalary = entry.rate * shiftHrs;
        const gross = entry.hours * perDaySalary;
        const deductions = entry.weeklyAdvance + entry.loan;
        const rawNet = gross + entry.incentive - deductions;
        const net = Math.round(rawNet);
        const roundoff = net - rawNet;
        
        totalHrs += entry.hours;
        totalIncentive += entry.incentive;
        totalDeductions += deductions;
        totalNet += net;
        totalRoundoff += roundoff;
        
        checkPageBreak(rowHeight);

        const rowTop = y - rowHeight + 2.5;
        const rowBottom = y + 2.5;

        if (idx % 2 === 1) {
          pdf.setFillColor(249, 250, 251); 
          pdf.rect(15, rowTop, 267, rowHeight, "F");
        }
        
        pdf.setFont("courier", "normal");
        pdf.setFontSize(fontSize);
        const shortId = `LBR${entry.id.substring(entry.id.length - 4).toUpperCase()}`;
        pdf.text(shortId, 17, y);
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(fontSize);
        pdf.text(entry.name.substring(0, 16), 34, y);
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize - 1);
        pdf.text((entry.role || "Staff").substring(0, 15), 69, y);
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize - 0.5);
        pdf.text(entry.shift, 94, y);
        
        pdf.setFont("courier", "normal");
        pdf.setFontSize(fontSize);
        pdf.text(String(entry.hours), 130, y, { align: "right" });
        pdf.text(perDaySalary.toLocaleString('en-IN', { maximumFractionDigits: 2 }), 160, y, { align: "right" });
        pdf.text(String(entry.incentive), 190, y, { align: "right" });
        pdf.text(String(deductions), 220, y, { align: "right" });
        pdf.text(roundoff.toFixed(2), 245, y, { align: "right" });
        
        pdf.setFont("courier", "bold");
        pdf.text(`${net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 279, y, { align: "right" });
        
        pdf.setDrawColor(209, 213, 219);
        pdf.line(15, rowBottom, 282, rowBottom);
        colBounds.forEach(bx => {
          pdf.line(bx, rowTop, bx, rowBottom);
        });
        
        y += rowHeight;
      });
      
      checkPageBreak(30);

      // Totals Footer Row
      const footerTop = y - rowHeight + 2.5;
      const footerBottom = footerTop + 8;

      pdf.setDrawColor(31, 41, 55);
      pdf.setFillColor(243, 244, 246);
      pdf.rect(15, footerTop, 267, 8, "FD");
      
      colBounds.forEach(bx => {
        pdf.line(bx, footerTop, bx, footerBottom);
      });

      const footerY = footerTop + 5.5;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(31, 41, 55);
      pdf.text("TOTALS", 34, footerY);
      
      pdf.setFont("courier", "bold");
      pdf.text(Number(totalHrs.toFixed(2)).toString(), 130, footerY, { align: "right" });
      pdf.text("-", 160, footerY, { align: "right" });
      pdf.text(Number(totalIncentive.toFixed(2)).toString(), 190, footerY, { align: "right" });
      pdf.text(Number(totalDeductions.toFixed(2)).toString(), 220, footerY, { align: "right" });
      pdf.text(totalRoundoff.toFixed(2), 245, footerY, { align: "right" });
      pdf.text(`${totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 279, footerY, { align: "right" });
      
      // Signature lines
      const sigY = y + 15;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      
      pdf.line(15, sigY, 80, sigY);
      pdf.text("PREPARED BY (SUPERVISOR)", 15, sigY + 4);
      
      pdf.line(217, sigY, 282, sigY);
      pdf.text("VERIFIED BY (FACTORY MGR)", 217, sigY + 4);
      
      pdf.setFontSize(6.5);
      pdf.text(`ShiftWise daily report generated programmatically. Scoped under FY: ${activeFinancialYear}. Created: ${new Date().toLocaleString()}`, 15, sigY + 12);
      
      // Final page number
      pdf.setFontSize(8);
      pdf.text(`Page ${pageNumber}`, 282, 200, { align: "right" });
      
      pdf.save(`Daily_Attendance_Report_${logDate}.pdf`);
      
      toast({
        title: "PDF Saved",
        description: `Daily report for ${logDate} saved as single-page A4 PDF.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "PDF Generation Failed",
        description: "Could not export PDF report.",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const applyBulkSettings = () => {
    // Scoped to the currently viewed month's rows only. entries is the whole
    // historical set, so applying unconditionally would silently overwrite
    // shift data in every month ever recorded, not just this one.
    const visibleIds = new Set(visibleEntries.map(e => e.id));
    setEntries(prev => prev.map(entry =>
      visibleIds.has(entry.id)
        ? { ...entry, shift: bulkShift, hours: bulkShift === '12-hour' ? 12 : 9, isModified: true }
        : entry
    ));
    toast({
      title: "Bulk Shift Applied",
      description: `Updated all staff to ${bulkShift} shift settings for ${selectedMonth} ${selectedYear}.`,
    });
  };



  const handleDeleteRow = (id: string) => {
    const deletedName = entries.find(e => e.id === id)?.name;
    setEntries(prev => prev.filter(entry => entry.id !== id));
    toast({
      variant: "destructive",
      title: "Entry Removed",
      description: `${deletedName} has been removed from the current log.`,
    });
  };

  /**
   * Picking a labourer re-derives the shift from their gender (male ->
   * 12-hour, female -> 9-hour; see lib/shift-rules for the fallbacks).
   *
   * Only the shift is set -- `hours` is the DAY COUNT for the selected date
   * range, not clock hours, so it is deliberately left alone here. Changing
   * the shift dropdown by hand still works exactly as before; this is a
   * starting value, not a lock.
   */
  const handleSelectEmployeeForEntry = (empId: string) => {
    setNewEntryEmployeeId(empId);
    const roster = employees && employees.length > 0 ? employees : EMPLOYEES;
    const emp = roster.find((e: any) => e.id === empId);
    if (!emp) return;
    setNewEntryDetails(p => ({ ...p, shift: defaultShiftForEmployee(emp as any) }));
  };

  /** The employee currently chosen in the dialog, for the auto-shift hint. */
  const selectedDialogEmployee = (employees && employees.length > 0 ? employees : EMPLOYEES)
    .find((e: any) => e.id === newEntryEmployeeId) as any;

  /**
   * Live payout preview for what is currently typed into the dialog, so the
   * amount is visible BEFORE saving rather than only afterwards in the table.
   *
   * Uses the shared payroll calculation (lib/payroll) rather than repeating
   * the formula -- this screen already has several inline copies of it, and
   * a preview that disagreed with the saved row would be worse than no
   * preview at all. Null until an employee is chosen, since the rate comes
   * from them.
   */
  const dialogPreview = useMemo(() => {
    if (!selectedDialogEmployee) return null;
    return calculateEntryBreakdown(
      {
        hours: Number(newEntryDetails.hours) || 0,
        rate: selectedDialogEmployee.rate,
        shift: newEntryDetails.shift,
        incentive: Number(newEntryDetails.incentive) || 0,
        weeklyAdvance: Number(newEntryDetails.weeklyAdvance) || 0,
        loan: Number(newEntryDetails.loan) || 0,
      },
      { rate: selectedDialogEmployee.rate, shift: selectedDialogEmployee.shift }
    );
  }, [selectedDialogEmployee, newEntryDetails]);

  const handleAddAttendance = () => {
    if (!newEntryEmployeeId) return;
    const currentEmployees = employees && employees.length > 0 ? employees : EMPLOYEES;
    const emp = currentEmployees.find((e: Employee) => e.id === newEntryEmployeeId);
    if (!emp) return;

    const dateStr = newEntryDetails.fromDate === newEntryDetails.toDate 
      ? newEntryDetails.fromDate 
      : `${newEntryDetails.fromDate} to ${newEntryDetails.toDate}`;

    /* Duplicate check by MONTH, not by exact date string.
     *
     * Attendance here is one record per labourer per month (the `hours` field
     * is a day count for the whole period), so a second record for the same
     * month double-counts that person's pay. The old check compared
     * `entry.date === dateStr` exactly, which let obvious duplicates through:
     * "2026-07-01 to 2026-07-31" and "2026-07-15" are different strings but
     * both are July for the same worker, and both would be paid. */
    const newPeriod = entryYearMonth(dateStr);
    const clash = entries.find(entry => {
      const isSameEmployee = (entry.employeeRefId || entry.id.split('-')[0]) === emp.id;
      if (!isSameEmployee) return false;
      if (editingDialogId && entry.id === editingDialogId) return false; // editing itself
      const existing = entryYearMonth(entry.date);
      // Fall back to exact-string comparison if either date is unparseable,
      // so a malformed entry still blocks its own exact duplicate.
      if (!newPeriod || !existing) return entry.date === dateStr;
      return existing.month === newPeriod.month && existing.year === newPeriod.year;
    });

    if (clash) {
      toast({
        variant: "destructive",
        title: "Duplicate Entry Blocked",
        description: `${emp.name} already has an attendance record for ${newPeriod ? `${newPeriod.month} ${newPeriod.year}` : dateStr} (${clash.date}). Edit that entry instead of adding a second one — two records for the same month would pay them twice.`,
      });
      return;
    }

    if (editingDialogId) {
      setEntries(prev => prev.map(item => item.id === editingDialogId ? {
        ...item,
        employeeRefId: emp.id,
        date: dateStr,
        shift: newEntryDetails.shift as '9-hour' | '12-hour',
        clockIn: newEntryDetails.clockIn,
        clockOut: newEntryDetails.clockOut,
        hours: newEntryDetails.hours,
        incentive: newEntryDetails.incentive,
        weeklyAdvance: newEntryDetails.weeklyAdvance,
        loan: newEntryDetails.loan,
        isModified: true
      } : item));
      toast({
        title: "Entry Updated",
        description: `Updated attendance log for ${emp.name}.`,
      });
    } else {
      const newEntry = {
        ...emp,
        id: `${emp.id}-${Date.now()}`,
        employeeRefId: emp.id,
        date: dateStr,
        shift: newEntryDetails.shift as '9-hour' | '12-hour',
        clockIn: newEntryDetails.clockIn,
        clockOut: newEntryDetails.clockOut,
        hours: newEntryDetails.hours,
        incentive: newEntryDetails.incentive,
        weeklyAdvance: newEntryDetails.weeklyAdvance,
        loan: newEntryDetails.loan,
        isModified: true
      };
      setEntries(prev => [newEntry, ...prev]);
      toast({
        title: "Attendance Added",
        description: `Added new attendance log for ${emp.name}.`,
      });
    }

    setIsAddDialogOpen(false);
    setDialogSearchQuery("");
    setNewEntryEmployeeId("");
    setEditingDialogId(null);
  };

  const handleFinalize = () => {
    toast({
      title: "Logs Finalized",
      description: `Processed payroll entries for ${visibleEntries.length} staff members for ${selectedMonth} ${selectedYear}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-headline font-bold text-accent flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Shift Logging Matrix
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <CalendarDays className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Payroll Period:</span>
            <div className="flex items-center gap-2">
              <Select value={draftMonth} onValueChange={setDraftMonth}>
                <SelectTrigger className="w-[130px] h-9 bg-background border-primary/30 text-sm font-semibold text-primary">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={draftYear} onValueChange={setDraftYear}>
                <SelectTrigger className="w-[100px] h-9 bg-background border-primary/30 text-sm font-semibold text-primary">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => {
                  setSelectedMonth(draftMonth);
                  setSelectedYear(draftYear);
                  toast({
                    title: "Period Saved",
                    description: `Payroll period updated to ${draftMonth} ${draftYear}.`,
                  });
                }}
                className="h-9 bg-accent hover:bg-accent/90"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCSV}
            className="border-primary/30 hover:bg-primary/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isExportingPDF}
                className="border-primary/30 hover:bg-primary/10"
              >
                <FileDown className="w-4 h-4 mr-2 text-primary" />
                Download PDF (Landscape)
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 font-bold">
              <DropdownMenuItem onClick={() => handleExportPDF()} className="cursor-pointer">
                <FileDown className="w-4 h-4 mr-2" />
                All Salaries
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPDF('Paid')} className="cursor-pointer text-green-600 focus:text-green-600 focus:bg-green-500/10">
                <Coins className="w-4 h-4 mr-2" />
                Paid Salaries Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportPDF('Unpaid')} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                <Calculator className="w-4 h-4 mr-2" />
                Unpaid Salaries Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingDialogId(null);
              const monthIndex = MONTHS.indexOf(selectedMonth);
              const monthNum = monthIndex !== -1 ? monthIndex + 1 : 1;
              const monthStr = String(monthNum).padStart(2, '0');
              const yearNum = parseInt(selectedYear, 10) || new Date().getFullYear();
              // Defaults the new entry to the full selected period
              // (1st -> last day) instead of a single arbitrary day, so
              // "Total Days" starts at a full month and gets edited down for
              // partial attendance, rather than built up from one day.
              const lastDay = lastDayOfMonth(yearNum, monthNum);
              const lastDayStr = String(lastDay).padStart(2, '0');
              setNewEntryDetails({
                fromDate: `${selectedYear}-${monthStr}-01`,
                toDate: `${selectedYear}-${monthStr}-${lastDayStr}`,
                shift: "9-hour",
                clockIn: "",
                clockOut: "",
                hours: lastDay,
                totalWage: "",
                incentive: 0,
                weeklyAdvance: 0,
                loan: 0,
              });
              setNewEntryEmployeeId("");
              setIsAddDialogOpen(true);
            }}
            disabled={isAccountant}
            className="border-primary/30 hover:bg-primary/10 font-bold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Attendance
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            disabled={isAccountant}
            onClick={handleFinalize} 
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Finalize Attendance
          </Button>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <p className="text-sm font-semibold">Bulk Entry Controls</p>
              <p className="text-xs text-muted-foreground">Apply standard shift settings to the entire staff list.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground text-right sm:text-left">Global Shift Type</span>
              <Select 
                value={bulkShift} 
                onValueChange={(val) => setBulkShift(val as any)}
                disabled={isAccountant}
              >
                <SelectTrigger className="w-[180px] h-10 bg-background border-primary/30 font-bold">
                  <SelectValue placeholder="Select Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9-hour">9-hour Shift (Standard)</SelectItem>
                  <SelectItem value="12-hour">12-hour Shift (Factory)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              disabled={isAccountant}
              className="bg-primary text-primary-foreground h-10 px-6 self-end font-bold"
              onClick={applyBulkSettings}
            >
              Apply to All Staff
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search labourer by name or ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-card/50 border-primary/20 focus-visible:border-primary/50"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/30 overflow-hidden overflow-x-auto shadow-2xl">
        <Table>
          <TableHeader className="bg-muted/80 text-[10px] uppercase tracking-widest font-bold">
            <TableRow className="border-b border-border">
              <th className="p-4 min-w-[160px] text-foreground text-left">Entry Date</th>
              <th className="p-4 min-w-[200px] text-foreground text-left">Labourer Details</th>
              <th className="p-4 min-w-[150px] text-foreground text-left">Shift Type</th>
              <th className="p-4 min-w-[100px] text-foreground text-left">Clock In</th>
              <th className="p-4 min-w-[100px] text-foreground text-left">Clock Out</th>
              <th className="p-4 min-w-[100px] text-primary text-left">Total Days</th>
              <th className="p-4 min-w-[120px] text-green-500 text-left">Incentive (+)</th>
              <th className="p-4 min-w-[120px] text-destructive text-left">Weekly Adv (-)</th>
              <th className="p-4 min-w-[140px] text-destructive text-left">Loan (-)</th>
              <th className="p-4 min-w-[100px] text-muted-foreground text-left">Roundoff</th>
              <th className="p-4 min-w-[120px] text-accent text-left">Net Payout</th>
              <th className="p-4 min-w-[100px] text-center text-foreground">Status</th>
              <th className="p-4 text-right text-foreground">Action</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleEntries.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-12 text-muted-foreground">
                  No attendance logged for {selectedMonth} {selectedYear} yet. Click &quot;Add Attendance&quot; to start.
                </TableCell>
              </TableRow>
            )}
            {visibleEntries
              .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((entry) => {
              // Shared payroll calculation, same as the dialog preview and the
              // payroll register -- so the previewed amount and the saved row
              // can never disagree.
              const breakdown = calculateEntryBreakdown(entry as any, { rate: entry.rate, shift: entry.shift });
              const rawNet = breakdown.gross + breakdown.incentive - breakdown.deductions;
              const netPayout = breakdown.net;
              const roundoff = netPayout - rawNet;
              const isEditing = false; // Inline edit removed

              return (
                <TableRow key={entry.id} className={cn(
                  "transition-all border-border h-24 group",
                  "hover:bg-muted/50"
                )}>
                  <TableCell>
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input 
                        type="text" 
                        value={entry.date} 
                        disabled={!isEditing}
                        className="h-11 pl-8 bg-background border-muted text-sm font-mono font-bold w-[220px]"
                        onChange={(e) => {
                          const val = e.target.value;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, date: val, isModified: true } : item));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-bold text-sm">
                        {entry.name}
                        {entry.isModified && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{entry.id} • {entry.role}</span>
                      {/* This row was priced at a different wage than the
                          labourer is on now. Shown rather than silently
                          reconciled -- the old rate is correct for a period
                          already worked, and hiding it would look like a bug. */}
                      {(() => {
                        const emp = (employees || []).find(
                          (e: Employee) => e.id === (entry.employeeRefId || entry.id.split('-')[0])
                        );
                        if (!hasRateDrift(entry, emp)) return null;
                        const was = Math.round(perDaySalary(entry.rate, entry.shift));
                        const now = Math.round(perDaySalary(emp!.rate, entry.shift));
                        return (
                          <span
                            className="mt-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-500"
                            title={`This period was worked at ₹${was}/day. The current wage is ₹${now}/day — later periods use that.`}
                          >
                            paid @ ₹{was.toLocaleString('en-IN')}/day
                            <span className="font-normal text-muted-foreground"> (now ₹{now.toLocaleString('en-IN')})</span>
                          </span>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select 
                        value={entry.shift} 
                        onValueChange={(val) => {
                          const hrs = val === '12-hour' ? 12 : 9;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, shift: val as '9-hour' | '12-hour', hours: hrs, isModified: true } : item));
                        }}
                      >
                        <SelectTrigger className="h-11 bg-background border-muted w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9-hour">9-hour</SelectItem>
                          <SelectItem value="12-hour">12-hour</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-3 py-1 font-bold",
                        entry.shift === '12-hour' ? 'text-accent border-accent/40 bg-accent/5' : 'text-primary border-primary/40 bg-primary/5'
                      )}>
                        {entry.shift}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="time" 
                      value={entry.clockIn || ""} 
                      disabled={!isEditing}
                      className="h-11 bg-background border-muted w-[110px]"
                      onChange={(e) => {
                        const val = e.target.value;
                        setEntries(prev => prev.map(item => {
                          if (item.id === entry.id) {
                            const newClockIn = val;
                            const clockOut = item.clockOut || "18:00";
                            const shiftHrs = item.shift === '12-hour' ? 12 : 9;
                            let newHours = item.hours;
                            if (newClockIn && clockOut) {
                              const [inH, inM] = newClockIn.split(':').map(Number);
                              const [outH, outM] = clockOut.split(':').map(Number);
                              let d1 = new Date(); d1.setHours(inH, inM, 0, 0);
                              let d2 = new Date(); d2.setHours(outH, outM, 0, 0);
                              if (d2 < d1) d2.setDate(d2.getDate() + 1);
                              const diff = (d2.getTime() - d1.getTime()) / 3600000;
                              newHours = Number((diff / shiftHrs).toFixed(2));
                            }
                            return { ...item, clockIn: newClockIn, hours: newHours, isModified: true };
                          }
                          return item;
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="time" 
                      value={entry.clockOut || ""} 
                      disabled={!isEditing}
                      className="h-11 bg-background border-muted w-[110px]"
                      onChange={(e) => {
                        const val = e.target.value;
                        setEntries(prev => prev.map(item => {
                          if (item.id === entry.id) {
                            const newClockOut = val;
                            const clockIn = item.clockIn || "09:00";
                            const shiftHrs = item.shift === '12-hour' ? 12 : 9;
                            let newHours = item.hours;
                            if (clockIn && newClockOut) {
                              const [inH, inM] = clockIn.split(':').map(Number);
                              const [outH, outM] = newClockOut.split(':').map(Number);
                              let d1 = new Date(); d1.setHours(inH, inM, 0, 0);
                              let d2 = new Date(); d2.setHours(outH, outM, 0, 0);
                              if (d2 < d1) d2.setDate(d2.getDate() + 1);
                              const diff = (d2.getTime() - d1.getTime()) / 3600000;
                              newHours = Number((diff / shiftHrs).toFixed(2));
                            }
                            return { ...item, clockOut: newClockOut, hours: newHours, isModified: true };
                          }
                          return item;
                        }));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={entry.hours} 
                      disabled={!isEditing}
                      className="h-11 bg-primary/5 border-primary/20 focus-visible:ring-primary font-mono text-base font-bold text-primary w-24"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, hours: val, isModified: true } : item));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-500 font-bold">₹</span>
                      <Input 
                        type="number"
                        value={entry.incentive} 
                        disabled={!isEditing}
                        className="h-11 pl-6 bg-green-500/5 border-green-500/20 focus-visible:ring-green-500 font-mono text-base font-bold text-green-500 w-32"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, incentive: val, isModified: true } : item));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-destructive font-bold">₹</span>
                      <Input 
                        type="number"
                        value={entry.weeklyAdvance} 
                        disabled={!isEditing}
                        className="h-11 pl-6 bg-destructive/5 border-destructive/20 focus-visible:ring-destructive font-mono text-base font-bold text-destructive w-32"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, weeklyAdvance: val, isModified: true } : item));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-destructive font-bold">₹</span>
                      <Input
                        type="number"
                        value={entry.loan}
                        disabled={!isEditing}
                        className="h-11 pl-6 bg-destructive/5 border-destructive/20 focus-visible:ring-destructive font-mono text-base font-bold text-destructive w-32"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, loan: val, isModified: true } : item));
                        }}
                      />
                    </div>
                    {/* Outstanding loan, so the deduction is entered against a
                        visible balance instead of from memory. */}
                    {(() => {
                      const bal = loanBalanceExcludingRow(entry.employeeRefId || entry.id.split('-')[0], entry.id);
                      if (bal.hasNoLoan) return null;
                      const remaining = Math.max(0, bal.outstanding - (Number(entry.loan) || 0));
                      return (
                        <div className="mt-1 text-[10px] leading-tight font-mono w-32">
                          <span className="text-muted-foreground">Owed </span>
                          <span className="font-bold text-amber-600 dark:text-amber-500">
                            ₹{bal.outstanding.toLocaleString('en-IN')}
                          </span>
                          {(Number(entry.loan) || 0) > 0 && (
                            <span className={cn("block", remaining === 0 ? "text-emerald-600 dark:text-emerald-500 font-bold" : "text-muted-foreground")}>
                              {remaining === 0 ? "→ closes loan" : `→ ₹${remaining.toLocaleString('en-IN')} left`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm text-muted-foreground">
                      {roundoff > 0 ? '+' : ''}{roundoff.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell className="font-headline font-black text-lg text-accent">
                    ₹{netPayout.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-center">
                    {/* Derived from voucher existence -- read-only. Generate a
                        voucher on the Vouchers screen to mark Paid. */}
                    {(() => {
                      const paid = isPaid(entry.employeeRefId || entry.id.split('-')[0]);
                      return (
                        <Badge
                          variant="outline"
                          title={paid
                            ? "A voucher exists for this employee this period"
                            : "No voucher yet -- generate one to mark Paid"}
                          className={cn(
                            "h-8 px-3 inline-flex items-center justify-center text-[10px] uppercase tracking-wider font-bold min-w-[70px]",
                            paid
                              ? "bg-green-500/10 text-green-600 border-green-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          )}
                        >
                          {paid ? 'Paid' : 'Unpaid'}
                        </Badge>
                      );
                    })()}
                  </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-9 hover:bg-accent/20 hover:text-accent p-0"
                          onClick={() => {
                            setEditingDialogId(entry.id);
                            setNewEntryEmployeeId(entry.employeeRefId || entry.id.split('-')[0]);
                            const parts = entry.date.includes('to') ? entry.date.split(' to ') : [entry.date, entry.date];
                            setNewEntryDetails({
                              fromDate: parts[0].trim(),
                              toDate: (parts[1] || parts[0]).trim(),
                              shift: entry.shift,
                              clockIn: entry.clockIn || "",
                              clockOut: entry.clockOut || "",
                              hours: entry.hours,
                              totalWage: "",
                              incentive: entry.incentive,
                              weeklyAdvance: entry.weeklyAdvance,
                              loan: entry.loan
                            });
                            setIsAddDialogOpen(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      
                        <ConfirmDialog>
                          <ConfirmTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-9 w-9 hover:bg-destructive/20 hover:text-destructive p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </ConfirmTrigger>
                          <ConfirmContent className="bg-card border-border">
                            <ConfirmHeader>
                              <ConfirmTitle>Remove Entry?</ConfirmTitle>
                              <ConfirmDescription>
                                This will remove {entry.name}&apos;s log for {entry.date}.
                              </ConfirmDescription>
                            </ConfirmHeader>
                            <ConfirmFooter>
                              <ConfirmCancel className="border-border">Cancel</ConfirmCancel>
                              <ConfirmAction 
                                onClick={() => handleDeleteRow(entry.id)}
                                className="bg-destructive hover:bg-destructive/90 text-white"
                              >
                                Remove
                              </ConfirmAction>
                            </ConfirmFooter>
                          </ConfirmContent>
                        </ConfirmDialog>
                      </div>
                    </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] text-primary uppercase font-bold tracking-widest">Net Liability ({selectedMonth})</span>
            <span className="text-2xl font-headline font-black text-foreground">
              ₹{visibleEntries.reduce((acc, curr) => {
                const shiftHrs = curr.shift === '12-hour' ? 12 : 9;
                return acc + Math.round(curr.hours * (curr.rate * shiftHrs) + curr.incentive - curr.weeklyAdvance - curr.loan);
              }, 0).toLocaleString('en-IN')}
            </span>
          </div>
          <TrendingUp className="w-8 h-8 text-primary/30" />
        </div>
        <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] text-green-500 uppercase font-bold tracking-widest">Total Incentives</span>
            <span className="text-2xl font-headline font-black text-foreground">
              ₹{visibleEntries.reduce((acc, curr) => acc + curr.incentive, 0).toLocaleString('en-IN')}
            </span>
          </div>
          <Coins className="w-8 h-8 text-green-500/30" />
        </div>
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] text-destructive uppercase font-bold tracking-widest">Total Deductions</span>
            <span className="text-2xl font-headline font-black text-foreground">
              ₹{visibleEntries.reduce((acc, curr) => acc + curr.weeklyAdvance + curr.loan, 0).toLocaleString('en-IN')}
            </span>
          </div>
          <Wallet className="w-8 h-8 text-destructive/30" />
        </div>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={v => { setIsAddDialogOpen(v); if(!v) { setDialogSearchQuery(""); setEditingDialogId(null); } }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingDialogId ? "Edit Staff Attendance" : "Add Staff Attendance"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">Select Staff / Labourer</label>
              <Input 
                placeholder="Search staff name or role..."
                value={dialogSearchQuery}
                onChange={(e) => setDialogSearchQuery(e.target.value)}
                className="mb-1 bg-background border-muted focus-visible:ring-accent"
              />
              <Select value={newEntryEmployeeId} onValueChange={handleSelectEmployeeForEntry}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {(employees && employees.length > 0 ? employees : EMPLOYEES)
                    .filter((emp: any) =>
                      emp.name.toLowerCase().includes(dialogSearchQuery.toLowerCase()) ||
                      emp.role.toLowerCase().includes(dialogSearchQuery.toLowerCase())
                    )
                    .map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                        {emp.gender ? <span className="text-muted-foreground"> &middot; {emp.gender}</span> : null}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">From Date</label>
                <Input 
                  type="date" 
                  value={newEntryDetails.fromDate} 
                  onChange={e => {
                    const fromDate = e.target.value;
                    setNewEntryDetails(p => {
                      const toDate = p.toDate || fromDate;
                      const start = new Date(fromDate);
                      const end = new Date(toDate);
                      let hours = p.hours;
                      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        hours = diffDays;
                      }
                      return { ...p, fromDate, hours };
                    });
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">To Date</label>
                <Input 
                  type="date" 
                  value={newEntryDetails.toDate} 
                  onChange={e => {
                    const toDate = e.target.value;
                    setNewEntryDetails(p => {
                      const fromDate = p.fromDate || toDate;
                      const start = new Date(fromDate);
                      const end = new Date(toDate);
                      let hours = p.hours;
                      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        hours = diffDays;
                      }
                      return { ...p, toDate, hours };
                    });
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Shift Type</label>
                <Select 
                  value={newEntryDetails.shift} 
                  onValueChange={v => {
                    setNewEntryDetails(p => {
                      const start = new Date(p.fromDate);
                      const end = new Date(p.toDate);
                      let hours = v === '12-hour' ? 12 : 9;
                      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
                        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        hours = diffDays;
                      }
                      return { ...p, shift: v, hours };
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9-hour">9-hour</SelectItem>
                    <SelectItem value="12-hour">12-hour</SelectItem>
                  </SelectContent>
                </Select>
                {/* Makes the auto-selection visible instead of the shift
                    appearing to change on its own. Still fully overridable. */}
                {selectedDialogEmployee?.gender &&
                  ['male', 'female'].includes(String(selectedDialogEmployee.gender).toLowerCase()) && (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Auto-set from{' '}
                    <span className="font-semibold capitalize">{selectedDialogEmployee.gender}</span>
                    {' '}&mdash; you can change it.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Clock In</label>
                <Input 
                  type="time" 
                  value={newEntryDetails.clockIn} 
                  onChange={e => setNewEntryDetails(p => ({ ...p, clockIn: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Clock Out</label>
                <Input 
                  type="time" 
                  value={newEntryDetails.clockOut} 
                  onChange={e => setNewEntryDetails(p => ({ ...p, clockOut: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-accent">Total Wage (₹)</label>
                <Input 
                  type="number" step="0.01" 
                  placeholder="Enter amount..."
                  value={newEntryDetails.totalWage} 
                  className="bg-accent/5 border-accent/30 font-bold"
                  onChange={e => {
                    const val = e.target.value;
                    const amount = parseFloat(val) || 0;
                    const currentEmployees = employees && employees.length > 0 ? employees : EMPLOYEES;
                    const emp = currentEmployees.find((e: any) => e.id === newEntryEmployeeId);
                    
                    setNewEntryDetails(p => {
                      let computedHours = p.hours;
                      if (emp && emp.rate > 0 && amount > 0) {
                        const shiftHrs = p.shift === '12-hour' ? 12 : 9;
                        computedHours = parseFloat((amount / (emp.rate * shiftHrs)).toFixed(2));
                      }
                      return { ...p, totalWage: val, hours: computedHours };
                    });
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Total Days</label>
                <Input 
                  type="number" step="0.5" 
                  value={newEntryDetails.hours} 
                  onChange={e => setNewEntryDetails(p => ({ ...p, hours: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Incentive (+)</label>
                <Input 
                  type="number" 
                  value={newEntryDetails.incentive} 
                  onChange={e => setNewEntryDetails(p => ({ ...p, incentive: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Weekly Adv (-)</label>
                <Input 
                  type="number" 
                  value={newEntryDetails.weeklyAdvance} 
                  onChange={e => setNewEntryDetails(p => ({ ...p, weeklyAdvance: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Loan (-)</label>
                <Input
                  type="number"
                  value={newEntryDetails.loan}
                  onChange={e => setNewEntryDetails(p => ({ ...p, loan: parseFloat(e.target.value) || 0 }))}
                />
              </div>

              {/* Outstanding loan for the selected labourer. Deliberately a
                  read-out, not an auto-fill: the factory decides how much to
                  recover each month, and the amount varies. */}
              {newEntryEmployeeId && (() => {
                const bal = loanBalanceExcludingRow(newEntryEmployeeId, editingDialogId ?? undefined);
                if (bal.hasNoLoan) return null;
                const taking = Number(newEntryDetails.loan) || 0;
                const remaining = Math.max(0, bal.outstanding - taking);
                return (
                  <div className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                        Loan Outstanding
                      </span>
                      <span className="font-mono text-lg font-black tabular-nums text-amber-600 dark:text-amber-500">
                        ₹{bal.outstanding.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      ₹{bal.issued.toLocaleString('en-IN')} issued &middot; ₹{bal.repaid.toLocaleString('en-IN')} recovered
                      {taking > 0 && (
                        <>
                          {' '}&middot;{' '}
                          <span className={remaining === 0 ? "font-bold text-emerald-600 dark:text-emerald-500" : "font-bold"}>
                            {remaining === 0
                              ? "this deduction closes the loan"
                              : `₹${remaining.toLocaleString('en-IN')} left after this deduction`}
                          </span>
                        </>
                      )}
                    </p>
                    {taking > bal.outstanding && bal.outstanding > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-destructive">
                        This deducts ₹{(taking - bal.outstanding).toLocaleString('en-IN')} more than is owed.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Live payout preview -- the amount this entry will actually
                  pay, visible before saving. Same shared calculation the
                  table and payroll register use. */}
              <div className="col-span-2">
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-accent">
                      Net Payout
                    </span>
                    <span className="font-headline text-2xl font-black text-accent tabular-nums">
                      {dialogPreview
                        ? `₹${dialogPreview.net.toLocaleString('en-IN')}`
                        : <span className="text-sm font-normal text-muted-foreground">Select a labourer</span>}
                    </span>
                  </div>

                  {dialogPreview && (
                    <>
                      <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                        {dialogPreview.days} day{dialogPreview.days === 1 ? '' : 's'} &times; ₹
                        {dialogPreview.perDaySalary.toLocaleString('en-IN')}/day
                        {' '}(₹{dialogPreview.rate}/hr &times; {dialogPreview.shiftHours}h)
                        {' = '}₹{dialogPreview.gross.toLocaleString('en-IN')}
                        {dialogPreview.incentive > 0 && <> &nbsp;+&nbsp; ₹{dialogPreview.incentive.toLocaleString('en-IN')} incentive</>}
                        {dialogPreview.deductions > 0 && <> &nbsp;&minus;&nbsp; ₹{dialogPreview.deductions.toLocaleString('en-IN')} deductions</>}
                      </p>
                      {dialogPreview.net < 0 && (
                        <p className="mt-1 text-[11px] font-semibold text-destructive">
                          Negative — deductions exceed earnings for this period.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setDialogSearchQuery(""); }}>Cancel</Button>
            <Button onClick={handleAddAttendance} disabled={!newEntryEmployeeId} className="bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

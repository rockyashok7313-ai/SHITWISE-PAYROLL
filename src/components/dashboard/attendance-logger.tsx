
"use client"

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEES } from "@/lib/mock-data";
import { Save, Download, Edit2, Zap, Calculator, Coins, TrendingUp, Wallet, CalendarDays, Trash2, Clock, Calendar, FileDown, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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

interface AttendanceLoggerProps {
  activeFinancialYear: string;
  employees: any[];
  attendance: any[];
  onAttendanceChange: (entries: any[]) => void;
}

const getDefaultPayrollPeriod = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return {
    month: MONTHS[date.getMonth()],
    year: date.getFullYear().toString()
  };
};

export function AttendanceLogger({ 
  activeFinancialYear, 
  employees, 
  attendance, 
  onAttendanceChange 
}: AttendanceLoggerProps) {
  const { toast } = useToast();
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
    hours: 9,
    totalWage: "",
    incentive: 0,
    weeklyAdvance: 0,
    loan: 0,
  });
  const [entries, setEntries] = useState<any[]>([]);
  const [bulkShift, setBulkShift] = useState<'9-hour' | '12-hour'>('12-hour');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Load or initialize entries on mount
  useEffect(() => {
    let loadedEntries = attendance || [];

    if (loadedEntries.length === 0) {
      // Load current employee list from props
      const currentEmployees = employees && employees.length > 0 ? employees : EMPLOYEES;

      if (currentEmployees.length > 0) {
        const monthIndex = MONTHS.indexOf(selectedMonth);
        const monthStr = String(monthIndex !== -1 ? monthIndex + 1 : 1).padStart(2, '0');
        const dayStr = String(new Date().getDate()).padStart(2, '0');
        const initialDate = `${selectedYear}-${monthStr}-${dayStr}`;

        loadedEntries = currentEmployees.map(emp => ({
          ...emp,
          date: initialDate,
          shift: emp.shift as '9-hour' | '12-hour',
          hours: emp.shift === '12-hour' ? 12 : 9,
          incentive: 0,
          weeklyAdvance: 0,
          loan: 0,
          isModified: false,
          employeeRefId: emp.id
        }));
      }
    } else {
      // Sync loaded entries' dates with current selectedYear/selectedMonth
      const monthIndex = MONTHS.indexOf(selectedMonth);
      const monthStr = String(monthIndex !== -1 ? monthIndex + 1 : 1).padStart(2, '0');
      const currentEmployees = employees && employees.length > 0 ? employees : EMPLOYEES;
      
      let hasChanges = false;
      const updatedEntries = loadedEntries.map(entry => {
        const parts = entry.date.split('-');
        const day = parts[2] || "01";
        const newDate = `${selectedYear}-${monthStr}-${day}`;
        
        let needsUpdate = false;
        let updated = { ...entry };
        
        if (entry.date !== newDate) {
          needsUpdate = true;
          updated.date = newDate;
        }

        const refId = entry.employeeRefId || entry.id.split('-')[0];
        const emp = currentEmployees.find((e: any) => e.id === refId);
        if (emp && (emp.rate !== entry.rate || emp.name !== entry.name || emp.role !== entry.role)) {
          needsUpdate = true;
          updated.rate = emp.rate;
          updated.name = emp.name;
          updated.role = emp.role;
        }

        if (needsUpdate) hasChanges = true;
        return needsUpdate ? updated : entry;
      });

      if (hasChanges) {
        loadedEntries = updatedEntries;
      }
    }
    
    setEntries(loadedEntries);
  }, [attendance, employees, selectedMonth, selectedYear]);

  // Save entries to parent state on change
  useEffect(() => {
    if (entries.length > 0) {
      onAttendanceChange(entries);
    }
  }, [entries, onAttendanceChange]);

  // Sync selectedYear when activeFinancialYear prop changes
  useEffect(() => {
    const year = activeFinancialYear.split('-')[0];
    setSelectedYear(year);
    setDraftYear(year);
  }, [activeFinancialYear]);



  // Sync entries dates when selectedMonth or selectedYear changes
  useEffect(() => {
    if (entries.length === 0) return;
    const monthIndex = MONTHS.indexOf(selectedMonth);
    const monthStr = String(monthIndex !== -1 ? monthIndex + 1 : 1).padStart(2, '0');
    
    setEntries(prev => prev.map(entry => {
      const parts = entry.date.split('-');
      const day = parts[2] || "01";
      const newDate = `${selectedYear}-${monthStr}-${day}`;
      if (entry.date !== newDate) {
        return { ...entry, date: newDate };
      }
      return entry;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const handleExportCSV = () => {
    try {
      let csvContent = "Date,Staff ID,Name,Role,Shift,Days,Rate (per hr),Per Day Salary,Incentive,Weekly Advance,Loan,Roundoff,Net Payout\n";
      entries.forEach(entry => {
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
      const logDate = entries[0]?.date || new Date().toISOString().split('T')[0];
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

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("l", "mm", "a4");
      
      const logDate = entries[0]?.date || new Date().toISOString().split('T')[0];
      
      pdf.setFont("helvetica", "normal");
      
      // Header Accent Band
      pdf.setFillColor(31, 41, 55); 
      pdf.rect(15, 15, 267, 8, "F");
      
      // Title
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(31, 41, 55);
      pdf.text("DAILY ATTENDANCE & PAYROLL REPORT", 15, 32);
      
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
      pdf.text(String(entries.length), 220, 42);
      
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
      
      entries.forEach((entry, idx) => {
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
    setEntries(prev => prev.map(entry => ({
      ...entry,
      shift: bulkShift,
      hours: bulkShift === '12-hour' ? 12 : 9,
      isModified: true
    })));
    toast({
      title: "Bulk Shift Applied",
      description: `Updated all staff to ${bulkShift} shift settings.`,
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

  const handleAddAttendance = () => {
    if (!newEntryEmployeeId) return;
    const currentEmployees = employees && employees.length > 0 ? employees : EMPLOYEES;
    const emp = currentEmployees.find((e: any) => e.id === newEntryEmployeeId);
    if (!emp) return;

    const dateStr = newEntryDetails.fromDate === newEntryDetails.toDate 
      ? newEntryDetails.fromDate 
      : `${newEntryDetails.fromDate} to ${newEntryDetails.toDate}`;

    const isDuplicate = entries.some(entry => {
      const isSameEmployee = (entry.employeeRefId || entry.id.split('-')[0]) === emp.id;
      const isSameDate = entry.date === dateStr;
      const isDifferentEntry = editingDialogId ? entry.id !== editingDialogId : true;
      return isSameEmployee && isSameDate && isDifferentEntry;
    });

    if (isDuplicate) {
      toast({
        variant: "destructive",
        title: "Duplicate Entry Detected",
        description: `${emp.name} already has a log for ${dateStr}.`,
      });
      return;
    }

    if (editingDialogId) {
      setEntries(prev => prev.map(item => item.id === editingDialogId ? {
        ...item,
        employeeRefId: emp.id,
        date: dateStr,
        shift: newEntryDetails.shift as '9-hour' | '12-hour',
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
      description: `Processed payroll entries for ${entries.length} staff members for ${selectedMonth} ${selectedYear}.`,
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="border-primary/30 hover:bg-primary/10"
          >
            <FileDown className="w-4 h-4 mr-2 text-primary" />
            Download PDF (Landscape)
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setEditingDialogId(null);
              const monthIndex = MONTHS.indexOf(selectedMonth);
              const monthStr = String(monthIndex !== -1 ? monthIndex + 1 : 1).padStart(2, '0');
              const dayStr = String(new Date().getDate()).padStart(2, '0');
              setNewEntryDetails({ 
                fromDate: `${selectedYear}-${monthStr}-${dayStr}`,
                toDate: `${selectedYear}-${monthStr}-${dayStr}`,
                shift: "9-hour",
                hours: 9,
                totalWage: "",
                incentive: 0,
                weeklyAdvance: 0,
                loan: 0,
              });
              setNewEntryEmployeeId("");
              setIsAddDialogOpen(true);
            }}
            className="border-primary/30 hover:bg-primary/10 font-bold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Attendance
          </Button>
          <Button 
            variant="default" 
            size="sm" 
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
              <th className="p-4 min-w-[120px] text-primary text-left">Total Days</th>
              <th className="p-4 min-w-[140px] text-green-500 text-left">Incentive (+)</th>
              <th className="p-4 min-w-[140px] text-destructive text-left">Weekly Adv (-)</th>
              <th className="p-4 min-w-[140px] text-destructive text-left">Loan (-)</th>
              <th className="p-4 min-w-[100px] text-muted-foreground text-left">Roundoff</th>
              <th className="p-4 min-w-[120px] text-accent text-left">Net Payout</th>
              <th className="p-4 text-right text-foreground">Action</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries
              .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((entry) => {
              const shiftHrs = entry.shift === '12-hour' ? 12 : 9;
              const grossWage = entry.hours * (entry.rate * shiftHrs);
              const rawNet = grossWage + entry.incentive - entry.weeklyAdvance - entry.loan;
              const netPayout = Math.round(rawNet);
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
                    </div>
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select 
                        value={entry.shift} 
                        onValueChange={(val) => {
                          const hrs = val === '12-hour' ? 12 : 9;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, shift: val, hours: hrs, isModified: true } : item));
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
                      type="number" 
                      step="0.5"
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
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm text-muted-foreground">
                      {roundoff > 0 ? '+' : ''}{roundoff.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell className="font-headline font-black text-lg text-accent">
                    ₹{netPayout.toLocaleString('en-IN')}
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
              ₹{entries.reduce((acc, curr) => {
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
              ₹{entries.reduce((acc, curr) => acc + curr.incentive, 0).toLocaleString('en-IN')}
            </span>
          </div>
          <Coins className="w-8 h-8 text-green-500/30" />
        </div>
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] text-destructive uppercase font-bold tracking-widest">Total Deductions</span>
            <span className="text-2xl font-headline font-black text-foreground">
              ₹{entries.reduce((acc, curr) => acc + curr.weeklyAdvance + curr.loan, 0).toLocaleString('en-IN')}
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
              <Select value={newEntryEmployeeId} onValueChange={setNewEntryEmployeeId}>
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

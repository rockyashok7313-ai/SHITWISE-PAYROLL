
"use client"

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { FileSpreadsheet, TrendingUp, IndianRupee, PieChart, Printer, Download, Sparkles, Loader2, Gift, User, CalendarDays, FileText, FileDown, Table as TableIcon, MessageCircle, Search } from "lucide-react";
import { EMPLOYEES } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const monthlyTrendData = [
  { month: "Jan", cost: 125000 },
  { month: "Feb", cost: 138000 },
  { month: "Mar", cost: 132000 },
  { month: "Apr", cost: 145000 },
  { month: "May", cost: 152000 },
  { month: "Jun", cost: 148000 },
  { month: "Jul", cost: 155000 },
  { month: "Aug", cost: 160000 },
  { month: "Sep", cost: 158000 },
  { month: "Oct", cost: 165000 },
  { month: "Nov", cost: 172000 },
  { month: "Dec", cost: 180000 },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const FY_MONTHS = [
  "October", "November", "December", 
  "January", "February", "March", "April", "May", "June", "July", "August", "September"
];

const getMonthYearLabel = (month: string, fy: string) => {
  const parts = fy.split('-');
  const startYear = parts[0];
  const endYear = parts.length > 1 ? parts[1] : startYear;
  const isSecondYear = [
    "January", "February", "March", "April", "May", "June", "July", "August", "September"
  ].includes(month);
  const year = isSecondYear ? endYear : startYear;
  return `${month.toUpperCase()} ${year}`;
};

const YEARS = ["2023", "2024", "2025", "2026", "2027"];
const FY_YEARS = ["2022-2023", "2023-2024", "2024-2025", "2025-2026", "2026-2027", "2027-2028"];

interface PayrollReportsProps {
  activeFinancialYear: string;
  employees: any[];
  attendance: any[];
}

interface MonthlySalaries {
  January: number;
  February: number;
  March: number;
  April: number;
  May: number;
  June: number;
  July: number;
  August: number;
  September: number;
  October: number;
  November: number;
  December: number;
}

interface BonusEntry {
  id: string;
  name: string;
  role: string;
  monthlySalaries: MonthlySalaries;
  includedMonths?: string[];
  yearlySalary: number; // sum of monthlySalaries
  percentage: number;
  bonusAmount: number;
}

export function PayrollReports({ activeFinancialYear, employees, attendance }: PayrollReportsProps) {
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("May");
  const [selectedYear, setSelectedYear] = useState<string>(activeFinancialYear.split('-')[0]);

  // Bonus Calculator States
  const [isBonusViewActive, setIsBonusViewActive] = useState(false);
  const [isDraggingMonths, setIsDraggingMonths] = useState(false);
  const [dragAction, setDragAction] = useState<'check' | 'uncheck' | null>(null);
  const [draggedEmployeeIndex, setDraggedEmployeeIndex] = useState<number | null>(null);
  const [bonusRefYear, setBonusRefYear] = useState<string>(activeFinancialYear);
  const [bonusPercentage, setBonusPercentage] = useState<number>(8.33);
  const [bonusEntries, setBonusEntries] = useState<BonusEntry[]>([]);
  const [activeEditEmployeeIndex, setActiveEditEmployeeIndex] = useState<number>(0);
  const [sheetSelectedMonth, setSheetSelectedMonth] = useState<string>("January");
  const [visibleMonths, setVisibleMonths] = useState<string[]>(FY_MONTHS);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingMonths(false);
      setDragAction(null);
      setDraggedEmployeeIndex(null);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  const handleMonthMouseDown = (empIndex: number, month: string, currentVal: boolean) => {
    setIsDraggingMonths(true);
    const targetState = !currentVal;
    setDragAction(targetState ? 'check' : 'uncheck');
    setDraggedEmployeeIndex(empIndex);
    handleUpdateEntry(empIndex, "toggleMonth", null, month as keyof MonthlySalaries);
  };

  const handleMonthMouseEnter = (empIndex: number, month: string, isIncluded: boolean) => {
    if (!isDraggingMonths || dragAction === null || draggedEmployeeIndex !== empIndex) return;
    const targetVal = dragAction === 'check';
    if (isIncluded !== targetVal) {
      handleUpdateEntry(empIndex, "toggleMonth", null, month as keyof MonthlySalaries);
    }
  };

  useEffect(() => {
    setSelectedYear(activeFinancialYear.split('-')[0]);
    setBonusRefYear(activeFinancialYear);
  }, [activeFinancialYear]);

  const initializeBonusEntries = (year: string, globalPct: number) => {
    const saved = localStorage.getItem(`bonuses_${activeFinancialYear}_${year}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration to ensure includedMonths exists
      const migrated = parsed.map((entry: any) => ({
        ...entry,
        includedMonths: entry.includedMonths || MONTHS
      }));
      setBonusEntries(migrated);
      if (migrated.length > 0 && migrated[0].percentage !== undefined) {
        setBonusPercentage(migrated[0].percentage);
      }
      setActiveEditEmployeeIndex(0);
      return;
    }

    const roster = employees && employees.length > 0 ? employees : EMPLOYEES;

    const computed = roster.map(emp => {
      const monthlySalaries: MonthlySalaries = {
        January: 0, February: 0, March: 0, April: 0, May: 0, June: 0,
        July: 0, August: 0, September: 0, October: 0, November: 0, December: 0
      };

      const shiftHours = emp.shift === '12-hour' ? 12 : 9;
      const dailyRate = emp.rate * shiftHours;
      const defaultMonthlySalary = dailyRate * 26;

      MONTHS.forEach(mName => {
        let mSalary = 0;
        if (attendance && attendance.length > 0) {
          const empLogs = attendance.filter(entry => {
            if (entry.id !== emp.id) return false;
            const parts = entry.date.split('-');
            if (parts.length < 3) return false;
            const entryYear = parts[0];
            const entryMonthIndex = parseInt(parts[1]) - 1;
            const entryMonthName = MONTHS[entryMonthIndex];
            
            let expectedYear = year;
            if (year.includes('-')) {
              const fyParts = year.split('-');
              expectedYear = [
                "January", "February", "March", "April", "May", "June", "July", "August", "September"
              ].includes(mName) ? fyParts[1] : fyParts[0];
            }
            
            return entryMonthName === mName && entryYear === expectedYear;
          });

          if (empLogs.length > 0) {
            mSalary = empLogs.reduce((sum, log) => {
              const gross = log.hours * log.rate;
              const net = gross + (log.incentive || 0) - (log.weeklyAdvance || 0) - (log.loan || 0);
              return sum + net;
            }, 0);
          }
        }
        monthlySalaries[mName as keyof MonthlySalaries] = mSalary > 0 ? mSalary : defaultMonthlySalary;
      });

      const yearlySalary = Object.values(monthlySalaries).reduce((sum, sal) => sum + sal, 0);
      const bonusAmount = Math.round((yearlySalary * globalPct) / 100);

      return {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        monthlySalaries,
        includedMonths: MONTHS,
        yearlySalary,
        percentage: globalPct,
        bonusAmount
      };
    });

    setBonusEntries(computed);
    setActiveEditEmployeeIndex(0);
  };

  useEffect(() => {
    if (isBonusViewActive) {
      initializeBonusEntries(bonusRefYear, bonusPercentage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBonusViewActive, bonusRefYear]);

  const handleGlobalPercentageChange = (pct: number) => {
    setBonusPercentage(pct);
    setBonusEntries(prev => prev.map(entry => {
      const bonusAmount = Math.round((entry.yearlySalary * pct) / 100);
      return {
        ...entry,
        percentage: pct,
        bonusAmount
      };
    }));
  };

  const handleUpdateEntry = (index: number, field: keyof BonusEntry | 'monthlySalaries' | 'toggleMonth', value: any, monthKey?: keyof MonthlySalaries) => {
    setBonusEntries(prev => {
      const updated = [...prev];
      const entry = { ...updated[index] };
      const included = entry.includedMonths ? [...entry.includedMonths] : [...MONTHS];

      if (field === "monthlySalaries" && monthKey) {
        const salaries = { ...entry.monthlySalaries };
        salaries[monthKey] = value;
        entry.monthlySalaries = salaries;
        
        // Sum only included months
        entry.yearlySalary = Object.keys(salaries).reduce((sum, m) => {
          if (included.includes(m)) {
            return sum + (salaries[m as keyof MonthlySalaries] || 0);
          }
          return sum;
        }, 0);
        entry.bonusAmount = Math.round((entry.yearlySalary * entry.percentage) / 100);
      } else if (field === "toggleMonth" && monthKey) {
        const monthStr = monthKey as string;
        const idx = included.indexOf(monthStr);
        if (idx > -1) {
          included.splice(idx, 1);
        } else {
          included.push(monthStr);
        }
        entry.includedMonths = included;
        
        // Recalculate yearlySalary based on updated included months
        entry.yearlySalary = Object.keys(entry.monthlySalaries).reduce((sum, m) => {
          if (included.includes(m)) {
            return sum + (entry.monthlySalaries[m as keyof MonthlySalaries] || 0);
          }
          return sum;
        }, 0);
        entry.bonusAmount = Math.round((entry.yearlySalary * entry.percentage) / 100);
      } else if (field === "percentage") {
        entry.percentage = value;
        entry.bonusAmount = Math.round((entry.yearlySalary * value) / 100);
      } else if (field === "bonusAmount") {
        entry.bonusAmount = value;
      }

      updated[index] = entry;
      return updated;
    });
  };

  const handleSaveBonuses = () => {
    localStorage.setItem(`bonuses_${activeFinancialYear}_${bonusRefYear}`, JSON.stringify(bonusEntries));
    toast({
      title: "Bonus Ledger Saved",
      description: `Persisted yearly bonus calculations for year ${bonusRefYear} under active FY.`,
    });
    setIsBonusViewActive(false);
  };

  const handleDownloadBonusCSV = () => {
    try {
      const monthHeaders = FY_MONTHS.map(m => getMonthYearLabel(m, bonusRefYear)).join(",");
      let csvContent = `Staff ID,Name,Role,${monthHeaders},Total,Bonus %,Bonus Amount,Round Off\n`;
      
      bonusEntries.forEach(entry => {
        const exactAmount = (entry.yearlySalary * entry.percentage) / 100;
        const m = entry.monthlySalaries;
        const mSalariesStr = FY_MONTHS.map(month => m[month as keyof MonthlySalaries] || 0).join(",");
        
        csvContent += `"${entry.id}","${entry.name}","${entry.role}",${mSalariesStr},${entry.yearlySalary},${entry.percentage},${exactAmount.toFixed(2)},${entry.bonusAmount}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `Yearly_Bonus_Report_${bonusRefYear}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      toast({
        title: "CSV Downloaded",
        description: "Yearly bonus ledger exported successfully with 12-month breakdown.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Could not export CSV file.",
      });
    }
  };
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [selectedEmployeeForSlip, setSelectedEmployeeForSlip] = useState<any>(null);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, 'Paid' | 'Unpaid'>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const handlePrint = () => {
    window.print();
  };

  const togglePaymentStatus = (empId: string) => {
    setPaymentStatuses(prev => {
      const current = prev[empId] || 'Unpaid';
      const next = current === 'Paid' ? 'Unpaid' : 'Paid';
      const updated = { ...prev, [empId]: next };
      localStorage.setItem(`payroll_status_${activeFinancialYear}_${selectedMonth}_${selectedYear}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleDownloadExcel = async () => {
    if (!reportData) return;
    setIsDownloadingExcel(true);
    try {
      const XLSX = await import("xlsx");
      
      const dataToExport = reportData.map(row => ({
        "Employee ID": row.id,
        "Name": row.name,
        "Role": row.role,
        "Shift": row.shift,
        "Days Worked": row.daysWorked,
        "Gross (₹)": row.gross,
        "Incentive (₹)": row.incentive,
        "Deductions (₹)": row.deductions,
        "Net Payout (₹)": row.net
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Summary");
      
      const fileName = `Payroll_Report_${selectedMonth}_${selectedYear}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Excel Downloaded",
        description: `${fileName} has been saved.`,
      });
    } catch (error) {
      console.error("Excel generation failed:", error);
      toast({
        variant: "destructive",
        title: "Excel Failed",
        description: "Could not generate Excel file.",
      });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    
    setIsDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      
      const fileName = selectedEmployeeForSlip 
        ? `Payslip_${selectedEmployeeForSlip.id}_${selectedMonth}_${selectedYear}.pdf`
        : `Payroll_Report_${selectedMonth}_${selectedYear}.pdf`;
        
      pdf.save(fileName);
      
      toast({
        title: "PDF Downloaded",
        description: `${fileName} has been saved to your device.`,
      });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Could not generate PDF. Please try the Print option.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!selectedEmployeeForSlip) {
      toast({
        variant: "destructive",
        title: "No Employee Selected",
        description: "Please select an employee to send their salary slip.",
      });
      return;
    }

    const emp = selectedEmployeeForSlip;
    const mobile = emp.mobile?.replace(/\D/g, '') || '';
    
    if (mobile.length < 10) {
      toast({
        variant: "destructive",
        title: "Invalid Mobile Number",
        description: `${emp.name} does not have a valid mobile number on file.`,
      });
      return;
    }

    // Format the mobile number for India if it doesn't have a country code
    const waNumber = mobile.length === 10 ? `91${mobile}` : mobile;

    const message = `Hello ${emp.name},
Here is your salary summary for ${selectedMonth} ${selectedYear}:

- Total Days: ${emp.daysWorked} Days
- Base Salary: ₹${emp.gross.toLocaleString('en-IN')}
- Incentives: +₹${emp.incentive.toLocaleString('en-IN')}
- Deductions: -₹${emp.deductions.toLocaleString('en-IN')}
--------------------------------
NET PAYOUT: ₹${emp.net.toLocaleString('en-IN')}
--------------------------------

Please contact HR if you have any questions.`;

    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const generateMonthlyReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const roster = employees && employees.length > 0 ? employees : EMPLOYEES;
      const data = roster.map(emp => {
        let daysWorked = 0;
        let gross = 0;
        let incentive = 0;
        let deductions = 0;

        if (attendance && attendance.length > 0) {
          const empLogs = attendance.filter(entry => {
            const isEmpMatch = (entry.employeeRefId || entry.id?.split('-')[0]) === emp.id || entry.id === emp.id;
            if (!isEmpMatch) return false;
            
            if (entry.date) {
               const parts = entry.date.split('-');
               if (parts.length >= 3) {
                 const logYear = parts[0];
                 const logMonth = MONTHS[parseInt(parts[1]) - 1];
                 return logYear === selectedYear && logMonth === selectedMonth;
               }
            }
            return false;
          });

          daysWorked = 0;
          empLogs.forEach(log => {
             // log.hours contains the Total Days for the month (as logged by Attendance Logger)
             const days = log.hours || 0;
             const shiftHours = (log.shift || emp.shift) === '12-hour' ? 12 : 9;
             const hourlyRate = log.rate || emp.rate || 0;
             const dailyRate = hourlyRate * shiftHours;
             
             daysWorked += days;
             gross += (days * dailyRate);
             incentive += (log.incentive || 0);
             deductions += (log.weeklyAdvance || 0) + (log.loan || 0);
          });
        }

        return {
          ...emp,
          daysWorked,
          gross,
          incentive,
          deductions,
          net: gross + incentive - deductions
        };
      });

      const savedStatuses = localStorage.getItem(`payroll_status_${activeFinancialYear}_${selectedMonth}_${selectedYear}`);
      if (savedStatuses) {
        setPaymentStatuses(JSON.parse(savedStatuses));
      } else {
        setPaymentStatuses({});
      }

      setReportData(data);
      setIsGenerating(false);
      toast({
        title: "Report Generated",
        description: `Salary summary for ${selectedMonth} ${selectedYear} is ready.`,
      });
    }, 1000);
  };

  if (isBonusViewActive) {
    const orderedVisibleMonths = FY_MONTHS.filter(m => visibleMonths.includes(m));
    return (
      <div className="space-y-6 w-full animate-in fade-in duration-200">
        {/* Full Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/30 p-5 border border-border rounded-xl">
          <div>
            <h2 className="font-headline text-2xl font-bold flex items-center gap-2">
              <Gift className="w-6 h-6 text-accent animate-pulse" />
              12-Month Yearly Bonus Calculator (Spreadsheet View)
            </h2>
            <p className="text-muted-foreground text-xs mt-1">
              Adjust percentages, drag-select months horizontally to toggle inclusion, and modify salaries directly in the spreadsheet grid below.
            </p>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => setIsBonusViewActive(false)} 
            className="text-muted-foreground hover:text-foreground border border-border"
          >
            Back to Reports
          </Button>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-card/20 border border-border rounded-xl">
          <div className="space-y-1.5">
            <Label htmlFor="ref-year" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Reporting Year</Label>
            <Select value={bonusRefYear} onValueChange={setBonusRefYear}>
              <SelectTrigger id="ref-year" className="bg-background border-muted h-10 w-full">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {FY_YEARS.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="global-pct" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Global Bonus Percentage (%)</Label>
            <div className="relative">
              <Input 
                id="global-pct"
                type="number"
                step="0.01"
                value={bonusPercentage}
                onChange={(e) => handleGlobalPercentageChange(Number(e.target.value) || 0)}
                className="bg-background border-muted h-10 font-mono font-bold w-full pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Visible Months</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full bg-background border-muted justify-between h-10 text-left font-normal">
                  <span className="truncate">
                    {visibleMonths.length === 12 
                      ? "All Months Visible" 
                      : `${visibleMonths.length} Months Selected`}
                  </span>
                  <TableIcon className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px] bg-card border-border max-h-[300px] overflow-y-auto z-40">
                <DropdownMenuLabel className="text-xs uppercase font-bold text-muted-foreground">Toggle Months</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {FY_MONTHS.map(month => {
                  const isVisible = visibleMonths.includes(month);
                  return (
                    <DropdownMenuCheckboxItem
                      key={month}
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setVisibleMonths(prev => [...prev, month]);
                        } else {
                          if (visibleMonths.length > 1) {
                            setVisibleMonths(prev => prev.filter(m => m !== month));
                          } else {
                            toast({
                              variant: "destructive",
                              title: "Cannot Hide All Months",
                              description: "At least one month must be visible in the spreadsheet.",
                            });
                          }
                        }
                      }}
                      className="text-xs cursor-pointer focus:bg-accent focus:text-accent-foreground"
                    >
                      {getMonthYearLabel(month, bonusRefYear)}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Spreadsheet Area */}
        <div className="border border-border bg-background/20 rounded-md p-4 flex flex-col overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-[#f3f4f6] dark:bg-neutral-800 sticky top-0 z-20">
                <tr className="text-left text-xs uppercase tracking-wider font-bold">
                  <th className="p-2 text-gray-700 dark:text-gray-300 sticky left-0 bg-[#f3f4f6] dark:bg-neutral-800 z-30 border-r border-b border-gray-300 dark:border-neutral-700 w-[75px] min-w-[75px] text-center font-bold">S.NO</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 sticky left-[75px] bg-[#f3f4f6] dark:bg-neutral-800 z-30 border-r border-b border-gray-300 dark:border-neutral-700 w-[160px] min-w-[160px] text-left font-bold">NAME</th>
                  {orderedVisibleMonths.map(month => (
                    <th key={month} className="p-2 text-gray-700 dark:text-gray-300 text-center min-w-[125px] w-[125px] border-r border-b border-gray-300 dark:border-neutral-700 font-bold">{getMonthYearLabel(month, bonusRefYear)}</th>
                  ))}
                  <th className="p-2 text-gray-700 dark:text-gray-300 text-right min-w-[110px] w-[110px] border-r border-b border-gray-300 dark:border-neutral-700 font-bold">TOTAL</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 text-right min-w-[95px] w-[95px] border-r border-b border-gray-300 dark:border-neutral-700 font-bold">BONUS %</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 text-right min-w-[120px] w-[120px] border-r border-b border-gray-300 dark:border-neutral-700 font-bold">BONUS AMOUNT</th>
                  <th className="p-2 text-gray-700 dark:text-gray-300 text-right min-w-[110px] w-[110px] border-b border-gray-300 dark:border-neutral-700 font-bold">ROUND OFF</th>
                </tr>
              </thead>
              <tbody>
                {bonusEntries.map((entry, index) => {
                  const exactAmount = (entry.yearlySalary * entry.percentage) / 100;
                  
                  return (
                    <tr 
                      key={entry.id} 
                      className={cn(
                        "transition-all h-10 hover:bg-muted/10 group cursor-pointer"
                      )}
                    >
                      <td className={cn(
                        "p-2 font-mono text-xs text-center sticky left-0 z-10 border-r border-b border-gray-300 dark:border-neutral-700 transition-colors w-[75px] min-w-[75px]",
                        "bg-card text-muted-foreground group-hover:bg-muted/30 dark:group-hover:bg-neutral-800/50"
                      )}>
                        {entry.id}
                      </td>
                      <td className={cn(
                        "p-2 text-xs font-bold sticky left-[75px] z-10 border-r border-b border-gray-300 dark:border-neutral-700 transition-colors w-[160px] min-w-[160px] truncate",
                        "bg-card text-foreground group-hover:bg-muted/30 dark:group-hover:bg-neutral-800/50"
                      )}>
                        {entry.name}
                      </td>
                      
                      {/* 12 Months Cells */}
                      {orderedVisibleMonths.map(month => {
                        const mSalary = entry.monthlySalaries[month as keyof MonthlySalaries] || 0;
                        const isIncluded = entry.includedMonths?.includes(month) ?? true;
                        
                        return (
                          <td 
                            key={month} 
                            className={cn(
                              "p-0.5 w-[125px] min-w-[125px] text-center border-r border-b border-gray-200 dark:border-neutral-800 transition-colors select-none",
                              !isIncluded && "bg-muted/30 dark:bg-neutral-950/30",
                              "group-hover:bg-muted/10 dark:group-hover:bg-neutral-900/30"
                            )}
                            onMouseDown={(e) => {
                              if (e.target instanceof HTMLInputElement && e.target.type === 'number') {
                                return;
                              }
                              if (e.button !== 0) return;
                              handleMonthMouseDown(index, month, isIncluded);
                            }}
                            onMouseEnter={() => {
                              handleMonthMouseEnter(index, month, isIncluded);
                            }}
                          >
                            <div className="flex items-center gap-1 px-1.5 h-8">
                              <Checkbox 
                                id={`include-${month}-${entry.id}`}
                                checked={isIncluded} 
                                onCheckedChange={() => handleUpdateEntry(index, "toggleMonth", null, month as keyof MonthlySalaries)}
                                className="border-muted-foreground/30 h-3.5 w-3.5 data-[state=checked]:bg-accent data-[state=checked]:border-accent shrink-0"
                              />
                              <Input 
                                type="number"
                                value={mSalary === 0 ? "" : mSalary}
                                placeholder="0"
                                disabled={!isIncluded}
                                onChange={(e) => handleUpdateEntry(index, "monthlySalaries", Number(e.target.value) || 0, month as keyof MonthlySalaries)}
                                className={cn(
                                  "h-7 text-right font-mono text-xs w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-white dark:focus:bg-neutral-800 rounded-sm px-1.5 transition-all outline-none",
                                  !isIncluded ? "text-muted-foreground/30 line-through decoration-destructive/30" : "text-foreground"
                                )}
                              />
                            </div>
                          </td>
                        );
                      })}
                      
                      {/* Total Yearly Salary */}
                      <td className={cn(
                        "p-2 text-right font-mono font-bold text-primary w-[110px] min-w-[110px] border-r border-b border-gray-200 dark:border-neutral-800/60 transition-colors",
                        "bg-gray-50/50 dark:bg-neutral-900/10 group-hover:bg-muted/10 dark:group-hover:bg-neutral-900/30"
                      )}>
                        ₹{entry.yearlySalary.toLocaleString('en-IN')}
                      </td>
                      
                      {/* Bonus Percentage */}
                      <td className={cn(
                        "p-0.5 w-[95px] min-w-[95px] border-r border-b border-gray-200 dark:border-neutral-800 transition-colors",
                        "group-hover:bg-muted/10 dark:group-hover:bg-neutral-900/30"
                      )}>
                        <div className="relative flex items-center h-8 px-1">
                          <Input 
                            type="number"
                            step="0.01"
                            value={entry.percentage}
                            onChange={(e) => handleUpdateEntry(index, "percentage", Number(e.target.value) || 0)}
                            className="h-7 text-right font-mono w-full bg-transparent border border-transparent focus:border-primary/50 focus:bg-white dark:focus:bg-neutral-800 rounded-sm pr-4 text-xs transition-all outline-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-muted-foreground pointer-events-none">%</span>
                        </div>
                      </td>
                      
                      {/* Exact Calculated Bonus Amount (read-only) */}
                      <td className={cn(
                        "p-2 text-right font-mono text-muted-foreground text-xs w-[120px] min-w-[120px] border-r border-b border-gray-200 dark:border-neutral-800/60 transition-colors",
                        "bg-gray-50/50 dark:bg-neutral-900/10 group-hover:bg-muted/10 dark:group-hover:bg-neutral-900/30"
                      )}>
                        ₹{exactAmount.toFixed(2)}
                      </td>
                      
                      {/* Rounded / Round Off (manual override) */}
                      <td className={cn(
                        "p-0.5 w-[110px] min-w-[110px] border-b border-gray-200 dark:border-neutral-800/60 transition-colors",
                        "group-hover:bg-muted/10 dark:group-hover:bg-neutral-900/30"
                      )}>
                        <div className="relative flex items-center h-8 px-1">
                          <Input 
                            type="number"
                            value={entry.bonusAmount}
                            onChange={(e) => handleUpdateEntry(index, "bonusAmount", Number(e.target.value) || 0)}
                            className="h-7 text-right font-mono font-bold w-full bg-transparent border border-transparent focus:border-accent/50 focus:bg-white dark:focus:bg-neutral-800 rounded-sm text-accent text-xs transition-all outline-none"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Summary */}
        <div className="p-5 bg-card/30 border border-border rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm font-bold uppercase tracking-wider">
            Total Bonus Liability: <span className="text-xl font-headline font-black text-accent ml-2">₹{bonusEntries.reduce((sum, e) => sum + e.bonusAmount, 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={handleDownloadBonusCSV}
              className="border-border text-xs flex-1 sm:flex-initial"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsBonusViewActive(false)}
              className="border-border text-xs flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveBonuses}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex-1 sm:flex-initial"
            >
              Save & Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print bg-card/30 p-4 border border-border rounded-xl">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarDays className="w-5 h-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase text-muted-foreground">Select Reporting Period</span>
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] bg-background">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            variant="secondary" 
            onClick={generateMonthlyReport}
            disabled={isGenerating}
            className="md:mt-4"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Report
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          <div className="relative no-print mr-auto md:mr-2 flex-grow md:flex-grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search labourer name or ID..."
              className="pl-8 h-9 w-full md:w-[250px] bg-background border-border focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-border hover:bg-accent/5"
            onClick={handleDownloadExcel}
            disabled={!reportData || isDownloadingExcel}
          >
            {isDownloadingExcel ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TableIcon className="w-4 h-4 mr-2 text-green-500" />
            )}
            Download Excel
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-border hover:bg-accent/5"
            onClick={handleDownloadPDF}
            disabled={!reportData || isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handlePrint} 
            className="bg-primary hover:bg-primary/90"
            disabled={!reportData}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print View
          </Button>
          {selectedEmployeeForSlip && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleSendWhatsApp} 
              className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          )}
        </div>
      </div>

      <div className="printable-area space-y-8" ref={reportRef}>
        {reportData && !selectedEmployeeForSlip && (
          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="border-b border-border/50">
              <div className="flex justify-between items-end">
                <div>
                  <CardTitle className="font-headline text-2xl">Monthly Payroll Summary</CardTitle>
                  <CardDescription className="text-primary font-bold uppercase tracking-widest text-xs">
                    Period: {selectedMonth} {selectedYear} • Manufacturing Unit #1
                  </CardDescription>
                </div>
                <div className="only-print text-right">
                  <div className="text-sm font-bold">ShiftWise Systems</div>
                  <div className="text-[10px] text-muted-foreground">Generated: {new Date().toLocaleDateString()}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr className="text-left">
                      <th className="p-4 text-[10px] uppercase font-bold">Staff ID</th>
                      <th className="p-4 text-[10px] uppercase font-bold">Labourer Name</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-center">Days</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-right">Gross (₹)</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-right">Inc. (+)</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-right">Ded. (-)</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-right">Net Payout</th>
                      <th className="p-4 text-[10px] uppercase font-bold text-center no-print">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData
                      .filter(row => 
                        row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        row.id.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((row) => (
                      <tr key={row.id} className="border-b border-border/30 hover:bg-accent/5">
                        <td className="p-4 font-mono text-muted-foreground">{row.id}</td>
                        <td className="p-4 font-bold">{row.name}</td>
                        <td className="p-4 text-center font-mono">{row.daysWorked}</td>
                        <td className="p-4 text-right font-mono text-muted-foreground">₹{row.gross.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right font-mono text-green-500">₹{row.incentive.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right font-mono text-destructive">₹{row.deductions.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right font-headline font-black text-accent">₹{row.net.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-center no-print">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className={cn(
                              "h-7 text-[10px] uppercase tracking-wider font-bold min-w-[80px]",
                              paymentStatuses[row.id] === 'Paid' 
                                ? "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20" 
                                : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                            )}
                            onClick={() => togglePaymentStatus(row.id)}
                          >
                            {paymentStatuses[row.id] === 'Paid' ? 'Paid' : 'Unpaid'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-accent/10 font-bold border-t-2 border-accent/20">
                    <tr>
                      <td colSpan={2} className="p-4 text-accent uppercase tracking-tighter">Total Monthly Liability</td>
                      <td className="p-4 text-center">{reportData.reduce((a, b) => a + b.daysWorked, 0)} Total Days</td>
                      <td className="p-4 text-right">₹{reportData.reduce((a, b) => a + b.gross, 0).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-right text-green-500">₹{reportData.reduce((a, b) => a + b.incentive, 0).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-right text-destructive">₹{reportData.reduce((a, b) => a + b.deductions, 0).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-right text-accent text-lg">₹{reportData.reduce((a, b) => a + b.net, 0).toLocaleString('en-IN')}</td>
                      <td className="p-4 no-print"></td>
                    </tr>
                    <tr className="bg-green-500/10 border-t border-green-500/20">
                      <td colSpan={6} className="p-3 text-right text-green-700 uppercase text-xs font-bold tracking-wider">Total Paid Salary</td>
                      <td className="p-3 text-right text-green-700 font-headline font-black text-lg">
                        ₹{reportData.filter(r => paymentStatuses[r.id] === 'Paid').reduce((a, b) => a + b.net, 0).toLocaleString('en-IN')}
                      </td>
                      <td className="no-print"></td>
                    </tr>
                    <tr className="bg-destructive/10 border-t border-destructive/20">
                      <td colSpan={6} className="p-3 text-right text-destructive uppercase text-xs font-bold tracking-wider">Total Unpaid Salary</td>
                      <td className="p-3 text-right text-destructive font-headline font-black text-lg">
                        ₹{reportData.filter(r => paymentStatuses[r.id] !== 'Paid').reduce((a, b) => a + b.net, 0).toLocaleString('en-IN')}
                      </td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedEmployeeForSlip && (
          <div className="printable-payslip bg-white text-black p-8 border-2 border-black rounded-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-black text-white px-4 py-1 text-[10px] font-bold uppercase tracking-widest no-print-force">
              Private & Confidential
            </div>
            
            <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
              <div>
                <h2 className="text-3xl font-headline font-black tracking-tighter">SHIFTWISE PAYROLL</h2>
                <p className="text-xs uppercase font-bold">Manufacturing Unit #1 • Factory Payout Slip</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-headline font-bold">{selectedMonth} {selectedYear}</div>
                <div className="text-[10px] uppercase font-bold">Salary Slip ID: PS-{selectedEmployeeForSlip.id}-{selectedMonth.substring(0,3)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8 text-left">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-gray-500">Employee Details</div>
                <div className="text-lg font-bold">{selectedEmployeeForSlip.name}</div>
                <div className="text-xs">ID: {selectedEmployeeForSlip.id}</div>
                <div className="text-xs">Role: {selectedEmployeeForSlip.role}</div>
                <div className="text-xs">Shift Allocation: {selectedEmployeeForSlip.shift}</div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] uppercase font-bold text-gray-500">Bank & Attendance</div>
                <div className="text-sm font-bold">Status: VERIFIED</div>
                <div className="text-xs">Total Days Worked: {selectedEmployeeForSlip.daysWorked} Days</div>
                <div className="text-xs">Hourly Rate Applied: ₹{selectedEmployeeForSlip.rate}/hr</div>
              </div>
            </div>

            <div className="border-t-2 border-black border-dashed py-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Base Salary ({selectedEmployeeForSlip.daysWorked} Days @ {selectedEmployeeForSlip.shift})</span>
                <span className="font-mono font-bold">₹{selectedEmployeeForSlip.gross.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center mb-2 text-green-600">
                <span className="text-sm font-bold">Performance Incentives (+)</span>
                <span className="font-mono font-bold">+ ₹{selectedEmployeeForSlip.incentive.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-red-600">
                <span className="text-sm font-bold">Total Deductions (Adv/Loan) (-)</span>
                <span className="font-mono font-bold">- ₹{selectedEmployeeForSlip.deductions.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="bg-black text-white p-4 flex justify-between items-center rounded-sm">
              <span className="text-lg font-headline font-bold uppercase tracking-widest">Net Payout Amount</span>
              <span className="text-3xl font-headline font-black">₹{selectedEmployeeForSlip.net.toLocaleString('en-IN')}</span>
            </div>

            <div className="mt-12 pt-12 border-t border-black flex justify-between items-end">
              <div className="text-center">
                <div className="w-32 h-px bg-black mb-1 mx-auto" />
                <span className="text-[10px] uppercase font-bold">Labourer Signature</span>
              </div>
              <div className="text-center">
                <div className="w-32 h-px bg-black mb-1 mx-auto" />
                <span className="text-[10px] uppercase font-bold">Authorized Signatory</span>
              </div>
            </div>
            
            <p className="mt-8 text-[8px] text-gray-400 italic text-center">
              This is a computer generated payslip and does not require a physical seal. For any discrepancies, please contact HR Unit 1.
            </p>
          </div>
        )}
      </div>

      <div className="no-print space-y-8">
        {!selectedEmployeeForSlip && (
          <Card className="bg-card/30 border-border">
            <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                12-Month Labor Expenditure Trend
              </CardTitle>
              <CardDescription>Seasonal cost variations and factory production overheads.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendData}>
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
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                      formatter={(value) => [`₹${(value as number).toLocaleString('en-IN')}`, 'Expenditure']}
                    />
                    <Bar 
                      dataKey="cost" 
                      fill="hsl(var(--primary))" 
                      radius={[6, 6, 0, 0]} 
                      barSize={30}
                      className="fill-primary/80 hover:fill-primary transition-all cursor-pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {!selectedEmployeeForSlip && (
          <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                  <Gift className="w-6 h-6 text-accent" />
                  Yearly Bonus Calculator
                </CardTitle>
                <CardDescription>Compute statutory bonus based on 12-month earnings.</CardDescription>
              </div>
              <Button 
                variant="default" 
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => setIsBonusViewActive(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Calculate Yearly Bonus
              </Button>
            </CardHeader>
          </Card>
        )}

        {selectedEmployeeForSlip && (
          <div className="flex justify-center py-4">
            <Button variant="ghost" onClick={() => setSelectedEmployeeForSlip(null)} className="text-muted-foreground hover:text-foreground">
              Back to Monthly Summary
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

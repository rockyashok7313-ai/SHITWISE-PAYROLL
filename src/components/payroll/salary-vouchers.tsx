"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReceiptText, Trash2, Printer, Search, Download, Edit2, RefreshCw, AlertTriangle, Check, X } from "lucide-react";
import { useAppContext } from "@/components/providers/app-provider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MONTHS,
  AttendanceEntry,
  calculateNetPay,
  filterAttendanceForPeriod,
  yearForMonth,
  yearOptions
} from "@/lib/payroll";
import { periodLabel, parsePeriod, samePeriod } from "@/lib/voucher-period";

/* ------------------------------------------------------------------ */
/* Date + financial year helpers                                       */
/* ------------------------------------------------------------------ */

/** Today as YYYY-MM-DD in the *local* timezone. `toISOString()` returns the UTC
 *  date, which is the previous day for anyone in IST before 05:30. */
function todayLocalISO(): string {
  const now = new Date();
  const mm = `${now.getMonth() + 1}`.padStart(2, '0');
  const dd = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Formats a stored YYYY-MM-DD without letting UTC parsing shift the day. */
function formatDisplayDate(iso?: string): string {
  if (!iso) return 'N/A';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 'N/A';
  return new Date(y, m - 1, d).toLocaleDateString();
}

/* ------------------------------------------------------------------ */
/* Voucher period key                                                  */
/* ------------------------------------------------------------------ */

/* The period is persisted as a display string ("January 2026"). Changing that
 * would orphan every existing voucher, so it is kept -- but it is parsed rather
 * than string-compared so casing/spacing differences do not hide records.
 * Worth migrating to { year: number, month: number } when you can run a
 * backfill. */

/* periodKey/parsePeriod/samePeriod now live in @/lib/voucher-period, shared with
 * the register, which derives payroll "Paid" status from voucher existence via
 * the same period matching. periodKey is periodLabel there. */

/* ------------------------------------------------------------------ */
/* Amount in words (Indian numbering)                                  */
/* ------------------------------------------------------------------ */

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
}

function numberToWordsIndian(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = Math.floor(n / 100); n %= 100;

  if (crore) parts.push(`${crore > 99 ? numberToWordsIndian(crore) : belowHundred(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(belowHundred(n));

  return `${value < 0 ? "Minus " : ""}${parts.join(" ")}`;
}

/* ------------------------------------------------------------------ */
/* PDF helpers                                                         */
/* ------------------------------------------------------------------ */

/** Truncates to the real rendered width instead of a guessed character count. */
function fitText(pdf: any, text: string, maxWidth: number): string {
  let out = text || "";
  if (pdf.getTextWidth(out) <= maxWidth) return out;
  while (out.length > 1 && pdf.getTextWidth(`${out}...`) > maxWidth) out = out.slice(0, -1);
  return `${out}...`;
}

/** Prints a jsPDF document via a hidden iframe -- avoids printing the whole app
 *  chrome (the old `window.print()`) and avoids popup blockers. */
function printPdfDocument(pdf: any) {
  const blobUrl: string = pdf.output("bloburl");
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = blobUrl;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch (err) {
      console.error("Print failed", err);
    }
  };
  document.body.appendChild(frame);
  // Removing the frame immediately cancels the print dialog, so clean up late.
  window.setTimeout(() => frame.remove(), 60000);
}

/* ------------------------------------------------------------------ */

interface VoucherRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  date?: string;
  amount: string | number;
  paymentMethod: 'Bank' | 'Cash';
  remarks?: string;
}

interface ComputedPay {
  net: number;
  recordCount: number;
}

export function SalaryVouchers() {
  const { config, employees, attendance, vouchers, handleCreateVoucher, handleUpdateVoucher, handleDeleteVoucher } = useAppContext();
  const activeFinancialYear = config?.financialYear || "2026-2027";
  const { toast } = useToast();

  const currentMonth = MONTHS[new Date().getMonth()];

  const [voucherMonth, setVoucherMonth] = useState<string>(currentMonth);
  const [voucherYear, setVoucherYear] = useState<string>(() => yearForMonth(currentMonth, activeFinancialYear));
  const [voucherEmployee, setVoucherEmployee] = useState<string>("");
  const [voucherDate, setVoucherDate] = useState<string>(todayLocalISO);
  const [voucherAmount, setVoucherAmount] = useState<string>("");
  const [voucherMethod, setVoucherMethod] = useState<'Bank' | 'Cash'>('Bank');
  const [voucherRemarks, setVoucherRemarks] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const [historyMonth, setHistoryMonth] = useState<string>(currentMonth);
  const [historyYear, setHistoryYear] = useState<string>(() => yearForMonth(currentMonth, activeFinancialYear));

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isPrintingReport, setIsPrintingReport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busyVoucherId, setBusyVoucherId] = useState<string | null>(null);

  /* Tracks whether the amount in the field was typed by the user. Without this
   * the auto-calc effect re-runs on any context refresh (new `attendance` array
   * identity) and silently overwrites a manual override. */
  const [isAmountManual, setIsAmountManual] = useState(false);
  const [computed, setComputed] = useState<ComputedPay | null>(null);

  // `|| []` inline would create a fresh array each render and loop the effects below.
  const safeVouchers = useMemo(() => (vouchers || []) as VoucherRecord[], [vouchers]);
  const safeEmployees = useMemo(() => employees || [], [employees]);
  const safeAttendance = useMemo(() => attendance || [], [attendance]);

  const years = useMemo(() => yearOptions(activeFinancialYear), [activeFinancialYear]);

  const periodVouchers = useMemo(() => {
    const target = periodLabel(historyMonth, historyYear);
    return safeVouchers
      .filter(v => samePeriod(v.month, target))
      .sort((a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        (a.employeeName || "").localeCompare(b.employeeName || "")
      );
  }, [safeVouchers, historyMonth, historyYear]);

  const bankTotal = periodVouchers.filter(v => v.paymentMethod === 'Bank').reduce((sum, v) => sum + Number(v.amount), 0);
  const cashTotal = periodVouchers.filter(v => v.paymentMethod === 'Cash').reduce((sum, v) => sum + Number(v.amount), 0);

  /* `useState` initialisers run once, so the periods above froze at the fallback
   * financial year when `config` was still loading. Re-sync when the real
   * financial year arrives or changes. */
  const appliedFinancialYear = useRef<string | null>(null);
  useEffect(() => {
    const fy = config?.financialYear;
    if (!fy || appliedFinancialYear.current === fy) return;
    appliedFinancialYear.current = fy;
    setVoucherYear(yearForMonth(voucherMonth, fy));
    setHistoryYear(yearForMonth(historyMonth, fy));
  }, [config?.financialYear, voucherMonth, historyMonth]);

  /* Computes the net payout for the selected employee + period, and writes it
   * into the field only while the user has not taken over. Compute and apply
   * live in one effect on purpose: splitting them lets the apply step run once
   * against a stale `computed`, briefly showing the previous employee's amount. */
  useEffect(() => {
    const clear = () => {
      setComputed(null);
      if (!isAmountManual) setVoucherAmount("");
    };

    if (!voucherEmployee || !voucherMonth || !voucherYear) return clear();

    const emp = safeEmployees.find(e => e.id === voucherEmployee);
    if (!emp) return clear();

    const records = filterAttendanceForPeriod(
      safeAttendance as AttendanceEntry[],
      voucherEmployee,
      voucherMonth,
      voucherYear
    );

    // Same defaults the payroll register uses, so the two can never disagree.
    const net = calculateNetPay(records, { rate: emp.rate, shift: emp.shift });
    setComputed({ net, recordCount: records.length });
    if (!isAmountManual) setVoucherAmount(net > 0 ? net.toString() : "");
  }, [voucherEmployee, voucherMonth, voucherYear, safeAttendance, safeEmployees, isAmountManual]);

  /* Changing the employee or period invalidates a manual amount, so hand the
   * field back to the calculator. This also means editing an existing voucher
   * recalculates when you switch employee -- the old code left the previous
   * employee's figure in place. */
  const selectEmployee = (id: string) => { setVoucherEmployee(id); setIsAmountManual(false); };
  const selectMonth = (m: string) => { setVoucherMonth(m); setIsAmountManual(false); };
  const selectYear = (y: string) => { setVoucherYear(y); setIsAmountManual(false); };

  const resetForm = useCallback(() => {
    setEditingVoucherId(null);
    setVoucherEmployee("");
    setVoucherAmount("");
    setVoucherRemarks("");
    setIsAmountManual(false);
  }, []);

  /** Shared validation for create + update. Returns the parsed amount or null. */
  const validateForm = (): number | null => {
    if (!voucherEmployee) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Please select an employee." });
      return null;
    }
    if (!voucherDate) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Please pick a voucher date." });
      return null;
    }
    const amount = Number(voucherAmount);
    if (!voucherAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Enter an amount greater than zero." });
      return null;
    }
    return amount;
  };

  /** Duplicate check now covers updates too, not just creates. */
  const findDuplicate = (employeeId: string, period: string, ignoreId?: string) =>
    safeVouchers.find(v => v.employeeId === employeeId && v.id !== ignoreId && samePeriod(v.month, period));

  const buildPayload = (amount: number) => ({
    employeeId: voucherEmployee,
    employeeName: safeEmployees.find(e => e.id === voucherEmployee)?.name || 'Unknown',
    month: periodLabel(voucherMonth, voucherYear),
    date: voucherDate,
    // Kept as a string to match the existing stored shape. The model should move
    // to a number -- every read site already has to call Number(v.amount).
    amount: amount.toString(),
    paymentMethod: voucherMethod,
    remarks: voucherRemarks
  });

  const onCreateVoucher = async () => {
    if (isSubmitting) return; // a second click would create a duplicate payment
    const amount = validateForm();
    if (amount === null) return;

    const targetPeriod = periodLabel(voucherMonth, voucherYear);
    if (findDuplicate(voucherEmployee, targetPeriod)) {
      toast({ variant: "destructive", title: "Duplicate Voucher", description: "A voucher has already been generated for this employee for the selected month." });
      return;
    }

    setIsSubmitting(true);
    try {
      // Creating the voucher IS the Paid status now -- the register derives it
      // from voucher existence, so there is no separate flag to set.
      await handleCreateVoucher(buildPayload(amount));
      toast({ title: "Success", description: "Voucher generated. This employee now shows as Paid for the period." });
      resetForm();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to generate voucher." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onUpdateVoucher = async () => {
    if (isSubmitting || !editingVoucherId) return;
    const amount = validateForm();
    if (amount === null) return;

    const targetPeriod = periodLabel(voucherMonth, voucherYear);
    if (findDuplicate(voucherEmployee, targetPeriod, editingVoucherId)) {
      toast({ variant: "destructive", title: "Duplicate Voucher", description: "Another voucher already exists for this employee for the selected month." });
      return;
    }

    setIsSubmitting(true);
    try {
      // Paid status follows the voucher: moving it to another employee or period
      // moves the status automatically, since the register reads voucher
      // existence. No flag to hand-migrate.
      await handleUpdateVoucher(editingVoucherId, buildPayload(amount));
      toast({ title: "Success", description: "Voucher updated successfully." });
      resetForm();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update voucher." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVoucher = (v: VoucherRecord) => {
    setEditingVoucherId(v.id);
    setVoucherEmployee(v.employeeId);
    setVoucherDate(v.date || todayLocalISO());
    setVoucherAmount(`${v.amount}`);
    setVoucherMethod(v.paymentMethod);
    setVoucherRemarks(v.remarks || "");

    const parsed = parsePeriod(v.month);
    setVoucherMonth(parsed?.month || currentMonth);
    setVoucherYear(parsed?.year || yearForMonth(currentMonth, activeFinancialYear));

    // Preserve the stored amount instead of recomputing over it on open.
    setIsAmountManual(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDeleteVoucher = async (v: VoucherRecord) => {
    setBusyVoucherId(v.id);
    try {
      // Deleting the voucher is what marks the employee Unpaid again -- the
      // register no longer reads a separate flag.
      await handleDeleteVoucher(v.id);
      if (editingVoucherId === v.id) resetForm();
      toast({ title: "Deleted", description: `Voucher for ${v.employeeName} removed. This employee now shows as Unpaid for the period.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to delete voucher." });
    } finally {
      setBusyVoucherId(null);
      setPendingDeleteId(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /* PDF generation                                                    */
  /* ---------------------------------------------------------------- */

  const buildReportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF("p", "mm", "a4");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(`Voucher Report - ${historyMonth} ${historyYear}`, 15, 20);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 15, 28);

    // Summary Box
    pdf.setFillColor(243, 244, 246);
    pdf.rect(15, 35, 180, 20, "F");

    pdf.setFont("helvetica", "bold");
    pdf.text(`Total Bank Paid: Rs. ${bankTotal.toLocaleString('en-IN')}`, 20, 43);
    pdf.text(`Total Cash Paid: Rs. ${cashTotal.toLocaleString('en-IN')}`, 100, 43);
    pdf.text(`Total Payout: Rs. ${(bankTotal + cashTotal).toLocaleString('en-IN')}`, 20, 50);

    const drawTableHeader = (top: number) => {
      pdf.setFillColor(31, 41, 55);
      pdf.rect(15, top, 180, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Date", 18, top + 5.5);
      pdf.text("Employee Name", 45, top + 5.5);
      pdf.text("Method", 130, top + 5.5);
      pdf.text("Amount (Rs)", 185, top + 5.5, { align: "right" });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
    };

    let y = 65;
    drawTableHeader(y);
    y += 10;

    periodVouchers.forEach((v, index) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
        drawTableHeader(y);   // page 2 onwards used to have bare columns
        y += 10;
      }

      const shade = index % 2 === 0 ? 255 : 249;
      pdf.setFillColor(shade, shade, shade === 255 ? 255 : 251);
      pdf.rect(15, y - 2, 180, 8, "F");

      pdf.text(formatDisplayDate(v.date), 18, y + 3);
      pdf.text(fitText(pdf, v.employeeName, 80), 45, y + 3);
      pdf.text(v.paymentMethod, 130, y + 3);
      pdf.text(Number(v.amount).toLocaleString('en-IN'), 185, y + 3, { align: "right" });

      y += 8;
    });

    const pageCount = (pdf as any).internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Page ${p} of ${pageCount}`, 195, 290, { align: "right" });
    }

    return pdf;
  };

  const buildVoucherPdf = async (v: VoucherRecord) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF("p", "mm", "a4");
    const amount = Number(v.amount);
    // `config` shape varies by install; fall back to a generic heading.
    const companyName = (config as any)?.companyName || (config as any)?.company || "";

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    if (companyName) {
      pdf.text(companyName, 105, 22, { align: "center" });
      pdf.setFontSize(12);
      pdf.text("SALARY VOUCHER", 105, 31, { align: "center" });
    } else {
      pdf.text("SALARY VOUCHER", 105, 25, { align: "center" });
    }

    pdf.setDrawColor(200, 200, 200);
    pdf.rect(15, 40, 180, 105);

    pdf.setFontSize(10);
    const row = (label: string, value: string, y: number) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, 22, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(value, 70, y);
    };

    row("Voucher No.", `${v.id}`, 52);
    row("Date", formatDisplayDate(v.date), 62);
    row("Employee", `${v.employeeName} (${v.employeeId})`, 72);
    row("Pay Period", v.month, 82);
    row("Payment Mode", v.paymentMethod, 92);
    row("Amount", `Rs. ${amount.toLocaleString('en-IN')}`, 102);

    pdf.setFont("helvetica", "bold");
    pdf.text("In Words", 22, 112);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      pdf.splitTextToSize(`${numberToWordsIndian(amount)} Rupees Only`, 120) as any,
      70,
      112
    );

    if (v.remarks) {
      pdf.setFont("helvetica", "bold");
      pdf.text("Remarks", 22, 130);
      pdf.setFont("helvetica", "normal");
      pdf.text(pdf.splitTextToSize(v.remarks, 120) as any, 70, 130);
    }

    pdf.setFontSize(9);
    pdf.text("Received By", 30, 175);
    pdf.text("Authorised Signatory", 140, 175);
    pdf.line(25, 170, 75, 170);
    pdf.line(135, 170, 185, 170);

    return pdf;
  };

  const handleDownloadPDF = async () => {
    if (periodVouchers.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No vouchers found for the selected period." });
      return;
    }
    setIsExportingPDF(true);
    try {
      const pdf = await buildReportPdf();
      pdf.save(`Voucher_Report_${historyMonth}_${historyYear}.pdf`);
      toast({ title: "Success", description: "PDF report downloaded successfully." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF." });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrintReport = async () => {
    if (periodVouchers.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "No vouchers found for the selected period." });
      return;
    }
    setIsPrintingReport(true);
    try {
      printPdfDocument(await buildReportPdf());
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to prepare the report for printing." });
    } finally {
      setIsPrintingReport(false);
    }
  };

  const onPrintVoucher = async (voucher: VoucherRecord) => {
    setBusyVoucherId(voucher.id);
    try {
      printPdfDocument(await buildVoucherPdf(voucher));
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to prepare the voucher for printing." });
    } finally {
      setBusyVoucherId(null);
    }
  };

  /* ---------------------------------------------------------------- */

  const filteredEmployees = safeEmployees.filter(e => {
    const q = searchQuery.toLowerCase();
    return (e.name || "").toLowerCase().includes(q) || (e.id || "").toLowerCase().includes(q);
  });

  const showComputedHint = !isAmountManual && !!computed && computed.net > 0;
  const showNoRecords = !!voucherEmployee && !!computed && computed.recordCount === 0;
  const showNonPositiveNet = !!voucherEmployee && !!computed && computed.recordCount > 0 && computed.net <= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-headline flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-primary" />
            Salary Vouchers &amp; Payments
          </h2>
          <p className="text-sm text-muted-foreground">Generate and manage payment vouchers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm">{editingVoucherId ? 'Edit Voucher' : 'Generate Voucher'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="voucher-employee" className="text-xs font-bold text-muted-foreground">Employee</Label>
              <Select
                value={voucherEmployee}
                onValueChange={selectEmployee}
                onOpenChange={(open) => { if (!open) setSearchQuery(""); }}
              >
                <SelectTrigger id="voucher-employee" className="w-full">
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {/* A plain input inside SelectContent fights Radix's own typeahead
                      and focus management. Works, but a Command/Combobox is the
                      right primitive for a searchable picker. */}
                  <div className="p-2 border-b mb-2">
                    <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1">
                      <Search className="w-3 h-3 text-muted-foreground" />
                      <input
                        className="bg-transparent border-none focus:outline-none text-sm w-full"
                        placeholder="Search..."
                        aria-label="Search employees"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">No employees match.</div>
                  ) : (
                    filteredEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} <span className="text-muted-foreground text-xs">({emp.id})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="voucher-month" className="text-xs font-bold text-muted-foreground">Month</Label>
                <Select value={voucherMonth} onValueChange={selectMonth}>
                  <SelectTrigger id="voucher-month" className="w-full">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="voucher-year" className="text-xs font-bold text-muted-foreground">Year</Label>
                <Select value={voucherYear} onValueChange={selectYear}>
                  <SelectTrigger id="voucher-year" className="w-full">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voucher-date" className="text-xs font-bold text-muted-foreground">Voucher Date</Label>
              <Input
                id="voucher-date"
                type="date"
                value={voucherDate}
                onChange={e => setVoucherDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voucher-amount" className="text-xs font-bold text-muted-foreground">Amount (₹)</Label>
              <Input
                id="voucher-amount"
                type="number"
                min="0"
                step="1"
                placeholder="Enter amount"
                value={voucherAmount}
                onChange={e => { setVoucherAmount(e.target.value); setIsAmountManual(true); }}
              />

              {showComputedHint && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium ml-1">
                  Automatically computed from {computed!.recordCount} attendance {computed!.recordCount === 1 ? 'entry' : 'entries'}.
                </p>
              )}

              {isAmountManual && computed && computed.net > 0 && Number(voucherAmount) !== computed.net && (
                <button
                  type="button"
                  onClick={() => setIsAmountManual(false)}
                  className="text-[10px] text-muted-foreground hover:text-foreground font-medium ml-1 inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Manually set. Reset to computed ₹{computed.net.toLocaleString('en-IN')}
                </button>
              )}

              {showNoRecords && (
                <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium ml-1 flex items-start gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                  No attendance records for {voucherMonth} {voucherYear}. Enter the amount manually.
                </p>
              )}

              {showNonPositiveNet && (
                <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium ml-1 flex items-start gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                  Computed net is ₹{computed!.net.toLocaleString('en-IN')} — deductions meet or exceed gross across {computed!.recordCount} entries. Enter the amount to pay manually.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voucher-method" className="text-xs font-bold text-muted-foreground">Payment Method</Label>
              <Select value={voucherMethod} onValueChange={(v: any) => setVoucherMethod(v)}>
                <SelectTrigger id="voucher-method" className="w-full">
                  <SelectValue placeholder="Select Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank">Bank Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voucher-remarks" className="text-xs font-bold text-muted-foreground">Remarks (Optional)</Label>
              <Input
                id="voucher-remarks"
                placeholder="E.g. Bonus included"
                value={voucherRemarks}
                onChange={e => setVoucherRemarks(e.target.value)}
              />
            </div>

            {editingVoucherId ? (
              <div className="flex gap-3 mt-4">
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                  onClick={onUpdateVoucher}
                  disabled={isSubmitting}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Updating..." : "Update Voucher"}
                </Button>
                <Button variant="outline" className="flex-1" onClick={resetForm} disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                onClick={onCreateVoucher}
                disabled={isSubmitting}
              >
                <ReceiptText className="w-4 h-4 mr-2" />
                {isSubmitting ? "Generating..." : "Generate Voucher"}
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="col-span-1 flex flex-col gap-6">
            <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 flex-1 flex flex-col justify-center min-h-[140px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-500">Bank Paid ({historyMonth} {historyYear})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">₹{bankTotal.toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 flex-1 flex flex-col justify-center min-h-[140px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-500">Cash Paid ({historyMonth} {historyYear})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">₹{cashTotal.toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-1 lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <Select value={historyMonth} onValueChange={setHistoryMonth}>
                    <SelectTrigger className="w-[120px] h-8 text-xs" aria-label="History month">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={historyYear} onValueChange={setHistoryYear}>
                    <SelectTrigger className="w-[90px] h-8 text-xs" aria-label="History year">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrintReport} disabled={isPrintingReport} className="h-8">
                    <Printer className="w-3.5 h-3.5 mr-2" />
                    {isPrintingReport ? "Preparing..." : "Print"}
                  </Button>
                  <Button variant="default" size="sm" onClick={handleDownloadPDF} disabled={isExportingPDF} className="h-8 shadow-sm">
                    <Download className="w-3.5 h-3.5 mr-2" />
                    {isExportingPDF ? "Exporting..." : "Export PDF"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {periodVouchers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center">
                    <ReceiptText className="w-8 h-8 mb-3 opacity-20" />
                    <p className="text-sm">No vouchers generated for this period.</p>
                  </div>
                ) : (
                  <div className="rounded-md border border-border/50">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow>
                          <TableHead className="w-[120px]">Date</TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead className="text-right">Amount (₹)</TableHead>
                          <TableHead className="text-center">Method</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {periodVouchers.map(v => (
                          <TableRow key={v.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDisplayDate(v.date)}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {v.employeeName}
                              {v.remarks && <p className="text-[10px] text-muted-foreground">{v.remarks}</p>}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {Number(v.amount).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={cn(
                                "text-[10px]",
                                v.paymentMethod === 'Bank'
                                  ? "text-emerald-600 dark:text-emerald-500 border-emerald-500/30"
                                  : "text-amber-600 dark:text-amber-500 border-amber-500/30"
                              )}>
                                {v.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {pendingDeleteId === v.id ? (
                                <div className="flex justify-end items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">Delete?</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 hover:bg-red-500/10"
                                    aria-label={`Confirm delete voucher for ${v.employeeName}`}
                                    disabled={busyVoucherId === v.id}
                                    onClick={() => onDeleteVoucher(v)}
                                  >
                                    <Check className="w-3.5 h-3.5 text-red-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7"
                                    aria-label="Cancel delete"
                                    disabled={busyVoucherId === v.id}
                                    onClick={() => setPendingDeleteId(null)}
                                  >
                                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7"
                                    aria-label={`Print voucher for ${v.employeeName}`}
                                    disabled={busyVoucherId === v.id}
                                    onClick={() => onPrintVoucher(v)}
                                  >
                                    <Printer className="w-3.5 h-3.5 text-blue-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7"
                                    aria-label={`Edit voucher for ${v.employeeName}`}
                                    onClick={() => handleEditVoucher(v)}
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 hover:bg-red-500/10"
                                    aria-label={`Delete voucher for ${v.employeeName}`}
                                    onClick={() => setPendingDeleteId(v.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

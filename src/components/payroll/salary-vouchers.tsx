"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReceiptText, Trash2, Printer, Search, Download } from "lucide-react";
import { useAppContext } from "@/components/providers/app-provider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const YEARS = ["2023", "2024", "2025", "2026", "2027"];

export function SalaryVouchers() {
  const { config, employees, attendance, vouchers, handleCreateVoucher, handleDeleteVoucher } = useAppContext();
  const activeFinancialYear = config?.financialYear || "2026-2027";
  const { toast } = useToast();
  
  const [voucherMonth, setVoucherMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [voucherYear, setVoucherYear] = useState<string>(activeFinancialYear.split('-')[0]);
  const [voucherEmployee, setVoucherEmployee] = useState<string>("");
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [voucherAmount, setVoucherAmount] = useState<string>("");
  const [voucherMethod, setVoucherMethod] = useState<'Bank' | 'Cash'>('Bank');
  const [voucherRemarks, setVoucherRemarks] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const [historyMonth, setHistoryMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [historyYear, setHistoryYear] = useState<string>(activeFinancialYear.split('-')[0]);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const safeVouchers = vouchers || [];
  const periodVouchers = safeVouchers.filter((v: any) => v.month === `${historyMonth} ${historyYear}`);
  const bankTotal = periodVouchers.filter((v: any) => v.paymentMethod === 'Bank').reduce((sum, v) => sum + Number(v.amount), 0);
  const cashTotal = periodVouchers.filter((v: any) => v.paymentMethod === 'Cash').reduce((sum, v) => sum + Number(v.amount), 0);

  // Auto-calculate voucher amount based on selected employee and month
  useEffect(() => {
    if (!voucherEmployee || !voucherMonth || !voucherYear) return;

    const emp = employees.find(e => e.id === voucherEmployee);
    if (!emp) return;

    const monthIndex = MONTHS.indexOf(voucherMonth) + 1;
    const mm = monthIndex.toString().padStart(2, '0');
    const prefix = `${voucherYear}-${mm}`;

    const safeAttendance = attendance || [];
    const records = safeAttendance.filter(a => 
      a.employeeRefId === voucherEmployee && a.date && a.date.startsWith(prefix)
    );

    let totalNet = 0;
    for (const entry of records) {
      const recordRate = entry.rate !== undefined ? entry.rate : emp.rate;
      const shiftHrs = entry.shift === '12-hour' ? 12 : 9;
      const perDaySalary = recordRate * shiftHrs;
      const gross = entry.hours * perDaySalary;
      
      const incentive = entry.incentive || 0;
      const weeklyAdvance = entry.weeklyAdvance || 0;
      const loan = entry.loan || 0;
      
      const rawNet = gross + incentive - weeklyAdvance - loan;
      totalNet += Math.round(rawNet);
    }

    if (totalNet > 0) {
      setVoucherAmount(totalNet.toString());
    } else {
      setVoucherAmount("");
    }
  }, [voucherEmployee, voucherMonth, voucherYear, attendance, employees]);

  const onCreateVoucher = async () => {
    if (!voucherEmployee || !voucherAmount || isNaN(Number(voucherAmount))) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Please select an employee and enter a valid amount." });
      return;
    }

    const targetMonthStr = `${voucherMonth} ${voucherYear}`;
    const alreadyExists = safeVouchers.some((v: any) => v.employeeId === voucherEmployee && v.month === targetMonthStr);
    
    if (alreadyExists) {
      toast({ variant: "destructive", title: "Duplicate Voucher", description: "A voucher has already been generated for this employee for the selected month." });
      return;
    }

    try {
      await handleCreateVoucher({
        employeeId: voucherEmployee,
        employeeName: employees.find(e => e.id === voucherEmployee)?.name || 'Unknown',
        month: `${voucherMonth} ${voucherYear}`,
        date: voucherDate,
        amount: voucherAmount,
        paymentMethod: voucherMethod,
        remarks: voucherRemarks
      });
      
      try {
        const statusKey = `payroll_status_${activeFinancialYear}_${voucherMonth}_${voucherYear}`;
        const existingStatuses = localStorage.getItem(statusKey);
        const statuses = existingStatuses ? JSON.parse(existingStatuses) : {};
        statuses[voucherEmployee] = 'Paid';
        localStorage.setItem(statusKey, JSON.stringify(statuses));
      } catch (err) {
        console.error("Failed to mark employee as Paid", err);
      }
      
      toast({ title: "Success", description: "Voucher generated successfully and marked as Paid." });
      setVoucherEmployee("");
      setVoucherAmount("");
      setVoucherRemarks("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to generate voucher." });
    }
  };

  const onPrintVoucher = (voucher: any) => {
    // In a real app, this would generate a PDF or open a print dialog
    toast({ title: "Print Voucher", description: `Printing voucher for ${voucher.employeeName}...` });
  };

  const handleDownloadPDF = async () => {
    setIsExportingPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      
      if (!periodVouchers || periodVouchers.length === 0) {
        toast({ variant: "destructive", title: "No Data", description: "No vouchers found for the selected period." });
        return;
      }
      
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
      
      // Table Header
      let y = 65;
      pdf.setFillColor(31, 41, 55);
      pdf.rect(15, y, 180, 8, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Date", 18, y + 5.5);
      pdf.text("Employee Name", 45, y + 5.5);
      pdf.text("Method", 130, y + 5.5);
      pdf.text("Amount (Rs)", 185, y + 5.5, { align: "right" });
      
      // Table Rows
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      
      y += 10;
      
      periodVouchers.forEach((v: any, index: number) => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        
        pdf.setFillColor(index % 2 === 0 ? 255 : 249, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 251);
        pdf.rect(15, y - 2, 180, 8, "F");
        
        const dateStr = v.date ? new Date(v.date).toLocaleDateString() : 'N/A';
        pdf.text(dateStr, 18, y + 3);
        pdf.text(v.employeeName.substring(0, 35), 45, y + 3);
        pdf.text(v.paymentMethod, 130, y + 3);
        pdf.text(Number(v.amount).toLocaleString('en-IN'), 185, y + 3, { align: "right" });
        
        y += 8;
      });
      
      pdf.save(`Voucher_Report_${historyMonth}_${historyYear}.pdf`);
      
      toast({ title: "Success", description: "PDF report downloaded successfully." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF." });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-headline flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-primary" />
            Salary Vouchers & Payments
          </h2>
          <p className="text-sm text-muted-foreground">Generate and manage payment vouchers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="col-span-1 lg:col-span-1 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm">Generate Voucher</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Employee</Label>
              <Select value={voucherEmployee} onValueChange={setVoucherEmployee}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b mb-2">
                    <div className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1">
                      <Search className="w-3 h-3 text-muted-foreground" />
                      <input 
                        className="bg-transparent border-none focus:outline-none text-sm w-full"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {employees
                    .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} <span className="text-muted-foreground text-xs">({emp.id})</span>
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">Month</Label>
                <Select value={voucherMonth} onValueChange={setVoucherMonth}>
                  <SelectTrigger className="w-full">
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
                <Label className="text-xs font-bold text-muted-foreground">Year</Label>
                <Select value={voucherYear} onValueChange={setVoucherYear}>
                  <SelectTrigger className="w-full">
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

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Voucher Date</Label>
              <Input 
                type="date"
                value={voucherDate}
                onChange={e => setVoucherDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Amount (₹)</Label>
              <Input 
                type="number" 
                placeholder="Enter amount"
                value={voucherAmount}
                onChange={e => setVoucherAmount(e.target.value)}
              />
              {voucherAmount && (
                <p className="text-[10px] text-emerald-500 font-medium ml-1">Automatically computed from net payout.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Payment Method</Label>
              <Select value={voucherMethod} onValueChange={(v: any) => setVoucherMethod(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank">Bank Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Remarks (Optional)</Label>
              <Input 
                placeholder="E.g. Bonus included" 
                value={voucherRemarks}
                onChange={e => setVoucherRemarks(e.target.value)}
              />
            </div>
            <Button 
              className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
              onClick={onCreateVoucher}
            >
              <ReceiptText className="w-4 h-4 mr-2" />
              Generate Voucher
            </Button>
          </CardContent>
        </Card>

        <div className="col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="col-span-1 flex flex-col gap-6">
            <Card className="bg-emerald-950/20 border-emerald-900/30 flex-1 flex flex-col justify-center min-h-[140px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-500">Bank Paid ({historyMonth} {historyYear})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">₹{bankTotal.toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-950/20 border-amber-900/30 flex-1 flex flex-col justify-center min-h-[140px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-500">Cash Paid ({historyMonth} {historyYear})</CardTitle>
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
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => (
                        <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={historyYear} onValueChange={setHistoryYear}>
                    <SelectTrigger className="w-[90px] h-8 text-xs">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => (
                        <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8">
                    <Printer className="w-3.5 h-3.5 mr-2" />
                    Print
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
                  <div className="rounded-md border border-border/50 max-h-[350px] overflow-auto">
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
                        {periodVouchers.map((v: any) => (
                          <TableRow key={v.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {v.date ? new Date(v.date).toLocaleDateString() : 'N/A'}
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
                                v.paymentMethod === 'Bank' ? "text-emerald-500 border-emerald-500/30" : "text-amber-500 border-amber-500/30"
                              )}>
                                {v.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => onPrintVoucher(v)}>
                                  <Printer className="w-3.5 h-3.5 text-blue-500" />
                                </Button>
                                <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-red-500/10" onClick={() => handleDeleteVoucher(v.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </Button>
                              </div>
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


"use client"

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { FileSpreadsheet, TrendingUp, IndianRupee, PieChart, Printer, Download, Sparkles, Loader2, Gift, User, CalendarDays, FileText, FileDown, Table as TableIcon } from "lucide-react";
import { EMPLOYEES } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

export function PayrollReports() {
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("May");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [selectedEmployeeForSlip, setSelectedEmployeeForSlip] = useState<any>(null);

  const handlePrint = () => {
    window.print();
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
      
      const fileName = `Payroll_Report_${selectedMonth}_2024.xlsx`;
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
        ? `Payslip_${selectedEmployeeForSlip.id}_${selectedMonth}.pdf`
        : `Payroll_Report_${selectedMonth}_2024.pdf`;
        
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

  const generateMonthlyReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const data = EMPLOYEES.map(emp => {
        const daysWorked = Math.floor(Math.random() * 5) + 21; // 21-26 days
        const dailyRate = emp.rate * (emp.shift === '12-hour' ? 12 : 9);
        const gross = dailyRate * daysWorked;
        const incentive = Math.floor(Math.random() * 2000);
        const deductions = Math.floor(Math.random() * 1500);
        return {
          ...emp,
          daysWorked,
          gross,
          incentive,
          deductions,
          net: gross + incentive - deductions
        };
      });
      setReportData(data);
      setIsGenerating(false);
      toast({
        title: "Report Generated",
        description: `Salary summary for ${selectedMonth} 2024 is ready.`,
      });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print bg-card/30 p-4 border border-border rounded-xl">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase text-muted-foreground">Select Reporting Period</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{m} 2024</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            variant="secondary" 
            onClick={generateMonthlyReport}
            disabled={isGenerating}
            className="mt-4"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Report
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
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
                    Period: {selectedMonth} 2024 • Manufacturing Unit #1
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
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row) => (
                      <tr key={row.id} className="border-b border-border/30 hover:bg-accent/5">
                        <td className="p-4 font-mono text-muted-foreground">{row.id}</td>
                        <td className="p-4 font-bold">{row.name}</td>
                        <td className="p-4 text-center font-mono">{row.daysWorked}</td>
                        <td className="p-4 text-right font-mono text-muted-foreground">₹{row.gross.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right font-mono text-green-500">₹{row.incentive.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right font-mono text-destructive">₹{row.deductions.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right font-headline font-black text-accent">₹{row.net.toLocaleString('en-IN')}</td>
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
                <div className="text-xl font-headline font-bold">{selectedMonth} 2024</div>
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
        {reportData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-accent" />
              <h4 className="font-headline font-bold text-lg">Generate Individual Payslips</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reportData.map((emp) => (
                <Button 
                  key={emp.id} 
                  variant="outline" 
                  className={cn(
                    "justify-between h-14 border-border hover:border-accent group",
                    selectedEmployeeForSlip?.id === emp.id && "bg-accent/10 border-accent"
                  )}
                  onClick={() => setSelectedEmployeeForSlip(emp)}
                >
                  <div className="flex flex-col items-start overflow-hidden text-left">
                    <span className="font-bold text-sm truncate w-full">{emp.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{emp.id}</span>
                  </div>
                  <FileText className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                </Button>
              ))}
            </div>
          </div>
        )}

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
                <CardDescription>Compute 8.33% statutory bonus based on 12-month earnings.</CardDescription>
              </div>
              <Button 
                variant="default" 
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => toast({ title: "Calculator Running", description: "Processing historical payroll files..."})}
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

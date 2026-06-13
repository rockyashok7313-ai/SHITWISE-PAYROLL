"use client"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { FileSpreadsheet, TrendingUp, IndianRupee, PieChart, Printer, Download, Sparkles, Loader2, Gift } from "lucide-react";
import { EMPLOYEES } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const data = [
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

export function PayrollReports() {
  const { toast } = useToast();
  const [isCalculating, setIsCalculating] = useState(false);
  const [bonusReport, setBonusReport] = useState<any[] | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const calculateYearlyBonus = () => {
    setIsCalculating(true);
    
    // Simulate complex calculation
    setTimeout(() => {
      const calculatedBonus = EMPLOYEES.map(emp => {
        const dailyRate = emp.rate * (emp.shift === '12-hour' ? 12 : 9);
        const yearlyGross = dailyRate * 26 * 12;
        const bonusAmount = yearlyGross * 0.0833; // Statutory 8.33% Bonus
        
        return {
          id: emp.id,
          name: emp.name,
          yearlyGross,
          bonusAmount
        };
      });
      
      setBonusReport(calculatedBonus);
      setIsCalculating(false);
      toast({
        title: "Yearly Bonus Calculated",
        description: "Statutory 8.33% bonus has been computed for all staff.",
      });
    }, 1500);
  };

  return (
    <div className="space-y-6 printable-area">
      <div className="flex justify-between items-center no-print">
        <h3 className="text-2xl font-headline font-bold text-foreground">Factory Financial Insights</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-border hover:bg-accent/5">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Button variant="default" size="sm" onClick={handlePrint} className="bg-primary hover:bg-primary/90">
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-accent/5 border-accent/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-accent uppercase flex items-center gap-2">
              <IndianRupee className="w-4 h-4" />
              Total Labor Payout (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline font-black">₹4,82,450</div>
            <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1 font-bold uppercase">
              <TrendingUp className="w-3 h-3" /> +12.5% vs Last Month
            </p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-primary uppercase flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              OT Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline font-black">18.4%</div>
            <p className="text-[10px] text-orange-400 mt-1 font-bold uppercase">Above Factory Limit (15%)</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-green-500 uppercase flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Compliance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline font-black">READY</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase">Audit Verified: May 2024</p>
          </CardContent>
        </Card>
      </div>

      {/* Bonus Calculator Tool */}
      <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/20 no-print">
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
            onClick={calculateYearlyBonus}
            disabled={isCalculating}
          >
            {isCalculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Calculate Yearly Bonus
          </Button>
        </CardHeader>
        {bonusReport && (
          <CardContent>
            <div className="rounded-xl border border-border bg-background/50 overflow-hidden">
              <ScrollArea className="h-[250px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/80 sticky top-0">
                    <tr className="text-left">
                      <th className="p-3 text-[10px] uppercase font-bold text-muted-foreground">Staff Name</th>
                      <th className="p-3 text-[10px] uppercase font-bold text-muted-foreground">Yearly Gross</th>
                      <th className="p-3 text-[10px] uppercase font-bold text-muted-foreground text-right">Bonus (8.33%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonusReport.map((item, idx) => (
                      <tr key={idx} className="border-t border-border/30 hover:bg-accent/5">
                        <td className="p-3 font-semibold">{item.name}</td>
                        <td className="p-3 font-mono text-muted-foreground">₹{item.yearlyGross.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-headline font-black text-accent text-right">₹{item.bonusAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              <div className="p-4 bg-accent/10 border-t border-accent/20 flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-accent">Total Bonus Liability</span>
                <span className="text-xl font-headline font-black text-accent">
                  ₹{bonusReport.reduce((acc, curr) => acc + curr.bonusAmount, 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

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
              <BarChart data={data}>
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

      <div className="only-print mt-12 p-8 border-2 border-dashed border-muted-foreground/30 rounded-xl">
        <div className="flex justify-between items-end">
          <div className="space-y-4">
            <div className="text-sm font-bold text-muted-foreground">OFFICIAL PAYROLL SUMMARY</div>
            <div className="text-3xl font-headline font-black">SHIFTWISE PAYROLL SYSTEMS</div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-sm">Authorized Signatory: ___________________</div>
            <div className="text-sm text-muted-foreground italic">Generated on: {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

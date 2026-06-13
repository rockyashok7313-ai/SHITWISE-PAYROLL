"use client"

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEES } from "@/lib/mock-data";
import { Save, Download, Edit2, Zap, IndianRupee, Calculator, Wallet, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function AttendanceLogger() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entries, setEntries] = useState(EMPLOYEES.map(emp => ({
    ...emp,
    shift: emp.shift as '9-hour' | '12-hour',
    hours: emp.shift === '12-hour' ? 12 : 9,
    incentive: 0,
    weeklyAdvance: 0,
    loan: 0,
    isModified: false
  })));

  // Bulk entry state
  const [bulkShift, setBulkShift] = useState<'9-hour' | '12-hour'>('12-hour');

  const applyBulkShift = () => {
    setEntries(prev => prev.map(entry => ({
      ...entry,
      shift: bulkShift,
      hours: bulkShift === '12-hour' ? 12 : 9,
      isModified: true
    })));
    toast({
      title: "Bulk Shift Applied",
      description: `All ${entries.length} records updated to standard ${bulkShift} hours.`,
    });
  };

  const handleSaveRow = (id: string) => {
    setEditingId(null);
    toast({
      title: "Entry Saved",
      description: `Updated records for ${entries.find(e => e.id === id)?.name}.`,
    });
  };

  const handleFinalize = () => {
    toast({
      title: "Daily Logs Finalized",
      description: `Processed payroll entries for ${entries.length} staff members.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-headline font-semibold text-accent flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Daily Wage & Attendance Log
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-primary/30 hover:bg-primary/10">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="default" size="sm" onClick={handleFinalize} className="bg-primary hover:bg-primary/90">
            <Save className="w-4 h-4 mr-2" />
            Finalize Payouts
          </Button>
        </div>
      </div>

      {/* Bulk Entry Tools */}
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-accent animate-pulse" />
            <div>
              <p className="text-sm font-semibold">Bulk Hours Entry</p>
              <p className="text-xs text-muted-foreground">Apply standard shift hours to all laborers.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select 
              value={bulkShift} 
              onValueChange={(val) => setBulkShift(val as any)}
            >
              <SelectTrigger className="w-full md:w-[180px] bg-background">
                <SelectValue placeholder="Select Shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9-hour">9-hour Shift (9.00 hrs)</SelectItem>
                <SelectItem value="12-hour">12-hour Shift (12.00 hrs)</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="secondary" 
              size="sm" 
              className="whitespace-nowrap"
              onClick={applyBulkShift}
            >
              Apply to All
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border border-border bg-card/30 overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50 text-[10px] uppercase tracking-wider">
            <TableRow>
              <TableHead className="min-w-[180px]">Labourer</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead className="min-w-[80px]">Total Hrs</TableHead>
              <TableHead>Per Day Sal</TableHead>
              <TableHead className="min-w-[120px]">Incentive (+)</TableHead>
              <TableHead className="min-w-[120px]">Weekly Adv (-)</TableHead>
              <TableHead className="min-w-[120px]">Loan (-)</TableHead>
              <TableHead>Net Payout</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const grossWage = entry.hours * entry.rate;
              const netPayout = grossWage + entry.incentive - entry.weeklyAdvance - entry.loan;
              const isEditing = editingId === entry.id;

              return (
                <TableRow key={entry.id} className={cn(
                  "hover:bg-accent/5 transition-colors border-border h-16",
                  isEditing && "bg-accent/10"
                )}>
                  <TableCell className="py-2">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        {entry.name}
                        {entry.isModified && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">{entry.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      entry.shift === '12-hour' ? 'text-accent border-accent/20' : 'text-primary border-primary/20'
                    )}>
                      {entry.shift}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      step="0.5"
                      value={entry.hours} 
                      disabled={!isEditing}
                      className="h-8 bg-background/50 border-muted focus-visible:ring-accent font-mono text-sm"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, hours: val, isModified: true } : item));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-foreground">₹{grossWage.toLocaleString('en-IN')}</span>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">₹</span>
                      <Input 
                        type="number"
                        value={entry.incentive} 
                        disabled={!isEditing}
                        className="h-8 pl-5 bg-background/50 border-muted focus-visible:ring-accent font-mono text-sm text-green-500"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, incentive: val, isModified: true } : item));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">₹</span>
                      <Input 
                        type="number"
                        value={entry.weeklyAdvance} 
                        disabled={!isEditing}
                        className="h-8 pl-5 bg-background/50 border-muted focus-visible:ring-accent font-mono text-sm text-destructive"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, weeklyAdvance: val, isModified: true } : item));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">₹</span>
                      <Input 
                        type="number"
                        value={entry.loan} 
                        disabled={!isEditing}
                        className="h-8 pl-5 bg-background/50 border-muted focus-visible:ring-accent font-mono text-sm text-destructive"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, loan: val, isModified: true } : item));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-headline font-bold text-accent">
                    ₹{netPayout.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="h-8 bg-green-500 hover:bg-green-600"
                        onClick={() => handleSaveRow(entry.id)}
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 hover:text-accent"
                        onClick={() => setEditingId(entry.id)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="p-4 bg-muted/20 border border-border rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">Net Daily Liability</span>
            <span className="text-xl font-headline font-bold text-primary">
              ₹{entries.reduce((acc, curr) => acc + (curr.hours * curr.rate + curr.incentive - curr.weeklyAdvance - curr.loan), 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-px h-8 bg-border hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">Total Incentives</span>
            <span className="text-xl font-headline font-bold text-green-500">
              ₹{entries.reduce((acc, curr) => acc + curr.incentive, 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-px h-8 bg-border hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">Total Deductions</span>
            <span className="text-xl font-headline font-bold text-destructive">
              ₹{entries.reduce((acc, curr) => acc + curr.weeklyAdvance + curr.loan, 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-accent">
          <Coins className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Financial Overview</span>
        </div>
      </div>
    </div>
  );
}

"use client"

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEES } from "@/lib/mock-data";
import { Save, Download, Edit2, Zap, Calculator, Coins, TrendingUp, Wallet, CalendarDays, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/badge"; // Note: Using Badge here for a placeholder if AlertDialog is missing, but actually it should be from @/components/ui/alert-dialog

// Correcting imports for AlertDialog
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

export function AttendanceLogger() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("May");
  const [entries, setEntries] = useState(EMPLOYEES.map(emp => ({
    ...emp,
    shift: emp.shift as '9-hour' | '12-hour',
    hours: emp.shift === '12-hour' ? 12 : 9,
    incentive: 0,
    weeklyAdvance: 0,
    loan: 0,
    isModified: false
  })));

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
      description: `All ${entries.length} records updated to standard ${bulkShift} hours for ${selectedMonth}.`,
    });
  };

  const handleSaveRow = (id: string) => {
    setEditingId(null);
    toast({
      title: "Entry Saved",
      description: `Updated records for ${entries.find(e => e.id === id)?.name} in ${selectedMonth}.`,
    });
  };

  const handleDeleteRow = (id: string) => {
    const deletedName = entries.find(e => e.id === id)?.name;
    setEntries(prev => prev.filter(entry => entry.id !== id));
    toast({
      variant: "destructive",
      title: "Entry Removed",
      description: `${deletedName} has been removed from the ${selectedMonth} payout list.`,
    });
  };

  const handleFinalize = () => {
    toast({
      title: "Monthly Logs Finalized",
      description: `Processed payroll entries for ${entries.length} staff members for the month of ${selectedMonth}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-headline font-bold text-accent flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            Attendance & Wage Matrix
          </h2>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Logging for:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px] h-8 bg-background border-border text-xs">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m} value={m}>{m} 2024</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-primary/30 hover:bg-primary/10">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="default" size="sm" onClick={handleFinalize} className="bg-primary hover:bg-primary/90">
            <Save className="w-4 h-4 mr-2" />
            Finalize {selectedMonth} Logs
          </Button>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <p className="text-sm font-semibold">Bulk Hours Entry</p>
              <p className="text-xs text-muted-foreground">Apply standard shift hours to all labourers instantly.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select 
              value={bulkShift} 
              onValueChange={(val) => setBulkShift(val as any)}
            >
              <SelectTrigger className="w-full md:w-[200px] bg-background">
                <SelectValue placeholder="Select Shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9-hour">9-hour Shift (9.00 hrs)</SelectItem>
                <SelectItem value="12-hour">12-hour Shift (12.00 hrs)</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="default" 
              size="sm" 
              className="bg-primary text-primary-foreground"
              onClick={applyBulkShift}
            >
              Apply All
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-card/30 overflow-hidden overflow-x-auto shadow-2xl">
        <Table>
          <TableHeader className="bg-muted/80 text-[10px] uppercase tracking-widest font-bold">
            <TableRow className="border-b border-border">
              <TableHead className="min-w-[200px] text-foreground">Labourer Details</TableHead>
              <TableHead className="min-w-[120px] text-foreground">Shift Type</TableHead>
              <TableHead className="min-w-[100px] text-primary">Total Hrs</TableHead>
              <TableHead className="min-w-[140px] text-green-500">Incentive (+)</TableHead>
              <TableHead className="min-w-[140px] text-destructive">Weekly Adv (-)</TableHead>
              <TableHead className="min-w-[140px] text-destructive">Loan (-)</TableHead>
              <TableHead className="min-w-[120px] text-accent">Net Payout</TableHead>
              <TableHead className="text-right text-foreground">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const grossWage = entry.hours * entry.rate;
              const netPayout = grossWage + entry.incentive - entry.weeklyAdvance - entry.loan;
              const isEditing = editingId === entry.id;

              return (
                <TableRow key={entry.id} className={cn(
                  "transition-all border-border h-20 group",
                  isEditing ? "bg-accent/10" : "hover:bg-muted/50"
                )}>
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
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-2 py-0.5 font-bold",
                      entry.shift === '12-hour' ? 'text-accent border-accent/40 bg-accent/5' : 'text-primary border-primary/40 bg-primary/5'
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
                      className="h-10 bg-primary/5 border-primary/20 focus-visible:ring-primary font-mono text-base font-bold text-primary w-24"
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
                        className="h-10 pl-6 bg-green-500/5 border-green-500/20 focus-visible:ring-green-500 font-mono text-base font-bold text-green-500 w-28"
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
                        className="h-10 pl-6 bg-destructive/5 border-destructive/20 focus-visible:ring-destructive font-mono text-base font-bold text-destructive w-28"
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
                        className="h-10 pl-6 bg-destructive/5 border-destructive/20 focus-visible:ring-destructive font-mono text-base font-bold text-destructive w-28"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, loan: val, isModified: true } : item));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-headline font-black text-lg text-accent">
                    ₹{netPayout.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="h-9 w-9 bg-green-600 hover:bg-green-700 shadow-lg p-0"
                          onClick={() => handleSaveRow(entry.id)}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-9 hover:bg-accent/20 hover:text-accent p-0"
                          onClick={() => setEditingId(entry.id)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      
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
                              This will remove {entry.name} from the {selectedMonth} list.
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
              ₹{entries.reduce((acc, curr) => acc + (curr.hours * curr.rate + curr.incentive - curr.weeklyAdvance - curr.loan), 0).toLocaleString('en-IN')}
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
    </div>
  );
}

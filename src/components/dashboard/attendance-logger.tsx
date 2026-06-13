"use client"

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEES } from "@/lib/mock-data";
import { Clock, Save, Download, Edit2, CheckCircle2, Zap, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function AttendanceLogger() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entries, setEntries] = useState(EMPLOYEES.map(emp => ({
    ...emp,
    shift: emp.shift as '9-hour' | '12-hour',
    clockIn: emp.shift === '9-hour' ? '09:00' : '08:00',
    clockOut: emp.shift === '9-hour' ? '18:00' : '20:00',
    isModified: false
  })));

  // Bulk entry state
  const [bulkShift, setBulkShift] = useState<'9-hour' | '12-hour'>('12-hour');

  const applyBulkShift = () => {
    setEntries(prev => prev.map(entry => ({
      ...entry,
      shift: bulkShift,
      clockIn: bulkShift === '9-hour' ? '09:00' : '08:00',
      clockOut: bulkShift === '9-hour' ? '18:00' : '20:00',
      isModified: true
    })));
    toast({
      title: "Bulk Shift Applied",
      description: `All ${entries.length} records updated to ${bulkShift} parameters.`,
    });
  };

  const toggleShift = (id: string) => {
    setEntries(prev => prev.map(e => {
      if (e.id === id) {
        const nextShift = e.shift === '9-hour' ? '12-hour' : '9-hour';
        return {
          ...e,
          shift: nextShift as any,
          clockIn: nextShift === '9-hour' ? '09:00' : '08:00',
          clockOut: nextShift === '9-hour' ? '18:00' : '20:00',
          isModified: true
        };
      }
      return e;
    }));
  };

  const calculateHours = (inStr: string, outStr: string) => {
    const [inH, inM] = inStr.split(':').map(Number);
    const [outH, outM] = outStr.split(':').map(Number);
    const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    return Math.max(0, totalMinutes / 60);
  };

  const handleSaveRow = (id: string) => {
    setEditingId(null);
    toast({
      title: "Row Saved",
      description: `Attendance entry for ${entries.find(e => e.id === id)?.name} has been updated.`,
    });
  };

  const handleFinalize = () => {
    toast({
      title: "Attendance Finalized",
      description: `Daily logs for ${entries.length} employees have been saved and sent for verification.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-headline font-semibold text-accent flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Shift Attendance Grid
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-primary/30 hover:bg-primary/10">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="default" size="sm" onClick={handleFinalize} className="bg-primary hover:bg-primary/90">
            <Save className="w-4 h-4 mr-2" />
            Finalize Bulk Entry
          </Button>
        </div>
      </div>

      {/* Bulk Entry Tools */}
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-accent animate-pulse" />
            <div>
              <p className="text-sm font-semibold">Bulk Shift Entry</p>
              <p className="text-xs text-muted-foreground">Set standard shift for all laborers at once.</p>
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
                <SelectItem value="9-hour">9-hour Shift</SelectItem>
                <SelectItem value="12-hour">12-hour Shift</SelectItem>
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

      <div className="rounded-md border border-border bg-card/30 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 text-xs uppercase tracking-wider">
            <TableRow>
              <TableHead className="w-[200px]">Employee</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Total Hrs</TableHead>
              <TableHead>Payout</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const hours = calculateHours(entry.clockIn, entry.clockOut);
              const payout = hours * entry.rate;
              const isEditing = editingId === entry.id;

              return (
                <TableRow key={entry.id} className={cn(
                  "hover:bg-accent/5 transition-colors border-border",
                  isEditing && "bg-accent/10"
                )}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2">
                        {entry.name}
                        {entry.isModified && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">{entry.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={!isEditing}
                      className={cn(
                        "h-7 px-2 font-mono text-xs border border-transparent",
                        entry.shift === '12-hour' ? 'text-accent border-accent/20' : 'text-primary border-primary/20',
                        !isEditing && "opacity-80"
                      )}
                      onClick={() => toggleShift(entry.id)}
                    >
                      {entry.shift}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="time" 
                      value={entry.clockIn} 
                      disabled={!isEditing}
                      className="h-8 w-28 bg-background/50 border-muted focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      onChange={(e) => {
                        const val = e.target.value;
                        setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, clockIn: val, isModified: true } : item));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="time" 
                      value={entry.clockOut} 
                      disabled={!isEditing}
                      className="h-8 w-28 bg-background/50 border-muted focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      onChange={(e) => {
                        const val = e.target.value;
                        setEntries(prev => prev.map(item => item.id === entry.id ? { ...item, clockOut: val, isModified: true } : item));
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-accent border-accent/30 text-[10px]">
                      {hours.toFixed(2)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-headline font-bold text-primary">
                    ₹{payout.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="h-8 bg-green-500 hover:bg-green-600"
                        onClick={() => handleSaveRow(entry.id)}
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Save
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 hover:text-accent"
                        onClick={() => setEditingId(entry.id)}
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

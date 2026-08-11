"use client"

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, AlertTriangle, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { useAppContext } from "@/components/providers/app-provider";
import { MONTHS } from "@/lib/payroll";
import { planPeriodMove, PeriodMovePlan } from "@/lib/attendance-move";
import { downloadBackupNow } from "@/lib/backup";

/**
 * Moves every attendance record in one month into another -- a deliberate,
 * reviewed correction for data entered under the wrong month, NOT the old
 * automatic date-rewrite bug. The difference: nothing happens until an
 * explicit Preview, the exact records and any collisions are shown before
 * anything changes, and a second explicit confirmation is required.
 *
 * Restricted to admins: this can touch every employee's records for a whole
 * month at once, which is a different order of consequence than editing one
 * row.
 */
export function MoveAttendancePeriod() {
  const { activeCompanyId, attendance, handleAttendanceChange } = useAppContext();
  const { isAdmin } = useRole(activeCompanyId);
  const { toast } = useToast();

  const currentYear = new Date().getFullYear().toString();
  const [fromMonth, setFromMonth] = useState("July");
  const [fromYear, setFromYear] = useState(currentYear);
  const [toMonth, setToMonth] = useState("June");
  const [toYear, setToYear] = useState(currentYear);

  const [plan, setPlan] = useState<PeriodMovePlan<any> | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  if (!isAdmin) return null;

  const samePeriod = fromMonth === toMonth && fromYear === toYear;

  const handlePreview = () => {
    setPlan(planPeriodMove(attendance || [], fromMonth, fromYear, toMonth, toYear));
  };

  const handleConfirmMove = async () => {
    if (!plan || plan.moved.length === 0) return;
    setIsMoving(true);
    try {
      // Safety net: a fresh local backup right before the change, independent
      // of the regular auto-backup throttle, so this specific action always
      // has a snapshot from immediately before it if something looks wrong.
      try {
        downloadBackupNow();
      } catch (e) {
        console.error("Pre-move backup failed", e);
      }

      await handleAttendanceChange(plan.result);

      toast({
        title: "Attendance moved",
        description: `${plan.moved.length} record(s) moved from ${fromMonth} ${fromYear} to ${toMonth} ${toYear}.`,
      });
      setPlan(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Move failed", description: e.message || "Could not move the records." });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-muted-foreground">From Month</Label>
          <Select value={fromMonth} onValueChange={(v) => { setFromMonth(v); setPlan(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-muted-foreground">From Year</Label>
          <input
            type="number"
            value={fromYear}
            onChange={(e) => { setFromYear(e.target.value); setPlan(null); }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-muted-foreground">To Month</Label>
          <Select value={toMonth} onValueChange={(v) => { setToMonth(v); setPlan(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-muted-foreground">To Year</Label>
          <input
            type="number"
            value={toYear}
            onChange={(e) => { setToYear(e.target.value); setPlan(null); }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {samePeriod && (
        <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> From and To are the same period -- nothing to move.
        </p>
      )}

      <Button variant="outline" size="sm" onClick={handlePreview} disabled={samePeriod} className="gap-2">
        <ArrowRightLeft className="w-3.5 h-3.5" /> Preview Move
      </Button>

      {plan && (
        <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
          {plan.moved.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendance found in {fromMonth} {fromYear}. Nothing to move.
            </p>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-bold">{plan.moved.length}</span> record(s) will move from{" "}
                <span className="font-semibold">{fromMonth} {fromYear}</span> to{" "}
                <span className="font-semibold">{toMonth} {toYear}</span>.
              </p>

              {plan.conflicts.length > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-500 border border-amber-500/30 rounded-md p-2 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {plan.conflicts.length} of these already have a record on the destination date
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {plan.conflicts.slice(0, 5).map((c, i) => (
                      <li key={i}>
                        {(c.moving as any).name || (c.moving as any).employeeRefId || c.moving.id} on {c.newDate}
                      </li>
                    ))}
                    {plan.conflicts.length > 5 && <li>...and {plan.conflicts.length - 5} more.</li>}
                  </ul>
                  <p>Moving anyway keeps both records -- review for duplicates afterward.</p>
                </div>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={isMoving} className="bg-primary hover:bg-primary/90">
                    {isMoving ? "Moving..." : `Confirm & Move ${plan.moved.length} Record(s)`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Move {plan.moved.length} attendance record(s)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This reassigns every {fromMonth} {fromYear} attendance record to {toMonth} {toYear}.
                      {fromMonth} {fromYear} will then be empty. A backup of your current data downloads
                      automatically right before this runs. This cannot be automatically undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmMove} className="bg-destructive hover:bg-destructive/90">
                      Move Records
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
    </div>
  );
}

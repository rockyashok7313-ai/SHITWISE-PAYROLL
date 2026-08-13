"use client"

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HandCoins, Plus, Trash2, Check, X, Search, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/components/providers/app-provider";
import { loanBalances, loanBalanceFor } from "@/lib/loans";
import { cn } from "@/lib/utils";

/** Today as YYYY-MM-DD in LOCAL time (toISOString would give the UTC day,
 *  which is yesterday in IST before 05:30). */
function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Issue loans and watch them come down.
 *
 * There is no "record a repayment" action here on purpose: repayments are the
 * Loan (-) amounts already entered on attendance each month. This screen
 * issues the principal and shows what is still owed; the Attendance screen is
 * where it gets recovered.
 */
export function EmployeeLoans() {
  const { employees, attendance, loans, handleCreateLoan, handleUpdateLoan, handleDeleteLoan } = useAppContext();
  const { toast } = useToast();

  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [issueDate, setIssueDate] = useState(todayLocalISO);
  const [remarks, setRemarks] = useState("");
  const [search, setSearch] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /* Inline edit of an issued loan. Only the principal, its date and the
   * remarks are editable -- NOT which labourer it belongs to. Moving a loan
   * between people would silently move an outstanding balance off one worker
   * and onto another; that is a delete plus a re-issue, and should be visible
   * as two actions rather than one quiet edit. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editRemarks, setEditRemarks] = useState("");

  const beginEdit = (loan: any) => {
    setPendingDeleteId(null);
    setEditingId(loan.id);
    setEditAmount(String(loan.amount ?? ""));
    setEditDate(loan.issueDate || "");
    setEditRemarks(loan.remarks || "");
  };
  const cancelEdit = () => setEditingId(null);

  // Memoised so the `|| []` fallback does not mint a new array each render and
  // invalidate every downstream useMemo.
  const safeEmployees = useMemo(() => employees || [], [employees]);
  const safeLoans = useMemo(() => loans || [], [loans]);
  const safeAttendance = useMemo(() => attendance || [], [attendance]);

  const balances = useMemo(() => loanBalances(safeLoans, safeAttendance), [safeLoans, safeAttendance]);
  const nameOf = (id: string) => safeEmployees.find((e: any) => e.id === id)?.name || id;

  const totals = useMemo(() => {
    let issued = 0, repaid = 0, outstanding = 0;
    balances.forEach(b => { issued += b.issued; repaid += b.repaid; outstanding += b.outstanding; });
    return { issued, repaid, outstanding };
  }, [balances]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...balances.entries()]
      .map(([empId, b]) => ({ empId, name: nameOf(empId), ...b }))
      .filter(r => !q || r.name.toLowerCase().includes(q) || r.empId.toLowerCase().includes(q))
      .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
    // nameOf is derived from safeEmployees, which is in the dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balances, search, safeEmployees]);

  const onIssue = async () => {
    const value = Number(amount);
    if (!employeeId) {
      toast({ variant: "destructive", title: "Select a labourer", description: "Choose who the loan is for." });
      return;
    }
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Enter a loan amount greater than zero." });
      return;
    }

    setIsSaving(true);
    try {
      await handleCreateLoan({ employeeId, amount: value, issueDate, remarks });
      const after = loanBalanceFor(employeeId, [...safeLoans, { id: 'x', employeeId, amount: value }], safeAttendance);
      toast({
        title: "Loan issued",
        description: `₹${value.toLocaleString('en-IN')} to ${nameOf(employeeId)}. Outstanding now ₹${after.outstanding.toLocaleString('en-IN')}.`,
      });
      setEmployeeId(""); setAmount(""); setRemarks("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not issue loan", description: e.message || "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const saveEdit = async (loan: any) => {
    const value = Number(editAmount);
    if (!editAmount.trim() || !Number.isFinite(value) || value <= 0) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Enter a loan amount greater than zero." });
      return;
    }

    /* Recomputed against this labourer's OTHER loans plus the edited figure,
     * so the warning reflects what the balance will actually be. Cutting the
     * principal below what has already been deducted in attendance leaves the
     * worker over-recovered -- money taken from them that is no longer owed.
     * Blocked rather than warned: the balance would go straight to the
     * `overpaid` bucket, and it is nearly always a typo. */
    const others = safeLoans.filter((l: any) => l.id !== loan.id);
    const after = loanBalanceFor(loan.employeeId, [...others, { ...loan, amount: value }], safeAttendance);
    if (after.overpaid > 0) {
      toast({
        variant: "destructive",
        title: "Amount is below what is already recovered",
        description: `${nameOf(loan.employeeId)} has already repaid ₹${after.repaid.toLocaleString('en-IN')}. Setting the loan to ₹${value.toLocaleString('en-IN')} would over-recover them by ₹${after.overpaid.toLocaleString('en-IN')}.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      await handleUpdateLoan(loan.id, {
        amount: value,
        issueDate: editDate,
        remarks: editRemarks,
      });
      toast({
        title: "Loan updated",
        description: `${nameOf(loan.employeeId)} — ₹${value.toLocaleString('en-IN')}. Outstanding now ₹${after.outstanding.toLocaleString('en-IN')}.`,
      });
      setEditingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not update loan", description: e.message || "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-700 dark:text-amber-400">Total Outstanding</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">₹{totals.outstanding.toLocaleString('en-IN')}</div></CardContent>
        </Card>
        <Card className="bg-card/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Issued</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">₹{totals.issued.toLocaleString('en-IN')}</div></CardContent>
        </Card>
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-700 dark:text-emerald-400">Recovered So Far</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold font-mono">₹{totals.repaid.toLocaleString('en-IN')}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Issue */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-accent" /> Issue a Loan
            </CardTitle>
            <CardDescription className="text-xs">
              Recovery happens in Attendance — enter an amount in Loan (-) each month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Labourer</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select labourer" /></SelectTrigger>
                <SelectContent>
                  {safeEmployees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} <span className="text-muted-foreground text-xs">({e.id})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {employeeId && (() => {
              const b = loanBalanceFor(employeeId, safeLoans, safeAttendance);
              if (b.hasNoLoan) return null;
              return (
                <p className={cn("text-[11px] rounded-md px-2 py-1.5 border",
                  b.outstanding > 0
                    ? "text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/5"
                    : "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5")}>
                  {b.outstanding > 0
                    ? <>Already owes <span className="font-bold">₹{b.outstanding.toLocaleString('en-IN')}</span>. A new loan adds to it.</>
                    : <>Previous loan fully recovered.</>}
                </p>
              );
            })()}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Loan Amount (₹)</Label>
              <Input type="number" min="0" placeholder="e.g. 10000" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Issue Date</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">Remarks (optional)</Label>
              <Input placeholder="e.g. Medical advance" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>

            <Button className="w-full" onClick={onIssue} disabled={isSaving}>
              <Plus className="w-4 h-4 mr-2" /> {isSaving ? "Issuing..." : "Issue Loan"}
            </Button>
          </CardContent>
        </Card>

        {/* Balances */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/50">
            <div>
              <CardTitle className="text-sm">Outstanding Loans</CardTitle>
              <CardDescription className="text-xs">Balance falls as Loan (-) is deducted each month.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8 h-9 w-full sm:w-56" placeholder="Search labourer..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <HandCoins className="w-8 h-8 mb-3 opacity-20 mx-auto" />
                <p className="text-sm">No loans issued yet.</p>
              </div>
            ) : (
              <div className="rounded-md border border-border/50">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Labourer</TableHead>
                      <TableHead className="text-right">Issued</TableHead>
                      <TableHead className="text-right">Recovered</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.empId}>
                        <TableCell className="font-medium text-sm">
                          {r.name}
                          <span className="block text-[10px] text-muted-foreground font-mono">{r.empId}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono">₹{r.issued.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-500">
                          ₹{r.repaid.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono font-bold",
                          r.outstanding > 0 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground")}>
                          ₹{r.outstanding.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.outstanding > 0 ? (
                            <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-500 border-amber-500/30">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-500 border-emerald-500/30">Closed</Badge>
                          )}
                          {r.overpaid > 0 && (
                            <span className="block text-[10px] text-destructive mt-1">
                              Over-recovered ₹{r.overpaid.toLocaleString('en-IN')}
                            </span>
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

      {/* Individual loan records, so a wrong entry can be removed */}
      {safeLoans.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Loan Records</CardTitle>
            <CardDescription className="text-xs">
              Each advance issued. Editing the amount or removing a record changes that labourer&apos;s outstanding balance.
              Repayments are not edited here — they are the Loan (-) amounts on attendance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Labourer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeLoans.map((l: any) => {
                    const isEditing = editingId === l.id;
                    return (
                      <TableRow key={l.id} className={cn(isEditing && "bg-accent/5")}>
                        <TableCell className="text-xs text-muted-foreground">
                          {isEditing ? (
                            <Input type="date" className="h-8 w-[140px] text-xs"
                              aria-label="Issue date"
                              value={editDate} onChange={e => setEditDate(e.target.value)} />
                          ) : (l.issueDate || '—')}
                        </TableCell>

                        {/* Not editable -- see the note on editingId above. */}
                        <TableCell className="text-sm font-medium">{nameOf(l.employeeId)}</TableCell>

                        <TableCell className="text-right font-mono">
                          {isEditing ? (
                            <Input type="number" min="0" className="h-8 w-[120px] text-right font-mono"
                              aria-label="Loan amount"
                              value={editAmount} onChange={e => setEditAmount(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(l);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              autoFocus />
                          ) : `₹${Number(l.amount).toLocaleString('en-IN')}`}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {isEditing ? (
                            <Input className="h-8 text-xs" placeholder="Remarks"
                              aria-label="Remarks"
                              value={editRemarks} onChange={e => setEditRemarks(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(l);
                                if (e.key === 'Escape') cancelEdit();
                              }} />
                          ) : (l.remarks || '—')}
                        </TableCell>

                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex justify-end items-center gap-2">
                              <Button size="sm" className="h-7 px-2" disabled={isSaving}
                                onClick={() => saveEdit(l)}>
                                <Check className="w-3.5 h-3.5 mr-1" /> {isSaving ? "Saving..." : "Save"}
                              </Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7" aria-label="Cancel edit"
                                onClick={cancelEdit}>
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : pendingDeleteId === l.id ? (
                            <div className="flex justify-end items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">Remove?</span>
                              <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-red-500/10"
                                aria-label="Confirm remove loan"
                                onClick={async () => { await handleDeleteLoan(l.id); setPendingDeleteId(null); }}>
                                <Check className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7" aria-label="Cancel"
                                onClick={() => setPendingDeleteId(null)}>
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end items-center gap-1">
                              <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-accent/10"
                                aria-label={`Edit loan for ${nameOf(l.employeeId)}`}
                                onClick={() => beginEdit(l)}>
                                <Pencil className="w-3.5 h-3.5 text-accent" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-red-500/10"
                                aria-label={`Remove loan for ${nameOf(l.employeeId)}`}
                                onClick={() => { setEditingId(null); setPendingDeleteId(l.id); }}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

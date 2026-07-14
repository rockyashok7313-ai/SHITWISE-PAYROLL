"use client"

import { useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  ShieldCheck, 
  FileSpreadsheet, 
  Settings,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export type TabValue = "dashboard" | "attendance" | "employees" | "audit" | "reports" | "settings";

const NAV_ITEMS: { label: string; icon: any; value: TabValue }[] = [
  { label: "Dashboard", icon: LayoutDashboard, value: "dashboard" },
  { label: "Attendance Grid", icon: Clock, value: "attendance" },
  { label: "Employee Profiles", icon: Users, value: "employees" },
  { label: "Audit Assistant", icon: ShieldCheck, value: "audit" },
  { label: "Payroll Reports", icon: FileSpreadsheet, value: "reports" },
];

interface SidebarNavProps {
  activeTab: TabValue;
  onTabChange: (value: TabValue) => void;
  companies: any[];
  activeCompanyId: string;
  onSwitchCompany: (id: string) => void;
  onCreateCompany: (details: { name: string; unit: string; financialYear: string }) => void;
}

export function SidebarNav({ 
  activeTab, 
  onTabChange, 
  companies, 
  activeCompanyId, 
  onSwitchCompany, 
  onCreateCompany 
}: SidebarNavProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyUnit, setNewCompanyUnit] = useState("");
  const [newCompanyFY, setNewCompanyFY] = useState("2026-27");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newCompanyUnit) return;
    onCreateCompany({
      name: newCompanyName,
      unit: newCompanyUnit,
      financialYear: newCompanyFY,
    });
    setNewCompanyName("");
    setNewCompanyUnit("");
    setNewCompanyFY("2026-27");
    setIsDialogOpen(false);
  };

  return (
    <div className="w-64 border-r border-border bg-sidebar h-screen flex flex-col sticky top-0">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-[0_0_15px_rgba(96,130,242,0.4)]">
            SW
          </div>
          <h1 className="font-headline font-bold text-lg tracking-tight">ShiftWise</h1>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Active Company</label>
          <Select 
            value={activeCompanyId} 
            onValueChange={(val) => {
              if (val === "create_new") {
                setIsDialogOpen(true);
              } else {
                onSwitchCompany(val);
              }
            }}
          >
            <SelectTrigger className="w-full bg-background/50 border-border text-xs font-semibold text-foreground h-9">
              <SelectValue placeholder="Select Company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.name} ({c.unit})
                </SelectItem>
              ))}
              <SelectItem value="create_new" className="text-xs text-primary font-bold border-t border-border mt-1">
                + Create New Company
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.value}
            variant="ghost"
            onClick={() => onTabChange(item.value)}
            className={cn(
              "w-full justify-start gap-3 h-11 transition-all",
              activeTab === item.value 
                ? "bg-primary/10 text-primary border-r-2 border-primary rounded-r-none" 
                : "text-muted-foreground hover:bg-accent/5 hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            <span className="font-medium text-sm">{item.label}</span>
          </Button>
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <Button 
          variant="ghost" 
          onClick={() => onTabChange("settings")}
          className={cn(
            "w-full justify-start gap-3 h-11 transition-all",
            activeTab === "settings" 
              ? "bg-primary/10 text-primary border-r-2 border-primary rounded-r-none" 
              : "text-muted-foreground hover:bg-accent/5 hover:text-foreground"
          )}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">Settings</span>
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-headline text-xl">Create New Company</DialogTitle>
              <DialogDescription>
                Register another company or factory branch unit to scope employees and attendance.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="comp-name" className="text-right text-xs font-bold">
                  Name
                </Label>
                <Input
                  id="comp-name"
                  placeholder="e.g. Apex Textiles"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="col-span-3 bg-background border-muted"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="comp-unit" className="text-right text-xs font-bold">
                  Unit/Branch
                </Label>
                <Input
                  id="comp-unit"
                  placeholder="e.g. Unit #2 - Looming"
                  value={newCompanyUnit}
                  onChange={(e) => setNewCompanyUnit(e.target.value)}
                  className="col-span-3 bg-background border-muted"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="comp-fy" className="text-right text-xs font-bold">
                  FY Selection
                </Label>
                <Select value={newCompanyFY} onValueChange={setNewCompanyFY}>
                  <SelectTrigger id="comp-fy" className="col-span-3 bg-background border-muted">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2023-24">FY 2023-24 (Apr-Mar)</SelectItem>
                    <SelectItem value="2024-25">FY 2024-25 (Apr-Mar)</SelectItem>
                    <SelectItem value="2025-26">FY 2025-26 (Apr-Mar)</SelectItem>
                    <SelectItem value="2026-27">FY 2026-27 (Apr-Mar)</SelectItem>
                    <SelectItem value="2027-28">FY 2027-28 (Apr-Mar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-border">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                Create & Switch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

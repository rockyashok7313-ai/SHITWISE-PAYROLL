"use client"

import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  ShieldCheck, 
  FileSpreadsheet, 
  Settings,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Attendance Grid", icon: Clock, active: false },
  { label: "Employee Profiles", icon: Users, active: false },
  { label: "Audit Assistant", icon: ShieldCheck, active: false },
  { label: "Payroll Reports", icon: FileSpreadsheet, active: false },
];

export function SidebarNav() {
  return (
    <div className="w-64 border-r border-border bg-sidebar h-screen flex flex-col sticky top-0">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-[0_0_15px_rgba(96,130,242,0.4)]">
            SW
          </div>
          <h1 className="font-headline font-bold text-lg tracking-tight">ShiftWise</h1>
        </div>
      </div>
      
      <div className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item, i) => (
          <Button
            key={i}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-11 transition-all",
              item.active 
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
        <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-muted-foreground">
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">Settings</span>
        </Button>
      </div>
    </div>
  );
}

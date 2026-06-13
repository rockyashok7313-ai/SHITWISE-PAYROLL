"use client"

import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  ShieldCheck, 
  FileSpreadsheet, 
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
}

export function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
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
    </div>
  );
}

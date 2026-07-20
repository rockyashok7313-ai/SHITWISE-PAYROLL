"use client"

import React from "react";
import { AppProvider } from "@/components/providers/app-provider";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Clock, ShieldCheck, History as HistoryIcon, Users, FileSpreadsheet, LayoutDashboard, Settings, ReceiptText } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const items = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Attendance",
    href: "/attendance",
    icon: Clock,
  },
  {
    title: "Employees",
    href: "/employees",
    icon: Users,
  },
  {
    title: "Vouchers",
    href: "/vouchers",
    icon: ReceiptText,
  },
  {
    title: "AI Audit",
    href: "/audit",
    icon: ShieldCheck,
  },
  {
    title: "Activity",
    href: "/activity",
    icon: HistoryIcon,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileSpreadsheet,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  }
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppProvider>
      <div className="min-h-screen bg-background flex text-foreground font-body">
        {/* Control Rail */}
        <div className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border relative z-10 flex flex-col">
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-lg border border-primary/20 shadow-[0_0_15px_rgba(96,130,242,0.2)]">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-headline font-bold text-xl tracking-tight leading-none text-white">
                  ShiftWise
                </h1>
                <p className="text-xs text-muted-foreground mt-1 tracking-wider uppercase font-semibold">
                  Factory Payroll
                </p>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-md transition-all font-medium text-sm",
                  pathname.startsWith(item.href) 
                    ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary))]" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.title}
              </Link>
            ))}
          </nav>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-hidden bg-background">
          {children}
        </main>
      </div>
    </AppProvider>
  );
}

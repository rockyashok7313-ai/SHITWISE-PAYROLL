"use client"

import React from "react";
import { AppProvider } from "@/components/providers/app-provider";
import { Clock, ShieldCheck, History as HistoryIcon, Users, FileSpreadsheet, LayoutDashboard, Settings, ReceiptText, LogOut, HandCoins } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SaveIndicator } from "@/components/ui/save-indicator";
import { CompanySwitcher } from "@/components/layout/company-switcher";
import { supabase } from "@/lib/supabase";

/* NOTE: this file used to import SidebarNav from @/components/layout/sidebar-nav
 * but never rendered it -- this hand-built rail is the actual navigation shell.
 * That meant the Log Out button and theme toggle that lived inside SidebarNav
 * were dead code: present in the source, never on screen. sidebar-nav.tsx is
 * left as-is (SidebarNav is unused but harmless) rather than deleted here, since
 * that is a separate cleanup decision. */

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
    title: "Loans",
    href: "/loans",
    icon: HandCoins,
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
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch {
      setSigningOut(false);
    }
  };

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

            {/* Which company's data you are looking at. Previously unreachable
                from the UI, which is how the app ended up sitting on an empty
                company while the real data lived in another one. */}
            <div className="mt-4">
              <CompanySwitcher />
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

          <div className="p-4 border-t border-sidebar-border space-y-1">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-medium text-sidebar-foreground">Theme</span>
              <ThemeToggle />
            </div>
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={signingOut}
              className="w-full justify-start gap-3 h-11 px-3 text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">{signingOut ? "Signing out..." : "Log Out"}</span>
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-hidden bg-background">
          {children}
        </main>

        {/* Global save feedback for every mutation in the app. */}
        <SaveIndicator />
      </div>
    </AppProvider>
  );
}

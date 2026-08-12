"use client"

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useAppContext } from "@/components/providers/app-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Switches the active company.
 *
 * This existed inside SidebarNav, but SidebarNav was imported and never
 * rendered -- the real sidebar is the rail in app/(app)/layout.tsx. So there
 * was no way to change company from the UI at all, which is how a database
 * ended up with eight companies while the app sat on an empty one and the
 * staff list looked empty.
 *
 * Shows the id alongside the name on purpose: companies here are frequently
 * all called the same thing (every one of the eight was "ShiftWise Systems
 * Ltd"), so the name alone cannot tell them apart and a switcher listing
 * eight identical rows would be useless.
 */
export function CompanySwitcher() {
  const { companies, activeCompanyId, setActiveCompanyId, loading } = useAppContext();

  const list = companies || [];
  const active = list.find((c: any) => c.id === activeCompanyId);

  // Nothing to switch between: show the current company as plain text rather
  // than a dropdown that does nothing when opened.
  if (list.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/40 border border-sidebar-border">
        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-sidebar-foreground truncate">
          {active?.name || (loading ? "Loading..." : "No company")}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent/40 border border-sidebar-border hover:bg-sidebar-accent transition-colors text-left"
          aria-label="Switch company"
        >
          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-medium text-sidebar-foreground truncate">
              {active?.name || "Select company"}
            </span>
            {active?.id && (
              <span className="block text-[10px] text-muted-foreground truncate font-mono">
                {active.id}
              </span>
            )}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Switch company ({list.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.map((c: any) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => { if (c.id !== activeCompanyId) setActiveCompanyId(c.id); }}
            className="cursor-pointer gap-2"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-sm truncate">{c.name}</span>
              {/* The disambiguator when names collide. */}
              <span className="block text-[10px] text-muted-foreground font-mono truncate">{c.id}</span>
            </span>
            {c.id === activeCompanyId && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

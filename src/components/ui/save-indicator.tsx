"use client"

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2, Check, CloudOff } from "lucide-react";
import { useAppContext } from "@/components/providers/app-provider";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/components/ui/motion";

/**
 * Floating save indicator, driven by AppProvider's saveStatus so every
 * mutation in the app -- attendance, employees, vouchers, settings -- reports
 * through the same UI instead of each screen doing its own thing.
 *
 * Deliberately not a toast: saves happen often here (the attendance grid
 * saves on nearly every keystroke via its save effect), and a toast queue
 * would become noise. This is a single pill that updates in place and
 * disappears on its own.
 *
 * The 'error' state says "saved on this device" rather than something like
 * "save failed", because that is what actually happened: the local write
 * always succeeds and only the cloud sync failed, so no work has been lost.
 */
export function SaveIndicator() {
  const { saveStatus, saveError } = useAppContext();
  const reduce = useReducedMotion();

  const visible = saveStatus !== 'idle';

  const content = {
    saving: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      label: "Saving...",
      className: "bg-card/95 text-muted-foreground border-border",
    },
    saved: {
      icon: <Check className="w-3.5 h-3.5" />,
      label: "Saved",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    error: {
      icon: <CloudOff className="w-3.5 h-3.5" />,
      label: "Saved on this device — cloud sync failed",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    },
    idle: null,
  }[saveStatus];

  return (
    <div
      className="fixed bottom-5 right-5 z-[60] pointer-events-none"
      // Announced politely so a screen reader hears the outcome without
      // interrupting whatever the user is typing.
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {visible && content && (
          <motion.div
            key={saveStatus}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: reduce ? 0.15 : 0.25, ease: EASE_OUT }}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-md",
              content.className
            )}
          >
            {content.icon}
            <span className="flex flex-col leading-tight">
              <span>{content.label}</span>
              {/* The actual reason, when there is one -- otherwise a failure is
                  a mystery that needs the browser console to diagnose. */}
              {saveStatus === 'error' && saveError && (
                <span className="opacity-80 font-normal max-w-[22rem] truncate" title={saveError}>
                  {saveError}
                </span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

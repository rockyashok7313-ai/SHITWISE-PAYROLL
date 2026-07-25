"use client"

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { EASE_OUT } from "@/components/ui/motion";

/**
 * Route-change transition. Rendered from template.tsx (inside AnimatePresence),
 * keyed on the pathname so navigations cross-fade.
 *
 * Honours prefers-reduced-motion: reduced -> a short opacity cross-fade only;
 * otherwise a gentle rise-in / lift-out. The old version always scaled from
 * 0.98 and ignored the reduced-motion setting.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: reduce ? 0.15 : 0.35, ease: EASE_OUT }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

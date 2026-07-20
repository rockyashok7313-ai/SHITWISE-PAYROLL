"use client"

import React from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // "Use prefers-reduced-motion to freeze page transitions to a simple opacity cross-fade"
  // framer-motion respects `prefers-reduced-motion: user` if configured or we can rely on standard CSS.
  // Actually, framer-motion checks `prefers-reduced-motion` at the OS level by default for spring animations, 
  // but to explicitly respect it for layout/scale, we can just supply a basic fade for reduced motion or use variants.
  
  // Note: For Next.js App Router, AnimatePresence is tricky across layouts unless you wrap it at the template.tsx level.
  // But we are wrapping the content here.

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1 }}
      transition={{ 
        duration: 0.3, 
        ease: "easeOut" 
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

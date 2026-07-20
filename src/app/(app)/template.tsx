"use client"

import React from "react";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/ui/page-transition";
import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  // AnimatePresence in App Router needs to be in template.tsx so that it triggers on route change properly
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={pathname}>
        {children}
      </PageTransition>
    </AnimatePresence>
  );
}

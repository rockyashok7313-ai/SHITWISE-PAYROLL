"use client"

import React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Shared motion primitives.
 *
 * Every one honours prefers-reduced-motion: when the OS asks for reduced
 * motion, movement (y-offset, scale) is dropped and only a short opacity fade
 * remains. framer-motion's useReducedMotion reads the media query for us.
 *
 * Kept small and declarative so screens opt in with <FadeIn>/<Stagger> instead
 * of hand-writing variants each time.
 */

// Modern ease-out (expo-ish): quick start, soft settle.
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const DURATION = 0.45;

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds to delay the entrance. Ignored under reduced motion. */
  delay?: number;
  /** Rise distance in px. Ignored under reduced motion. */
  y?: number;
}

/** Fade in with a subtle upward rise. */
export function FadeIn({ children, className, delay = 0, y = 12 }: FadeInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.2 : DURATION, ease: EASE_OUT, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  /** Gap between each child's entrance, in seconds. */
  stagger?: number;
  /** Delay before the first child, in seconds. */
  delayChildren?: number;
}

/**
 * Container that reveals its <StaggerItem> children one after another.
 * Under reduced motion the children still appear, just without the cascade.
 */
export function Stagger({ children, className, stagger = 0.06, delayChildren = 0.03 }: StaggerProps) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : stagger,
        delayChildren: reduce ? 0 : delayChildren,
      },
    },
  };
  return (
    <motion.div className={className} variants={variants} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  y?: number;
}

/** A child of <Stagger>. Rises and fades in on its turn. */
export function StaggerItem({ children, className, y = 12 }: StaggerItemProps) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0.2 : DURATION, ease: EASE_OUT },
    },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

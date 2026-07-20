"use client"

import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TiltCard({ children, className, ...props }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  // Fallback to static if reduced motion is preferred
  const prefersReducedMotion = useReducedMotion();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    
    // Calculate distance from center (range -1 to 1)
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    // Apply max tilt of ~5 degrees
    const multiplier = 10;
    setRotateX(y * -multiplier);
    setRotateY(x * multiplier);
  };

  const handleMouseLeave = () => {
    if (prefersReducedMotion) return;
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      ref={ref}
      style={{
        perspective: 1000,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: prefersReducedMotion ? 0 : rotateX,
        rotateY: prefersReducedMotion ? 0 : rotateY,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.5,
      }}
      className={className}
      {...props as any}
    >
      <div 
        style={{ transform: "translateZ(30px)" }} 
        className="w-full h-full relative"
      >
        {children}
      </div>
    </motion.div>
  );
}

"use client"

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Box } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";

function ConveyorBlocks() {
  const groupRef = useRef<THREE.Group>(null);
  const prefersReducedMotion = useReducedMotion();

  useFrame((state, delta) => {
    if (prefersReducedMotion) return;
    if (groupRef.current) {
      // Move blocks slowly across the screen
      groupRef.current.position.x -= delta * 0.5;
      if (groupRef.current.position.x < -10) {
        groupRef.current.position.x = 10;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, -2, -5]}>
      {Array.from({ length: 20 }).map((_, i) => (
        <Float key={i} speed={prefersReducedMotion ? 0 : 1} rotationIntensity={0.1} floatIntensity={0.2}>
          <Box 
            args={[1, 0.5, 1]} 
            position={[i * 1.5 - 15, Math.sin(i) * 0.5, (i % 3) * 1.5 - 2]}
            rotation={[0, Math.PI / 4, 0]}
          >
            <meshStandardMaterial 
              color="#0F1115" 
              metalness={0.8} 
              roughness={0.2}
              emissive="#6082F2"
              emissiveIntensity={0.1}
            />
            {/* Emissive Edges */}
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(1, 0.5, 1)]} />
              <lineBasicMaterial color="#6082F2" opacity={0.5} transparent />
            </lineSegments>
          </Box>
        </Float>
      ))}
    </group>
  );
}

function CameraRig({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const prefersReducedMotion = useReducedMotion();

  useFrame((state) => {
    if (prefersReducedMotion) return;
    if (groupRef.current) {
      // Subtle parallax based on mouse
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        (state.pointer.x * Math.PI) / 20,
        0.05
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        (state.pointer.y * Math.PI) / 20,
        0.05
      );
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

export function LoginBackground() {
  return (
    <div className="absolute inset-0 z-0 bg-background overflow-hidden pointer-events-none">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#0F1115"]} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 10, 5]} intensity={1} color="#6082F2" />
        <CameraRig>
          <ConveyorBlocks />
        </CameraRig>
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

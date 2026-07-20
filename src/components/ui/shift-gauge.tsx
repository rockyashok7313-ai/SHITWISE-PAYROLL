"use client"

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, MeshTransmissionMaterial, Float, Html } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";

function GaugeModel({ value = 0.75 }: { value?: number }) {
  const needleRef = useRef<THREE.Mesh>(null);
  const prefersReducedMotion = useReducedMotion();

  useFrame((state, delta) => {
    if (prefersReducedMotion) return;
    if (needleRef.current) {
      // Animate needle towards target value
      // Map value (0 to 1) to angle (-Math.PI/2 to Math.PI/2)
      const targetAngle = (value - 0.5) * -Math.PI;
      needleRef.current.rotation.z = THREE.MathUtils.damp(
        needleRef.current.rotation.z,
        targetAngle,
        2,
        delta
      );
    }
  });

  return (
    <group>
      {/* Outer Bezel (Metal) */}
      <mesh position={[0, 0, -0.1]}>
        <cylinderGeometry args={[2.2, 2.2, 0.2, 64]} />
        <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.11]}>
          <ringGeometry args={[2.0, 2.2, 64]} />
          <meshStandardMaterial color="#C7CDD9" metalness={0.8} roughness={0.2} />
        </mesh>
      </mesh>

      {/* Glass Face */}
      <mesh position={[0, 0, 0.1]}>
        <cylinderGeometry args={[2.0, 2.0, 0.05, 64]} />
        <MeshTransmissionMaterial 
          backside 
          thickness={0.1}
          roughness={0.1}
          transmission={0.9}
          ior={1.5}
          color="#ffffff"
        />
      </mesh>

      {/* Dial Background */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.05]}>
        <circleGeometry args={[2.0, 64]} />
        <meshStandardMaterial color="#0F1115" roughness={0.9} />
      </mesh>

      {/* Ticks */}
      {Array.from({ length: 11 }).map((_, i) => {
        const angle = (i / 10 - 0.5) * Math.PI;
        return (
          <group key={i} rotation={[0, 0, -angle]}>
            <mesh position={[0, 1.7, -0.04]}>
              <boxGeometry args={[0.05, 0.2, 0.01]} />
              <meshBasicMaterial color={i < 5 ? "#2DD4BF" : i < 8 ? "#6082F2" : "#F2A65A"} />
            </mesh>
          </group>
        );
      })}

      {/* Needle */}
      <group position={[0, 0, 0]} ref={needleRef}>
        <mesh position={[0, 0.8, -0.02]}>
          <boxGeometry args={[0.1, 1.8, 0.02]} />
          <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 32]} />
          <meshStandardMaterial color="#C7CDD9" metalness={1} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

export function LiveShiftGauge({ value = 0.8 }: { value?: number }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="w-full h-full min-h-[300px] relative">
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.2} />
        
        <Float 
          speed={prefersReducedMotion ? 0 : 2} 
          rotationIntensity={prefersReducedMotion ? 0 : 0.2} 
          floatIntensity={prefersReducedMotion ? 0 : 0.5}
        >
          <GaugeModel value={value} />
        </Float>
        
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

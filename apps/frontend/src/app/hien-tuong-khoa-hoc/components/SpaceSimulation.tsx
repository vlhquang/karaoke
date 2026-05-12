"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Sphere, Text } from "@react-three/drei";
import * as THREE from "three";
import type { SimulationState } from "../page";

// Load textures from reliable external sources (three.js examples)
const EARTH_TEX = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg";
const MOON_TEX = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg";

const ORBIT_RADIUS = 15;
const EARTH_RADIUS = 2;
const MOON_RADIUS = 0.5;
const MOON_ORBIT_RADIUS = 4;
const TILT_ANGLE = (23.5 * Math.PI) / 180;

interface SpaceSimulationProps {
  simState: SimulationState;
}

function SolarSystem({ simState }: SpaceSimulationProps) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const earthMeshRef = useRef<THREE.Mesh>(null);
  const moonGroupRef = useRef<THREE.Group>(null);
  const waterMeshRef = useRef<THREE.Mesh>(null);

  // Load textures
  const [earthMap, moonMap] = useLoader(THREE.TextureLoader, [EARTH_TEX, MOON_TEX]);

  // Orbit path points for Seasons module
  const orbitPoints = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS));
    }
    return points;
  }, []);

  // Animation variables
  const orbitAngle = useRef(0);
  const moonOrbitAngle = useRef(0);

  useFrame((state, delta) => {
    // 1. Day and Night: Earth rotates on its own axis
    if (simState.dayNight && earthMeshRef.current) {
      earthMeshRef.current.rotation.y += delta * 0.5;
    }

    // 2. Seasons: Earth orbits the Sun
    if (earthGroupRef.current) {
      if (simState.seasons) {
        orbitAngle.current += delta * 0.2;
      }
      earthGroupRef.current.position.x = Math.cos(orbitAngle.current) * ORBIT_RADIUS;
      earthGroupRef.current.position.z = Math.sin(orbitAngle.current) * ORBIT_RADIUS;
      
      // Tilt axis
      if (simState.seasons || simState.polar) {
        // Apply tilt. We tilt the earth mesh group
        earthGroupRef.current.rotation.z = TILT_ANGLE;
      } else {
        earthGroupRef.current.rotation.z = 0;
      }
    }

    // 4. Tides: Moon orbits Earth
    if (simState.tides && moonGroupRef.current) {
      moonOrbitAngle.current += delta * 0.8;
      moonGroupRef.current.position.x = Math.cos(moonOrbitAngle.current) * MOON_ORBIT_RADIUS;
      moonGroupRef.current.position.z = Math.sin(moonOrbitAngle.current) * MOON_ORBIT_RADIUS;

      // Water layer bulges towards the moon
      if (waterMeshRef.current) {
        // The bulge needs to align with the moon's direction
        // Reset scale first
        waterMeshRef.current.scale.set(1, 1, 1);
        // We scale along the X axis (since moon is moving in X-Z relative to earth)
        // Rotate the water mesh to face the moon
        waterMeshRef.current.rotation.y = -moonOrbitAngle.current;
        // Stretch along local X axis
        waterMeshRef.current.scale.set(1.15, 1.02, 1.02);
      }
    }
  });

  return (
    <>
      {/* The Sun */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[3, 32, 32]} />
        <meshBasicMaterial color="#ffdd44" />
        <PointLight color="#ffffff" intensity={200} distance={100} decay={2} />
      </mesh>
      <Text position={[0, 4, 0]} fontSize={1} color="#ffaa00" anchorX="center" anchorY="middle">
        Mặt Trời
      </Text>

      {/* Earth Orbit Path (Seasons) */}
      {simState.seasons && (
        <Line points={orbitPoints} color="rgba(255, 255, 255, 0.2)" lineWidth={1} />
      )}

      {/* Earth System */}
      <group ref={earthGroupRef} position={[ORBIT_RADIUS, 0, 0]}>
        
        {/* Earth Mesh */}
        <mesh ref={earthMeshRef} castShadow receiveShadow>
          <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
          <meshStandardMaterial map={earthMap} roughness={0.6} metalness={0.1} />
          
          {/* Home Marker (Vietnam approx: Lat 14°N, Lng 108°E) */}
          {simState.dayNight && (
            <group rotation={[0, (108 * Math.PI) / 180, 0]}>
              <group rotation={[(90 - 14) * Math.PI / 180, 0, 0]}>
                <mesh position={[0, EARTH_RADIUS + 0.1, 0]}>
                  <coneGeometry args={[0.1, 0.3, 16]} />
                  <meshBasicMaterial color="#ff0000" />
                </mesh>
                <Text position={[0, EARTH_RADIUS + 0.5, 0]} fontSize={0.4} color="#ff0000" rotation={[-Math.PI/2, 0, 0]}>
                  Nhà của bé
                </Text>
              </group>
            </group>
          )}

          {/* Polar Regions Highlight */}
          {simState.polar && (
            <>
              {/* Arctic Circle (~66.5° N) */}
              <group rotation={[(90 - 66.5) * Math.PI / 180, 0, 0]}>
                <mesh position={[0, EARTH_RADIUS * Math.sin((66.5 * Math.PI) / 180), 0]} rotation={[Math.PI/2, 0, 0]}>
                  <ringGeometry args={[EARTH_RADIUS * Math.cos((66.5 * Math.PI) / 180) + 0.01, EARTH_RADIUS * Math.cos((66.5 * Math.PI) / 180) + 0.05, 64]} />
                  <meshBasicMaterial color="#00ffff" side={THREE.DoubleSide} transparent opacity={0.8} />
                </mesh>
                <Text position={[0, EARTH_RADIUS + 0.6, 0]} fontSize={0.3} color="#00ffff" rotation={[-Math.PI/2, 0, 0]}>
                  Bắc Cực
                </Text>
              </group>
              {/* Antarctic Circle (~66.5° S) */}
              <group rotation={[(90 + 66.5) * Math.PI / 180, 0, 0]}>
                <mesh position={[0, -EARTH_RADIUS * Math.sin((66.5 * Math.PI) / 180), 0]} rotation={[Math.PI/2, 0, 0]}>
                  <ringGeometry args={[EARTH_RADIUS * Math.cos((66.5 * Math.PI) / 180) + 0.01, EARTH_RADIUS * Math.cos((66.5 * Math.PI) / 180) + 0.05, 64]} />
                  <meshBasicMaterial color="#00ffff" side={THREE.DoubleSide} transparent opacity={0.8} />
                </mesh>
              </group>
            </>
          )}
        </mesh>

        {/* Tides: Water layer */}
        {simState.tides && (
          <mesh ref={waterMeshRef}>
            <sphereGeometry args={[EARTH_RADIUS + 0.1, 32, 32]} />
            <meshStandardMaterial color="#4488ff" transparent opacity={0.4} roughness={0.1} metalness={0.8} />
          </mesh>
        )}

        {/* Tides: Moon */}
        {simState.tides && (
          <group ref={moonGroupRef} position={[MOON_ORBIT_RADIUS, 0, 0]}>
            <mesh castShadow receiveShadow>
              <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
              <meshStandardMaterial map={moonMap} roughness={0.9} metalness={0.1} />
            </mesh>
            <Text position={[0, 1, 0]} fontSize={0.5} color="#cccccc" anchorX="center" anchorY="middle">
              Mặt Trăng
            </Text>
          </group>
        )}

      </group>
    </>
  );
}

// Extract PointLight to a component to satisfy react-three-fiber
function PointLight({ color, intensity, distance, decay }: any) {
  return <pointLight color={color} intensity={intensity} distance={distance} decay={decay} castShadow shadow-mapSize={[2048, 2048]} />;
}

export default function SpaceSimulation({ simState }: SpaceSimulationProps) {
  return (
    <Canvas shadows camera={{ position: [0, 15, 25], fov: 45 }}>
      <color attach="background" args={["#050510"]} />
      
      {/* Ambient light so we can see the dark side slightly */}
      <ambientLight intensity={0.05} />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <SolarSystem simState={simState} />
      
      <OrbitControls 
        enablePan={true} 
        enableZoom={true} 
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
      />
    </Canvas>
  );
}

"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Sphere, Text, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { SimulationState } from "../page";

// Load textures from reliable external sources (three.js examples)
const EARTH_TEX = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg";
const MOON_TEX = "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg";

const EARTH_RADIUS = 2;
const MOON_RADIUS = 0.5;
const MOON_ORBIT_RADIUS = 4;
const TILT_ANGLE = (23.5 * Math.PI) / 180;

// Elliptical orbit parameters
const ORBIT_A = 22; // Semi-major axis
const ORBIT_B = 16; // Semi-minor axis
// Focus distance c = sqrt(a^2 - b^2)
const ORBIT_C = Math.sqrt(ORBIT_A * ORBIT_A - ORBIT_B * ORBIT_B); // approx 15.1
// We place the Sun at (0,0,0) which is one focus.
// The center of the ellipse will be at (ORBIT_C, 0, 0).

interface SpaceSimulationProps {
  simState: SimulationState;
  viewMode: 'space' | 'surface';
  dayOfYear: number;
}

function SolarSystem({ simState, viewMode, dayOfYear }: SpaceSimulationProps) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const earthMeshRef = useRef<THREE.Mesh>(null);
  const moonGroupRef = useRef<THREE.Group>(null);
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const seasonTextRef = useRef<any>(null);
  const surfaceCamRef = useRef<THREE.PerspectiveCamera>(null);

  const [earthMap, moonMap] = useLoader(THREE.TextureLoader, [EARTH_TEX, MOON_TEX]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {
        setUserLocation({ lat: 14, lng: 108 });
      });
    } else {
      setUserLocation({ lat: 14, lng: 108 });
    }
  }, []);

  const orbitPoints = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(ORBIT_A * Math.cos(angle) + ORBIT_C, 0, ORBIT_B * Math.sin(angle)));
    }
    return points;
  }, []);

  const orbitAngle = useRef(0);
  const moonOrbitAngle = useRef(0);
  const controlsRef = useRef<any>(null);

  useFrame((state, delta) => {
    // Không còn dùng delta để tự quay nữa, mà xoay dựa vào thanh trượt dayOfYear!
    // 1 năm = 365.25 ngày.
    
    // Tự quay của Trái Đất: Mỗi 1 ngày = 1 vòng = 2 * PI
    if (simState.dayNight && earthMeshRef.current) {
      earthMeshRef.current.rotation.y = dayOfYear * 2 * Math.PI;
    }

    if (earthGroupRef.current) {
      if (simState.seasons) {
        // Offset 171 ngày: Để ngày 0 (01/01) nằm ở đúng vị trí trên quỹ đạo thực tế
        // (Vừa qua khỏi Đông Chí - góc PI).
        const offsetDays = 171;
        const currentDay = dayOfYear - offsetDays;
        
        // Quỹ đạo của Trái đất: 365.25 ngày = 1 vòng quỹ đạo (2 * PI)
        orbitAngle.current = (currentDay / 365.25) * 2 * Math.PI;
      }
      
      const ex = ORBIT_A * Math.cos(orbitAngle.current) + ORBIT_C;
      const ez = ORBIT_B * Math.sin(orbitAngle.current);
      
      const newPos = new THREE.Vector3(ex, 0, ez);
      
      earthGroupRef.current.position.copy(newPos);
      
      // Move camera to follow Earth
      if (viewMode === 'space' && controlsRef.current) {
        controlsRef.current.target.copy(newPos);
      }
      
      if (simState.seasons || simState.polar) {
        earthGroupRef.current.rotation.z = TILT_ANGLE;
      } else {
        earthGroupRef.current.rotation.z = 0;
      }

      // Update local season text
      if (simState.seasons && userLocation && seasonTextRef.current) {
        let normAngle = orbitAngle.current % (Math.PI * 2);
        if (normAngle < 0) normAngle += Math.PI * 2;
        const isNorth = userLocation.lat >= 0;
        let seasonStr = "";
        
        if (normAngle > 7*Math.PI/4 || normAngle <= Math.PI/4) {
           seasonStr = isNorth ? "Mùa Hè" : "Mùa Đông";
        } else if (normAngle > Math.PI/4 && normAngle <= 3*Math.PI/4) {
           seasonStr = isNorth ? "Mùa Thu" : "Mùa Xuân";
        } else if (normAngle > 3*Math.PI/4 && normAngle <= 5*Math.PI/4) {
           seasonStr = isNorth ? "Mùa Đông" : "Mùa Hè";
        } else {
           seasonStr = isNorth ? "Mùa Xuân" : "Mùa Thu";
        }
        
        if (seasonTextRef.current.text !== seasonStr) {
          seasonTextRef.current.text = seasonStr;
        }
      }
    }

    if (simState.tides && moonGroupRef.current) {
      // Mặt trăng quay quanh TĐ: 27.3 ngày = 1 vòng
      moonOrbitAngle.current = (dayOfYear / 27.3) * 2 * Math.PI;
      
      // Quỹ đạo Elip của Mặt Trăng để tạo ra sự chênh lệch khoảng cách
      const mx = 6.0 * Math.cos(moonOrbitAngle.current) + 1.5; // Lệch tâm để có lúc gần, lúc xa
      const mz = 4.0 * Math.sin(moonOrbitAngle.current);
      moonGroupRef.current.position.x = mx;
      moonGroupRef.current.position.z = mz;

      // Tính khoảng cách từ Trái đất đến Mặt trăng
      const moonDist = Math.sqrt(mx * mx + mz * mz);
      
      // Tính độ phình của nước (Thủy triều): Gần thì phình to, xa thì phình ít
      // Khoảng cách min ~ 4.5, max ~ 7.5. Độ phình dao động từ 1.05 đến 1.35
      const bulge = 1.05 + ((7.5 - moonDist) / 3.0) * 0.3;

      if (waterMeshRef.current) {
        waterMeshRef.current.scale.set(1, 1, 1);
        const angleToMoon = Math.atan2(mz, mx);
        waterMeshRef.current.rotation.y = -angleToMoon;
        waterMeshRef.current.scale.set(bulge, 1.02, 1.02);
      }
    }

    if (viewMode === 'surface' && surfaceCamRef.current) {
      surfaceCamRef.current.rotation.x = THREE.MathUtils.lerp(surfaceCamRef.current.rotation.x, Math.PI/2 - state.pointer.y * 1.5, 0.1);
      surfaceCamRef.current.rotation.y = THREE.MathUtils.lerp(surfaceCamRef.current.rotation.y, -state.pointer.x * Math.PI, 0.1);
    }
  });

  return (
    <>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[3, 32, 32]} />
        <meshBasicMaterial color="#ffdd44" />
        <PointLight color="#ffffff" intensity={500} distance={200} decay={1.5} />
      </mesh>
      
      {viewMode === 'space' && (
        <Text position={[0, 4, 0]} fontSize={1} color="#ffaa00" anchorX="center" anchorY="middle">
          Mặt Trời
        </Text>
      )}

      {/* Earth Orbit Path & Season Labels */}
      {simState.seasons && viewMode === 'space' && (
        <group>
          <Line points={orbitPoints} color="rgba(255, 255, 255, 0.3)" lineWidth={1.5} />
          {/* North pole points towards Sun at +X. So +X is Northern Summer (Hạ Chí) */}
          <Text position={[ORBIT_A + ORBIT_C + 3, 0, 0]} fontSize={0.8} color="#00ffff" rotation={[-Math.PI/2, 0, 0]}>Hạ Chí</Text>
          <Text position={[-ORBIT_A + ORBIT_C - 3, 0, 0]} fontSize={0.8} color="#00ffff" rotation={[-Math.PI/2, 0, 0]}>Đông Chí</Text>
          <Text position={[ORBIT_C, 0, ORBIT_B + 2]} fontSize={0.8} color="#00ffff" rotation={[-Math.PI/2, 0, 0]}>Thu Phân</Text>
          <Text position={[ORBIT_C, 0, -ORBIT_B - 2]} fontSize={0.8} color="#00ffff" rotation={[-Math.PI/2, 0, 0]}>Xuân Phân</Text>
        </group>
      )}

      {/* Earth System */}
      <group ref={earthGroupRef} position={[ORBIT_A + ORBIT_C, 0, 0]}>
        
        {/* Earth Axis Line */}
        {(simState.seasons || simState.polar) && viewMode === 'space' && (
          <Line 
            points={[new THREE.Vector3(0, -EARTH_RADIUS - 1.5, 0), new THREE.Vector3(0, EARTH_RADIUS + 1.5, 0)]} 
            color="#ff0055" 
            lineWidth={3} 
          />
        )}

        {/* Earth Mesh */}
        <mesh ref={earthMeshRef} castShadow receiveShadow>
          <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
          <meshStandardMaterial map={earthMap} roughness={1} metalness={0} />
          
          {/* Home Marker */}
          {simState.dayNight && userLocation && (
            <group rotation={[0, (userLocation.lng * Math.PI) / 180, 0]}>
              <group rotation={[(90 - userLocation.lat) * Math.PI / 180, 0, 0]}>
                
                {viewMode === 'space' ? (
                  <>
                    <mesh position={[0, EARTH_RADIUS + 0.1, 0]}>
                      <coneGeometry args={[0.1, 0.3, 16]} />
                      <meshBasicMaterial color="#ff0000" />
                    </mesh>
                    {simState.seasons && (
                      <Text ref={seasonTextRef} position={[0, EARTH_RADIUS + 1.0, 0]} fontSize={0.5} color="#00ff00" rotation={[-Math.PI/2, 0, 0]}>
                        Mùa
                      </Text>
                    )}
                  </>
                ) : (
                  <PerspectiveCamera 
                    ref={surfaceCamRef}
                    makeDefault 
                    position={[0, EARTH_RADIUS + 0.05, 0]} 
                    rotation={[Math.PI/2, 0, 0]} 
                    fov={80} 
                    near={0.01} 
                    far={1000} 
                  />
                )}
              </group>
            </group>
          )}

          {/* Polar Regions Highlight */}
          {simState.polar && viewMode === 'space' && (
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
            {viewMode === 'space' && (
              <Text position={[0, 1, 0]} fontSize={0.5} color="#cccccc" anchorX="center" anchorY="middle">
                Mặt Trăng
              </Text>
            )}
          </group>
        )}

      </group>
      
      {/* OrbitControls injected from parent */}
      {viewMode === 'space' && <OrbitControlsHelper controlsRef={controlsRef} />}
    </>
  );
}

// Helper to get ref to OrbitControls from within Canvas
function OrbitControlsHelper({ controlsRef }: { controlsRef: React.MutableRefObject<any> }) {
  return (
    <OrbitControls 
      ref={controlsRef}
      enablePan={true} 
      enableZoom={true} 
      enableRotate={true}
      minDistance={3}
      maxDistance={80}
    />
  );
}

// Extract PointLight to a component to satisfy react-three-fiber
function PointLight({ color, intensity, distance, decay }: any) {
  return <pointLight color={color} intensity={intensity} distance={distance} decay={decay} castShadow shadow-mapSize={[2048, 2048]} />;
}

export default function SpaceSimulation({ simState, viewMode, dayOfYear }: SpaceSimulationProps) {
  return (
    <Canvas shadows camera={{ position: [ORBIT_A + ORBIT_C, 5, 20], fov: 45 }}>
      <color attach="background" args={["#020205"]} />
      
      {/* 0 ambient light to make the dark side pitch black */}
      <ambientLight intensity={0} />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <SolarSystem simState={simState} viewMode={viewMode} dayOfYear={dayOfYear} />
    </Canvas>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, PerspectiveCamera, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { PlayableGameDefinition } from "../core/types";

interface R3FGhostHuntersGameProps {
  game: PlayableGameDefinition;
  paused: boolean;
  restartKey: number;
  playerCount: number;
}

interface HunterState {
  id: 1 | 2;
  x: number;
  z: number;
  facingX: number;
  facingZ: number;
  score: number;
  cooldown: number;
  wardCooldown: number;
}

interface GhostState {
  id: string;
  x: number;
  z: number;
  health: number;
  speed: number;
  stun: number;
}

interface LightOrbState {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  owner: 1 | 2;
}

interface WardState {
  id: string;
  x: number;
  z: number;
  life: number;
}

interface SpiritState {
  id: string;
  x: number;
  z: number;
  life: number;
}

interface GhostRuntimeState {
  hunters: HunterState[];
  ghosts: GhostState[];
  orbs: LightOrbState[];
  wards: WardState[];
  spirits: SpiritState[];
  baseHealth: number;
  sharedScore: number;
  timeLeft: number;
  resource: number;
  spawnIn: number;
  spiritIn: number;
  status: "ready" | "playing" | "finished";
  message: string;
  publishIn: number;
}

const arenaLimitX = 4.6;
const arenaLimitZ = 3.35;
const durationSeconds = 120;

export function R3FGhostHuntersGame({ game, paused, restartKey, playerCount }: R3FGhostHuntersGameProps) {
  const stateRef = useRef(createInitialState(playerCount));
  const [view, setView] = useState(() => snapshotState(stateRef.current));

  useEffect(() => {
    stateRef.current = createInitialState(playerCount);
    setView(snapshotState(stateRef.current));
  }, [playerCount, restartKey]);

  return (
    <div className="three-game-shell r3f-game-shell is-ghost-game">
      <div className="r3f-game-canvas">
        <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]}>
          <GhostScene paused={paused} stateRef={stateRef} onPublish={setView} />
        </Canvas>
      </div>

      <div className="three-game-hud" aria-live="polite">
        <div>
          <span>P1</span>
          <strong>{view.hunters[0]?.score ?? 0}</strong>
          <small>Bắn tia sáng</small>
        </div>
        <div>
          <span>Đèn linh quang</span>
          <strong>{Math.max(0, Math.round(view.baseHealth))}</strong>
          <small>{paused ? "Tạm dừng" : getStatusLabel(view.status)}</small>
        </div>
        <div>
          <span>{playerCount > 1 ? "P2" : "Solo"}</span>
          <strong>{playerCount > 1 ? view.hunters[1]?.score ?? 0 : view.sharedScore}</strong>
          <small>{playerCount > 1 ? "Đặt vòng bảo vệ" : "Điểm chung"}</small>
        </div>
      </div>

      <div className="three-game-status">
        <strong>{game.shortTitle}</strong>
        <span>{paused ? "Game đang pause để người chơi đọc hướng dẫn hoặc chỉnh vị trí." : view.message}</span>
        <small>
          Điểm chung: {view.sharedScore} | Linh quang: {view.resource} | Thời gian: {Math.ceil(view.timeLeft)}s
        </small>
      </div>

      <div className="three-game-controls">
        <span>P1: WASD di chuyển</span>
        {playerCount > 1 ? <span>P2: phím mũi tên di chuyển</span> : null}
        <span>F/K: bắn tia sáng</span>
        <span>G/L: đặt vòng bảo vệ</span>
      </div>
    </div>
  );
}

function GhostScene({
  paused,
  stateRef,
  onPublish,
}: {
  paused: boolean;
  stateRef: MutableRefObject<GhostRuntimeState>;
  onPublish: (state: GhostRuntimeState) => void;
}) {
  const keysRef = useKeyboardInput();

  useFrame((_, rawDt) => {
    const state = stateRef.current;
    const dt = Math.min(0.033, rawDt);

    if (paused || state.status === "finished") {
      state.publishIn -= dt;
      if (state.publishIn <= 0) {
        state.publishIn = 0.12;
        onPublish(snapshotState(state));
      }
      return;
    }

    state.status = "playing";
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.spawnIn -= dt;
    state.spiritIn -= dt;

    updateHunters(state, keysRef.current, dt);
    updateOrbs(state, dt);
    updateWards(state, dt);
    updateGhosts(state, dt);
    updateSpirits(state, dt);

    if (state.spawnIn <= 0) {
      state.spawnIn = Math.max(0.58, 1.28 - (durationSeconds - state.timeLeft) / 190);
      state.ghosts.push(createGhost(state.timeLeft));
    }

    if (state.spiritIn <= 0) {
      state.spiritIn = 9 + Math.random() * 5;
      state.spirits.push({
        id: createId("spirit"),
        x: randomBetween(-3.8, 3.8),
        z: randomBetween(-2.6, 2.6),
        life: 9,
      });
    }

    if (state.baseHealth <= 0) {
      state.baseHealth = 0;
      state.status = "finished";
      state.message = "Đèn linh quang đã tắt. Hãy chơi lại và chia người bảo vệ trung tâm tốt hơn.";
    } else if (state.timeLeft <= 0) {
      state.status = "finished";
      state.message = "Qua đêm an toàn! Biệt đội đã bảo vệ đèn linh quang thành công.";
    } else if (state.ghosts.length > 7) {
      state.message = "Bóng ma đang áp sát, cần đặt vòng bảo vệ gần đèn trung tâm.";
    } else {
      state.message = "Bảo vệ đèn trung tâm, bắn tia sáng và nhặt linh quang hồi phục.";
    }

    state.publishIn -= dt;
    if (state.publishIn <= 0) {
      state.publishIn = 0.05;
      onPublish(snapshotState(state));
    }
  });

  const view = stateRef.current;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 7.4, 8.8]} fov={48} />
      <color attach="background" args={["#071224"]} />
      <fog attach="fog" args={["#071224", 9, 19]} />
      <ambientLight intensity={0.75} />
      <directionalLight castShadow position={[4, 8, 3]} intensity={1.35} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 1.4, 0]} intensity={2.1} color="#fde68a" distance={7.5} />
      <Stars radius={28} depth={18} count={1200} factor={4} saturation={0.2} fade speed={0.45} />

      <Arena />
      <Lantern health={view.baseHealth} />

      {view.hunters.map((hunter) => (
        <Hunter key={hunter.id} hunter={hunter} />
      ))}
      {view.ghosts.map((ghost) => (
        <Ghost key={ghost.id} ghost={ghost} />
      ))}
      {view.orbs.map((orb) => (
        <LightOrb key={orb.id} orb={orb} />
      ))}
      {view.wards.map((ward) => (
        <Ward key={ward.id} ward={ward} />
      ))}
      {view.spirits.map((spirit) => (
        <Spirit key={spirit.id} spirit={spirit} />
      ))}
    </>
  );
}

function Arena() {
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <circleGeometry args={[5.65, 72]} />
        <meshStandardMaterial color="#13294b" roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <ringGeometry args={[4.85, 5.08, 72]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f97316" emissiveIntensity={0.32} />
      </mesh>
      {[-4.2, 4.2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh castShadow position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.72, 18]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <pointLight position={[0, 1.15, 0]} intensity={0.8} color="#22d3ee" distance={4} />
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.24, 18, 12]} />
            <meshStandardMaterial color="#67e8f9" emissive="#06b6d4" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Lantern({ health }: { health: number }) {
  const scale = 0.78 + Math.max(0, health) / 1000;

  return (
    <Float speed={1.5} floatIntensity={0.18}>
      <group position={[0, 0.68, 0]} scale={scale}>
        <mesh castShadow>
          <cylinderGeometry args={[0.46, 0.6, 0.72, 28]} />
          <meshStandardMaterial color="#facc15" emissive="#f97316" emissiveIntensity={0.75} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.34, 24, 16]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fde047" emissiveIntensity={1.7} transparent opacity={0.86} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.52, 0]}>
          <ringGeometry args={[0.86, 1.08, 36]} />
          <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={1.1} transparent opacity={0.7} />
        </mesh>
      </group>
    </Float>
  );
}

function Hunter({ hunter }: { hunter: HunterState }) {
  const color = hunter.id === 1 ? "#fb923c" : "#22d3ee";
  const accent = hunter.id === 1 ? "#fed7aa" : "#cffafe";
  const rotationY = Math.atan2(hunter.facingX, hunter.facingZ);

  return (
    <group position={[hunter.x, 0, hunter.z]} rotation-y={rotationY}>
      <mesh castShadow position={[0, 0.45, 0]}>
        <capsuleGeometry args={[0.25, 0.5, 8, 18]} />
        <meshStandardMaterial color={color} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 0.9, 0.02]}>
        <sphereGeometry args={[0.24, 18, 14]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.66, 0.42]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.12, 0.38, 16]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fde047" emissiveIntensity={0.75} />
      </mesh>
      <pointLight position={[0, 0.86, 0.42]} intensity={0.55} color={color} distance={2.2} />
    </group>
  );
}

function Ghost({ ghost }: { ghost: GhostState }) {
  const opacity = ghost.stun > 0 ? 0.52 : 0.78;
  const color = ghost.health > 1 ? "#c4b5fd" : "#dbeafe";

  return (
    <Float speed={2.2} floatIntensity={0.28}>
      <group position={[ghost.x, 0.58, ghost.z]}>
        <mesh castShadow>
          <sphereGeometry args={[0.38, 24, 18]} />
          <meshStandardMaterial color={color} emissive="#818cf8" emissiveIntensity={0.62} transparent opacity={opacity} />
        </mesh>
        <mesh position={[-0.13, 0.06, 0.34]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
        <mesh position={[0.13, 0.06, 0.34]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.36, 0]}>
          <ringGeometry args={[0.22, 0.4, 20]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.24} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </Float>
  );
}

function LightOrb({ orb }: { orb: LightOrbState }) {
  const color = orb.owner === 1 ? "#fde68a" : "#67e8f9";

  return (
    <group position={[orb.x, 0.72, orb.z]}>
      <pointLight intensity={0.72} color={color} distance={2.2} />
      <mesh castShadow>
        <sphereGeometry args={[0.13, 18, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

function Ward({ ward }: { ward: WardState }) {
  const opacity = Math.max(0.18, Math.min(0.72, ward.life / 4));

  return (
    <group position={[ward.x, 0.05, ward.z]}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.78, 1.04, 42]} />
        <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={1.2} transparent opacity={opacity} />
      </mesh>
      <pointLight intensity={0.55} color="#22d3ee" distance={3.6} />
    </group>
  );
}

function Spirit({ spirit }: { spirit: SpiritState }) {
  return (
    <Float speed={2.4} floatIntensity={0.35}>
      <group position={[spirit.x, 0.5, spirit.z]}>
        <pointLight intensity={0.5} color="#86efac" distance={2.6} />
        <mesh>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color="#bbf7d0" emissive="#22c55e" emissiveIntensity={1.4} />
        </mesh>
      </group>
    </Float>
  );
}

function useKeyboardInput() {
  const keysRef = useRef(new Set<string>());

  useEffect(() => {
    const playableKeys = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyF",
      "KeyG",
      "ArrowUp",
      "ArrowLeft",
      "ArrowDown",
      "ArrowRight",
      "KeyK",
      "KeyL",
    ]);

    const keydown = (event: KeyboardEvent) => {
      keysRef.current.add(event.code);
      if (playableKeys.has(event.code)) event.preventDefault();
    };
    const keyup = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code);
    };

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
  }, []);

  return keysRef;
}

function createInitialState(playerCount: number): GhostRuntimeState {
  const hunters: HunterState[] = [
    {
      id: 1,
      x: playerCount > 1 ? -1.55 : 0,
      z: 1.9,
      facingX: 0,
      facingZ: -1,
      score: 0,
      cooldown: 0,
      wardCooldown: 0,
    },
  ];

  if (playerCount > 1) {
    hunters.push({
      id: 2,
      x: 1.55,
      z: 1.9,
      facingX: 0,
      facingZ: -1,
      score: 0,
      cooldown: 0,
      wardCooldown: 0,
    });
  }

  return {
    hunters,
    ghosts: [createGhost(durationSeconds), createGhost(durationSeconds - 8), createGhost(durationSeconds - 16)],
    orbs: [],
    wards: [],
    spirits: [],
    baseHealth: 100,
    sharedScore: 0,
    timeLeft: durationSeconds,
    resource: 0,
    spawnIn: 1.2,
    spiritIn: 5,
    status: "ready",
    message: "Bảo vệ đèn trung tâm, bắn tia sáng và nhặt linh quang hồi phục.",
    publishIn: 0,
  };
}

function updateHunters(state: GhostRuntimeState, keys: Set<string>, dt: number) {
  for (const hunter of state.hunters) {
    const input = getHunterInput(hunter.id, keys);
    const speed = 3.6;

    if (Math.abs(input.x) > 0.01 || Math.abs(input.z) > 0.01) {
      const length = Math.hypot(input.x, input.z) || 1;
      const nx = input.x / length;
      const nz = input.z / length;
      hunter.x = clamp(hunter.x + nx * speed * dt, -arenaLimitX, arenaLimitX);
      hunter.z = clamp(hunter.z + nz * speed * dt, -arenaLimitZ, arenaLimitZ);
      hunter.facingX = nx;
      hunter.facingZ = nz;
    }

    hunter.cooldown = Math.max(0, hunter.cooldown - dt);
    hunter.wardCooldown = Math.max(0, hunter.wardCooldown - dt);

    if (input.action && hunter.cooldown <= 0) {
      hunter.cooldown = 0.34;
      state.orbs.push({
        id: createId("orb"),
        x: hunter.x + hunter.facingX * 0.42,
        z: hunter.z + hunter.facingZ * 0.42,
        vx: hunter.facingX * 7.4,
        vz: hunter.facingZ * 7.4,
        life: 0.92,
        owner: hunter.id,
      });
    }

    if (input.alt && hunter.wardCooldown <= 0) {
      hunter.wardCooldown = 4.5;
      state.wards.push({
        id: createId("ward"),
        x: hunter.x,
        z: hunter.z,
        life: 4,
      });
      state.resource += 1;
    }
  }
}

function updateOrbs(state: GhostRuntimeState, dt: number) {
  const remainingOrbs: LightOrbState[] = [];

  for (const orb of state.orbs) {
    orb.x += orb.vx * dt;
    orb.z += orb.vz * dt;
    orb.life -= dt;

    let hit = false;
    for (const ghost of state.ghosts) {
      if (distance2d(orb.x, orb.z, ghost.x, ghost.z) < 0.56) {
        ghost.health -= 1;
        ghost.stun = Math.max(ghost.stun, 0.45);
        hit = true;
        const hunter = state.hunters.find((candidate) => candidate.id === orb.owner);
        if (hunter) hunter.score += 5;
        state.sharedScore += 5;
        break;
      }
    }

    if (!hit && orb.life > 0 && Math.abs(orb.x) < 5.6 && Math.abs(orb.z) < 4.6) {
      remainingOrbs.push(orb);
    }
  }

  state.orbs = remainingOrbs;
  defeatGhosts(state);
}

function updateWards(state: GhostRuntimeState, dt: number) {
  state.wards = state.wards
    .map((ward) => ({ ...ward, life: ward.life - dt }))
    .filter((ward) => ward.life > 0);

  for (const ward of state.wards) {
    for (const ghost of state.ghosts) {
      const distance = distance2d(ward.x, ward.z, ghost.x, ghost.z);
      if (distance < 1.14) {
        ghost.stun = Math.max(ghost.stun, 0.34);
        const push = Math.max(0, 1.14 - distance) * 1.9 * dt;
        const dx = ghost.x - ward.x;
        const dz = ghost.z - ward.z;
        const length = Math.hypot(dx, dz) || 1;
        ghost.x += (dx / length) * push;
        ghost.z += (dz / length) * push;
      }
    }
  }
}

function updateGhosts(state: GhostRuntimeState, dt: number) {
  const remainingGhosts: GhostState[] = [];

  for (const ghost of state.ghosts) {
    ghost.stun = Math.max(0, ghost.stun - dt);
    const speed = ghost.stun > 0 ? ghost.speed * 0.22 : ghost.speed;
    const dx = -ghost.x;
    const dz = -ghost.z;
    const length = Math.hypot(dx, dz) || 1;

    ghost.x += (dx / length) * speed * dt;
    ghost.z += (dz / length) * speed * dt;

    if (distance2d(ghost.x, ghost.z, 0, 0) < 0.68) {
      state.baseHealth -= 11;
      state.message = "Một bóng ma đã chạm vào đèn. Cần giữ vòng bảo vệ ở trung tâm.";
      continue;
    }

    remainingGhosts.push(ghost);
  }

  state.ghosts = remainingGhosts;
}

function updateSpirits(state: GhostRuntimeState, dt: number) {
  const remainingSpirits: SpiritState[] = [];

  for (const spirit of state.spirits) {
    spirit.life -= dt;
    const collectedBy = state.hunters.find((hunter) => distance2d(hunter.x, hunter.z, spirit.x, spirit.z) < 0.56);
    if (collectedBy) {
      state.baseHealth = Math.min(100, state.baseHealth + 12);
      state.sharedScore += 12;
      collectedBy.score += 8;
      state.resource += 1;
      continue;
    }

    if (spirit.life > 0) remainingSpirits.push(spirit);
  }

  state.spirits = remainingSpirits;
}

function defeatGhosts(state: GhostRuntimeState) {
  const remainingGhosts: GhostState[] = [];

  for (const ghost of state.ghosts) {
    if (ghost.health <= 0) {
      state.sharedScore += 18;
      if (Math.random() < 0.42) {
        state.spirits.push({
          id: createId("spirit"),
          x: ghost.x,
          z: ghost.z,
          life: 7,
        });
      }
    } else {
      remainingGhosts.push(ghost);
    }
  }

  state.ghosts = remainingGhosts;
}

function getHunterInput(id: 1 | 2, keys: Set<string>) {
  if (id === 1) {
    return {
      x: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      z: (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0),
      action: keys.has("KeyF"),
      alt: keys.has("KeyG"),
    };
  }

  return {
    x: (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0),
    z: (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0),
    action: keys.has("KeyK"),
    alt: keys.has("KeyL"),
  };
}

function createGhost(timeLeft: number): GhostState {
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? -5 : side === 1 ? 5 : randomBetween(-4.4, 4.4);
  const z = side === 2 ? -3.8 : side === 3 ? 3.8 : randomBetween(-3.2, 3.2);
  const elapsed = durationSeconds - timeLeft;
  const hardening = Math.min(1, elapsed / durationSeconds);

  return {
    id: createId("ghost"),
    x,
    z,
    health: Math.random() < 0.25 + hardening * 0.35 ? 2 : 1,
    speed: randomBetween(0.88, 1.24) + hardening * 0.36,
    stun: 0,
  };
}

function snapshotState(state: GhostRuntimeState): GhostRuntimeState {
  return {
    ...state,
    hunters: state.hunters.map((hunter) => ({ ...hunter })),
    ghosts: state.ghosts.map((ghost) => ({ ...ghost })),
    orbs: state.orbs.map((orb) => ({ ...orb })),
    wards: state.wards.map((ward) => ({ ...ward })),
    spirits: state.spirits.map((spirit) => ({ ...spirit })),
  };
}

function getStatusLabel(status: GhostRuntimeState["status"]) {
  return {
    ready: "Sẵn sàng",
    playing: "Đang chơi",
    finished: "Kết thúc",
  }[status];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance2d(ax: number, az: number, bx: number, bz: number) {
  return Math.hypot(ax - bx, az - bz);
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

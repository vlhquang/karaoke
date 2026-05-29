"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { GameDefinition, GameId, RuntimeStats } from "../core/types";

interface ThreeGameCanvasProps {
  game: GameDefinition;
  paused: boolean;
  restartKey: number;
}

interface PlayerInput {
  x: number;
  z: number;
  action: boolean;
  alt: boolean;
}

interface InputManager {
  getPlayerInput: (player: 1 | 2) => PlayerInput;
  destroy: () => void;
}

interface PlayerActor {
  id: 1 | 2;
  group: THREE.Group;
  variant: ActorVariant;
  bobTarget: THREE.Object3D;
  bobBaseY: number;
  healthBarFill?: THREE.Mesh;
  velocity: THREE.Vector3;
  facing: THREE.Vector3;
  score: number;
  health: number;
  cooldown: number;
  stun: number;
  carrying: string | null;
  resource: number;
  raceDistance: number;
  raceSpeed: number;
  lane: number;
  laps: number;
}

interface SceneObject {
  mesh: THREE.Object3D;
  kind: string;
  velocity: THREE.Vector3;
  owner?: 1 | 2;
  life: number;
  value: number;
  data: Record<string, string | number | boolean>;
}

interface Runtime {
  update: (dt: number) => void;
  dispose: () => void;
}

type ActorVariant =
  | "brawler"
  | "board-token"
  | "builder"
  | "chef"
  | "defender"
  | "explorer"
  | "firefighter"
  | "hopper"
  | "magician"
  | "party"
  | "racer"
  | "ring-thrower"
  | "robot"
  | "shooter"
  | "sport";

type HealthMode = "none" | "players" | "base";

interface GameplayProfile {
  primaryAction?: string;
  secondaryAction?: string;
  extraHint?: string;
  healthMode: HealthMode;
}

const initialStats: RuntimeStats = {
  p1Score: 0,
  p2Score: 0,
  p1Health: 100,
  p2Health: 100,
  sharedScore: 0,
  timeLeft: 120,
  resource: 0,
  status: "ready",
  message: "Sẵn sàng",
};

const gameDuration: Record<GameDefinition["id"], number> = {
  "mini-brawler-3d": 120,
  "sport-action-3d": 150,
  "arena-shooter-3d": 120,
  "duo-puzzle-3d": 180,
  "chaos-kitchen-3d": 150,
  "tower-defense-3d": 180,
  "racing-casual-3d": 150,
  "mini-games-3d": 60,
  "candy-ball-3d": 120,
  "bubble-arena-3d": 120,
  "island-box-push-3d": 90,
  "hopper-race-3d": 90,
  "ring-toss-3d": 90,
  "toy-robot-duel-3d": 120,
  "teddy-rescue-3d": 150,
  "bridge-builder-3d": 180,
  "fire-rescue-3d": 150,
  "whack-mole-3d": 60,
  "falling-dodge-3d": 60,
  "star-maze-3d": 60,
  "rock-paper-magic-3d": 60,
  "tic-tac-toe-3d": 120,
  "memory-match-3d": 120,
  "color-catch-3d": 60,
  "treasure-hunt-3d": 150,
};

const brawlerGames = new Set<GameId>(["mini-brawler-3d", "island-box-push-3d", "toy-robot-duel-3d"]);
const sportGames = new Set<GameId>(["sport-action-3d", "candy-ball-3d"]);
const shooterGames = new Set<GameId>(["arena-shooter-3d", "bubble-arena-3d"]);
const puzzleGames = new Set<GameId>(["duo-puzzle-3d", "teddy-rescue-3d", "bridge-builder-3d", "treasure-hunt-3d"]);
const kitchenGames = new Set<GameId>(["chaos-kitchen-3d", "fire-rescue-3d"]);
const racingGames = new Set<GameId>(["racing-casual-3d", "hopper-race-3d"]);
const miniPartyGames = new Set<GameId>([
  "mini-games-3d",
  "whack-mole-3d",
  "falling-dodge-3d",
  "star-maze-3d",
  "rock-paper-magic-3d",
  "tic-tac-toe-3d",
  "memory-match-3d",
  "color-catch-3d",
  "ring-toss-3d",
]);

const actorVariants: Record<GameId, ActorVariant> = {
  "mini-brawler-3d": "brawler",
  "sport-action-3d": "sport",
  "arena-shooter-3d": "shooter",
  "duo-puzzle-3d": "explorer",
  "chaos-kitchen-3d": "chef",
  "tower-defense-3d": "defender",
  "racing-casual-3d": "racer",
  "mini-games-3d": "party",
  "candy-ball-3d": "sport",
  "bubble-arena-3d": "shooter",
  "island-box-push-3d": "brawler",
  "hopper-race-3d": "hopper",
  "ring-toss-3d": "ring-thrower",
  "toy-robot-duel-3d": "robot",
  "teddy-rescue-3d": "explorer",
  "bridge-builder-3d": "builder",
  "fire-rescue-3d": "firefighter",
  "whack-mole-3d": "party",
  "falling-dodge-3d": "party",
  "star-maze-3d": "explorer",
  "rock-paper-magic-3d": "magician",
  "tic-tac-toe-3d": "board-token",
  "memory-match-3d": "party",
  "color-catch-3d": "party",
  "treasure-hunt-3d": "explorer",
};

const gameplayProfiles: Record<GameId, GameplayProfile> = {
  "mini-brawler-3d": { primaryAction: "Đẩy đối thủ", healthMode: "none" },
  "sport-action-3d": { primaryAction: "Sút mạnh", healthMode: "none" },
  "arena-shooter-3d": { primaryAction: "Bắn bóng nước", healthMode: "players" },
  "duo-puzzle-3d": { primaryAction: "Kích hoạt gần mục tiêu", healthMode: "none" },
  "chaos-kitchen-3d": { primaryAction: "Nhặt/đặt/giao món", healthMode: "none" },
  "tower-defense-3d": { primaryAction: "Xây trụ khi đủ 2 sao", healthMode: "base" },
  "racing-casual-3d": { primaryAction: "Giữ để tăng tốc tối đa", healthMode: "none" },
  "mini-games-3d": { primaryAction: "Nhặt sao / tránh hộp", healthMode: "none" },
  "candy-ball-3d": { primaryAction: "Sút bóng kẹo", healthMode: "none" },
  "bubble-arena-3d": { primaryAction: "Bắn bong bóng", healthMode: "players" },
  "island-box-push-3d": { primaryAction: "Đẩy đối thủ", healthMode: "none" },
  "hopper-race-3d": { primaryAction: "Giữ để tăng tốc tối đa", healthMode: "none" },
  "ring-toss-3d": { primaryAction: "Ném vòng", healthMode: "none" },
  "toy-robot-duel-3d": { primaryAction: "Dash đẩy robot", healthMode: "none" },
  "teddy-rescue-3d": { primaryAction: "Kích hoạt gần mục tiêu", healthMode: "none" },
  "bridge-builder-3d": { primaryAction: "Nhặt/đặt vật liệu", healthMode: "none" },
  "fire-rescue-3d": { primaryAction: "Phun nước dập lửa", healthMode: "none" },
  "whack-mole-3d": { primaryAction: "Đập chuột gần mình", healthMode: "none" },
  "falling-dodge-3d": { primaryAction: "Nhặt sao / né vật rơi", healthMode: "players" },
  "star-maze-3d": { primaryAction: "Nhặt sao", healthMode: "none" },
  "rock-paper-magic-3d": {
    primaryAction: "Chọn đá",
    secondaryAction: "Chọn kéo",
    extraHint: "Không bấm: giấy",
    healthMode: "none",
  },
  "tic-tac-toe-3d": { primaryAction: "Chiếm ô đang đứng", healthMode: "none" },
  "memory-match-3d": { primaryAction: "Lật khối trí nhớ", healthMode: "none" },
  "color-catch-3d": { primaryAction: "Bắt bóng đúng màu", healthMode: "none" },
  "treasure-hunt-3d": { primaryAction: "Kích hoạt gần kho báu", healthMode: "none" },
};

export function ThreeGameCanvas({ game, paused, restartKey }: ThreeGameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(paused);
  const profile = gameplayProfiles[game.id];
  const [stats, setStats] = useState<RuntimeStats>({
    ...initialStats,
    timeLeft: gameDuration[game.id],
    message: game.objective,
  });

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#dff8ff");
    scene.fog = new THREE.Fog("#dff8ff", 13, 24);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
    camera.position.set(0, 8.4, 9.2);
    camera.lookAt(0, 0, 0);

    const input = createInputManager();
    const runtime = createRuntime(game, scene, camera, input, setStats);

    const resize = () => {
      const width = Math.max(320, mount.clientWidth);
      const height = Math.max(280, mount.clientHeight);
      const aspect = width / height;
      const isNarrow = aspect < 0.72;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.position.x = 0;
      camera.fov = isNarrow ? 58 : 46;
      camera.position.y = isNarrow ? 9.8 : 8.4;
      camera.position.z = isNarrow ? 12.2 : 9.2;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener("resize", resize);

    let frameId = 0;
    let lastTime = performance.now();

    const frame = (time: number) => {
      const dt = Math.min(0.033, Math.max(0, (time - lastTime) / 1000));
      lastTime = time;

      if (!pausedRef.current) {
        runtime.update(dt);
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(frame);
    };

    frameId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      runtime.dispose();
      input.destroy();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [game, restartKey]);

  return (
    <div className="three-game-shell">
      <div className="three-game-canvas" ref={mountRef} />

      <div className="three-game-hud" aria-live="polite">
        <div>
          <span>P1</span>
          <strong>{stats.p1Score}</strong>
          <small>{getPlayerStatusLabel(profile, 1, stats.p1Health)}</small>
        </div>
        <div>
          <span>Thời gian</span>
          <strong>{Math.max(0, Math.ceil(stats.timeLeft))}</strong>
          <small>{paused ? "Tạm dừng" : getStatusLabel(stats.status)}</small>
        </div>
        <div>
          <span>P2</span>
          <strong>{stats.p2Score}</strong>
          <small>{getPlayerStatusLabel(profile, 2, stats.p2Health)}</small>
        </div>
      </div>

      <div className="three-game-status">
        <strong>{game.shortTitle}</strong>
        <span>{paused ? "Tạm dừng" : stats.message}</span>
        <small>
          Điểm chung: {stats.sharedScore} | Tài nguyên: {stats.resource}
        </small>
      </div>

      <div className="three-game-controls">
        <span>Di chuyển: P1 WASD | P2 phím mũi tên</span>
        {profile.primaryAction ? <span>F/K: {profile.primaryAction}</span> : null}
        {profile.secondaryAction ? <span>G/L: {profile.secondaryAction}</span> : null}
        {profile.extraHint ? <span>{profile.extraHint}</span> : null}
      </div>
    </div>
  );
}

function createInputManager(): InputManager {
  const keys = new Set<string>();

  const keydown = (event: KeyboardEvent) => {
    keys.add(event.code);
    if (
      ["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "KeyK", "KeyL"].includes(
        event.code,
      )
    ) {
      event.preventDefault();
    }
  };

  const keyup = (event: KeyboardEvent) => {
    keys.delete(event.code);
  };

  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);

  return {
    getPlayerInput(player) {
      if (player === 1) {
        return {
          x: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
          z: Number(keys.has("KeyS")) - Number(keys.has("KeyW")),
          action: keys.has("KeyF"),
          alt: keys.has("KeyG"),
        };
      }

      return {
        x: Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft")),
        z: Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp")),
        action: keys.has("KeyK"),
        alt: keys.has("KeyL"),
      };
    },
    destroy() {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    },
  };
}

function createRuntime(
  game: GameDefinition,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  input: InputManager,
  emitStats: (stats: RuntimeStats) => void,
): Runtime {
  const theme = {
    accent: game.accent,
    secondary: game.secondaryAccent,
    floor: blendColor(game.accent, "#ffffff", 0.82),
  };
  const profile = gameplayProfiles[game.id];
  const actorVariant = actorVariants[game.id];
  const objects: SceneObject[] = [];
  const players: [PlayerActor, PlayerActor] = [
    createPlayer(1, theme.accent, new THREE.Vector3(-2.1, 0, 0.8), actorVariant),
    createPlayer(2, theme.secondary, new THREE.Vector3(2.1, 0, 0.8), actorVariant),
  ];
  let elapsed = 0;
  let lastStatEmit = 0;
  let sharedScore = 0;
  let resource = 0;
  let baseHealth = 100;
  let status: RuntimeStats["status"] = "playing";
  let message = game.objective;
  let messageTimer = 0;
  let spawnTimer = 0;
  let level = 1;
  let cookedReady = false;
  let potVeg = false;
  let potFruit = false;
  let gateOpen = false;
  let ball: SceneObject | null = null;
  let baseHealthFill: THREE.Mesh | null = null;

  setupWorld(scene, game, theme);
  scene.add(players[0].group, players[1].group);
  if (profile.healthMode === "players") {
    attachPlayerHealthBars(players);
  }
  setupSignatureObjects();

  if (sportGames.has(game.id)) {
    ball = createBall(new THREE.Vector3(0, 0.24, 0));
    scene.add(ball.mesh);
    objects.push(ball);
    addGoal(scene, -5.8, theme.secondary);
    addGoal(scene, 5.8, theme.accent);
  }

  if (puzzleGames.has(game.id)) {
    addPlate(scene, new THREE.Vector3(-3.1, 0.03, 1.9), theme.accent);
    addPlate(scene, new THREE.Vector3(3.1, 0.03, 1.9), theme.secondary);
    addGate(scene, new THREE.Vector3(0, 0.7, -1.1), "#f59e0b");
    addExit(scene, new THREE.Vector3(0, 0.04, -3.2), "#22c55e");
  }

  if (kitchenGames.has(game.id)) {
    addStation(scene, new THREE.Vector3(-4.2, 0.35, -2.5), "#22c55e");
    addStation(scene, new THREE.Vector3(4.2, 0.35, -2.5), "#f97316");
    addStation(scene, new THREE.Vector3(0, 0.35, 0), "#64748b");
    addStation(scene, new THREE.Vector3(0, 0.35, 3.1), "#facc15");
  }

  if (game.id === "tower-defense-3d") {
    addBase(scene, "#facc15");
    baseHealthFill = addBaseHealthBar(scene);
  }

  if (racingGames.has(game.id)) {
    players[0].group.position.set(-1.5, 0, 2.9);
    players[1].group.position.set(1.5, 0, 2.9);
    players[0].lane = -1;
    players[1].lane = 1;
    addTrack(scene);
  }

  if (game.id === "tic-tac-toe-3d") {
    setupTicTacToeBoard();
  }

  if (game.id === "memory-match-3d") {
    setupMemoryBlocks();
  }

  if (game.id === "ring-toss-3d") {
    setupRingTargets();
  }

  publishDebugState();

  function setupTicTacToeBoard() {
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const index = row * 3 + col;
        const cell = createBoxObject(
          "cell",
          new THREE.Vector3((col - 1) * 1.1, 0.08, (row - 1) * 1.1),
          new THREE.Vector3(0.92, 0.12, 0.92),
          "#e2e8f0",
          0,
        );
        cell.data.index = index;
        cell.data.owner = 0;
        cell.life = 9999;
        objects.push(cell);
        scene.add(cell.mesh);
      }
    }
  }

  function setupMemoryBlocks() {
    const colors = ["#f97316", "#22c55e", "#38bdf8", "#c084fc"];
    const symbols = [...colors, ...colors].sort(() => Math.random() - 0.5);
    symbols.forEach((color, index) => {
      const block = createBoxObject(
        "memory",
        new THREE.Vector3((index % 4 - 1.5) * 1.05, 0.22, (Math.floor(index / 4) - 0.5) * 1.15),
        new THREE.Vector3(0.7, 0.38, 0.7),
        "#64748b",
        1,
      );
      block.data.symbol = color;
      block.data.revealed = false;
      block.life = 9999;
      objects.push(block);
      scene.add(block.mesh);
    });
  }

  function setupRingTargets() {
    for (let index = 0; index < 3; index += 1) {
      const peg = createPegObject("ring-peg", new THREE.Vector3((index - 1) * 1.7, 0, -2.35), index === 1 ? "#facc15" : "#fde68a", 1);
      peg.data.index = index;
      peg.life = 9999;
      objects.push(peg);
      scene.add(peg.mesh);
    }
  }

  function setupSignatureObjects() {
    const addStatic = (object: SceneObject) => {
      object.life = 9999;
      objects.push(object);
      scene.add(object.mesh);
    };

    if (game.id === "island-box-push-3d") {
      addStatic(createBoxObject("push-box", new THREE.Vector3(-0.7, 0.28, -0.6), new THREE.Vector3(0.56, 0.56, 0.56), "#fbbf24", 1));
      addStatic(createBoxObject("push-box", new THREE.Vector3(0.8, 0.28, -1.4), new THREE.Vector3(0.56, 0.56, 0.56), "#fb923c", 1));
    } else if (game.id === "teddy-rescue-3d") {
      addStatic(createTeddyObject(new THREE.Vector3(0, 0, 0.2), "#c084fc"));
    } else if (game.id === "bridge-builder-3d") {
      addStatic(createBoxObject("river", new THREE.Vector3(0, 0.02, -0.8), new THREE.Vector3(12, 0.05, 1.05), "#38bdf8", 1));
      addStatic(createBoxObject("bridge-plank", new THREE.Vector3(-1.4, 0.12, -0.8), new THREE.Vector3(1.1, 0.14, 0.34), "#a16207", 1));
      addStatic(createBoxObject("bridge-plank", new THREE.Vector3(1.4, 0.12, -0.8), new THREE.Vector3(1.1, 0.14, 0.34), "#a16207", 1));
    } else if (game.id === "fire-rescue-3d") {
      addStatic(createFireObject(new THREE.Vector3(-1.9, 0, 0.4)));
      addStatic(createFireObject(new THREE.Vector3(1.8, 0, -1.1)));
    } else if (game.id === "treasure-hunt-3d") {
      addStatic(createChestObject(new THREE.Vector3(0, 0, -2.5), "#facc15"));
      addStatic(createSphereObject("key-star", new THREE.Vector3(-2.5, 0.28, -0.6), 0.18, "#fde047", 1));
    } else if (game.id === "whack-mole-3d") {
      for (let index = 0; index < 5; index += 1) {
        addStatic(createHoleObject(new THREE.Vector3((index - 2) * 1.2, 0, -1.6 + (index % 2) * 1.2)));
      }
    } else if (game.id === "star-maze-3d") {
      for (let index = 0; index < 5; index += 1) {
        addStatic(createBoxObject("maze-wall", new THREE.Vector3((index - 2) * 1.05, 0.18, -0.7 + (index % 2) * 1.25), new THREE.Vector3(0.18, 0.36, 1.1), "#86efac", 1));
      }
    } else if (game.id === "rock-paper-magic-3d") {
      addStatic(createMagicProp("magic-rock", new THREE.Vector3(-1.5, 0.26, -1.2), "#94a3b8"));
      addStatic(createMagicProp("magic-paper", new THREE.Vector3(0, 0.26, -1.2), "#f8fafc"));
      addStatic(createMagicProp("magic-scissors", new THREE.Vector3(1.5, 0.26, -1.2), "#f472b6"));
    } else if (game.id === "color-catch-3d") {
      addStatic(createBasketObject(new THREE.Vector3(-3.4, 0, -2.7), "#ef4444"));
      addStatic(createBasketObject(new THREE.Vector3(3.4, 0, -2.7), "#3b82f6"));
    }
  }

  function setMessage(next: string, seconds = 2) {
    message = next;
    messageTimer = seconds;
  }

  function publishDebugState() {
    (
      window as typeof window & {
        __gameHubDebug?: {
          actorVariant: ActorVariant;
          gameId: GameId;
          healthMode: HealthMode;
          objectKinds: string[];
          playerVariants: ActorVariant[];
          primaryAction?: string;
          secondaryAction?: string;
        };
      }
    ).__gameHubDebug = {
      actorVariant,
      gameId: game.id,
      healthMode: profile.healthMode,
      objectKinds: Array.from(new Set(objects.map((object) => object.kind))).sort(),
      playerVariants: players.map((player) => player.variant),
      primaryAction: profile.primaryAction,
      secondaryAction: profile.secondaryAction,
    };
  }

  function update(dt: number) {
    if (status === "finished") {
      emitIfNeeded(true);
      return;
    }

    elapsed += dt;
    messageTimer = Math.max(0, messageTimer - dt);
    if (messageTimer <= 0) {
      message = game.objective;
    }

    const timeLeft = Math.max(0, gameDuration[game.id] - elapsed);
    if (timeLeft <= 0) {
      finish(getWinnerText(players[0].score, players[1].score, sharedScore));
    }

    if (racingGames.has(game.id)) {
      updateRacing(dt);
    } else {
      updatePlayers(dt);
    }

    if (brawlerGames.has(game.id)) {
      updateBrawler(dt);
    } else if (sportGames.has(game.id)) {
      updateSport(dt);
    } else if (shooterGames.has(game.id)) {
      updateArena(dt);
    } else if (puzzleGames.has(game.id)) {
      updatePuzzle(dt);
    } else if (kitchenGames.has(game.id)) {
      updateKitchen(dt);
    } else if (game.id === "tower-defense-3d") {
      updateTower(dt);
    } else if (racingGames.has(game.id)) {
      updateRacingObjects(dt);
    } else if (miniPartyGames.has(game.id)) {
      updateMiniGames(dt);
    }

    updateObjects(dt);
    camera.position.x = 0;
    camera.lookAt(0, 0, 0);
    emitIfNeeded(false);
  }

  function updatePlayers(dt: number) {
    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      updatePlayerMovement(player, controls, dt, brawlerGames.has(game.id) ? 3.7 : 3.25, 5.35, 3.45);
    }
  }

  function updateBrawler(dt: number) {
    const [p1, p2] = players;
    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      const other = player.id === 1 ? p2 : p1;
      if (controls.action && player.cooldown <= 0) {
        player.cooldown = 0.55;
        addActionFlash(scene, player.group.position, player.id === 1 ? game.accent : game.secondaryAccent);
        if (distance(player, other) < 1.05) {
          const push = other.group.position.clone().sub(player.group.position).normalize().multiplyScalar(1.5);
          other.velocity.add(push);
          other.stun = 0.18;
          setMessage(`P${player.id} đẩy trúng!`);
          addImpactWave(scene, other.group.position, game.accent);
        } else {
          setMessage(`P${player.id} ra đòn hụt.`, 0.8);
        }
      }
      player.group.position.addScaledVector(player.velocity, dt);
      player.velocity.multiplyScalar(0.9);
    }

    for (const player of players) {
      if (Math.abs(player.group.position.x) > 5.75 || Math.abs(player.group.position.z) > 3.9) {
        const other = player.id === 1 ? p2 : p1;
        other.score += 1;
        resetPlayers(players);
        setMessage(`P${other.id} ghi điểm!`);
      }
    }
  }

  function updateSport(dt: number) {
    if (!ball) {
      return;
    }

    ball.mesh.position.addScaledVector(ball.velocity, dt);
    ball.velocity.multiplyScalar(0.985);
    if (Math.abs(ball.mesh.position.z) > 3.45) {
      ball.velocity.z *= -0.8;
      ball.mesh.position.z = clamp(ball.mesh.position.z, -3.45, 3.45);
    }

    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      const direction = ball.mesh.position.clone().sub(player.group.position);
      direction.y = 0;
      const dist = direction.length();
      if (dist < 0.72) {
        ball.velocity.add(direction.normalize().multiplyScalar(controls.action ? 5.4 : 1.8));
        if (controls.action) {
          player.cooldown = 0.3;
          addBallTrail(scene, ball.mesh.position, player.id === 1 ? game.accent : game.secondaryAccent);
          setMessage(`P${player.id} sút bóng!`, 1);
        }
      }
    }

    if (ball.mesh.position.x < -5.9 && Math.abs(ball.mesh.position.z) < 1.5) {
      players[1].score += 1;
      resetBall(ball);
      setMessage("P2 ghi bàn!");
    } else if (ball.mesh.position.x > 5.9 && Math.abs(ball.mesh.position.z) < 1.5) {
      players[0].score += 1;
      resetBall(ball);
      setMessage("P1 ghi bàn!");
    } else if (Math.abs(ball.mesh.position.x) > 5.55) {
      ball.velocity.x *= -0.8;
      ball.mesh.position.x = clamp(ball.mesh.position.x, -5.55, 5.55);
    }
  }

  function updateArena(dt: number) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 4.2;
      spawnPickup("heart", randomPoint(4.4, 2.8), "#f472b6", 18);
    }

    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      if (controls.action && player.cooldown <= 0) {
        shoot(player);
      }
    }
  }

  function updatePuzzle(_dt: number) {
    const p1OnPlate = nearPoint(players[0], new THREE.Vector3(-3.1, 0, 1.9), 0.82);
    const p2OnPlate = nearPoint(players[1], new THREE.Vector3(3.1, 0, 1.9), 0.82);
    gateOpen = p1OnPlate && p2OnPlate;
    const exitPoint = new THREE.Vector3(0, 0, -3.2);

    if (!gateOpen) {
      for (const player of players) {
        if (player.group.position.z < -0.72 && Math.abs(player.group.position.x) < 2.1) {
          player.group.position.z = -0.72;
        }
      }
      message = "Hai người cần đứng đúng hai nút màu.";
    } else {
      message = "Cổng đã mở, cùng về vùng sao xanh!";
    }

    if (gateOpen && nearPoint(players[0], exitPoint, 0.9) && nearPoint(players[1], exitPoint, 0.9)) {
      sharedScore += 1;
      level += 1;
      resetPlayers(players);
      setMessage(`Qua màn ${level - 1}! Màn ${level} bắt đầu.`, 3);
    }
  }

  function updateKitchen(_dt: number) {
    if (game.id === "fire-rescue-3d") {
      updateFireRescue();
      return;
    }

    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      if (!controls.action || player.cooldown > 0) {
        continue;
      }

      player.cooldown = 0.35;
      if (nearPoint(player, new THREE.Vector3(-4.2, 0, -2.5), 0.95)) {
        player.carrying = "rau";
        setMessage(`P${player.id} lấy rau.`);
      } else if (nearPoint(player, new THREE.Vector3(4.2, 0, -2.5), 0.95)) {
        player.carrying = "trai cay";
        setMessage(`P${player.id} lấy trái cây.`);
      } else if (nearPoint(player, new THREE.Vector3(0, 0, 0), 1.05) && player.carrying) {
        potVeg = potVeg || player.carrying === "rau";
        potFruit = potFruit || player.carrying === "trai cay";
        player.carrying = null;
        cookedReady = potVeg && potFruit;
        setMessage(cookedReady ? "Món đã nấu xong, mang ra bàn!" : "Còn thiếu một nguyên liệu.");
      } else if (nearPoint(player, new THREE.Vector3(0, 0, 3.1), 1.05) && cookedReady) {
        sharedScore += 1;
        potVeg = false;
        potFruit = false;
        cookedReady = false;
        setMessage(`Giao món thành công! Tổng ${sharedScore}`);
      }
    }
  }

  function updateFireRescue() {
    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      if (!controls.action || player.cooldown > 0) {
        continue;
      }

      player.cooldown = 0.42;
      const start = player.group.position.clone().setY(0.62);
      const target = objects.find((object) => object.kind === "fire" && object.mesh.position.distanceTo(player.group.position) < 1.8);
      const end = target
        ? target.mesh.position.clone().setY(0.45)
        : player.group.position.clone().add(player.facing.clone().multiplyScalar(1.35)).setY(0.45);
      addBeam(scene, start, end, "#38bdf8", 260, 0.035);

      if (target) {
        sharedScore += 1;
        removeSceneObject(objects, target, scene);
        setMessage(`P${player.id} dập tắt một đốm lửa!`);
        if (!objects.some((object) => object.kind === "fire")) {
          setupSignatureObjects();
          setMessage("Dập xong đợt lửa, đợt mới xuất hiện!", 1.4);
        }
      } else {
        setMessage(`P${player.id} phun nước, lại gần lửa hơn.`, 1);
      }
    }
  }

  function updateTower(dt: number) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.9, 2.8 - sharedScore * 0.05);
      spawnEnemy();
      if (Math.random() > 0.55) {
        spawnPickup("gem", randomPoint(4.7, 3), "#facc15", 1);
      }
    }

    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      if (controls.action && player.cooldown <= 0 && nearPoint(player, new THREE.Vector3(0, 0, 0), 1.15)) {
        if (resource >= 2) {
          resource -= 2;
          spawnTurret(player.group.position.clone().multiplyScalar(0.85), player.id);
          setMessage(`P${player.id} xây trụ kẹo!`);
        } else {
          setMessage("Cần 2 sao để xây trụ.");
        }
        player.cooldown = 0.45;
      }
    }

    for (const turret of objects.filter((object) => object.kind === "turret")) {
      turret.life -= dt;
      if (turret.life % 0.65 < dt) {
        const enemy = objects.find((object) => object.kind === "enemy" && turret.mesh.position.distanceTo(object.mesh.position) < 3.2);
        if (enemy) {
          enemy.value -= 1;
          addPulse(scene, enemy.mesh.position, "#fde047");
          addBeam(scene, turret.mesh.position.clone().setY(0.75), enemy.mesh.position.clone().setY(0.35), "#fde047", 160, 0.025);
          if (enemy.value <= 0) {
            sharedScore += 1;
            removeSceneObject(objects, enemy, scene);
          }
        }
      }
    }

    for (const enemy of objects.filter((object) => object.kind === "enemy")) {
      const direction = new THREE.Vector3(0, 0, 0).sub(enemy.mesh.position);
      direction.y = 0;
      enemy.mesh.position.addScaledVector(direction.normalize(), dt * 0.82);
      if (enemy.mesh.position.length() < 0.72) {
        baseHealth -= 12;
        removeSceneObject(objects, enemy, scene);
        setMessage(`Căn cứ còn ${Math.max(0, Math.round(baseHealth))}%`);
        if (baseHealth <= 0) {
          finish("Căn cứ bị slime chạm tới. Thử lại nào!");
        }
      }
    }
  }

  function updateRacing(dt: number) {
    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      player.raceSpeed = clamp(player.raceSpeed + (controls.z < 0 ? 2.4 : -1.6) * dt, 0.5, controls.action ? 7.2 : 5.2);
      if (controls.action && player.cooldown <= 0) {
        player.cooldown = 0.22;
        addBoostTrail(scene, player.group.position, player.id === 1 ? game.accent : game.secondaryAccent);
      }
      player.raceDistance += player.raceSpeed * dt;
      if (controls.x !== 0) {
        player.lane = clamp(player.lane + controls.x * dt * 2.6, -1.6, 1.6);
      }

      const trackLength = 22;
      if (player.raceDistance >= trackLength) {
        player.raceDistance -= trackLength;
        player.laps += 1;
        player.score = player.laps;
        setMessage(`P${player.id} hoàn thành vòng ${player.laps}/3`);
        if (player.laps >= 3) {
          finish(`P${player.id} thắng đường đua!`);
        }
      }

      const z = 3.2 - (player.raceDistance / trackLength) * 6.4;
      player.group.position.set(player.lane, 0, z);
      player.group.rotation.y = controls.x * -0.3;
    }
  }

  function updateRacingObjects(dt: number) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 2.6;
      spawnPickup("boost", new THREE.Vector3(randomRange(-1.8, 1.8), 0.25, randomRange(-2.8, 2.8)), "#38bdf8", 1);
    }
  }

  function updateMiniGames(dt: number) {
    spawnTimer -= dt;

    if (game.id === "tic-tac-toe-3d") {
      updateTicTacToe();
      return;
    }

    if (game.id === "memory-match-3d") {
      updateMemoryMatch();
      return;
    }

    if (game.id === "rock-paper-magic-3d") {
      updateRockPaperMagic(dt);
      return;
    }

    if (game.id === "ring-toss-3d") {
      updateRingToss();
      return;
    }

    if (spawnTimer <= 0) {
      if (game.id === "whack-mole-3d") {
        spawnTimer = 0.85;
        spawnPickup("mole", randomPoint(4.6, 3), "#a16207", 1);
      } else if (game.id === "falling-dodge-3d") {
        spawnTimer = 0.7;
        const isFalling = Math.random() > 0.45;
        spawnPickup(isFalling ? "falling" : "star", randomPoint(4.8, 3), isFalling ? "#94a3b8" : "#fde047", 1);
      } else if (game.id === "color-catch-3d") {
        spawnTimer = 0.75;
        const isP1 = Math.random() > 0.5;
        spawnPickup(isP1 ? "red-ball" : "blue-ball", randomPoint(4.8, 3), isP1 ? "#ef4444" : "#3b82f6", 1);
      } else {
        spawnTimer = game.id === "star-maze-3d" ? 0.55 : 0.8;
        spawnPickup(Math.random() > 0.25 ? "star" : "crate", randomPoint(4.8, 3), Math.random() > 0.25 ? "#fde047" : "#94a3b8", 1);
      }
    }

    for (const object of objects.filter((candidate) => ["crate", "falling", "mole"].includes(candidate.kind))) {
      object.mesh.rotation.x += dt * 2;
      object.mesh.rotation.z += dt * 1.2;
    }

    if (game.id === "whack-mole-3d") {
      for (const player of players) {
        const controls = input.getPlayerInput(player.id);
        if (!controls.action || player.cooldown > 0) {
          continue;
        }

        player.cooldown = 0.28;
        const mole = objects.find((object) => object.kind === "mole" && object.mesh.position.distanceTo(player.group.position) < 0.78);
        if (mole) {
          player.score += 1;
          addPulse(scene, mole.mesh.position, player.id === 1 ? game.accent : game.secondaryAccent);
          removeSceneObject(objects, mole, scene);
          setMessage(`P${player.id} đập trúng chuột đất!`, 1);
        }
      }
    }
  }

  function updateRingToss() {
    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      if (!controls.action || player.cooldown > 0) {
        continue;
      }

      player.cooldown = 0.7;
      const pegs = objects.filter((object) => object.kind === "ring-peg");
      const nearestPeg = pegs
        .map((peg) => ({
          distance: peg.mesh.position.distanceTo(player.group.position),
          peg,
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      const hit = Boolean(nearestPeg && nearestPeg.distance < 2.9);
      const landing = hit && nearestPeg
        ? nearestPeg.peg.mesh.position.clone().setY(0.5)
        : player.group.position.clone().add(player.facing.clone().multiplyScalar(2.1)).setY(0.34);

      spawnThrownRing(player, landing, hit, nearestPeg?.peg);
      setMessage(hit ? `P${player.id} đang ném vòng...` : `P${player.id} ném vòng hơi xa cọc.`, 0.9);
    }
  }

  function updateRockPaperMagic(dt: number) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 2.2;
      const p1 = input.getPlayerInput(1);
      const p2 = input.getPlayerInput(2);
      const p1Choice = p1.action ? "đá" : p1.alt ? "kéo" : "giấy";
      const p2Choice = p2.action ? "đá" : p2.alt ? "kéo" : "giấy";
      const result = compareMagicChoice(p1Choice, p2Choice);
      if (result === 1) {
        players[0].score += 1;
        setMessage(`P1 thắng vòng: ${p1Choice} thắng ${p2Choice}.`);
      } else if (result === 2) {
        players[1].score += 1;
        setMessage(`P2 thắng vòng: ${p2Choice} thắng ${p1Choice}.`);
      } else {
        sharedScore += 1;
        setMessage(`Hòa vòng phép thuật: cùng ${p1Choice}.`);
      }
      addPulse(scene, new THREE.Vector3(0, 0.05, 0), "#c084fc");
    }
  }

  function updateTicTacToe() {
    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      if (!controls.action || player.cooldown > 0) {
        continue;
      }

      player.cooldown = 0.35;
      const cell = objects.find(
        (object) => object.kind === "cell" && object.data.owner === 0 && object.mesh.position.distanceTo(player.group.position) < 0.85,
      );
      if (!cell) {
        continue;
      }

      cell.data.owner = player.id;
      if (cell.mesh instanceof THREE.Mesh) {
        cell.mesh.material = material(player.id === 1 ? game.accent : game.secondaryAccent);
      }
      setMessage(`P${player.id} chiếm một ô cờ.`, 1);

      if (hasTicTacToeLine(player.id)) {
        player.score += 1;
        resetTicTacToeBoard();
        setMessage(`P${player.id} tạo được hàng ba ô!`);
      }
    }
  }

  function hasTicTacToeLine(owner: 1 | 2) {
    const cellOwners = new Map<number, number>();
    for (const cell of objects.filter((object) => object.kind === "cell")) {
      const index = typeof cell.data.index === "number" ? cell.data.index : -1;
      const cellOwner = typeof cell.data.owner === "number" ? cell.data.owner : 0;
      cellOwners.set(index, cellOwner);
    }

    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    return lines.some((line) => line.every((index) => cellOwners.get(index) === owner));
  }

  function resetTicTacToeBoard() {
    for (const cell of objects.filter((object) => object.kind === "cell")) {
      cell.data.owner = 0;
      if (cell.mesh instanceof THREE.Mesh) {
        cell.mesh.material = material("#e2e8f0");
      }
    }
  }

  function updateMemoryMatch() {
    const revealed = objects.filter((object) => object.kind === "memory" && object.data.revealed === true);
    if (revealed.length >= 2) {
      const [first, second] = revealed;
      if (first.data.symbol === second.data.symbol) {
        sharedScore += 1;
        removeSceneObject(objects, first, scene);
        removeSceneObject(objects, second, scene);
        setMessage("Tìm được một cặp giống nhau!");
      } else {
        first.data.revealed = false;
        second.data.revealed = false;
        if (first.mesh instanceof THREE.Mesh) {
          first.mesh.material = material("#64748b");
        }
        if (second.mesh instanceof THREE.Mesh) {
          second.mesh.material = material("#64748b");
        }
        setMessage("Chưa đúng cặp, nhớ vị trí nhé.", 1.4);
      }
    }

    for (const player of players) {
      const controls = input.getPlayerInput(player.id);
      if (!controls.action || player.cooldown > 0) {
        continue;
      }

      player.cooldown = 0.42;
      const block = objects.find(
        (object) => object.kind === "memory" && object.data.revealed === false && object.mesh.position.distanceTo(player.group.position) < 0.82,
      );
      if (block) {
        block.data.revealed = true;
        if (block.mesh instanceof THREE.Mesh && typeof block.data.symbol === "string") {
          block.mesh.material = material(block.data.symbol);
        }
        setMessage(`P${player.id} lật một khối trí nhớ.`, 1);
      }
    }
  }

  function updateObjects(dt: number) {
    for (const player of players) {
      player.cooldown = Math.max(0, player.cooldown - dt);
      player.stun = Math.max(0, player.stun - dt);
      const bob = Math.sin((elapsed + player.id) * 6) * 0.035;
      player.bobTarget.position.y = player.bobBaseY + bob;
      if (player.healthBarFill) {
        const percent = clamp(player.health / 100, 0, 1);
        player.healthBarFill.scale.x = percent;
        player.healthBarFill.position.x = -0.31 * (1 - percent);
      }
    }

    if (baseHealthFill) {
      const percent = clamp(baseHealth / 100, 0, 1);
      baseHealthFill.scale.x = percent;
      baseHealthFill.position.x = -0.52 * (1 - percent);
    }

    for (const object of [...objects]) {
      object.life -= dt;
      object.mesh.position.addScaledVector(object.velocity, dt);

      if (object.kind === "thrown-ring") {
        const progress = clamp((Number(object.data.progress) || 0) + dt * 1.9, 0, 1);
        object.data.progress = progress;
        const start = new THREE.Vector3(Number(object.data.startX), Number(object.data.startY), Number(object.data.startZ));
        const end = new THREE.Vector3(Number(object.data.endX), Number(object.data.endY), Number(object.data.endZ));
        object.mesh.position.lerpVectors(start, end, progress);
        object.mesh.position.y += Math.sin(progress * Math.PI) * 0.8;
        object.mesh.rotation.x = Math.PI / 2 + progress * Math.PI * 2;
        object.mesh.rotation.z += dt * 8;

        if (progress >= 1) {
          if (object.data.hit === true) {
            const scorer = players.find((player) => player.id === object.owner);
            if (scorer) {
              scorer.score += 1;
            }
            const peg = objects.find((candidate) => candidate.kind === "ring-peg" && candidate.data.index === object.data.pegIndex);
            if (peg) {
              addPulse(scene, peg.mesh.position, object.owner === 1 ? game.accent : game.secondaryAccent);
              peg.mesh.position.copy(randomPoint(3.2, 2.3).setY(0));
            }
            setMessage(`P${object.owner} ném vòng trúng cọc!`, 1.2);
          } else {
            setMessage(`P${object.owner} ném hụt, lại gần cọc hơn.`, 1);
          }
          removeSceneObject(objects, object, scene);
        }
        continue;
      }

      if (object.kind === "projectile") {
        object.mesh.rotation.y += dt * 10;
        const target = players.find((player) => player.id !== object.owner);
        if (target && object.mesh.position.distanceTo(target.group.position) < 0.62) {
          target.health -= 22;
          addPulse(scene, target.group.position, "#38bdf8");
          removeSceneObject(objects, object, scene);
          if (target.health <= 0) {
            const shooter = players.find((player) => player.id === object.owner);
            if (shooter) {
              shooter.score += 1;
            }
            resetPlayers(players);
            setMessage(`P${object.owner} ghi điểm bằng bóng nước!`);
          }
          continue;
        }
      }

      if (["heart", "gem", "boost", "star", "crate", "falling", "red-ball", "blue-ball"].includes(object.kind)) {
        object.mesh.rotation.y += dt * 2.4;
        for (const player of players) {
          if (object.mesh.position.distanceTo(player.group.position) < 0.62) {
            if (object.kind === "heart") {
              player.health = Math.min(100, player.health + 24);
              setMessage(`P${player.id} hồi máu.`);
            } else if (object.kind === "gem") {
              resource += 1;
              setMessage(`P${player.id} nhặt sao xây trụ.`);
            } else if (object.kind === "boost") {
              player.raceSpeed = Math.min(7.5, player.raceSpeed + 1.8);
              setMessage(`P${player.id} tăng tốc!`);
            } else if (object.kind === "star") {
              player.score += 1;
              setMessage(`P${player.id} nhặt sao!`, 1);
            } else if (object.kind === "crate") {
              player.stun = 0.5;
              setMessage(`P${player.id} bị hộp quà cản đường.`, 1);
            } else if (object.kind === "falling") {
              player.health = Math.max(0, player.health - 14);
              player.stun = 0.45;
              setMessage(`P${player.id} né chưa kịp!`, 1);
            } else if (object.kind === "red-ball" || object.kind === "blue-ball") {
              const targetPlayer = object.kind === "red-ball" ? 1 : 2;
              if (player.id === targetPlayer) {
                player.score += 1;
                setMessage(`P${player.id} bắt đúng màu!`, 1);
              } else {
                player.stun = 0.35;
                setMessage(`P${player.id} bắt nhầm màu.`, 1);
              }
            }
            removeSceneObject(objects, object, scene);
            break;
          }
        }
      }

      if (object.life <= 0 || Math.abs(object.mesh.position.x) > 8 || Math.abs(object.mesh.position.z) > 6) {
        removeSceneObject(objects, object, scene);
      }
    }
  }

  function shoot(player: PlayerActor) {
    const projectile = createSphereObject(
      "projectile",
      player.group.position.clone().add(player.facing.clone().multiplyScalar(0.58)).setY(0.42),
      0.16,
      player.id === 1 ? game.accent : game.secondaryAccent,
      1.25,
    );
    projectile.owner = player.id;
    projectile.velocity.copy(player.facing).multiplyScalar(7.4);
    projectile.life = 1.3;
    objects.push(projectile);
    scene.add(projectile.mesh);
    player.cooldown = 0.38;
    addMuzzleFlash(scene, projectile.mesh.position, player.id === 1 ? game.accent : game.secondaryAccent);
    setMessage(`P${player.id} bắn bóng nước!`, 1);
  }

  function spawnThrownRing(player: PlayerActor, landing: THREE.Vector3, hit: boolean, peg?: SceneObject) {
    const start = player.group.position.clone().add(player.facing.clone().multiplyScalar(0.62)).setY(0.72);
    const thrownRing = createRingObject("thrown-ring", start, player.id === 1 ? game.accent : game.secondaryAccent, 1);
    thrownRing.owner = player.id;
    thrownRing.life = 1.2;
    thrownRing.data.startX = start.x;
    thrownRing.data.startY = start.y;
    thrownRing.data.startZ = start.z;
    thrownRing.data.endX = landing.x;
    thrownRing.data.endY = landing.y;
    thrownRing.data.endZ = landing.z;
    thrownRing.data.hit = hit;
    thrownRing.data.pegIndex = typeof peg?.data.index === "number" ? peg.data.index : -1;
    thrownRing.data.progress = 0;
    objects.push(thrownRing);
    scene.add(thrownRing.mesh);
  }

  function spawnPickup(kind: string, position: THREE.Vector3, color: string, value: number) {
    const radius = ["crate", "falling", "mole"].includes(kind) ? 0.24 : 0.18;
    const object = createSphereObject(kind, position.setY(0.28), radius, color, value);
    const lifeByKind: Record<string, number> = {
      boost: 5,
      crate: 4.5,
      falling: 3.2,
      gem: 6,
      heart: 6,
      mole: 2.2,
      "blue-ball": 4,
      "red-ball": 4,
      star: 4.5,
    };
    object.life = lifeByKind[kind] ?? 8;
    objects.push(object);
    scene.add(object.mesh);
  }

  function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const position = new THREE.Vector3(Math.cos(angle) * 5.4, 0.25, Math.sin(angle) * 3.7);
    const enemy = createSphereObject("enemy", position, 0.28, "#a3e635", 2 + Math.floor(sharedScore / 6));
    enemy.life = 90;
    objects.push(enemy);
    scene.add(enemy.mesh);
  }

  function spawnTurret(position: THREE.Vector3, owner: 1 | 2) {
    const turret = createBoxObject("turret", position.setY(0.36), new THREE.Vector3(0.36, 0.72, 0.36), owner === 1 ? game.accent : game.secondaryAccent, 20);
    turret.owner = owner;
    objects.push(turret);
    scene.add(turret.mesh);
  }

  function emitIfNeeded(force: boolean) {
    lastStatEmit += force ? 1 : 0.016;
    if (!force && lastStatEmit < 0.2) {
      return;
    }

    lastStatEmit = 0;
    publishDebugState();
    emitStats({
      p1Score: players[0].score,
      p2Score: players[1].score,
      p1Health: game.id === "tower-defense-3d" ? baseHealth : players[0].health,
      p2Health: players[1].health,
      sharedScore,
      timeLeft: Math.max(0, gameDuration[game.id] - elapsed),
      resource,
      status,
      message,
    });
  }

  function finish(nextMessage: string) {
    status = "finished";
    setMessage(nextMessage, 999);
  }

  return {
    update,
    dispose() {
      objects.splice(0, objects.length);
    },
  };
}

function setupWorld(scene: THREE.Scene, game: GameDefinition, theme: { floor: string; accent: string; secondary: string }) {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(racingGames.has(game.id) ? 5.2 : 12, 0.12, 8),
    material(theme.floor),
  );
  floor.receiveShadow = true;
  floor.position.y = -0.08;
  scene.add(floor);

  const ambient = new THREE.HemisphereLight("#ffffff", "#7dd3fc", 1.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#ffffff", 2.2);
  sun.position.set(-3, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  addWall(scene, new THREE.Vector3(0, 0.25, -4.08), new THREE.Vector3(12.1, 0.5, 0.18), theme.accent);
  addWall(scene, new THREE.Vector3(0, 0.25, 4.08), new THREE.Vector3(12.1, 0.5, 0.18), theme.secondary);
  addWall(scene, new THREE.Vector3(-6.08, 0.25, 0), new THREE.Vector3(0.18, 0.5, 8), theme.secondary);
  addWall(scene, new THREE.Vector3(6.08, 0.25, 0), new THREE.Vector3(0.18, 0.5, 8), theme.accent);

  if (brawlerGames.has(game.id)) {
    scene.children
      .filter((child) => child.name === "game-wall")
      .forEach((wall) => {
        wall.visible = false;
      });
  }

  for (let index = 0; index < 18; index += 1) {
    addDecoration(scene, randomPoint(5.4, 3.4), index % 2 === 0 ? theme.accent : theme.secondary);
  }
}

function createPlayer(id: 1 | 2, color: string, position: THREE.Vector3, variant: ActorVariant): PlayerActor {
  const group = new THREE.Group();
  group.position.copy(position);
  const trim = id === 1 ? "#f8fafc" : "#111827";
  let bobTarget: THREE.Object3D = group;
  let bobBaseY = 0;

  const addMesh = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const setBobTarget = (target: THREE.Object3D) => {
    bobTarget = target;
    bobBaseY = target.position.y;
  };

  if (variant === "racer") {
    const chassis = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.28, 1.08), material(color)));
    chassis.position.y = 0.24;
    const cabin = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.42), material(blendColor(color, "#ffffff", 0.32))));
    cabin.position.set(0, 0.5, -0.08);
    for (const x of [-0.42, 0.42]) {
      for (const z of [-0.34, 0.34]) {
        const wheel = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 12), material("#0f172a")));
        wheel.position.set(x, 0.16, z);
        wheel.rotation.z = Math.PI / 2;
      }
    }
    setBobTarget(cabin);
  } else if (variant === "hopper") {
    const spring = addMesh(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 18), material("#e5e7eb")));
    spring.position.y = 0.26;
    spring.rotation.x = Math.PI / 2;
    const body = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), material(color)));
    body.position.y = 0.62;
    const handle = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.12), material(trim)));
    handle.position.y = 0.98;
    setBobTarget(body);
  } else if (variant === "robot") {
    const body = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.42), material(color)));
    body.position.y = 0.36;
    const head = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.38), material(blendColor(color, "#ffffff", 0.22))));
    head.position.y = 0.85;
    const antenna = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 8), material("#facc15")));
    antenna.position.y = 1.15;
    setBobTarget(head);
  } else if (variant === "board-token") {
    const token = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 20), material(color)));
    token.position.y = 0.18;
    const mark = addMesh(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 20), material(trim)));
    mark.position.y = 0.34;
    mark.rotation.x = Math.PI / 2;
    setBobTarget(mark);
  } else {
    const bodyShape = variant === "sport" || variant === "party" ? new THREE.SphereGeometry(0.36, 14, 10) : new THREE.CylinderGeometry(0.3, 0.36, 0.66, 8);
    const body = addMesh(new THREE.Mesh(bodyShape, material(color)));
    body.position.y = variant === "sport" || variant === "party" ? 0.42 : 0.36;
    const head = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), material(blendColor(color, "#ffffff", 0.25))));
    head.position.y = 0.83;
    setBobTarget(head);

    if (variant === "brawler") {
      for (const x of [-0.44, 0.44]) {
        const glove = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), material("#f97316")));
        glove.position.set(x, 0.48, 0.06);
      }
    } else if (variant === "sport") {
      const foot = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), material(trim)));
      foot.position.set(0, 0.09, 0.28);
    } else if (variant === "shooter") {
      const tank = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 12), material("#38bdf8")));
      tank.position.set(0, 0.52, -0.32);
      const nozzle = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.42), material("#bae6fd")));
      nozzle.position.set(0, 0.56, 0.42);
    } else if (variant === "chef") {
      const hat = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.24, 12), material("#f8fafc")));
      hat.position.y = 1.12;
      const apron = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.04), material("#f8fafc")));
      apron.position.set(0, 0.42, 0.32);
    } else if (variant === "defender") {
      const shield = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 18), material("#fde047")));
      shield.position.set(0.38, 0.48, 0.08);
      shield.rotation.z = Math.PI / 2;
    } else if (variant === "builder") {
      const helmet = addMesh(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), material("#facc15")));
      helmet.position.y = 1.02;
      const plank = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.68), material("#a16207")));
      plank.position.set(-0.38, 0.48, 0);
    } else if (variant === "firefighter") {
      const helmet = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.14, 14), material("#ef4444")));
      helmet.position.y = 1.04;
      const hose = addMesh(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 18), material("#38bdf8")));
      hose.position.set(-0.34, 0.46, 0);
      hose.rotation.y = Math.PI / 2;
    } else if (variant === "magician") {
      const hat = addMesh(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.46, 14), material("#7c3aed")));
      hat.position.y = 1.18;
      const wand = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.58, 8), material("#f8fafc")));
      wand.position.set(0.42, 0.57, 0.04);
      wand.rotation.z = 0.75;
    } else if (variant === "ring-thrower") {
      const ring = addMesh(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 22), material("#fde047")));
      ring.position.set(0.42, 0.52, 0.08);
      ring.rotation.x = Math.PI / 2;
    } else if (variant === "explorer") {
      const hat = addMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.13, 14), material("#a16207")));
      hat.position.y = 1.05;
      const backpack = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.16), material("#0f766e")));
      backpack.position.set(0, 0.5, -0.34);
    } else {
      const starHat = addMesh(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 5), material("#facc15")));
      starHat.position.y = 1.13;
      starHat.rotation.y = Math.PI / 5;
    }

    const nose = addMesh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), material("#17343b")));
    nose.position.set(0, 0.84, 0.27);
  }

  return {
    id,
    group,
    variant,
    bobTarget,
    bobBaseY,
    velocity: new THREE.Vector3(),
    facing: new THREE.Vector3(0, 0, id === 1 ? -1 : 1),
    score: 0,
    health: 100,
    cooldown: 0,
    stun: 0,
    carrying: null,
    resource: 0,
    raceDistance: 0,
    raceSpeed: 0.8,
    lane: id === 1 ? -1 : 1,
    laps: 0,
  };
}

function updatePlayerMovement(player: PlayerActor, controls: PlayerInput, dt: number, speed: number, maxX: number, maxZ: number) {
  if (player.stun > 0) {
    player.group.position.addScaledVector(player.velocity, dt);
    player.velocity.multiplyScalar(0.86);
  } else {
    const direction = new THREE.Vector3(controls.x, 0, controls.z);
    if (direction.lengthSq() > 0.001) {
      direction.normalize();
      player.facing.copy(direction);
      player.group.position.addScaledVector(direction, speed * dt);
      player.group.rotation.y = Math.atan2(direction.x, direction.z);
    }
  }

  player.group.position.x = clamp(player.group.position.x, -maxX, maxX);
  player.group.position.z = clamp(player.group.position.z, -maxZ, maxZ);
}

function resetPlayers(players: [PlayerActor, PlayerActor]) {
  players[0].group.position.set(-2.1, 0, 0.8);
  players[1].group.position.set(2.1, 0, 0.8);
  for (const player of players) {
    player.health = 100;
    player.velocity.set(0, 0, 0);
    player.stun = 0;
    player.cooldown = 0;
    player.carrying = null;
  }
}

function createBall(position: THREE.Vector3): SceneObject {
  return createSphereObject("ball", position, 0.28, "#ffffff", 0);
}

function resetBall(ball: SceneObject) {
  ball.mesh.position.set(0, 0.24, 0);
  ball.velocity.set(0, 0, 0);
}

function createSphereObject(kind: string, position: THREE.Vector3, radius: number, color: string, value: number): SceneObject {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material(color));
  mesh.position.copy(position);
  mesh.castShadow = true;
  return { mesh, kind, velocity: new THREE.Vector3(), life: 999, value, data: {} };
}

function createBoxObject(kind: string, position: THREE.Vector3, size: THREE.Vector3, color: string, value: number): SceneObject {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material(color));
  mesh.position.copy(position);
  mesh.castShadow = true;
  return { mesh, kind, velocity: new THREE.Vector3(), life: 999, value, data: {} };
}

function createRingObject(kind: string, position: THREE.Vector3, color: string, value: number): SceneObject {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 8, 28), material(color));
  mesh.position.copy(position);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  return { mesh, kind, velocity: new THREE.Vector3(), life: 999, value, data: {} };
}

function createPegObject(kind: string, position: THREE.Vector3, color: string, value: number): SceneObject {
  const group = new THREE.Group();
  group.position.copy(position);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.1, 18), material("#fef3c7"));
  base.position.y = 0.05;
  base.castShadow = true;
  group.add(base);

  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.78, 14), material(color));
  peg.position.y = 0.46;
  peg.castShadow = true;
  group.add(peg);

  const top = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), material("#f97316"));
  top.position.y = 0.9;
  top.castShadow = true;
  group.add(top);

  return { mesh: group, kind, velocity: new THREE.Vector3(), life: 999, value, data: {} };
}

function createTeddyObject(position: THREE.Vector3, color: string): SceneObject {
  const group = new THREE.Group();
  group.position.copy(position);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), material(color));
  body.position.y = 0.4;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), material(blendColor(color, "#ffffff", 0.18)));
  head.position.y = 0.82;
  for (const x of [-0.2, 0.2]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), material(color));
    ear.position.set(x, 1.02, 0);
    group.add(ear);
  }
  body.castShadow = true;
  head.castShadow = true;
  group.add(body, head);
  return { mesh: group, kind: "teddy", velocity: new THREE.Vector3(), life: 999, value: 1, data: {} };
}

function createFireObject(position: THREE.Vector3): SceneObject {
  const group = new THREE.Group();
  group.position.copy(position);
  const base = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.66, 7), material("#ef4444"));
  base.position.y = 0.33;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.44, 7), material("#facc15"));
  core.position.y = 0.42;
  base.castShadow = true;
  core.castShadow = true;
  group.add(base, core);
  return { mesh: group, kind: "fire", velocity: new THREE.Vector3(), life: 999, value: 1, data: {} };
}

function createChestObject(position: THREE.Vector3, color: string): SceneObject {
  const group = new THREE.Group();
  group.position.copy(position);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.42, 0.46), material("#a16207"));
  box.position.y = 0.24;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.52), material(color));
  lid.position.y = 0.58;
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.05), material("#f8fafc"));
  lock.position.set(0, 0.45, 0.27);
  box.castShadow = true;
  lid.castShadow = true;
  group.add(box, lid, lock);
  return { mesh: group, kind: "treasure-chest", velocity: new THREE.Vector3(), life: 999, value: 1, data: {} };
}

function createHoleObject(position: THREE.Vector3): SceneObject {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.04, 18), material("#7c2d12"));
  mesh.position.copy(position.setY(0.02));
  return { mesh, kind: "mole-hole", velocity: new THREE.Vector3(), life: 999, value: 1, data: {} };
}

function createMagicProp(kind: string, position: THREE.Vector3, color: string): SceneObject {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), material(color));
  mesh.position.copy(position);
  mesh.castShadow = true;
  return { mesh, kind, velocity: new THREE.Vector3(), life: 999, value: 1, data: {} };
}

function createBasketObject(position: THREE.Vector3, color: string): SceneObject {
  const group = new THREE.Group();
  group.position.copy(position);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.36, 16, 1, true), material(blendColor(color, "#ffffff", 0.18)));
  basket.position.y = 0.18;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 20), material(color));
  rim.position.y = 0.38;
  rim.rotation.x = Math.PI / 2;
  basket.castShadow = true;
  rim.castShadow = true;
  group.add(basket, rim);
  return { mesh: group, kind: "color-basket", velocity: new THREE.Vector3(), life: 999, value: 1, data: {} };
}

function addWall(scene: THREE.Scene, position: THREE.Vector3, size: THREE.Vector3, color: string) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material(blendColor(color, "#ffffff", 0.4)));
  wall.name = "game-wall";
  wall.position.copy(position);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

function addGoal(scene: THREE.Scene, x: number, color: string) {
  const postA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), material(color));
  const postB = postA.clone();
  postA.position.set(x, 0.55, -1.4);
  postB.position.set(x, 0.55, 1.4);
  scene.add(postA, postB);
}

function addPlate(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 18), material(color));
  plate.position.copy(position);
  scene.add(plate);
}

function addGate(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const gate = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 0.16), material(color));
  gate.position.copy(position);
  scene.add(gate);
}

function addExit(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const exit = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 8, 24), material(color));
  exit.position.copy(position);
  exit.rotation.x = Math.PI / 2;
  scene.add(exit);
}

function addStation(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.8), material(color));
  counter.position.copy(position);
  counter.castShadow = true;
  scene.add(counter);
}

function addBase(scene: THREE.Scene, color: string) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 0.7, 12), material(color));
  base.position.y = 0.35;
  base.castShadow = true;
  scene.add(base);
}

function attachPlayerHealthBars(players: [PlayerActor, PlayerActor]) {
  for (const player of players) {
    const group = new THREE.Group();
    group.position.set(0, 1.22, 0);

    const background = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.06), material("#111827"));
    const fill = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.07), material(player.id === 1 ? "#22c55e" : "#38bdf8"));
    fill.position.z = 0.02;
    group.add(background, fill);
    player.group.add(group);
    player.healthBarFill = fill;
  }
}

function addBaseHealthBar(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.position.set(0, 1.14, 0);
  const background = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.08), material("#111827"));
  const fill = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.09, 0.09), material("#22c55e"));
  fill.position.z = 0.02;
  group.add(background, fill);
  scene.add(group);
  return fill;
}

function addTrack(scene: THREE.Scene) {
  for (let i = -3; i <= 3; i += 1) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.7), material("#f8fafc"));
    marker.position.set(0, 0.03, i);
    marker.receiveShadow = true;
    scene.add(marker);
  }
}

function addDecoration(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const deco = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 5), material(blendColor(color, "#ffffff", 0.2)));
  deco.position.copy(position.setY(0.1));
  deco.rotation.y = Math.random() * Math.PI;
  scene.add(deco);
}

function addPulse(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 18), material(color));
  pulse.position.copy(position.clone().setY(0.05));
  pulse.rotation.x = Math.PI / 2;
  scene.add(pulse);
  window.setTimeout(() => {
    scene.remove(pulse);
    disposeObject(pulse);
  }, 180);
}

function addActionFlash(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const flash = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 24), material(color));
  flash.position.copy(position.clone().setY(0.08));
  flash.rotation.x = Math.PI / 2;
  scene.add(flash);
  removeEffectLater(scene, flash, 180);
}

function addImpactWave(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const wave = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 8, 28), material(color));
  wave.position.copy(position.clone().setY(0.1));
  wave.rotation.x = Math.PI / 2;
  scene.add(wave);
  removeEffectLater(scene, wave, 220);
}

function addBallTrail(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  for (let index = 0; index < 3; index += 1) {
    const trail = new THREE.Mesh(new THREE.SphereGeometry(0.09 - index * 0.018, 8, 6), material(blendColor(color, "#ffffff", index * 0.18)));
    trail.position.copy(position.clone().add(new THREE.Vector3((index - 1) * 0.12, 0.08, 0.18 + index * 0.08)));
    scene.add(trail);
    removeEffectLater(scene, trail, 180 + index * 80);
  }
}

function addMuzzleFlash(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), material(blendColor(color, "#ffffff", 0.35)));
  flash.position.copy(position);
  scene.add(flash);
  removeEffectLater(scene, flash, 130);
}

function addBoostTrail(scene: THREE.Scene, position: THREE.Vector3, color: string) {
  const trail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 8), material(color));
  trail.position.copy(position.clone().add(new THREE.Vector3(0, 0.18, 0.52)));
  trail.rotation.x = Math.PI / 2;
  scene.add(trail);
  removeEffectLater(scene, trail, 170);
}

function addBeam(scene: THREE.Scene, start: THREE.Vector3, end: THREE.Vector3, color: string, duration = 180, radius = 0.03) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.01) {
    return;
  }

  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material(color));
  beam.position.copy(start.clone().add(end).multiplyScalar(0.5));
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  scene.add(beam);
  removeEffectLater(scene, beam, duration);
}

function removeEffectLater(scene: THREE.Scene, effect: THREE.Object3D, duration: number) {
  window.setTimeout(() => {
    scene.remove(effect);
    disposeObject(effect);
  }, duration);
}

function removeSceneObject(objects: SceneObject[], object: SceneObject, scene: THREE.Scene) {
  const index = objects.indexOf(object);
  if (index >= 0) {
    objects.splice(index, 1);
  }
  scene.remove(object.mesh);
  disposeObject(object.mesh);
}

function distance(a: PlayerActor, b: PlayerActor) {
  return a.group.position.distanceTo(b.group.position);
}

function nearPoint(player: PlayerActor, point: THREE.Vector3, radius: number) {
  return player.group.position.distanceTo(point) <= radius;
}

function randomPoint(maxX: number, maxZ: number) {
  return new THREE.Vector3(randomRange(-maxX, maxX), 0, randomRange(-maxZ, maxZ));
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function compareMagicChoice(choiceA: string, choiceB: string) {
  if (choiceA === choiceB) {
    return 0;
  }

  const winMap: Record<string, string> = {
    "đá": "kéo",
    "kéo": "giấy",
    "giấy": "đá",
  };

  return winMap[choiceA] === choiceB ? 1 : 2;
}

function getStatusLabel(status: RuntimeStats["status"]) {
  const labels: Record<RuntimeStats["status"], string> = {
    ready: "Sẵn sàng",
    playing: "Đang chơi",
    paused: "Tạm dừng",
    finished: "Kết thúc",
  };

  return labels[status];
}

function getPlayerStatusLabel(profile: GameplayProfile, player: 1 | 2, health: number) {
  if (profile.healthMode === "players") {
    return `Máu ${Math.max(0, Math.round(health))}%`;
  }

  if (profile.healthMode === "base") {
    return player === 1 ? `Căn cứ ${Math.max(0, Math.round(health))}%` : "Hỗ trợ";
  }

  return "Điểm";
}

function getWinnerText(p1: number, p2: number, shared: number) {
  if (shared > 0 && p1 === p2) {
    return `Hoàn thành ${shared} mục tiêu chung!`;
  }
  if (p1 === p2) {
    return "Hòa điểm, chơi lại thêm một trận!";
  }
  return p1 > p2 ? "P1 chiến thắng!" : "P2 chiến thắng!";
}

function material(color: string) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.03,
    flatShading: true,
  });
}

function blendColor(colorA: string, colorB: string, amount: number) {
  const a = new THREE.Color(colorA);
  const b = new THREE.Color(colorB);
  return `#${a.lerp(b, amount).getHexString()}`;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((entry) => entry.dispose());
    } else {
      child.material.dispose();
    }
  });
}

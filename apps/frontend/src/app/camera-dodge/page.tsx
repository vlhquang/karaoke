"use client";

import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import Link from "next/link";
import { Camera, Play, RotateCcw, ShieldAlert } from "lucide-react";

type GameStatus = "idle" | "ready" | "playing" | "result";
type ItemKind = "hazard" | "food" | "drink";
type PoseStatus = "idle" | "loading" | "ready" | "tracking" | "lost" | "error";

interface FallingItem {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  speed: number;
  radius: number;
}

interface GameState {
  status: GameStatus;
  energy: number;
  energyPulse: number;
  playerHitPulse: number;
  playerX: number;
  targetX: number;
  survivedMs: number;
  startedAt: number;
  lastSpawnAt: number;
  items: FallingItem[];
  feedbacks: EnergyFeedback[];
}

interface EnergyFeedback {
  id: string;
  x: number;
  y: number;
  amount: number;
  kind: "damage" | "gain";
  createdAt: number;
}

const initialGameState = (): GameState => ({
  status: "idle",
  energy: 100,
  energyPulse: 0,
  playerHitPulse: 0,
  playerX: 0.5,
  targetX: 0.5,
  survivedMs: 0,
  startedAt: 0,
  lastSpawnAt: 0,
  items: [],
  feedbacks: []
});

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const posePointIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26];
const poseConnections: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26]
];

const createItem = (elapsedMs: number): FallingItem => {
  const difficulty = Math.min(1, elapsedMs / 90_000);
  const roll = Math.random();
  const kind: ItemKind = roll < 0.7 + difficulty * 0.12 ? "hazard" : roll < 0.86 ? "food" : "drink";
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    x: 0.08 + Math.random() * 0.84,
    y: -0.08,
    speed: 0.18 + Math.random() * 0.12 + difficulty * 0.16,
    radius: kind === "hazard" ? 0.045 : 0.038
  };
};

const drawRock = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#78716c";
  ctx.strokeStyle = "#292524";
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.8, -radius * 0.2);
  ctx.lineTo(-radius * 0.45, -radius * 0.78);
  ctx.lineTo(radius * 0.18, -radius * 0.92);
  ctx.lineTo(radius * 0.86, -radius * 0.36);
  ctx.lineTo(radius * 0.68, radius * 0.48);
  ctx.lineTo(-radius * 0.12, radius * 0.86);
  ctx.lineTo(-radius * 0.9, radius * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.18, -radius * 0.32, radius * 0.22, radius * 0.1, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawBurger = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#3f220d";
  ctx.lineWidth = Math.max(2, radius * 0.1);
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.ellipse(0, -radius * 0.32, radius * 0.86, radius * 0.38, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(-radius * 0.78, -radius * 0.1, radius * 1.56, radius * 0.18);
  ctx.fillStyle = "#a16207";
  ctx.fillRect(-radius * 0.72, radius * 0.06, radius * 1.44, radius * 0.24);
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.36, radius * 0.82, radius * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff7ed";
  for (const seedX of [-0.34, 0.05, 0.38]) {
    ctx.beginPath();
    ctx.ellipse(radius * seedX, -radius * 0.46, radius * 0.06, radius * 0.025, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawWater = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#075985";
  ctx.lineWidth = Math.max(2, radius * 0.1);
  ctx.fillStyle = "#7dd3fc";
  ctx.beginPath();
  ctx.roundRect(-radius * 0.42, -radius * 0.72, radius * 0.84, radius * 1.48, radius * 0.18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0ea5e9";
  ctx.fillRect(-radius * 0.34, -radius * 0.12, radius * 0.68, radius * 0.54);
  ctx.fillStyle = "#e0f2fe";
  ctx.beginPath();
  ctx.roundRect(-radius * 0.24, -radius * 0.95, radius * 0.48, radius * 0.26, radius * 0.06);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#082f49";
  ctx.font = `900 ${Math.max(10, radius * 0.3)}px Avenir Next, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("H2O", 0, radius * 0.16);
  ctx.restore();
};

const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(34, 211, 238, 0.16)";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0e7490";
  ctx.lineWidth = Math.max(3, radius * 0.12);
  ctx.fillStyle = "#22d3ee";
  ctx.beginPath();
  ctx.roundRect(-radius * 0.58, -radius * 0.06, radius * 1.16, radius * 0.98, radius * 0.22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fed7aa";
  ctx.beginPath();
  ctx.arc(0, -radius * 0.56, radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#172554";
  ctx.beginPath();
  ctx.arc(-radius * 0.14, -radius * 0.6, radius * 0.04, 0, Math.PI * 2);
  ctx.arc(radius * 0.14, -radius * 0.6, radius * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#172554";
  ctx.lineWidth = Math.max(2, radius * 0.04);
  ctx.beginPath();
  ctx.arc(0, -radius * 0.5, radius * 0.15, 0.1, Math.PI - 0.1);
  ctx.stroke();
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = Math.max(5, radius * 0.12);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.58, radius * 0.12);
  ctx.lineTo(-radius * 0.98, radius * 0.5);
  ctx.moveTo(radius * 0.58, radius * 0.12);
  ctx.lineTo(radius * 0.98, radius * 0.5);
  ctx.stroke();
  ctx.restore();
};

const formatGameTime = (survivedMs: number) => {
  const seconds = Math.floor(survivedMs / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

function drawGame(canvas: HTMLCanvasElement, state: GameState) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#07111f");
  bg.addColorStop(0.52, "#10251f");
  bg.addColorStop(1, "#05070d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (state.energyPulse > 0) {
    const isDamage = state.playerHitPulse > 0;
    ctx.strokeStyle = isDamage
      ? `rgba(251, 113, 133, ${0.18 + state.energyPulse * 0.55})`
      : `rgba(190, 242, 100, ${0.18 + state.energyPulse * 0.42})`;
    ctx.lineWidth = 8 + state.energyPulse * 10;
    ctx.strokeRect(4, 4, width - 8, height - 8);
  }

  ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
  for (let i = 0; i < 7; i += 1) {
    const x = ((i + 1) / 8) * width;
    ctx.fillRect(x, 0, 1, height);
  }

  const hudX = 22;
  const hudY = 20;
  const hudWidth = Math.min(420, width - 44);
  ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudWidth, 74, 12);
  ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "800 15px Avenir Next, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Năng lượng", hudX + 18, hudY + 28);
  ctx.fillStyle = "#bef264";
  ctx.font = "900 24px Avenir Next, sans-serif";
  ctx.fillText(`${Math.round(state.energy)}%`, hudX + 128, hudY + 31);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.roundRect(hudX + 18, hudY + 44, hudWidth - 36, 12, 6);
  ctx.fill();
  ctx.fillStyle = state.energy > 35 ? "#bef264" : "#fb7185";
  ctx.beginPath();
  ctx.roundRect(hudX + 18, hudY + 44, (hudWidth - 36) * (state.energy / 100), 12, 6);
  ctx.fill();

  const timeText = formatGameTime(state.survivedMs);
  ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
  ctx.beginPath();
  ctx.roundRect(width - 176, hudY, 154, 58, 12);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "700 13px Avenir Next, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Thời gian", width - 158, hudY + 22);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 27px Avenir Next, sans-serif";
  ctx.fillText(timeText, width - 158, hudY + 48);

  for (const item of state.items) {
    const x = item.x * width;
    const y = item.y * height;
    const radius = item.radius * Math.min(width, height);
    if (item.kind === "hazard") drawRock(ctx, x, y, radius);
    if (item.kind === "food") drawBurger(ctx, x, y, radius);
    if (item.kind === "drink") drawWater(ctx, x, y, radius);
  }

  const playerY = height * 0.86;
  const playerX = state.playerX * width;
  const playerRadius = Math.min(width, height) * 0.07;
  const shake = state.playerHitPulse > 0 ? Math.sin(Date.now() / 28) * state.playerHitPulse * 12 : 0;
  drawPlayer(ctx, playerX + shake, playerY, playerRadius);

  for (const feedback of state.feedbacks) {
    const age = Date.now() - feedback.createdAt;
    const progress = clamp(age / 900);
    const alpha = 1 - progress;
    const y = feedback.y * height - progress * 72;
    const x = feedback.x * width;
    const text = `${feedback.amount > 0 ? "+" : ""}${feedback.amount}`;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = feedback.kind === "damage" ? "#fb7185" : "#bef264";
    ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
    ctx.lineWidth = 6;
    ctx.font = `900 ${28 + (1 - progress) * 8}px Avenir Next, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  if (state.status !== "playing") {
    ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 30px Avenir Next, sans-serif";
    ctx.textAlign = "center";
    const label = state.status === "result" ? "Hết năng lượng" : "Bật camera và bắt đầu";
    ctx.fillText(label, width / 2, height / 2 - 42);
    ctx.font = "600 16px Avenir Next, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("Di chuyển cơ thể sang trái/phải để điều khiển.", width / 2, height / 2 - 10);
  }
}

const landmarkVisibility = (landmark?: NormalizedLandmark): number => landmark?.visibility ?? 1;

const drawPoseOverlay = (ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], width: number, height: number) => {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(190, 242, 100, 0.85)";
  for (const [from, to] of poseConnections) {
    const a = landmarks[from];
    const b = landmarks[to];
    if (!a || !b || landmarkVisibility(a) < 0.35 || landmarkVisibility(b) < 0.35) continue;
    ctx.beginPath();
    ctx.moveTo((1 - a.x) * width, a.y * height);
    ctx.lineTo((1 - b.x) * width, b.y * height);
    ctx.stroke();
  }
  for (const index of posePointIndices) {
    const landmark = landmarks[index];
    if (!landmark || landmarkVisibility(landmark) < 0.35) continue;
    ctx.fillStyle = index === 0 ? "#fbbf24" : "#22d3ee";
    ctx.beginPath();
    ctx.arc((1 - landmark.x) * width, landmark.y * height, index === 0 ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const getPoseBodyX = (landmarks: NormalizedLandmark[]): { bodyX: number; confidence: number } | null => {
  const coreIndices = [11, 12, 23, 24];
  const core = coreIndices
    .map((index) => landmarks[index])
    .filter((landmark): landmark is NormalizedLandmark => Boolean(landmark) && landmarkVisibility(landmark) >= 0.35);
  const points = core.length >= 2 ? core : [landmarks[0]].filter((landmark): landmark is NormalizedLandmark => Boolean(landmark));
  if (points.length === 0) return null;
  const confidence = points.reduce((sum, landmark) => sum + landmarkVisibility(landmark), 0) / points.length;
  const rawX = points.reduce((sum, landmark) => sum + landmark.x, 0) / points.length;
  return { bodyX: clamp(1 - rawX), confidence: clamp(confidence) };
};

export default function CameraDodgePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const poseLoadPromiseRef = useRef<Promise<void> | null>(null);
  const lastPoseDetectAtRef = useRef(0);
  const lastPoseSeenAtRef = useRef(0);
  const lastPoseBodyXRef = useRef(0.5);
  const poseCenterRef = useRef(0.5);
  const poseSensitivityRef = useRef(2.4);
  const streamRef = useRef<MediaStream | null>(null);
  const gameRef = useRef<GameState>(initialGameState());
  const [game, setGame] = useState<GameState>(gameRef.current);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [trackingX, setTrackingX] = useState(0.5);
  const [motionLevel, setMotionLevel] = useState(0);
  const [poseStatus, setPoseStatus] = useState<PoseStatus>("idle");
  const [poseError, setPoseError] = useState("");
  const [poseCenter, setPoseCenter] = useState(0.5);
  const [poseSensitivity, setPoseSensitivity] = useState(2.4);

  const updateGame = (patch: Partial<GameState>) => {
    gameRef.current = { ...gameRef.current, ...patch };
    setGame(gameRef.current);
  };

  const loadPoseLandmarker = async () => {
    if (poseLandmarkerRef.current) return;
    if (poseLoadPromiseRef.current) return poseLoadPromiseRef.current;

    setPoseStatus("loading");
    setPoseError("");
    poseLoadPromiseRef.current = (async () => {
      const { FilesetResolver, PoseLandmarker: PoseLandmarkerTask } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
      );
      const createWithDelegate = (delegate: "GPU" | "CPU") =>
        PoseLandmarkerTask.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
            delegate
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45
        });

      try {
        poseLandmarkerRef.current = await createWithDelegate("GPU");
      } catch {
        poseLandmarkerRef.current = await createWithDelegate("CPU");
      }
      setPoseStatus("ready");
    })().catch((error) => {
      poseLoadPromiseRef.current = null;
      setPoseStatus("error");
      setPoseError(error instanceof Error ? error.message : "Không tải được pose model.");
    });
    return poseLoadPromiseRef.current;
  };

  const enableCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      void loadPoseLandmarker();
      setCameraReady(true);
      updateGame({ status: gameRef.current.status === "idle" ? "ready" : gameRef.current.status });
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Không bật được camera.");
    }
  };

  const centerPoseTracking = () => {
    poseCenterRef.current = lastPoseBodyXRef.current;
    setPoseCenter(poseCenterRef.current);
    setMotionLevel(0);
    setTrackingX(0.5);
    gameRef.current.targetX = 0.5;
  };

  const startGame = () => {
    const next = initialGameState();
    next.status = "playing";
    next.startedAt = performance.now();
    next.lastSpawnAt = performance.now();
    next.playerX = gameRef.current.playerX;
    next.targetX = gameRef.current.targetX;
    gameRef.current = next;
    setGame(next);
  };

  useEffect(() => {
    const trackPose = () => {
      const video = videoRef.current;
      const trackingCanvas = trackingCanvasRef.current;
      if (!video || !trackingCanvas || video.readyState < 2) {
        requestAnimationFrame(trackPose);
        return;
      }
      const ctx = trackingCanvas.getContext("2d");
      if (!ctx) {
        requestAnimationFrame(trackPose);
        return;
      }
      const width = 160;
      const height = 120;
      trackingCanvas.width = width;
      trackingCanvas.height = height;
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -width, 0, width, height);
      ctx.restore();

      const poseLandmarker = poseLandmarkerRef.current;
      if (poseLandmarker && performance.now() - lastPoseDetectAtRef.current > 66) {
        let poseTracked = false;
        try {
          lastPoseDetectAtRef.current = performance.now();
          const result = poseLandmarker.detectForVideo(video, lastPoseDetectAtRef.current);
          const landmarks = result.landmarks[0];
          if (landmarks) {
            drawPoseOverlay(ctx, landmarks, width, height);
            const poseBody = getPoseBodyX(landmarks);
            if (poseBody && poseBody.confidence >= 0.35) {
              poseTracked = true;
              const rawBodyX = poseBody.bodyX;
              const mappedBodyX = clamp(0.5 + (rawBodyX - poseCenterRef.current) * poseSensitivityRef.current);
              lastPoseSeenAtRef.current = performance.now();
              lastPoseBodyXRef.current = rawBodyX;
              setPoseStatus("tracking");
              setTrackingX(mappedBodyX);
              setMotionLevel(poseBody.confidence);
              gameRef.current.targetX = clamp(gameRef.current.targetX * 0.45 + mappedBodyX * 0.55);
              ctx.strokeStyle = "#bef264";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(rawBodyX * width, 0);
              ctx.lineTo(rawBodyX * width, height);
              ctx.stroke();
              ctx.strokeStyle = "#38bdf8";
              ctx.beginPath();
              ctx.moveTo(mappedBodyX * width, 0);
              ctx.lineTo(mappedBodyX * width, height);
              ctx.stroke();
            }
          }
          if (!poseTracked && performance.now() - lastPoseSeenAtRef.current > 900) {
            setPoseStatus("lost");
            setMotionLevel(0);
          }
        } catch (error) {
          setPoseStatus("error");
          setPoseError(error instanceof Error ? error.message : "Pose detection lỗi.");
        }
      }
      requestAnimationFrame(trackPose);
    };
    const frame = requestAnimationFrame(trackPose);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const state = gameRef.current;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      state.playerX += (state.targetX - state.playerX) * Math.min(1, dt * 7);

      if (state.status === "playing") {
        const elapsed = now - state.startedAt;
        const difficulty = Math.min(1, elapsed / 90_000);
        const spawnEvery = 820 - difficulty * 360;
        if (now - state.lastSpawnAt > spawnEvery) {
          state.items.push(createItem(elapsed));
          state.lastSpawnAt = now;
        }

        state.energy = Math.max(0, state.energy - (0.8 + difficulty * 0.65) * dt);
        state.survivedMs = elapsed;
        const playerY = 0.86;
        const playerRadius = 0.075;
        const remainingItems: FallingItem[] = [];
        for (const item of state.items) {
          item.y += item.speed * dt;
          const dx = item.x - state.playerX;
          const dy = item.y - playerY;
          const hit = Math.sqrt(dx * dx + dy * dy) < item.radius + playerRadius;
          if (hit) {
            let amount = 0;
            if (item.kind === "hazard") amount = -Math.round(12 + difficulty * 6);
            if (item.kind === "food") amount = 10;
            if (item.kind === "drink") amount = 16;
            state.energy = clamp(state.energy + amount, 0, 100);
            state.energyPulse = 1;
            state.playerHitPulse = amount < 0 ? 1 : 0;
            state.feedbacks.push({
              id: `${item.id}-feedback`,
              x: item.x,
              y: Math.min(item.y, 0.82),
              amount,
              kind: amount < 0 ? "damage" : "gain",
              createdAt: Date.now()
            });
            continue;
          }
          if (item.y < 1.08) remainingItems.push(item);
        }
        state.items = remainingItems;
        state.feedbacks = state.feedbacks.filter((feedback) => Date.now() - feedback.createdAt < 950);
        state.energyPulse = Math.max(0, state.energyPulse - dt * 2.6);
        state.playerHitPulse = Math.max(0, state.playerHitPulse - dt * 4.4);

        if (state.energy <= 0) {
          state.energy = 0;
          state.status = "result";
        }
      } else {
        state.energyPulse = Math.max(0, state.energyPulse - dt * 2.6);
        state.playerHitPulse = Math.max(0, state.playerHitPulse - dt * 4.4);
        state.feedbacks = state.feedbacks.filter((feedback) => Date.now() - feedback.createdAt < 950);
      }

      drawGame(canvasRef.current!, state);
      setGame({ ...state, items: [...state.items] });
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const timeLabel = formatGameTime(game.survivedMs);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-4 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-200/80">Camera Game</p>
          <h1 className="mt-2 text-2xl font-black text-slate-50 md:text-4xl">Né vật rơi</h1>
        </div>
        <Link href="/" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-lime-300">
          Về portal
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <section className="relative min-w-0">
          <canvas ref={canvasRef} className="h-[76vh] min-h-[560px] w-full rounded-lg border border-slate-700 bg-slate-950" />
          {game.status !== "playing" && (
            <button
              onClick={startGame}
              disabled={!cameraReady}
              className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 translate-y-8 items-center justify-center rounded-full border-4 border-cyan-100/80 bg-cyan-300 text-slate-950 shadow-2xl shadow-cyan-950/60 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={game.status === "result" ? "Chơi lại" : "Bắt đầu"}
              title={game.status === "result" ? "Chơi lại" : "Bắt đầu"}
            >
              {game.status === "result" ? <RotateCcw size={34} /> : <Play size={38} className="ml-1" />}
            </button>
          )}
        </section>

        <aside className="space-y-2">
          <div className="rounded-lg border border-slate-700 bg-slate-900/75 p-3">
            <div className="flex items-center gap-2 text-slate-100">
              <Camera size={20} />
              <h2 className="text-lg font-bold">Camera</h2>
            </div>
            <div className="relative mt-2 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
              <video ref={videoRef} muted playsInline className="aspect-video w-full scale-x-[-1] object-cover" />
            </div>
            <canvas ref={trackingCanvasRef} className="mt-2 h-14 w-full rounded-lg border border-slate-700 bg-slate-950 object-cover" />
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Game dùng MediaPipe Pose để bắt tâm cơ thể. Đường xanh lá là vị trí thật trong camera, đường xanh dương là vị trí đã phóng đại cho game.
            </p>
            {cameraError && <p className="mt-2 rounded-lg bg-rose-500/15 p-2 text-sm text-rose-100">{cameraError}</p>}
            {poseError && <p className="mt-2 rounded-lg bg-amber-500/15 p-2 text-sm text-amber-100">{poseError}</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-950 p-3">
                <p className="text-slate-500">Tâm</p>
                <p className="text-lg font-black text-lime-200">{Math.round(poseCenter * 100)}%</p>
              </div>
              <div className="rounded-lg bg-slate-950 p-3">
                <p className="text-slate-500">Pose</p>
                <p className="text-lg font-black text-cyan-200">{poseStatus}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={enableCamera} className="flex items-center justify-center gap-2 rounded-lg bg-lime-300 px-3 py-3 font-bold text-slate-950">
                <Camera size={18} /> {cameraReady ? "Đã bật" : "Bật camera"}
              </button>
              <button onClick={() => void loadPoseLandmarker()} className="rounded-lg border border-lime-300/60 px-3 py-3 font-bold text-lime-100">
                {poseStatus === "loading" ? "Đang tải" : "Tải pose"}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={centerPoseTracking} className="rounded-lg border border-cyan-300/60 px-3 py-3 font-bold text-cyan-100">
                Căn giữa
              </button>
              <button
                onClick={() => {
                  poseSensitivityRef.current = 2.4;
                  setPoseSensitivity(2.4);
                }}
                className="rounded-lg border border-slate-600 px-3 py-3 font-bold text-slate-100"
              >
                Reset nhạy
              </button>
            </div>
            <label className="mt-3 block text-sm text-slate-300">
              Độ nhạy: {poseSensitivity.toFixed(1)}x
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={poseSensitivity}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  poseSensitivityRef.current = value;
                  setPoseSensitivity(value);
                }}
                className="mt-2 w-full"
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/75 p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-950 p-3">
                <p className="text-slate-500">Thời gian</p>
                <p className="text-2xl font-black text-slate-100">{timeLabel}</p>
              </div>
              <div className="rounded-lg bg-slate-950 p-3">
                <p className="text-slate-500">Vị trí</p>
                <p className="text-2xl font-black text-cyan-200">{Math.round(trackingX * 100)}%</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-cyan-300 transition-all" style={{ width: `${motionLevel * 100}%` }} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/75 p-3 text-sm leading-6 text-slate-300">
            <div className="mb-2 flex items-center gap-2 font-bold text-slate-100">
              <ShieldAlert size={18} /> Luật chơi
            </div>
            Né vật đỏ. Hứng đồ ăn xanh lá và nước xanh dương để hồi năng lượng. Người chơi thua khi năng lượng về 0.
          </div>
        </aside>
      </div>
    </main>
  );
}

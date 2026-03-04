"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { GamePanelSwitch, type LiXiGameType } from "../../components/lixi";
import { getLiXiSocket } from "../../lib/lixi-socket";

type PlayerView = {
  playerId: string;
  name: string;
  score: number;
  latency: number;
  isOnline: boolean;
};

type RoomView = {
  roomId: string;
  hostId: string;
  status: "waiting" | "countdown" | "playing" | "finished";
  selectedGame: LiXiGameType | null;
  selectedGameOptions: any | null;
  countdownEndsAt: number | null;
  currentGame: LiXiGameType | null;
  players: Array<PlayerView & { ready?: boolean }>;
};

type AckResponse = { ok?: boolean; roomId?: string; playerId?: string; message?: string };
type WinnerPayload = { playerId: string; name: string; victoryImageDataUrl?: string };
type CameraFilter =
  | "none"
  | "bigeyes"
  | "tinyMouth"
  | "bigNose"
  | "longChin"
  | "funny"
  | "bigForehead"
  | "puffyCheeks"
  | "tiltFace"
  | "wobble"
  | "crossEyes";

type FaceBox = { x: number; y: number; width: number; height: number };

const LIXI_SESSION_KEY = "lixi_session_v6";

interface LiXiSessionCache {
  roomId: string;
  playerId: string;
  name: string;
  role: "host" | "player";
}

const saveLiXiSession = (session: LiXiSessionCache): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIXI_SESSION_KEY, JSON.stringify(session));
};

const loadLiXiSession = (): LiXiSessionCache | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LIXI_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const clearLiXiSession = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LIXI_SESSION_KEY);
};

type BrowserFaceDetector = {
  detect: (input: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => BrowserFaceDetector;
  }
}

const games: Array<{ type: LiXiGameType; title: string; desc: string; color: string }> = [
  { type: "reaction", title: "Phản xạ", desc: "Bấm nhanh sau tín hiệu.", color: "bg-cyan-500/20 border-cyan-400/50" },
  { type: "memory", title: "Ghi nhớ", desc: "Hoàn thành bàn nhanh nhất.", color: "bg-emerald-500/20 border-emerald-400/50" },
  { type: "rps", title: "Kéo búa bao", desc: "Đấu BO1 ngay lập tức.", color: "bg-amber-500/20 border-amber-400/50" },
  { type: "number", title: "Săn số", desc: "Chạm đúng số mục tiêu trước.", color: "bg-violet-500/20 border-violet-400/50" },
  { type: "shake", title: "Lắc máy", desc: "Lắc mạnh trong 5 giây.", color: "bg-fuchsia-500/20 border-fuchsia-400/50" },
  { type: "color", title: "Chạm màu", desc: "Chạm đúng màu mục tiêu.", color: "bg-rose-500/20 border-rose-400/50" },
  { type: "racing", title: "Đua xe", desc: "Tránh né chướng ngại vật.", color: "bg-orange-500/20 border-orange-400/50" }
];

const pretty = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const roomFromPayload = (payload: unknown): RoomView | null => {
  const data = payload as { room?: RoomView };
  return data.room ?? null;
};

const drawFrameWithFilter = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  filter: CameraFilter,
  detectedFace: FaceBox | null
): void => {
  const fallbackFace: FaceBox = {
    x: w * 0.26,
    y: h * 0.16,
    width: w * 0.48,
    height: h * 0.62
  };
  const face = detectedFace ?? fallbackFace;

  ctx.clearRect(0, 0, w, h);
  ctx.filter = "none";

  ctx.drawImage(source, 0, 0, w, h);

  if (filter === "bigeyes") {
    const eyeY = face.y + face.height * 0.4;
    const eyeDistance = face.width * 0.2;
    const eyeR = Math.max(22, Math.min(face.width, face.height) * 0.14);
    const eyeScale = 2.2;
    const leftEyeX = face.x + face.width / 2 - eyeDistance;
    const rightEyeX = face.x + face.width / 2 + eyeDistance;

    const drawEye = (x: number, y: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, eyeR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        source,
        x - eyeR / eyeScale,
        y - eyeR / eyeScale,
        (eyeR * 2) / eyeScale,
        (eyeR * 2) / eyeScale,
        x - eyeR,
        y - eyeR,
        eyeR * 2,
        eyeR * 2
      );
      ctx.restore();
    };

    drawEye(leftEyeX, eyeY);
    drawEye(rightEyeX, eyeY);
    return;
  }

  if (filter === "tinyMouth") {
    const mouthX = face.x + face.width / 2;
    const mouthY = face.y + face.height * 0.73;
    const mouthW = face.width * 0.26;
    const mouthH = face.height * 0.12;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY, mouthW * 1.1, mouthH * 1.2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      source,
      mouthX - mouthW * 0.9,
      mouthY - mouthH * 0.9,
      mouthW * 1.8,
      mouthH * 1.8,
      mouthX - mouthW * 0.38,
      mouthY - mouthH * 0.38,
      mouthW * 0.76,
      mouthH * 0.76
    );
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(mouthX - mouthW * 0.5, mouthY - mouthH * 0.5, mouthW, mouthH);
    ctx.restore();
    return;
  }

  if (filter === "bigNose") {
    const noseX = face.x + face.width / 2;
    const noseY = face.y + face.height * 0.56;
    const noseW = face.width * 0.18;
    const noseH = face.height * 0.18;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(noseX, noseY, noseW, noseH, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      source,
      noseX - noseW * 0.7,
      noseY - noseH * 0.7,
      noseW * 1.4,
      noseH * 1.4,
      noseX - noseW * 1.5,
      noseY - noseH * 1.5,
      noseW * 3,
      noseH * 3
    );
    ctx.restore();
    return;
  }

  if (filter === "longChin") {
    const cx = face.x + face.width / 2;
    const chinY = face.y + face.height * 0.82;
    const chinW = face.width * 0.26;
    const chinH = face.height * 0.16;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, chinY, chinW, chinH, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      source,
      cx - chinW * 1.1,
      chinY - chinH * 1.1,
      chinW * 2.2,
      chinH * 2.2,
      cx - chinW * 1.5,
      chinY - chinH * 0.8,
      chinW * 3,
      chinH * 2.8
    );
    ctx.restore();
    return;
  }

  if (filter === "funny") {
    const mouthX = face.x + face.width / 2;
    const mouthY = face.y + face.height * 0.72;
    const mouthW = face.width * 0.28;
    const mouthH = face.height * 0.14;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      source,
      mouthX - mouthW / 2,
      mouthY - mouthH / 2,
      mouthW,
      mouthH,
      mouthX - mouthW * 1.35,
      mouthY - mouthH * 1.1,
      mouthW * 2.7,
      mouthH * 2.2
    );
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.font = `${Math.max(30, Math.round(face.width * 0.12))}px sans-serif`;
    ctx.fillText("🤣", face.x + face.width * 0.08, face.y + face.height * 0.16);
    ctx.fillText("😜", face.x + face.width * 0.84, face.y + face.height * 0.16);
    return;
  }

  if (filter === "bigForehead") {
    const cx = face.x + face.width / 2;
    const foreheadY = face.y + face.height * 0.2;
    const fw = face.width * 0.36;
    const fh = face.height * 0.2;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, foreheadY, fw, fh, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      source,
      cx - fw * 0.9,
      foreheadY - fh * 0.9,
      fw * 1.8,
      fh * 1.8,
      cx - fw * 1.45,
      foreheadY - fh * 1.55,
      fw * 2.9,
      fh * 3.1
    );
    ctx.restore();
    return;
  }

  if (filter === "puffyCheeks") {
    const cy = face.y + face.height * 0.58;
    const cheekOffset = face.width * 0.26;
    const cheekR = face.width * 0.18;
    const inflate = (x: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, cy, cheekR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        source,
        x - cheekR * 0.85,
        cy - cheekR * 0.85,
        cheekR * 1.7,
        cheekR * 1.7,
        x - cheekR * 1.25,
        cy - cheekR * 1.15,
        cheekR * 2.5,
        cheekR * 2.3
      );
      ctx.restore();
    };
    inflate(face.x + face.width / 2 - cheekOffset);
    inflate(face.x + face.width / 2 + cheekOffset);
    return;
  }

  if (filter === "tiltFace") {
    ctx.save();
    const cx = face.x + face.width / 2;
    const cy = face.y + face.height / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, face.width * 0.56, face.height * 0.62, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-0.22);
    ctx.drawImage(source, -face.width / 2, -face.height / 2, face.width, face.height);
    ctx.restore();
    return;
  }

  if (filter === "wobble") {
    const stripeH = Math.max(6, Math.floor(h / 56));
    for (let y = 0; y < h; y += stripeH) {
      const wobble = Math.sin(y * 0.07 + Date.now() * 0.02) * 14;
      ctx.drawImage(source, 0, y, w, stripeH, wobble, y, w, stripeH);
    }
    return;
  }

  if (filter === "crossEyes") {
    const eyeY = face.y + face.height * 0.42;
    const eyeDistance = face.width * 0.2;
    const eyeR = Math.max(18, Math.min(face.width, face.height) * 0.12);
    const drawEye = (x: number, shift: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, eyeY, eyeR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        source,
        x - eyeR * 0.7 + shift,
        eyeY - eyeR * 0.7,
        eyeR * 1.4,
        eyeR * 1.4,
        x - eyeR,
        eyeY - eyeR,
        eyeR * 2,
        eyeR * 2
      );
      ctx.restore();
    };
    drawEye(face.x + face.width / 2 - eyeDistance, eyeR * 0.35);
    drawEye(face.x + face.width / 2 + eyeDistance, -eyeR * 0.35);
    return;
  }
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Không thể đọc ảnh"));
    reader.readAsDataURL(blob);
  });

export default function LiXiNangCaoPage() {
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("Chủ phòng");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [selectedGame, setSelectedGame] = useState<LiXiGameType>("reaction");
  const [role, setRole] = useState<"host" | "player" | null>(null);
  const [memoryBoardLength, setMemoryBoardLength] = useState(12);
  const [memoryTheme, setMemoryTheme] = useState<"sports" | "animals" | "fruits" | "vehicles">("animals");
  const [rpsMode, setRpsMode] = useState<"BO1" | "BO3" | "BO5" | "BO7" | "BO11">("BO1");
  const [numberTargetCount, setNumberTargetCount] = useState(10);
  const [numberItemLifetimeMs, setNumberItemLifetimeMs] = useState(2000);
  const [numberWinCondition, setNumberWinCondition] = useState<"unique" | "ranking">("unique");

  const [gameState, setGameState] = useState<unknown>(null);
  const [resultState, setResultState] = useState<unknown>(null);
  const [errorText, setErrorText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [victoryImageDataUrl, setVictoryImageDataUrl] = useState("");
  const [winnerPopup, setWinnerPopup] = useState<WinnerPayload | null>(null);
  const [origin, setOrigin] = useState("");
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [hidePlayingOverlay, setHidePlayingOverlay] = useState(false);

  // Reset hidePlayingOverlay when room status changes (to show overlay again for next game)
  useEffect(() => {
    if (room?.status !== "playing") {
      setHidePlayingOverlay(false);
    }
  }, [room?.status]);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFilter, setCameraFilter] = useState<CameraFilter>("none");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRafRef = useRef<number | null>(null);
  const faceDetectorRef = useRef<BrowserFaceDetector | null>(null);
  const faceDetectingRef = useRef(false);
  const faceDetectTsRef = useRef(0);
  const faceBoxRef = useRef<FaceBox | null>(null);

  const roomId = room?.roomId ?? "";
  const isHost = room?.hostId === playerId;
  const canPlay = Boolean(roomId && playerId);
  const currentGame = room?.currentGame ?? room?.selectedGame ?? selectedGame;
  const joinUrl = roomId && origin ? `${origin}/li-xi-nang-cao?room=${roomId}` : "";
  const readyCount = room?.players.filter((player: any) => player.ready).length ?? 0;
  const onlineCount = room?.players.filter((player: any) => player.isOnline).length ?? 0;
  const allReady = onlineCount > 0 && readyCount === onlineCount;
  const myReady = room?.players.find((player: any) => player.playerId === playerId)?.ready ?? false;
  const countdownLeft = room?.countdownEndsAt ? Math.max(0, Math.ceil((room.countdownEndsAt - countdownNow) / 1000)) : 0;
  const canHostSelectGame = Boolean(isHost && room?.status === "waiting" && !myReady);

  const addLog = (message: string): void => {
    const line = `${new Date().toLocaleTimeString()} ${message}`;
    setLogs((prev) => [line, ...prev].slice(0, 40));
  };

  const stopCamera = (): void => {
    if (cameraRafRef.current !== null) {
      cancelAnimationFrame(cameraRafRef.current);
      cameraRafRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track: any) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCameraReady(false);
  };

  const openCamera = async (): Promise<void> => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      cameraStreamRef.current?.getTracks().forEach((track: any) => track.stop());
      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Không thể mở camera");
    }
  };

  const captureFromCamera = async (): Promise<void> => {
    const canvas = cameraCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    if (dataUrl.length > 5_500_000) {
      setErrorText("Ảnh quá lớn, vui lòng chụp lại.");
      return;
    }
    setVictoryImageDataUrl(dataUrl);
    stopCamera();
  };

  const handleImageCapture = async (file: File | null): Promise<void> => {
    if (!file) return;
    try {
      setErrorText("");
      if (!file.type.startsWith("image/")) {
        setErrorText("Vui lòng chọn file ảnh.");
        return;
      }
      const dataUrl = await blobToDataUrl(file);
      if (dataUrl.length > 5_500_000) {
        setErrorText("Ảnh quá lớn, vui lòng chụp/chọn ảnh nhỏ hơn.");
        return;
      }
      setVictoryImageDataUrl(dataUrl);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Không thể xử lý ảnh");
    }
  };

  useEffect(() => {
    const roomParam = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() ?? "";
    if (roomParam && roomParam !== roomIdInput) {
      setRoomIdInput(roomParam);
      setRole("player");
    }
  }, [roomIdInput]);

  useEffect(() => {
    if (room?.selectedGame) {
      setSelectedGame(room.selectedGame);
    }
  }, [room?.selectedGame]);

  useEffect(() => {
    if (room?.selectedGameOptions?.number) {
      if (room.selectedGameOptions.number.targetCount) {
        setNumberTargetCount(room.selectedGameOptions.number.targetCount);
      }
      if (room.selectedGameOptions.number.itemLifetimeMs) {
        setNumberItemLifetimeMs(room.selectedGameOptions.number.itemLifetimeMs);
      }
    }
  }, [room?.selectedGameOptions?.number]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let mounted = true;
    let cleanupSocket: (() => void) | null = null;

    const setup = async (): Promise<void> => {
      try {
        const socket = await getLiXiSocket();

        const onConnect = () => {
          if (!mounted) return;
          setConnected(true);
          addLog("Kết nối realtime /lixi thành công");

          // Try to restore session if not already in a room
          const cached = loadLiXiSession();
          if (cached) {
            void (async () => {
              const res = await emitWithAck("room:restoreSession", {
                roomId: cached.roomId,
                playerId: cached.playerId
              });
              if (res.ok) {
                const data = res as { room?: RoomView; playerId?: string };
                if (mounted) {
                  setRoom(data.room ?? null);
                  setRoomIdInput(data.room?.roomId ?? "");
                  setPlayerId(String(data.playerId ?? ""));
                  setRole(cached.role);
                  setName(cached.name);
                  addLog(`Đã khôi phục phiên: ${cached.roomId}`);
                }
              } else {
                // If restore fails, clear session to avoid constant attempts
                // clearLiXiSession(); // Optional: might be transient error
              }
            })();
          }
        };

        const onDisconnect = () => {
          if (!mounted) return;
          setConnected(false);
          addLog("Mất kết nối realtime");
        };

        const onRoomCreated = (payload: unknown) => {
          if (!mounted) return;
          const data = payload as { room?: RoomView; playerId?: string };
          setRoom(data.room ?? null);
          setRoomIdInput(data.room?.roomId ?? "");
          setPlayerId(String(data.playerId ?? ""));
          setErrorText("");
          addLog("Đã tạo phòng thành công");
        };

        const onRoomJoined = (payload: unknown) => {
          if (!mounted) return;
          const data = payload as { room?: RoomView; playerId?: string };
          setRoom(data.room ?? null);
          setRoomIdInput(data.room?.roomId ?? "");
          setPlayerId(String(data.playerId ?? ""));
          setErrorText("");
          addLog("Đã tham gia phòng");
        };

        const onGameStarted = (payload: unknown) => {
          if (!mounted) return;
          setGameState(payload);
          const nextRoom = roomFromPayload(payload);
          if (nextRoom) setRoom(nextRoom);
          setResultState(null);
          addLog("Trò chơi đã bắt đầu");
        };

        const onGameUpdate = (payload: any) => {
          if (!mounted) return;
          // Only update gameState if it's actually in the payload
          if (payload?.gameState || payload?.result || payload?.phase) {
            setGameState(payload);
          }
          const nextRoom = roomFromPayload(payload);
          if (nextRoom) setRoom(nextRoom);
        };

        const onGameResult = (payload: unknown) => {
          if (!mounted) return;
          setResultState(payload);
          const nextRoom = roomFromPayload(payload);
          if (nextRoom) setRoom(nextRoom);
          const winner = (payload as { winner?: WinnerPayload | null }).winner;
          if (winner) {
            setWinnerPopup(winner);
          }
          addLog("Trò chơi đã có kết quả");
        };

        const onError = (payload: unknown) => {
          if (!mounted) return;
          const message = String((payload as { message?: string }).message ?? "Lỗi không xác định");
          setErrorText(message);
          addLog(`Lỗi: ${message}`);
        };

        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("room:created", onRoomCreated);
        socket.off("room:joined", onRoomJoined);
        socket.off("game:started", onGameStarted);
        socket.off("game:update", onGameUpdate);
        socket.off("game:result", onGameResult);
        socket.off("error", onError);

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("room:created", onRoomCreated);
        socket.on("room:joined", onRoomJoined);
        socket.on("game:started", onGameStarted);
        socket.on("game:update", onGameUpdate);
        socket.on("game:result", onGameResult);
        socket.on("error", onError);

        cleanupSocket = () => {
          socket.off("connect", onConnect);
          socket.off("disconnect", onDisconnect);
          socket.off("room:created", onRoomCreated);
          socket.off("room:joined", onRoomJoined);
          socket.off("game:started", onGameStarted);
          socket.off("game:update", onGameUpdate);
          socket.off("game:result", onGameResult);
          socket.off("error", onError);
        };

        socket.connect();
      } catch (error) {
        if (!mounted) return;
        setErrorText(error instanceof Error ? error.message : "Không thể khởi tạo socket");
      }
    };

    void setup();

    return () => {
      mounted = false;
      cleanupSocket?.();
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (room?.status !== "countdown") return;
    setCountdownNow(Date.now()); // Reset to avoid stale countdown glitch
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [room?.status, room?.countdownEndsAt]); // Added countdownEndsAt as dependency

  useEffect(() => {
    if (!cameraOpen || !cameraStreamRef.current) return;
    const video = cameraVideoRef.current;
    if (!video) return;
    video.srcObject = cameraStreamRef.current;
    void video.play().then(() => setCameraReady(true)).catch(() => setCameraReady(false));

    const draw = (): void => {
      const canvas = cameraCanvasRef.current;
      if (!canvas || !video || video.readyState < 2) {
        cameraRafRef.current = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const now = Date.now();
      if (
        faceDetectorRef.current &&
        now - faceDetectTsRef.current > 260 &&
        !faceDetectingRef.current &&
        video.readyState >= 2
      ) {
        faceDetectingRef.current = true;
        faceDetectTsRef.current = now;
        void faceDetectorRef.current
          .detect(video)
          .then((faces) => {
            const box = faces[0]?.boundingBox;
            if (!box) {
              faceBoxRef.current = null;
              return;
            }
            faceBoxRef.current = {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height
            };
          })
          .catch(() => {
            faceBoxRef.current = null;
          })
          .finally(() => {
            faceDetectingRef.current = false;
          });
      }
      drawFrameWithFilter(ctx, video, canvas.width, canvas.height, cameraFilter, faceBoxRef.current);
      cameraRafRef.current = requestAnimationFrame(draw);
    };
    cameraRafRef.current = requestAnimationFrame(draw);

    return () => {
      if (cameraRafRef.current !== null) {
        cancelAnimationFrame(cameraRafRef.current);
        cameraRafRef.current = null;
      }
    };
  }, [cameraFilter, cameraOpen]);

  useEffect(() => {
    if (!cameraOpen) return;
    if (typeof window === "undefined" || !window.FaceDetector) {
      faceDetectorRef.current = null;
      return;
    }
    try {
      faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    } catch {
      faceDetectorRef.current = null;
    }
  }, [cameraOpen]);

  const emitWithAck = async (event: string, payload: Record<string, unknown>): Promise<AckResponse> => {
    const socket = await getLiXiSocket();
    return await new Promise<AckResponse>((resolve) => {
      socket.emit(event, payload, (response: unknown) => {
        resolve((response as AckResponse) ?? {});
      });
    });
  };

  const createRoom = async (): Promise<void> => {
    setErrorText("");
    const displayName = name.trim() || "Chủ phòng";
    const res = await emitWithAck("host:createRoom", {
      name: displayName,
      victoryImageDataUrl: victoryImageDataUrl || undefined
    });
    if (res.ok) {
      const data = res as { roomId: string; playerId: string };
      setRole("host");
      saveLiXiSession({
        roomId: data.roomId,
        playerId: data.playerId,
        name: displayName,
        role: "host"
      });
    } else {
      setErrorText(res.message ?? "Tạo phòng thất bại");
    }
  };

  const joinRoom = async (): Promise<void> => {
    setErrorText("");
    const displayName = name.trim() || "Người chơi";
    const rId = roomIdInput.trim().toUpperCase();
    const res = await emitWithAck("player:joinRoom", {
      roomId: rId,
      name: displayName,
      victoryImageDataUrl: victoryImageDataUrl || undefined
    });
    if (res.ok) {
      const data = res as { roomId: string; playerId: string };
      setRole("player");
      saveLiXiSession({
        roomId: data.roomId,
        playerId: data.playerId,
        name: displayName,
        role: "player"
      });
    } else {
      setErrorText(res.message ?? "Vào phòng thất bại");
    }
  };

  const selectGame = async (gameType: LiXiGameType, forceOptions?: any): Promise<void> => {
    if (!roomId || !isHost) return;
    if (myReady) {
      setErrorText("Chủ phòng đang sẵn sàng. Bỏ sẵn sàng để đổi trò chơi.");
      return;
    }
    setSelectedGame(gameType);
    const options = forceOptions || (gameType === "memory"
      ? { memory: { boardLength: memoryBoardLength, theme: memoryTheme } }
      : gameType === "rps"
        ? { rps: { mode: rpsMode } }
        : gameType === "number"
          ? { number: { targetCount: numberTargetCount } }
          : undefined);
    const res = await emitWithAck("host:selectGame", { roomId, gameType, options });
    if (!res.ok) setErrorText(res.message ?? "Không thể chọn trò chơi");
  };

  const startGame = async (): Promise<void> => {
    if (!roomId) return;
    setErrorText("");
    const options = selectedGame === "memory"
      ? { memory: { boardLength: memoryBoardLength, theme: memoryTheme } }
      : selectedGame === "rps"
        ? { rps: { mode: rpsMode } }
        : selectedGame === "number"
          ? { number: { targetCount: numberTargetCount } }
          : undefined;
    const res = await emitWithAck("host:startGame", { roomId, options });
    if (!res.ok) setErrorText(res.message ?? "Không thể bắt đầu trò chơi");
  };

  const endGame = async (): Promise<void> => {
    if (!roomId) return;
    setErrorText("");
    const res = await emitWithAck("host:endGame", { roomId });
    if (!res.ok) setErrorText(res.message ?? "Không thể kết thúc trò chơi");
  };

  const restartGame = async (): Promise<void> => {
    if (!roomId) return;
    setErrorText("");
    const res = await emitWithAck("host:restartGame", { roomId });
    if (!res.ok) setErrorText(res.message ?? "Không thể chơi lại");
  };

  const setReady = async (ready: boolean): Promise<void> => {
    if (!roomId) return;
    setErrorText("");
    const res = await emitWithAck("player:setReady", { roomId, ready });
    if (!res.ok) setErrorText(res.message ?? "Không thể cập nhật trạng thái sẵn sàng");
  };

  const kickPlayer = async (targetPlayerId: string): Promise<void> => {
    if (!roomId || !isHost) return;
    setErrorText("");
    const res = await emitWithAck("host:kickPlayer", { roomId, playerId: targetPlayerId });
    if (!res.ok) setErrorText(res.message ?? "Không thể mời người chơi ra khỏi phòng");
  };

  const emitAction = (event: string, payload: Record<string, unknown>): void => {
    void (async () => {
      const socket = await getLiXiSocket();
      socket.emit(event, payload);
      addLog(`Đã gửi sự kiện ${event}`);
    })();
  };


  const renderPopups = () => (
    <>
      {/* Popups */}
      {winnerPopup && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-[40px] border border-white/10 bg-slate-900 p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
            <p className="mt-2 text-xl font-black text-white italic tracking-tight">
              NGƯỜI CHIẾN THẮNG
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-400 uppercase tracking-wider">{winnerPopup.name}</p>

            {winnerPopup.victoryImageDataUrl && (
              <div className="mt-6 aspect-square rounded-3xl overflow-hidden border-2 border-emerald-500/30 shadow-xl">
                <img className="w-full h-full object-cover" src={winnerPopup.victoryImageDataUrl} alt="Winner" />
              </div>
            )}

            <button
              onClick={() => {
                setWinnerPopup(null);
                if (isHost) {
                  void endGame();
                } else {
                  setHidePlayingOverlay(true);
                }
              }}
              className="mt-8 w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
            >
              Đóng & Quay lại sảnh
            </button>
          </div>
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in zoom-in duration-300">
          <div className="w-full max-w-lg rounded-[40px] border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white uppercase italic tracking-wide">Camera Studio</h2>
              <button onClick={stopCamera} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="relative aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-slate-800">
              <video ref={cameraVideoRef} className="absolute inset-0 w-px h-px opacity-0 pointer-events-none" playsInline muted />
              <canvas ref={cameraCanvasRef} width={640} height={480} className="w-full h-full object-cover" />
              {!cameraReady && <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-bold uppercase tracking-widest animate-pulse">Khởi tạo camera...</div>}
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex gap-2 overflow-auto pb-2 no-scrollbar">
                {[
                  { id: "none", label: "Gốc" },
                  { id: "funny", label: "Hài hước" },
                  { id: "bigeyes", label: "Mắt to" },
                  { id: "tinyMouth", label: "Miệng xinh" },
                  { id: "bigNose", label: "Mũi to" },
                  { id: "tiltFace", label: "Lệch mặt" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCameraFilter(item.id as CameraFilter)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${cameraFilter === item.id ? "bg-cyan-500 text-slate-900" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => void captureFromCamera()}
                disabled={!cameraReady}
                className="w-full h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 font-black text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-30 active:scale-95 transition-all uppercase tracking-widest"
              >
                Chụp ảnh & Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {room?.status === "countdown" && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4 animate-in fade-in duration-500">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-500 mb-8 animate-pulse">Chuẩn bị sẵn sàng</p>
            <div className="relative h-48 w-48 flex items-center justify-center mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin duration-700" style={{ animationDuration: '2s' }} />
              <span className="text-9xl font-black text-white italic drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">{countdownLeft}</span>
            </div>
            <p className="mt-8 text-xl font-black text-white uppercase italic tracking-wider">
              {room?.selectedGame === "number" ? "Săn Số V6" : room?.selectedGame === "memory" ? "Board Nhớ" : "Bắt Đầu"}
            </p>
          </div>
        </div>
      )}

      {(room?.status === "playing" || room?.status === "finished") && !hidePlayingOverlay && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-3 sm:p-6 overflow-y-auto overflow-x-hidden">
          {/* External Exit Button */}
          <div className="absolute top-4 right-4 z-[230] sm:top-8 sm:right-8">
            <button
              onClick={() => setHidePlayingOverlay(true)}
              className="group flex flex-col items-center gap-1 transition-all active:scale-90"
            >
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl border border-white/20 bg-slate-900/80 text-white shadow-2xl backdrop-blur-xl transition-all group-hover:bg-red-500 group-hover:border-red-400">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-red-400 transition-colors">Thoát Game</span>
            </button>
          </div>
          <div className="w-full max-w-6xl mx-auto h-full flex flex-col justify-center py-12 sm:py-20">
            <div className="w-full h-auto max-h-full">
              <GamePanelSwitch
                game={currentGame}
                disabled={!canPlay || (currentGame === "reaction" && !isHost)}
                onEmit={emitAction}
                gameState={gameState}
                playerId={playerId}
                room={room}
                onClose={() => setHidePlayingOverlay(true)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (!roomId) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4 py-8 overflow-x-hidden">
        {renderPopups()}
        <section className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <h1 className="text-4xl font-black bg-gradient-to-br from-cyan-300 to-violet-400 bg-clip-text text-transparent">LÌ XÌ NÂNG CAO</h1>
            <p className="mt-2 text-slate-400 font-medium">Phiên bản V6 • Trò chơi tương tác nhóm</p>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6 backdrop-blur-xl shadow-2xl">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Tên hiển thị</label>
                <input
                  className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-lg font-semibold text-white focus:border-cyan-500/50 focus:outline-none transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                />
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Tùy chọn chiến thắng</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void openCamera()} className="flex-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-2 sm:px-4 py-2.5 text-[10px] sm:text-xs md:text-sm font-bold text-cyan-400 hover:bg-cyan-500/20 transition-all">
                    📸 Mở Camera
                  </button>
                  <label className="flex-1 cursor-pointer rounded-xl bg-violet-500/10 border border-violet-500/30 px-2 sm:px-4 py-2.5 text-[10px] sm:text-xs md:text-sm font-bold text-violet-400 text-center hover:bg-violet-500/20 transition-all overflow-hidden whitespace-nowrap">
                    📁 Chọn Ảnh
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleImageCapture(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                {victoryImageDataUrl && (
                  <div className="mt-4 relative group">
                    <img className="w-full h-32 object-cover rounded-xl border border-slate-700" src={victoryImageDataUrl} alt="Preview" />
                    <button onClick={() => setVictoryImageDataUrl("")} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => void createRoom()}
                  className="h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 font-bold text-slate-950 shadow-lg shadow-cyan-950/20 hover:scale-[1.02] active:scale-95 transition-all text-sm sm:text-base"
                >
                  TẠO PHÒNG
                </button>
                <div className="relative group">
                  <input
                    className="h-14 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 font-bold text-emerald-300 uppercase placeholder:text-emerald-900 group-hover:border-emerald-500/50 transition-all focus:outline-none"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                    placeholder="MÃ PHÒNG"
                  />
                  <button
                    onClick={() => void joinRoom()}
                    disabled={!roomIdInput.trim()}
                    className="absolute right-2 top-2 h-10 px-4 rounded-xl bg-emerald-500 font-bold text-slate-950 disabled:hidden transition-all"
                  >
                    VÀO
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-300 transition-colors">
              ← Quay lại Portal
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 md:py-10 overflow-x-hidden">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-cyan-500 font-black text-slate-900 shadow-lg shadow-cyan-500/20">L6</div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">Lì Xì V6</h1>
        </div>
        <Link href="/" className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 transition-all">
          ← Thoát
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        {/* Left Column: Room Info & Controls */}
        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-md shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" /></svg>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Mã phòng</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${connected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                  {connected ? "Ổn định" : "Mất kết nối"}
                </span>
              </div>

              <div className="flex items-center gap-2 group">
                <div className="flex-1 bg-slate-950/80 border border-slate-700 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <span className="font-mono text-2xl font-black text-cyan-300 tracking-wider">
                    {roomId || "------"}
                  </span>
                  <button
                    onClick={() => {
                      if (roomId) {
                        void navigator.clipboard.writeText(roomId);
                        addLog("Đã sao chép mã phòng");
                      }
                    }}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Sao chép mã phòng"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Thành viên</p>
                  <p className="text-xl font-black text-white">{onlineCount}<span className="text-slate-600 text-sm">/{room?.players?.length ?? 0}</span></p>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sẵn sàng</p>
                  <p className="text-xl font-black text-emerald-400">{readyCount}<span className="text-slate-600 text-sm">/{onlineCount}</span></p>
                </div>
              </div>

              {joinUrl && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center gap-3">
                  <div className="p-2 bg-white rounded-xl">
                    <QRCodeSVG value={joinUrl} size={120} />
                  </div>
                  <p className="text-[10px] font-medium text-slate-400 break-all text-center">{joinUrl}</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-700 bg-slate-900/40 p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 ml-1">Người chơi</h2>
            <div className="space-y-3 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
              {room?.players?.map((p: any) => (
                <div key={p.playerId} className={`group flex items-center justify-between p-3 rounded-2xl border transition-all ${p.playerId === playerId ? "bg-cyan-500/10 border-cyan-500/30" : "bg-slate-950/40 border-slate-800"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${p.isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-600"}`} />
                    <div>
                      <p className={`text-sm font-bold ${p.playerId === playerId ? "text-cyan-300" : "text-white"}`}>
                        {p.name} {p.playerId === room?.hostId && "👑"}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500">
                        {p.ready ? "✓ Sẵn sàng" : "• Đang chờ"} • {p.latency}ms
                      </p>
                    </div>
                  </div>
                  {isHost && p.playerId !== playerId && room?.status === "waiting" && (
                    <button
                      onClick={() => void kickPlayer(p.playerId)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 transition-all hover:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Right Column: Game Area */}
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-md">
            {isHost && (room?.status === "waiting" || hidePlayingOverlay) && (
              <div className="space-y-6 mb-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 ml-1">Chọn trò chơi</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {games.map((g) => (
                      <button
                        key={g.type}
                        onClick={() => void selectGame(g.type)}
                        disabled={myReady}
                        className={`p-3 rounded-2xl border text-left transition-all ${selectedGame === g.type ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.1)]" : "border-slate-800 bg-slate-950/40 hover:border-slate-700"}`}
                      >
                        <p className={`text-xs font-bold leading-tight ${selectedGame === g.type ? "text-cyan-300" : "text-slate-400"}`}>{g.title}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game Specific Configurations */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Cấu hình {games.find(g => g.type === selectedGame)?.title}</h3>

                  {selectedGame === "rps" && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400">Chọn chế độ thi đấu:</p>
                      <div className="flex flex-wrap gap-2">
                        {["BO1", "BO3", "BO5", "BO7", "BO11"].map((m) => (
                          <button
                            key={m}
                            onClick={() => { setRpsMode(m as any); void selectGame("rps", { rps: { mode: m } }); }}
                            disabled={myReady}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${rpsMode === m ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedGame === "memory" && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400">Chọn chủ đề hình ảnh:</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: "animals", label: "Động vật" },
                          { id: "fruits", label: "Hoa quả" },
                          { id: "sports", label: "Thể thao" },
                          { id: "vehicles", label: "Xe cộ" }
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => { setMemoryTheme(t.id as any); void selectGame("memory", { memory: { boardLength: memoryBoardLength, theme: t.id } }); }}
                            disabled={myReady}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${memoryTheme === t.id ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedGame === "number" && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <p className="text-xs text-slate-400">Số lượng mục tiêu cần tìm:</p>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min={1}
                            max={25}
                            value={numberTargetCount}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setNumberTargetCount(val);
                              void selectGame("number", { number: { targetCount: val, itemLifetimeMs: numberItemLifetimeMs, winCondition: numberWinCondition } });
                            }}
                            disabled={myReady}
                            className="flex-1 accent-cyan-500"
                          />
                          <span className="w-12 h-10 flex items-center justify-center rounded-xl bg-slate-800 font-bold text-cyan-300 border border-slate-700">{numberTargetCount}</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs text-slate-400">Thời gian hiện số (ms):</p>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min={500}
                            max={5000}
                            step={100}
                            value={numberItemLifetimeMs}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setNumberItemLifetimeMs(val);
                              void selectGame("number", { number: { targetCount: numberTargetCount, itemLifetimeMs: val, winCondition: numberWinCondition } });
                            }}
                            disabled={myReady}
                            className="flex-1 accent-violet-500"
                          />
                          <span className="w-16 h-10 flex items-center justify-center rounded-xl bg-slate-800 font-bold text-violet-300 border border-slate-700">{numberItemLifetimeMs}</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs text-slate-400">Cách tính thắng cuộc:</p>
                        <div className="flex gap-2">
                          {[
                            { id: "unique", label: "Người thắng duy nhất" },
                            { id: "ranking", label: "Sắp xếp danh sách" }
                          ].map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setNumberWinCondition(c.id as any);
                                void selectGame("number", { number: { targetCount: numberTargetCount, itemLifetimeMs: numberItemLifetimeMs, winCondition: c.id as any } });
                              }}
                              disabled={myReady}
                              className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-bold transition-all ${numberWinCondition === c.id ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedGame !== "rps" && selectedGame !== "memory" && selectedGame !== "number" && (
                    <p className="text-xs text-slate-500 italic">Trò chơi này không cần cấu hình thêm.</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 p-6 rounded-3xl bg-slate-950/40 border border-slate-800">
              <div className="space-y-1">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Điều khiển trò chơi</h2>
                <p className="text-[10px] text-slate-500">Tất cả người chơi cần Sẵn sàng để Bắt đầu</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const nextReady = !myReady;
                    if (myReady && room?.status === "playing") {
                      if (isHost) {
                        void setReady(false);
                        void endGame();
                      } else {
                        void setReady(false);
                        setHidePlayingOverlay(true);
                      }
                    } else {
                      void setReady(nextReady);
                    }
                  }}
                  disabled={room?.status === "countdown" || !roomId}
                  className={`h-12 px-6 rounded-2xl font-black transition-all text-xs sm:text-sm shadow-xl ${myReady ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20" : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"} disabled:opacity-30`}
                >
                  {myReady ? (room?.status === "playing" ? (isHost ? "DỪNG GAME" : "THOÁT GAME") : "✓ ĐÃ SẴN SÀNG") : "SẴN SÀNG"}
                </button>
                {isHost && (room?.status === "waiting" || room?.status === "finished" || hidePlayingOverlay) && (
                  <button
                    onClick={() => void startGame()}
                    disabled={!allReady || !room?.selectedGame || !myReady}
                    className="h-12 px-6 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 font-black text-slate-950 shadow-xl shadow-cyan-500/20 disabled:opacity-30 active:scale-95 transition-all text-xs sm:text-sm"
                  >
                    {room?.status === "finished" ? "BẮT ĐẦU LẠI" : "BẮT ĐẦU"}
                  </button>
                )}
              </div>
            </div>

            {/* Removed inline game panel as it's now in popups only */}
          </section>

          {/* Dev Tools / Debug */}
          <section className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-700 bg-slate-900/40 p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Trạng thái game</h3>
              <pre className="max-h-48 overflow-auto rounded-xl bg-slate-950 p-4 text-[10px] font-mono text-cyan-100 custom-scrollbar">{pretty(gameState)}</pre>
            </div>
            <div className="rounded-3xl border border-slate-700 bg-slate-900/40 p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Nhật ký hệ thống</h3>
              <div className="max-h-48 overflow-auto rounded-xl bg-slate-950 p-4 text-[10px] font-mono text-slate-300 custom-scrollbar">
                {logs.map((line: string, i: number) => <p key={i} className="mb-1 leading-relaxed"><span className="text-slate-600 mr-2">[{i}]</span> {line}</p>)}
              </div>
            </div>
          </section>
        </div>
      </div>

      {renderPopups()}
    </main>
  );
}

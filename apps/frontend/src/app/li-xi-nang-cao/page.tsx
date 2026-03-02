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
  { type: "color", title: "Chạm màu", desc: "Chạm đúng màu mục tiêu.", color: "bg-rose-500/20 border-rose-400/50" }
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

  const [gameState, setGameState] = useState<unknown>(null);
  const [resultState, setResultState] = useState<unknown>(null);
  const [errorText, setErrorText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [victoryImageDataUrl, setVictoryImageDataUrl] = useState("");
  const [winnerPopup, setWinnerPopup] = useState<WinnerPayload | null>(null);
  const [origin, setOrigin] = useState("");
  const [countdownNow, setCountdownNow] = useState(Date.now());

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
  const readyCount = room?.players.filter((player) => player.ready).length ?? 0;
  const onlineCount = room?.players.filter((player) => player.isOnline).length ?? 0;
  const allReady = onlineCount > 0 && readyCount === onlineCount;
  const myReady = room?.players.find((player) => player.playerId === playerId)?.ready ?? false;
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
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
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
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
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

        const onGameUpdate = (payload: unknown) => {
          if (!mounted) return;
          setGameState(payload);
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
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [room?.status]);

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
    setRole("host");
    const res = await emitWithAck("host:createRoom", {
      name: name.trim() || "Chủ phòng",
      victoryImageDataUrl: victoryImageDataUrl || undefined
    });
    if (!res.ok) setErrorText(res.message ?? "Tạo phòng thất bại");
  };

  const joinRoom = async (): Promise<void> => {
    setErrorText("");
    setRole("player");
    const res = await emitWithAck("player:joinRoom", {
      roomId: roomIdInput.trim().toUpperCase(),
      name: name.trim() || "Người chơi",
      victoryImageDataUrl: victoryImageDataUrl || undefined
    });
    if (!res.ok) setErrorText(res.message ?? "Vào phòng thất bại");
  };

  const selectGame = async (gameType: LiXiGameType): Promise<void> => {
    if (!roomId || !isHost) return;
    if (myReady) {
      setErrorText("Chủ phòng đang sẵn sàng. Bỏ sẵn sàng để đổi trò chơi.");
      return;
    }
    setSelectedGame(gameType);
    const options = gameType === "memory" ? { memory: { boardLength: memoryBoardLength, theme: memoryTheme } } : undefined;
    const res = await emitWithAck("host:selectGame", { roomId, gameType, options });
    if (!res.ok) setErrorText(res.message ?? "Không thể chọn trò chơi");
  };

  const startGame = async (): Promise<void> => {
    if (!roomId) return;
    setErrorText("");
    const options = selectedGame === "memory" ? { memory: { boardLength: memoryBoardLength, theme: memoryTheme } } : undefined;
    const res = await emitWithAck("host:startGame", { roomId, options });
    if (!res.ok) setErrorText(res.message ?? "Không thể bắt đầu trò chơi");
  };

  const endGame = async (): Promise<void> => {
    if (!roomId) return;
    setErrorText("");
    const res = await emitWithAck("host:endGame", { roomId });
    if (!res.ok) setErrorText(res.message ?? "Không thể kết thúc trò chơi");
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

  if (!role) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10">
        <section className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Lì xì nâng cao</h1>
            <Link href="/" className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
              Về Portal
            </Link>
          </div>
          <p className="text-sm text-slate-300">Chọn vai trò để bắt đầu:</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button onClick={() => setRole("host")} className="rounded-xl border border-cyan-300/70 bg-cyan-500/15 px-4 py-4 text-left">
              <p className="text-lg font-semibold text-cyan-100">Chủ phòng</p>
              <p className="mt-1 text-sm text-slate-300">Tạo phòng, chọn game, bắt đầu và quản lý người chơi.</p>
            </button>
            <button onClick={() => setRole("player")} className="rounded-xl border border-emerald-300/70 bg-emerald-500/15 px-4 py-4 text-left">
              <p className="text-lg font-semibold text-emerald-100">Người chơi</p>
              <p className="mt-1 text-sm text-slate-300">Vào phòng bằng mã, sẵn sàng và tham gia trò chơi.</p>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lì xì nâng cao</h1>
        <Link href="/" className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
          Về Portal
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">Trạng thái kết nối: {connected ? "Đang kết nối" : "Mất kết nối"}</p>

          <div className="mt-4 space-y-3">
            <input className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn" />
            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
              <p className="text-sm font-semibold text-slate-100">Ảnh chọc vui khi chiến thắng</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => void openCamera()} className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-900">
                  Mở camera + filter
                </button>
                <label className="cursor-pointer rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white">
                  Chụp/Chọn ảnh
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleImageCapture(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={() => setVictoryImageDataUrl("")}
                  disabled={!victoryImageDataUrl}
                  className="rounded-lg border border-slate-500 px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50"
                >
                  Xóa ảnh
                </button>
              </div>
              {victoryImageDataUrl && (
                <img className="mt-3 w-full max-w-xs rounded-lg border border-slate-700 object-cover" src={victoryImageDataUrl} alt="Anh choc vui cua ban" />
              )}
              {cameraError && <p className="mt-2 text-xs text-red-300">{cameraError}</p>}
            </div>
            {role === "host" ? (
              <button onClick={() => void createRoom()} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-900">
                Tạo phòng
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 uppercase"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  placeholder="Mã phòng"
                />
                <button onClick={() => void joinRoom()} className="rounded-lg border border-cyan-300/60 px-4 py-2 font-semibold text-cyan-200">
                  Vào
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
            <p>Phòng: <span className="font-mono text-cyan-200">{roomId || "-"}</span></p>
            <p>Vai trò: <span className="font-semibold">{isHost ? "Chủ phòng" : canPlay ? "Người chơi" : "-"}</span></p>
            <p>Trạng thái: <span className="font-semibold">{room?.status ?? "-"}</span></p>
            <p>Game đã chọn: <span className="font-semibold">{room?.selectedGame ?? "-"}</span></p>
            <p>Sẵn sàng: <span className="font-semibold">{readyCount}/{onlineCount}</span></p>
            {room?.status === "countdown" && <p>Game bắt đầu sau: <span className="font-semibold text-amber-300">{countdownLeft}s</span></p>}
            <button
              onClick={() => void setReady(!myReady)}
              disabled={!canPlay || room?.status !== "waiting"}
              className={`mt-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${myReady ? "bg-emerald-500 text-slate-900" : "border border-emerald-300/60 text-emerald-200"} disabled:opacity-50`}
            >
              {myReady ? "Đã sẵn sàng" : "Bấm để sẵn sàng"}
            </button>
            {joinUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-2">
                <QRCodeSVG value={joinUrl} size={84} includeMargin />
                <div>
                  <p className="text-xs font-semibold text-cyan-100">Quét mã để vào phòng</p>
                  <p className="mt-1 break-all text-[11px] text-slate-300">{joinUrl}</p>
                </div>
              </div>
            )}
          </div>

          {errorText && <div className="mt-3 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{errorText}</div>}

          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Danh sách người chơi</h2>
            <div className="space-y-2">
              {room?.players?.length ? room.players.map((p) => (
                <div key={p.playerId} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{p.name}</p>
                    <p className="text-xs text-slate-400">Độ trễ: {p.latency}ms • {p.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs ${p.isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                      {p.isOnline ? "Trực tuyến" : "Ngoại tuyến"}
                    </span>
                    {isHost && !p.ready && p.playerId !== playerId && room?.status === "waiting" && (
                      <button
                        onClick={() => void kickPlayer(p.playerId)}
                        className="rounded-lg border border-red-300/60 px-2 py-1 text-xs font-semibold text-red-200"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400">Chưa có người chơi.</p>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold">{isHost ? "Chọn trò chơi" : "Trò chơi đã chọn bởi host"}</h2>
          {isHost ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {games.map((g) => (
                <button
                  key={g.type}
                  onClick={() => void selectGame(g.type)}
                  disabled={!canHostSelectGame}
                  className={`rounded-xl border p-3 text-left transition ${selectedGame === g.type ? g.color : "border-slate-700 bg-slate-900/50"} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <p className="font-semibold">{g.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{g.desc}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
              {room?.selectedGame ? `Host đã chọn: ${room.selectedGame}` : "Host chưa chọn trò chơi."}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void startGame()}
              disabled={!isHost || !canPlay || !allReady || !room?.selectedGame || room.status !== "waiting"}
              className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 disabled:opacity-50"
            >
              Bắt đầu (đếm ngược 5s)
            </button>
            <button onClick={() => void endGame()} disabled={!isHost || !canPlay} className="rounded-lg border border-amber-400/60 px-4 py-2 font-semibold text-amber-200 disabled:opacity-50">
              Kết thúc
            </button>
          </div>

          {isHost && selectedGame === "memory" && (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
              <p className="text-sm font-semibold text-emerald-200">Cấu hình board nhớ</p>
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="memory-board-length" className="text-sm text-slate-200">Số ô trên board</label>
                <select
                  id="memory-board-length"
                  value={memoryBoardLength}
                  onChange={(e) => setMemoryBoardLength(Number(e.target.value))}
                  className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
                >
                  {[8, 12, 16, 20, 24, 30, 36].map((value) => (
                    <option key={value} value={value}>{value} ô</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="memory-theme" className="text-sm text-slate-200">Chủ đề hình</label>
                <select
                  id="memory-theme"
                  value={memoryTheme}
                  onChange={(e) => setMemoryTheme(e.target.value as "sports" | "animals" | "fruits" | "vehicles")}
                  className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
                >
                  <option value="animals">Động vật</option>
                  <option value="fruits">Trái cây</option>
                  <option value="vehicles">Xe cộ</option>
                  <option value="sports">Thể thao</option>
                </select>
              </div>
              <button
                onClick={() => void selectGame("memory")}
                disabled={!canHostSelectGame}
                className="mt-2 rounded-lg border border-emerald-300/60 px-3 py-1.5 text-sm font-semibold text-emerald-200 disabled:opacity-50"
              >
                Áp dụng cấu hình ghi nhớ
              </button>
              <p className="mt-2 text-xs text-slate-300">Mặc định 12 ô (6 cặp). Chỉ nhận số chẵn.</p>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Bảng điều khiển trò chơi</h3>
            <GamePanelSwitch
              game={currentGame}
              disabled={!canPlay || (currentGame === "reaction" && !isHost)}
              onEmit={emitAction}
              gameState={gameState}
              playerId={playerId}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Trạng thái game</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-cyan-100">{pretty(gameState)}</pre>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Kết quả</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-100">{pretty(resultState)}</pre>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Nhật ký realtime</h3>
          <div className="mt-2 max-h-60 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">
            {logs.length ? logs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>Chưa có log.</p>}
          </div>
        </section>
      </div>

      {winnerPopup && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-300/50 bg-slate-900 p-4">
            <p className="text-xl font-bold text-emerald-300">Chiến thắng!</p>
            <p className="mt-1 text-sm text-slate-200">{winnerPopup.name} là người chiến thắng.</p>
            {winnerPopup.victoryImageDataUrl ? (
              <img
                className="mt-3 w-full rounded-xl border border-slate-700 object-cover"
                src={winnerPopup.victoryImageDataUrl}
                alt={`Anh choc vui cua ${winnerPopup.name}`}
              />
            ) : (
              <p className="mt-3 rounded-xl border border-slate-700 bg-slate-800/70 p-3 text-sm text-slate-300">Người thắng chưa thiết lập ảnh chọc vui.</p>
            )}
            <button onClick={() => setWinnerPopup(null)} className="mt-4 w-full rounded-lg border border-slate-500 px-3 py-2 text-sm font-semibold text-slate-200">
              Đóng
            </button>
          </div>
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/85 p-3">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-300/40 bg-slate-900 p-4">
            <p className="text-lg font-bold text-cyan-200">Chụp ảnh với filter</p>
            <p className="mt-1 text-xs text-slate-300">Chọn filter rồi bấm Chụp ảnh</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: "none", label: "Gốc" },
                { id: "bigeyes", label: "Mắt siêu to" },
                { id: "tinyMouth", label: "Miệng tí hon" },
                { id: "bigNose", label: "Mũi siêu to" },
                { id: "longChin", label: "Cằm dài" },
                { id: "bigForehead", label: "Trán siêu to" },
                { id: "puffyCheeks", label: "Má phồng" },
                { id: "tiltFace", label: "Mặt lệch" },
                { id: "wobble", label: "Lắc nhòe" },
                { id: "crossEyes", label: "Mắt lé" },
                { id: "funny", label: "Mặt hài tổng hợp" }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCameraFilter(item.id as CameraFilter)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${cameraFilter === item.id ? "bg-cyan-500 text-slate-900" : "border border-slate-600 text-slate-200"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <video ref={cameraVideoRef} className="hidden" playsInline muted />
            <canvas ref={cameraCanvasRef} width={640} height={480} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => void captureFromCamera()}
                disabled={!cameraReady}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                Chụp ảnh
              </button>
              <button onClick={stopCamera} className="rounded-lg border border-slate-500 px-3 py-2 text-sm font-semibold text-slate-200">
                Đóng camera
              </button>
            </div>
          </div>
        </div>
      )}

      {room?.status === "countdown" && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/90 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-300/50 bg-slate-900 p-5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Chuẩn bị bắt đầu</p>
            <p className="mt-2 text-xl font-bold text-slate-100">
              {room.selectedGame ? `Game: ${room.selectedGame}` : "Game"}
            </p>
            <p className="mt-4 text-6xl font-black text-amber-300">{countdownLeft}</p>
            <p className="mt-2 text-sm text-slate-300">Popup đã mở, game sẽ bắt đầu sau khi đếm ngược về 0.</p>
          </div>
        </div>
      )}
    </main>
  );
}

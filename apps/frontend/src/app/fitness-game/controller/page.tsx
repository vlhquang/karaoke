"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, DoorOpen, Hand, Play, Shield, Smartphone } from "lucide-react";

type PlayerSlot = "A" | "B";

interface ControllerInput {
  runPower: number;
  jump: boolean;
  punch: boolean;
  guard: boolean;
}

interface FitnessMatch {
  id: string;
  gameType: "race" | "boxing";
  status: "lobby" | "countdown" | "playing" | "result";
  countdownEndsAt: number | null;
  winnerSlot: PlayerSlot | null;
}

interface FitnessSocket {
  on: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
  disconnect?: () => void;
}

const loadSocketIo = async (): Promise<void> => {
  if ((window as Window & { io?: unknown }).io) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("socket-io-cdn");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Socket.IO CDN load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "socket-io-cdn";
    script.src = "https://cdn.socket.io/4.8.1/socket.io.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Socket.IO CDN load failed"));
    document.body.appendChild(script);
  });
};

const useQueryValue = (key: string, fallback = "") => {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(key) ?? fallback);
  }, [fallback, key]);
  return value;
};

export default function FitnessControllerPage() {
  const roomFromQr = useQueryValue("room");
  const screenFromQr = useQueryValue("screen", "A");
  const [socket, setSocket] = useState<FitnessSocket | null>(null);
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [slot, setSlot] = useState<PlayerSlot | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [match, setMatch] = useState<FitnessMatch | null>(null);
  const [message, setMessage] = useState("");
  const [permissionReady, setPermissionReady] = useState(false);
  const [input, setInput] = useState<ControllerInput>({ runPower: 0, jump: false, punch: false, guard: false });
  const samplesRef = useRef<number[]>([]);
  const lastPunchRef = useRef(0);
  const lastJumpRef = useRef(0);

  useEffect(() => setRoom(roomFromQr.toUpperCase()), [roomFromQr]);

  useEffect(() => {
    let nextSocket: FitnessSocket | null = null;
    loadSocketIo()
      .then(() => {
        const socketFactory = (window as Window & {
          io?: (url: string, options: Record<string, unknown>) => FitnessSocket;
        }).io;
        if (!socketFactory) return;
        nextSocket = socketFactory(`${window.location.origin}/fitness-game`, { transports: ["websocket", "polling"] });
        nextSocket.on("match:state", (nextMatch: FitnessMatch) => setMatch(nextMatch));
        nextSocket.on("match:closed", (payload: { message?: string }) => {
          setSlot(null);
          setPlayerId("");
          setMatch(null);
          setInput({ runPower: 0, jump: false, punch: false, guard: false });
          setMessage(payload?.message ?? "Phòng game đã đóng.");
        });
        setSocket(nextSocket);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được Socket.IO."));
    return () => {
      nextSocket?.disconnect?.();
    };
  }, []);

  const screenId = useMemo<PlayerSlot>(() => (screenFromQr === "B" ? "B" : "A"), [screenFromQr]);

  const join = () => {
    const displayName = name.trim() || `Người chơi ${screenId}`;
    socket?.emit("player:join", { matchId: room, screenId, name: displayName }, (res: any) => {
      if (!res?.ok) {
        setMessage(res?.message ?? "Không tham gia được phòng.");
        return;
      }
      setSlot(res.slot);
      setPlayerId(res.playerId);
      setMatch(res.match);
      setMessage("");
    });
  };

  const requestMotionPermission = async () => {
    const motionWithPermission = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof motionWithPermission.requestPermission === "function") {
      const result = await motionWithPermission.requestPermission();
      setPermissionReady(result === "granted");
      if (result !== "granted") setMessage("Bạn cần cấp quyền cảm biến để chơi.");
      return;
    }
    setPermissionReady(true);
  };

  useEffect(() => {
    if (!permissionReady) return;

    const onMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      const x = acc?.x ?? 0;
      const y = acc?.y ?? 0;
      const z = acc?.z ?? 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const dynamic = Math.abs(magnitude - 9.8);
      const samples = samplesRef.current;
      samples.push(dynamic);
      if (samples.length > 18) samples.shift();
      const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(1, samples.length);
      const variance = samples.reduce((sum, value) => sum + Math.abs(value - average), 0) / Math.max(1, samples.length);
      const runPower = Math.min(1, Math.max(0, (average + variance * 0.8 - 1.2) / 9));
      const now = Date.now();
      const vertical = Math.abs(y);
      const jump = vertical > 18 && now - lastJumpRef.current > 650;
      const punch = Math.abs(z) > 17 && now - lastPunchRef.current > 360;
      const guard = vertical > 13 && average > 3.2;
      if (jump) lastJumpRef.current = now;
      if (punch) lastPunchRef.current = now;
      setInput({ runPower, jump, punch, guard });
    };

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [permissionReady]);

  useEffect(() => {
    if (!socket || !slot || !playerId) return;
    const timer = window.setInterval(() => {
      socket.emit("controller:input", { matchId: room, slot, playerId, input });
    }, 80);
    return () => window.clearInterval(timer);
  }, [input, playerId, room, slot, socket]);

  const start = () => {
    socket?.emit("match:start", { matchId: room, seconds: 5 }, (res: any) => {
      if (!res?.ok) setMessage(res?.message ?? "Chưa thể bắt đầu.");
    });
  };

  const leaveRoom = () => {
    if (!slot) return;
    socket?.emit("match:leave", { matchId: room }, () => {
      setSlot(null);
      setPlayerId("");
      setMatch(null);
      setInput({ runPower: 0, jump: false, punch: false, guard: false });
      setMessage("Đã rời phòng.");
    });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">Phone Controller</p>
          <h1 className="mt-2 text-2xl font-black text-slate-50">Tay cầm vận động</h1>
        </div>
        <Smartphone className="text-cyan-200" size={34} />
      </div>

      <section className="mt-5 rounded-lg border border-slate-700 bg-slate-900/75 p-4">
        {!slot ? (
          <div className="space-y-3">
            <label className="block text-sm text-slate-300">
              Mã phòng
              <input value={room} onChange={(event) => setRoom(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-center text-2xl font-black tracking-[0.25em] text-slate-100" />
            </label>
            <label className="block text-sm text-slate-300">
              Tên người chơi
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên của bạn" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100" />
            </label>
            <button onClick={join} disabled={!room} className="w-full rounded-lg bg-cyan-300 px-4 py-3 font-bold text-slate-950 disabled:opacity-40">
              Tham gia
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-950 p-4 text-center">
              <p className="text-sm text-slate-400">Bạn là người chơi</p>
              <p className="text-5xl font-black text-cyan-200">{slot}</p>
              <p className="mt-1 text-sm text-slate-500">{match?.gameType === "boxing" ? "Đấm bốc" : "Chạy đua"}</p>
            </div>

            <button onClick={requestMotionPermission} className="w-full rounded-lg bg-emerald-300 px-4 py-3 font-bold text-slate-950">
              {permissionReady ? "Cảm biến đã sẵn sàng" : "Bật cảm biến chuyển động"}
            </button>

            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                <span className="flex items-center gap-2">
                  <Activity size={17} /> Cường độ chạy/đánh tay
                </span>
                <span>{Math.round(input.runPower * 100)}%</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-cyan-300 transition-all" style={{ width: `${input.runPower * 100}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`rounded-lg border p-3 ${input.jump ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-slate-700 bg-slate-950 text-slate-400"}`}>
                Nhảy
              </div>
              <div className={`rounded-lg border p-3 ${input.punch ? "border-rose-300 bg-rose-300/15 text-rose-100" : "border-slate-700 bg-slate-950 text-slate-400"}`}>
                <Hand className="mx-auto mb-1" size={18} /> Đấm
              </div>
              <div className={`rounded-lg border p-3 ${input.guard ? "border-emerald-300 bg-emerald-300/15 text-emerald-100" : "border-slate-700 bg-slate-950 text-slate-400"}`}>
                <Shield className="mx-auto mb-1" size={18} /> Thủ
              </div>
            </div>

            <button onClick={start} className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/70 px-4 py-3 font-bold text-emerald-100">
              <Play size={18} /> Bắt đầu trận
            </button>

            <button onClick={leaveRoom} className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300/70 px-4 py-3 font-bold text-rose-100">
              <DoorOpen size={18} /> Rời phòng
            </button>
          </div>
        )}
        {message && <p className="mt-3 rounded-lg bg-rose-500/15 p-3 text-sm text-rose-100">{message}</p>}
      </section>

      <p className="mt-4 text-sm leading-6 text-slate-400">
        Cầm chắc điện thoại, đứng cách xa người xung quanh. Game chạy khuyến khích chạy tại chỗ hoặc đánh tay đều; boxing chỉ cần vung vừa đủ, không cần quá mạnh.
      </p>

      <Link href="/fitness-game" className="mt-auto py-4 text-center text-sm text-cyan-200">
        Mở màn TV
      </Link>
    </main>
  );
}

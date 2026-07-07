"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { Activity, DoorOpen, Dumbbell, Gamepad2, Play, RotateCcw, Users } from "lucide-react";

type GameType = "race" | "boxing";
type MatchMode = "local" | "remote";
type PlayerSlot = "A" | "B";

interface FitnessPlayer {
  id: string;
  slot: PlayerSlot;
  name: string;
  screenId: PlayerSlot;
  connected: boolean;
  isAi: boolean;
  distance: number;
  speed: number;
  hp: number;
  stamina: number;
  punching: boolean;
  guarding: boolean;
  stunned: boolean;
  finishedAt: number | null;
}

interface FitnessMatch {
  id: string;
  mode: MatchMode;
  gameType: GameType;
  raceDistance: 100 | 200 | 500;
  hurdles: boolean;
  status: "lobby" | "countdown" | "playing" | "result";
  countdownEndsAt: number | null;
  winnerSlot: PlayerSlot | null;
  hosts: Partial<Record<PlayerSlot, string>>;
  players: Array<FitnessPlayer | null>;
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

const getPlayer = (match: FitnessMatch | null, slot: PlayerSlot): FitnessPlayer | null =>
  match?.players.find((player) => player?.slot === slot) ?? null;

const formatSpeed = (speed = 0): string => `${speed.toFixed(1)} m/s · ${(speed * 3.6).toFixed(1)} km/h`;

function FitnessCanvas({ match }: { match: FitnessMatch | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#09111f");
    gradient.addColorStop(0.5, "#10212c");
    gradient.addColorStop(1, "#081018");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (!match) {
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "700 28px Avenir Next, sans-serif";
      ctx.fillText("Tạo phòng để bắt đầu Fitness Game", 38, 62);
      return;
    }

    const a = getPlayer(match, "A");
    const b = getPlayer(match, "B");
    const players = [
      { player: a, color: "#22d3ee", lane: 0 },
      { player: b, color: "#fb7185", lane: 1 }
    ];

    if (match.gameType === "race") {
      const trackTop = 110;
      const laneHeight = 120;
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "800 24px Avenir Next, sans-serif";
      ctx.fillText(`${match.raceDistance}m ${match.hurdles ? "vượt rào" : "chạy tốc độ"}`, 32, 50);
      ctx.font = "600 16px Avenir Next, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Chạy tại chỗ hoặc đánh tay nhanh để tăng tốc.", 32, 78);

      for (const item of players) {
        const y = trackTop + item.lane * laneHeight;
        ctx.fillStyle = "rgba(148, 163, 184, 0.14)";
        ctx.fillRect(32, y, width - 80, 74);
        ctx.fillStyle = item.color;
        ctx.fillRect(32, y + 64, width - 80, 6);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "700 18px Avenir Next, sans-serif";
        ctx.fillText(item.player?.name ?? `Đợi người chơi ${item.lane + 1}`, 44, y + 28);
        const progress = item.player ? item.player.distance / match.raceDistance : 0;
        const x = 52 + progress * (width - 140);
        ctx.beginPath();
        ctx.arc(x, y + 48, 20, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.fillStyle = "#020617";
        ctx.font = "900 17px Avenir Next, sans-serif";
        ctx.fillText(item.player?.slot ?? "?", x - 6, y + 54);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "600 14px Avenir Next, sans-serif";
        ctx.fillText(`${Math.round(item.player?.distance ?? 0)}m`, width - 112, y + 28);
        if (item.player) {
          ctx.fillStyle = item.color;
          ctx.font = "800 15px Avenir Next, sans-serif";
          ctx.fillText(`${item.player.speed.toFixed(1)} m/s`, Math.min(width - 126, x + 28), y + 54);
        }
      }

      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(width - 48, trackTop - 10);
      ctx.lineTo(width - 48, trackTop + laneHeight * 2 - 36);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "800 24px Avenir Next, sans-serif";
      ctx.fillText("Đấm bốc vận động", 32, 50);
      ctx.font = "600 16px Avenir Next, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Vung tay để đấm, chuyển động dọc liên tục để thủ. Ai hết máu trước thua.", 32, 78);

      const leftX = width * 0.28;
      const rightX = width * 0.72;
      const floorY = height - 86;
      for (const item of [
        { player: a, color: "#22d3ee", x: leftX, face: 1 },
        { player: b, color: "#fb7185", x: rightX, face: -1 }
      ]) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.x, floorY - 95, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 16;
        ctx.strokeStyle = item.color;
        ctx.beginPath();
        ctx.moveTo(item.x, floorY - 62);
        ctx.lineTo(item.x, floorY - 12);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(item.x, floorY - 44);
        ctx.lineTo(item.x + item.face * (item.player?.punching ? 92 : 48), floorY - 64);
        ctx.stroke();
        if (item.player?.guarding) {
          ctx.strokeStyle = "#fde68a";
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(item.x + item.face * 36, floorY - 60, 34, -1.3, 1.3);
          ctx.stroke();
        }
      }
    }

    if (match.status === "countdown" && match.countdownEndsAt) {
      const seconds = Math.max(1, Math.ceil((match.countdownEndsAt - Date.now()) / 1000));
      ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "900 96px Avenir Next, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(seconds), width / 2, height / 2 + 32);
      ctx.textAlign = "left";
    }
  }, [match]);

  return <canvas ref={canvasRef} className="h-[48vh] min-h-[360px] w-full rounded-lg border border-slate-700 bg-slate-950" />;
}

export default function FitnessGamePage() {
  const [socket, setSocket] = useState<FitnessSocket | null>(null);
  const [match, setMatch] = useState<FitnessMatch | null>(null);
  const [screenId, setScreenId] = useState<PlayerSlot>("A");
  const [mode, setMode] = useState<MatchMode>("local");
  const [gameType, setGameType] = useState<GameType>("race");
  const [raceDistance, setRaceDistance] = useState<100 | 200 | 500>(100);
  const [hurdles, setHurdles] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());

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
          setMatch(null);
          setScreenId("A");
          setMessage(payload?.message ?? "Phòng game đã đóng.");
        });
        setSocket(nextSocket);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được Socket.IO."));
    return () => {
      nextSocket?.disconnect?.();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const controllerUrl = useMemo(() => {
    if (!match) return "";
    const url = new URL("/fitness-game/controller", window.location.origin);
    url.searchParams.set("room", match.id);
    url.searchParams.set("screen", match.mode === "remote" ? screenId : "A");
    return url.toString();
  }, [match, screenId]);

  const createMatch = () => {
    socket?.emit("host:create", { mode, gameType, raceDistance, hurdles }, (res: any) => {
      if (!res?.ok) {
        setMessage(res?.message ?? "Không tạo được phòng.");
        return;
      }
      setScreenId(res.screenId);
      setMatch(res.match);
      setMessage("");
    });
  };

  const joinRemote = () => {
    socket?.emit("host:join", { matchId: joinCode }, (res: any) => {
      if (!res?.ok) {
        setMessage(res?.message ?? "Không vào được phòng.");
        return;
      }
      setScreenId(res.screenId);
      setMatch(res.match);
      setMessage("");
    });
  };

  const start = (seconds = 5) => {
    socket?.emit("match:start", { matchId: match?.id, seconds }, (res: any) => {
      if (!res?.ok) setMessage(res?.message ?? "Chưa thể bắt đầu.");
    });
  };

  const leaveMatch = () => {
    if (!match) return;
    socket?.emit("match:close", { matchId: match.id }, () => {
      setMatch(null);
      setScreenId("A");
      setJoinCode("");
      setMessage("Đã thoát game. Bạn có thể chọn game khác.");
    });
  };

  const humanPlayerCount = match?.players.filter((player) => player && !player.isAi && player.connected).length ?? 0;
  const canStart = humanPlayerCount >= 1;
  const winner = match?.winnerSlot ? getPlayer(match, match.winnerSlot) : null;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">TV Fitness Game</p>
          <h1 className="mt-2 text-2xl font-black text-slate-50 md:text-4xl">Chạy đua & Đấm bốc bằng điện thoại</h1>
        </div>
        <Link href="/" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300">
          Về portal
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section>
          <FitnessCanvas match={match} />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(["A", "B"] as PlayerSlot[]).map((slot) => {
              const player = getPlayer(match, slot);
              return (
                <div key={slot} className="rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-bold text-slate-100">{player?.name ?? `Người chơi ${slot}`}</p>
                    <span className={player?.connected ? "text-sm text-emerald-300" : "text-sm text-slate-500"}>
                      {player ? (player.isAi ? "AI" : player.connected ? "Online" : "Mất kết nối") : "Đang chờ"}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={slot === "A" ? "h-full bg-cyan-300" : "h-full bg-rose-400"}
                      style={{ width: `${match?.gameType === "boxing" ? player?.hp ?? 0 : ((player?.distance ?? 0) / (match?.raceDistance ?? 100)) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {match?.gameType === "boxing"
                      ? `Máu ${Math.round(player?.hp ?? 0)} | Thể lực ${Math.round(player?.stamina ?? 0)}`
                      : `${Math.round(player?.distance ?? 0)}m | Tốc độ ${formatSpeed(player?.speed ?? 0)}`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/75 p-4">
            <div className="flex items-center gap-2 text-slate-100">
              <Gamepad2 size={20} />
              <h2 className="text-lg font-bold">Thiết lập phòng</h2>
            </div>

            {!match ? (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMode("local")} className={`rounded-lg px-3 py-2 text-sm ${mode === "local" ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-slate-200"}`}>
                    Cùng TV
                  </button>
                  <button onClick={() => setMode("remote")} className={`rounded-lg px-3 py-2 text-sm ${mode === "remote" ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-slate-200"}`}>
                    Online 2 TV
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setGameType("race")} className={`rounded-lg px-3 py-2 text-sm ${gameType === "race" ? "bg-emerald-300 text-slate-950" : "bg-slate-800 text-slate-200"}`}>
                    Chạy đua
                  </button>
                  <button onClick={() => setGameType("boxing")} className={`rounded-lg px-3 py-2 text-sm ${gameType === "boxing" ? "bg-emerald-300 text-slate-950" : "bg-slate-800 text-slate-200"}`}>
                    Đấm bốc
                  </button>
                </div>
                {gameType === "race" && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {[100, 200, 500].map((distance) => (
                        <button key={distance} onClick={() => setRaceDistance(distance as 100 | 200 | 500)} className={`rounded-lg px-3 py-2 text-sm ${raceDistance === distance ? "bg-amber-300 text-slate-950" : "bg-slate-800 text-slate-200"}`}>
                          {distance}m
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200">
                      Vượt rào
                      <input type="checkbox" checked={hurdles} onChange={(event) => setHurdles(event.target.checked)} />
                    </label>
                  </>
                )}
                <button onClick={createMatch} className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-200">
                  <Users size={18} /> Tạo phòng
                </button>
                <div className="border-t border-slate-700 pt-3">
                  <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Mã phòng online" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-lg font-bold tracking-[0.2em] text-slate-100" />
                  <button onClick={joinRemote} className="mt-2 w-full rounded-lg border border-cyan-300/60 px-4 py-2 text-cyan-100 hover:bg-cyan-300/10">
                    TV thứ 2 tham gia
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg bg-slate-950 p-4 text-center">
                  <p className="text-sm text-slate-400">Mã phòng</p>
                  <p className="text-4xl font-black tracking-[0.22em] text-cyan-200">{match.id}</p>
                  {match.mode === "remote" && <p className="mt-1 text-xs text-slate-500">TV này là màn {screenId}</p>}
                </div>
                <div className="rounded-lg bg-white p-3">
                  {controllerUrl ? <QRCodeCanvas value={controllerUrl} size={260} className="mx-auto" /> : null}
                </div>
                <p className="text-center text-sm text-slate-400">
                  Quét QR bằng điện thoại. Cần tối thiểu 1 người chơi; slot còn thiếu sẽ do AI điều khiển.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => start(5)} disabled={!canStart} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-3 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                    <Play size={17} /> 5s
                  </button>
                  <button onClick={() => start(10)} disabled={!canStart} className="flex items-center justify-center gap-2 rounded-lg border border-emerald-300/70 px-3 py-3 font-bold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">
                    <RotateCcw size={17} /> 10s
                  </button>
                </div>
                <button onClick={leaveMatch} className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300/70 px-4 py-3 font-bold text-rose-100 hover:bg-rose-300/10">
                  <DoorOpen size={18} /> Thoát game
                </button>
                {winner && (
                  <div className="rounded-lg border border-amber-300/60 bg-amber-300/10 p-3 text-center">
                    <p className="text-sm text-amber-100">Người thắng</p>
                    <p className="text-2xl font-black text-amber-200">{winner.name}</p>
                  </div>
                )}
              </div>
            )}
            {message && <p className="mt-3 rounded-lg bg-rose-500/15 p-3 text-sm text-rose-100">{message}</p>}
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/75 p-4">
            <div className="flex items-center gap-2 text-slate-100">
              {match?.gameType === "boxing" ? <Dumbbell size={19} /> : <Activity size={19} />}
              <h2 className="font-bold">Trạng thái</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {match
                ? `${match.status.toUpperCase()} | ${match.gameType === "race" ? `${match.raceDistance}m` : "đánh đến khi hết máu"}`
                : "Chưa có phòng."}
            </p>
            {match?.status === "countdown" && match.countdownEndsAt && (
              <p className="mt-2 text-3xl font-black text-cyan-200">{Math.max(1, Math.ceil((match.countdownEndsAt - now) / 1000))}</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

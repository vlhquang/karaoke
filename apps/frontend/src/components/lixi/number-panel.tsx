import { useState, useEffect, useRef, useMemo } from "react";
import type { LiXiActionProps } from "./types";

interface PopItem {
  id: string;
  type: "target" | "noise" | "bomb";
  value: number;
  x: number;
  y: number;
  scale: number;
  expiresAt: number;
}

export function NumberPanel({ disabled, onEmit, gameState, playerId, room }: LiXiActionProps) {
  const state = gameState as any;
  const playerState = state?.playerStates?.[playerId ?? ""];
  const phase = state?.phase as "PREP" | "WAIT" | "HIGHLIGHT" | "PLAYING" | undefined;

  const [items, setItems] = useState<PopItem[]>([]);
  const [blinded, setBlinded] = useState(false);
  const [localRoundStartedAt, setLocalRoundStartedAt] = useState<number | null>(null);
  const [targetFoundInRound, setTargetFoundInRound] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const targetAppearsAtRef = useRef<number>(0);

  // Sync state transitions
  useEffect(() => {
    if (phase === "PREP") {
      setItems([]);
      setTargetFoundInRound(false);
      setBlinded(false);
    } else if (phase === "PLAYING" && !localRoundStartedAt) {
      setLocalRoundStartedAt(performance.now());
    } else if (phase !== "PLAYING") {
      setLocalRoundStartedAt(null);
    }
  }, [phase]);

  // Dynamic Popping Logic
  useEffect(() => {
    if (phase !== "PLAYING" || targetFoundInRound || blinded) return;

    const spawnItem = () => {
      const now = performance.now();
      const rand = Math.random();
      let type: "target" | "noise" | "bomb" = "noise";

      if (rand < 0.1) {
        type = "target";
      } else if (rand < 0.4) { // 30% bomb (0.1 to 0.4)
        type = "bomb";
      } else {
        type = "noise";
      }

      const newItem: PopItem = {
        id: Math.random().toString(36).substring(2, 9),
        type,
        value: type === "target" ? state.targetNumber : Math.floor(Math.random() * 99) + 1,
        x: 10 + Math.random() * 80, // 10% to 90%
        y: 10 + Math.random() * 80,
        scale: 0.8 + Math.random() * 0.4,
        expiresAt: now + 800 + Math.random() * 1200 // 0.8s to 2s
      };

      setItems((prev: PopItem[]) => [...prev.filter((item: PopItem) => item.expiresAt > now), newItem]);
    };

    const interval = setInterval(() => {
      if (items.length < 8) spawnItem();
    }, 400);

    return () => clearInterval(interval);
  }, [phase, targetFoundInRound, blinded, items.length, state?.targetNumber]);

  // Auto-cleanup expired items
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      setItems((prev: PopItem[]) => prev.filter((item: PopItem) => item.expiresAt > now));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleTap = (item: PopItem) => {
    if (disabled || blinded || targetFoundInRound) return;

    if (item.type === "target") {
      setTargetFoundInRound(true);
      const duration = localRoundStartedAt ? Math.round(performance.now() - localRoundStartedAt) : 0;
      onEmit("number:found", { durationMs: duration });
      setItems([]);
    } else if (item.type === "bomb") {
      setBlinded(true);
      setTimeout(() => setBlinded(false), 1000);
      setItems([]);
    } else {
      // Noise penalty: optional, user didn't specify but usually good for anti-spam
      // Let's just remove the item for now
      setItems((prev: PopItem[]) => prev.filter((i: PopItem) => i.id !== item.id));
    }
  };

  const sortedPlayers = useMemo(() => {
    if (!room?.players) return [];
    const playersArr = Array.isArray(room.players) ? room.players : [];
    return [...playersArr].sort((a: any, b: any) => {
      const sa = state?.playerStates?.[a.playerId]?.foundCount ?? 0;
      const sb = state?.playerStates?.[b.playerId]?.foundCount ?? 0;
      if (sa !== sb) return sb - sa;
      return (state?.playerStates?.[a.playerId]?.totalTimeMs ?? 0) - (state?.playerStates?.[b.playerId]?.totalTimeMs ?? 0);
    });
  }, [room?.players, state?.playerStates]);

  if (!state) return <div className="p-4 text-center">Đang tải...</div>;

  return (
    <div className="relative flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl">

      {/* HUD Layer */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Hiệp {state.round}</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">{playerState?.foundCount ?? 0}</span>
            <span className="text-xs font-semibold text-slate-500">/ {state.targetCountToWin}</span>
          </div>
        </div>

        {(phase === "HIGHLIGHT" || phase === "PLAYING") && (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tìm số</span>
            <span className="text-3xl font-black text-violet-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.5)]">{state.targetNumber}</span>
          </div>
        )}

        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Thời gian</span>
          <p className="font-mono text-sm font-bold text-white">{(playerState?.totalTimeMs / 1000).toFixed(2)}s</p>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative h-full w-full">
        {phase === "PREP" && (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            {Date.now() < state.phaseEndsAt - 2000 ? (
              <div className="w-full max-w-xs animate-in fade-in zoom-in duration-300">
                <h3 className="mb-4 text-center text-lg font-bold text-amber-300">Bảng xếp hạng</h3>
                <div className="space-y-2">
                  {sortedPlayers.slice(0, 5).map((p, i) => (
                    <div key={p.playerId} className="flex items-center justify-between rounded-lg bg-white/5 p-2 border border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-xs font-bold text-slate-500">{i + 1}</span>
                        <span className={`text-sm font-semibold ${p.playerId === playerId ? "text-cyan-400" : "text-white"}`}>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-emerald-400">{state.playerStates?.[p.playerId]?.foundCount ?? 0}</span>
                        <span className="text-[10px] font-mono text-slate-500">{(state.playerStates?.[p.playerId]?.totalTimeMs / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center animate-in zoom-in duration-300">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">Sẵn sàng</p>
                <p className="text-8xl font-black text-white drop-shadow-2xl">
                  {Math.ceil((state.phaseEndsAt - Date.now()) / 1000)}
                </p>
              </div>
            )}
          </div>
        )}

        {phase === "WAIT" && (
          <div className="flex h-full w-full flex-col items-center justify-center text-center">
            <div className="animate-pulse">
              <span className="text-4xl mb-4 block">⏳</span>
              <p className="text-xl font-bold text-amber-400 uppercase tracking-widest">Đang chờ số...</p>
              <p className="text-sm text-slate-400">Chuẩn bị tinh thần!</p>
            </div>
          </div>
        )}
        {phase === "HIGHLIGHT" && (
          <div className="flex h-full w-full flex-col items-center justify-center bg-violet-600/20">
            <p className="mb-2 text-sm font-bold uppercase tracking-widest text-violet-300">Mục tiêu là số</p>
            <div className="animate-bounce-slow flex h-40 w-40 items-center justify-center rounded-full bg-white text-7xl font-black text-violet-700 shadow-[0_0_50px_rgba(255,255,255,0.4)]">
              {state.targetNumber}
            </div>
          </div>
        )}

        {phase === "PLAYING" && (
          <div className="h-full w-full">
            {targetFoundInRound ? (
              <div className="flex h-full w-full items-center justify-center text-center">
                <div className="animate-in zoom-in duration-500">
                  <span className="text-6xl mb-2 block">✅</span>
                  <p className="text-xl font-bold text-emerald-400">Đã xong!</p>
                  <p className="text-sm text-slate-400">Chờ người chơi khác...</p>
                </div>
              </div>
            ) : (
              items.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleTap(item)}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    transform: `translate(-50%, -50%) scale(${item.scale})`,
                  }}
                  className={`absolute flex h-16 w-16 items-center justify-center rounded-2xl border-2 font-black transition-all active:scale-90
                    ${item.type === "target"
                      ? "border-amber-400 bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)] z-30"
                      : item.type === "bomb"
                        ? "border-red-500 bg-slate-900 shadow-lg z-20"
                        : "border-slate-700 bg-slate-800/80 text-slate-400 z-10"
                    }
                  `}
                >
                  {item.type === "bomb" ? (
                    <span className="text-2xl animate-pulse">💣</span>
                  ) : (
                    <span className="text-2xl">{item.value}</span>
                  )}
                </button>
              ))
            )}

            {/* Blindness Overlay */}
            {blinded && (
              <div className="absolute inset-0 z-[100] bg-black animate-in fade-in duration-100 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-4xl mb-2 block">💥</span>
                  <p className="text-sm font-bold text-red-500 uppercase tracking-tighter">BỊ MÙ 1S</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {state.done && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 animate-in fade-in duration-500">
          <span className="text-7xl mb-4">🏆</span>
          <h2 className="text-3xl font-black text-amber-400 mb-2">CHIẾN THẮNG!</h2>
          <p className="text-lg font-bold text-white mb-6">
            {room.players.find((p: any) => p.playerId === state.winnerId)?.name ?? "Người chơi"}
          </p>
          <div className="w-full max-w-xs space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center mb-2">Tổng kết</p>
            {sortedPlayers.map((p, i) => (
              <div key={p.playerId} className="flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-300">{i + 1}. {p.name}</span>
                <span className="font-mono text-emerald-400">{(state.playerStates?.[p.playerId]?.totalTimeMs / 1000).toFixed(2)}s</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

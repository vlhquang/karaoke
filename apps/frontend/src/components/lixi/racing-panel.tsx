"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { LiXiActionProps } from "./types";

interface RacingPlayerState {
    progress: number;
    finishedAt: number | null;
    rank: number | null;
}

interface RacingRankEntry {
    playerId: string;
    progress: number;
    finishedAt: number | null;
    rank: number | null;
}

interface RacingState {
    playerStates: Record<string, RacingPlayerState>;
    startedAt: number;
    finishOrder: string[];
    done: boolean;
    winnerId: string | null;
    ranking: RacingRankEntry[];
}

const parseRacingState = (payload: unknown): RacingState | null => {
    if (!payload || typeof payload !== "object") return null;
    const root = payload as { gameState?: unknown; result?: unknown };
    const candidate = (root.gameState ?? root.result ?? payload) as Partial<RacingState>;
    if (!candidate || typeof candidate !== "object") return null;
    if (!candidate.playerStates || typeof candidate.playerStates !== "object") return null;
    return candidate as RacingState;
};

// Car emojis for players
const CAR_EMOJIS = ["🏎️", "🚗", "🚕", "🚙", "🚓", "🛻", "🚐", "🚌"];
const CAR_COLORS = [
    "from-red-500 to-orange-500",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-green-500",
    "from-amber-500 to-yellow-400",
    "from-purple-500 to-violet-500",
    "from-pink-500 to-rose-400",
    "from-teal-500 to-cyan-400",
    "from-indigo-500 to-blue-400",
];

const RANK_LABELS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];

interface RacingPanelProps extends LiXiActionProps {
    gameState?: unknown;
    playerId?: string;
    room?: any;
}

export function RacingPanel({ disabled, onEmit, gameState, playerId, room, onClose }: RacingPanelProps) {
    const state = useMemo(() => parseRacingState(gameState), [gameState]);
    const [localProgress, setLocalProgress] = useState(0);
    const [tapCount, setTapCount] = useState(0);
    const [pulseKey, setPulseKey] = useState(0);
    const animFrameRef = useRef<number | null>(null);
    const lastEmitRef = useRef<number>(0);

    // Sync local progress from server state
    useEffect(() => {
        if (!state || !playerId) return;
        const ps = state.playerStates?.[playerId];
        if (ps) {
            setLocalProgress(ps.progress);
        }
    }, [state, playerId]);

    const handleTap = useCallback(() => {
        if (disabled || !state || state.done) return;
        if (playerId && state.playerStates?.[playerId]?.finishedAt !== null) return;

        // Optimistic local update
        setLocalProgress((prev) => Math.min(100, prev + 3.5));
        setTapCount((c) => c + 1);
        setPulseKey((k) => k + 1);

        // Throttle: emit at most every 50ms
        const now = Date.now();
        if (now - lastEmitRef.current >= 50) {
            lastEmitRef.current = now;
            onEmit("racing:tap", {});
        }
    }, [disabled, state, onEmit, playerId]);

    // Keyboard support (spacebar / enter)
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.code === "Space" || e.code === "Enter") {
                e.preventDefault();
                handleTap();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [handleTap]);

    // Build player list from room + state
    const playerList = useMemo(() => {
        if (!room?.players) return [];
        const playersArr: any[] = Array.isArray(room.players) ? room.players : [];
        return playersArr.map((p: any, idx: number) => ({
            ...p,
            carEmoji: CAR_EMOJIS[idx % CAR_EMOJIS.length],
            carColor: CAR_COLORS[idx % CAR_COLORS.length],
            progress: state?.playerStates?.[p.playerId]?.progress ?? 0,
            finishedAt: state?.playerStates?.[p.playerId]?.finishedAt ?? null,
            rank: state?.playerStates?.[p.playerId]?.rank ?? null,
        })).sort((a, b) => b.progress - a.progress);
    }, [room?.players, state?.playerStates]);

    const myPlayer = playerList.find((p) => p.playerId === playerId);
    const myProgress = state?.playerStates?.[playerId ?? ""]?.progress ?? localProgress;
    const myFinished = state?.playerStates?.[playerId ?? ""]?.finishedAt !== null;
    const myRank = state?.playerStates?.[playerId ?? ""]?.rank ?? null;

    if (!state) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border border-slate-700 rounded-3xl bg-slate-900/40 w-full h-[500px]">
                <div className="text-5xl mb-4">🏎️</div>
                <p className="text-slate-300 font-bold">Chờ Host nhấn BẮT ĐẦU</p>
                <p className="text-xs text-slate-500 mt-2">Game đua xe sẽ bắt đầu sau countdown</p>
            </div>
        );
    }

    return (
        <div
            className="relative flex h-[min(85vh,850px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl select-none"
            style={{ touchAction: "manipulation" }}
        >
            {/* HUD */}
            <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Racing</span>
                    <span className="text-2xl font-black text-white">Đua Xe</span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tiến độ</span>
                    <p className="font-mono text-sm font-bold text-white leading-tight">
                        {Math.round(myProgress)}%
                    </p>
                </div>
            </div>

            {/* Race Tracks */}
            <div className="relative w-full flex-1 flex flex-col justify-center px-4 pt-16 pb-4 gap-0 overflow-y-auto">
                {playerList.map((player, idx) => {
                    const progress = player.progress ?? 0;
                    const isMe = player.playerId === playerId;
                    const finished = player.finishedAt !== null;
                    return (
                        <div key={player.playerId} className="mb-2 last:mb-0">
                            {/* Player name row */}
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{player.carEmoji}</span>
                                    <span className={`text-xs font-bold ${isMe ? "text-cyan-300" : "text-slate-300"}`}>
                                        {player.name ?? player.playerId}
                                        {isMe && <span className="ml-1 text-cyan-500">(bạn)</span>}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {finished && player.rank && (
                                        <span className="text-sm">{RANK_LABELS[(player.rank - 1) % RANK_LABELS.length]}</span>
                                    )}
                                    <span className="text-[10px] font-mono text-slate-500">{Math.round(progress)}%</span>
                                </div>
                            </div>

                            {/* Track */}
                            <div className="relative h-8 w-full rounded-full overflow-hidden bg-slate-800/80 border border-slate-700">
                                {/* Track dashes */}
                                <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
                                    {([20, 40, 60, 80] as number[]).map((dash) => (
                                        <div
                                            key={dash}
                                            className="absolute top-1/2 -translate-y-1/2 w-4 h-[2px] bg-slate-600/50"
                                            style={{ left: `${dash}%` }}
                                        />
                                    ))}
                                </div>

                                {/* Progress fill */}
                                <div
                                    className={`absolute left-0 top-0 h-full bg-gradient-to-r ${player.carColor} opacity-40 rounded-full transition-all duration-100`}
                                    style={{ width: `${progress}%` }}
                                />

                                {/* Car position */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 text-lg leading-none transition-all duration-100"
                                    style={{
                                        left: `calc(${Math.min(progress, 96)}% - 12px)`,
                                    }}
                                >
                                    {player.carEmoji}
                                </div>

                                {/* Finish line */}
                                <div className="absolute right-0 top-0 bottom-0 w-[3px] flex flex-col overflow-hidden">
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`flex-1 ${i % 2 === 0 ? "bg-white" : "bg-black"}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* TAP BUTTON / Finished overlay */}
            <div className="relative z-10 w-full px-4 pb-4 shrink-0">
                {state.done ? (
                    <div className="text-center py-4 animate-in zoom-in duration-500">
                        {myRank === 1 ? (
                            <>
                                <span className="text-5xl block mb-2">🏆</span>
                                <p className="text-xl font-black text-amber-400 uppercase">Chiến thắng!</p>
                            </>
                        ) : (
                            <>
                                <span className="text-4xl block mb-2">{myRank ? RANK_LABELS[(myRank - 1) % RANK_LABELS.length] : "🏁"}</span>
                                <p className="text-lg font-black text-white uppercase">
                                    {myFinished ? `Hạng ${myRank}` : "Chưa về đích"}
                                </p>
                            </>
                        )}
                    </div>
                ) : myFinished ? (
                    <div className="text-center py-4 animate-in zoom-in duration-300">
                        <span className="text-3xl block mb-2">✅</span>
                        <p className="text-base font-black text-emerald-400">Đã về đích!</p>
                        <p className="text-xs text-slate-400">Chờ người chơi khác...</p>
                    </div>
                ) : (
                    <button
                        key={pulseKey}
                        onPointerDown={handleTap}
                        disabled={disabled}
                        className={`
              w-full h-20 rounded-2xl font-black text-2xl uppercase tracking-widest
              bg-gradient-to-br from-cyan-500 to-blue-600
              text-white shadow-xl shadow-cyan-500/30
              active:scale-95 transition-transform duration-75
              disabled:opacity-40 disabled:cursor-not-allowed
              border-b-4 border-blue-700
            `}
                        style={{ touchAction: "manipulation" }}
                    >
                        🚀 BẤM ĐỂ CHẠY!
                    </button>
                )}

                {/* Tap counter */}
                {!state.done && !myFinished && (
                    <p className="text-center text-[10px] text-slate-600 mt-2 font-mono">
                        {tapCount} lần bấm
                    </p>
                )}
            </div>
        </div>
    );
}

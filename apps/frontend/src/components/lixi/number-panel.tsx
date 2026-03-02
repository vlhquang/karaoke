import { useState, useEffect } from "react";
import type { LiXiActionProps } from "./types";

export function NumberPanel({ disabled, onEmit, gameState, playerId }: LiXiActionProps) {
  const state = gameState as any;
  const playerState = state?.playerStates?.[playerId ?? ""];
  const isLocked = playerState && Date.now() < playerState.lockUntil;
  const [localLock, setLocalLock] = useState(false);

  // Sync local lock with player state lock
  useEffect(() => {
    if (isLocked) {
      setLocalLock(true);
      const timer = setTimeout(() => setLocalLock(false), playerState.lockUntil - Date.now());
      return () => clearTimeout(timer);
    }
  }, [isLocked, playerState?.lockUntil]);

  if (!state?.grid) {
    return <div className="p-4 text-center text-slate-400">Đang khởi tạo lưới số...</div>;
  }

  const handleTap = (num: number) => {
    if (disabled || localLock || state.done) return;
    onEmit("number:tap", { number: num });

    // If we want instant local feedback for "wrong" (optional, but good for UX)
    if (num !== state.targetNumber) {
      setLocalLock(true);
      setTimeout(() => setLocalLock(false), 1000);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 py-4">
      {/* Target Display */}
      <div className="flex flex-col items-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Tìm số mục tiêu</p>
        <div className="mt-2 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-violet-400 bg-violet-500/10 shadow-[0_0_20px_rgba(167,139,250,0.3)]">
          <span className="text-4xl font-black text-violet-100">{state.targetNumber}</span>
        </div>
      </div>

      {/* Grid */}
      <div className={`relative grid grid-cols-5 gap-2 transition-all duration-300 ${localLock ? "scale-95 opacity-50 grayscale" : "opacity-100"}`}>
        {state.grid.map((n: number, idx: number) => (
          <button
            key={`${n}-${idx}`}
            onClick={() => handleTap(n)}
            disabled={disabled || state.done}
            className={`flex h-12 w-12 items-center justify-center rounded-xl border font-bold transition-all active:scale-95 sm:h-14 sm:w-14 sm:text-lg
              ${n === state.targetNumber && state.done
                ? "border-emerald-400 bg-emerald-500 text-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-violet-400/50 hover:bg-slate-800"
              }
              ${disabled || state.done ? "cursor-default" : "cursor-pointer"}
            `}
          >
            {n}
          </button>
        ))}

        {/* Lockout Overlay */}
        {localLock && !state.done && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/20 backdrop-blur-[1px]">
            <div className="rounded-full bg-red-500/20 px-4 py-1 border border-red-500/40">
              <span className="text-xs font-bold text-red-200 uppercase tracking-tighter">Bị khóa 1s</span>
            </div>
          </div>
        )}
      </div>

      {/* Score/Status */}
      <div className="flex w-full justify-between px-2 text-xs font-medium text-slate-400">
        <p>Điểm phản xạ: <span className={playerState?.reflexPoints < 0 ? "text-rose-400" : "text-emerald-400"}>{playerState?.reflexPoints ?? 0}</span></p>
        {state.done && (
          <p className="text-emerald-400 font-bold uppercase animate-pulse">Trò chơi kết thúc!</p>
        )}
      </div>
    </div>
  );
}

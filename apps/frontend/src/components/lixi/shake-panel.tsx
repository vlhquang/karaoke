import { useState } from "react";
import type { LiXiActionProps } from "./types";

export function ShakePanel({ disabled, onEmit, onClose }: LiXiActionProps) {
  const [score, setScore] = useState(1200);

  return (
    <div className="relative flex h-[min(85vh,750px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl">
      {/* HUD Layer */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">Shake It</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">Lắc Tay</span>
          </div>
        </div>


        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Điểm số</span>
          <p className="font-mono text-sm font-bold text-white leading-tight">
            {score}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative h-full w-full flex flex-col pt-16 px-6">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-8 p-6 rounded-full bg-fuchsia-500/10 border-4 border-fuchsia-500/20 animate-pulse">
            <span className="text-6xl">📱</span>
          </div>

          <h2 className="text-xl font-black text-white mb-4 uppercase italic">Lắc điện thoại ngay!</h2>

          <div className="w-full max-w-xs space-y-4">
            <input
              type="range"
              min={0}
              max={10000}
              value={score}
              disabled={disabled}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-fuchsia-500"
            />

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-baseline px-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Cường độ</span>
                <span className="text-2xl font-black text-fuchsia-400">{score}</span>
              </div>

              <button
                onClick={() => onEmit("shake:submit", { shakeScore: score })}
                disabled={disabled}
                className="w-full rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 py-4 text-sm font-black text-white shadow-xl shadow-fuchsia-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                GỬI ĐIỂM SỐ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

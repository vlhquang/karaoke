import { useState } from "react";
import type { LiXiActionProps } from "./types";

export function ShakePanel({ disabled, onEmit }: LiXiActionProps) {
  const [score, setScore] = useState(1200);

  return (
    <div className="space-y-3">
      <input
        type="range"
        min={0}
        max={10000}
        value={score}
        disabled={disabled}
        onChange={(e) => setScore(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-300">
          Điểm lắc: <span className="font-bold text-fuchsia-300">{score}</span>
        </p>
        <button
          onClick={() => onEmit("shake:submit", { shakeScore: score })}
          disabled={disabled}
          className="rounded-lg bg-fuchsia-500 px-4 py-2 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gửi điểm
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import type { LiXiActionProps } from "./types";

export function NumberPanel({ disabled, onEmit }: LiXiActionProps) {
  const [manualNumber, setManualNumber] = useState("1");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onEmit("number:tap", { number: n })}
            disabled={disabled}
            className="rounded border border-slate-600 px-2 py-2 text-sm hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={manualNumber}
          onChange={(e) => setManualNumber(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 disabled:opacity-50"
          placeholder="Nhập số"
        />
        <button
          onClick={() => onEmit("number:tap", { number: Number(manualNumber) || 0 })}
          disabled={disabled}
          className="rounded-lg border border-violet-400/60 px-4 py-2 text-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gửi
        </button>
      </div>
    </div>
  );
}

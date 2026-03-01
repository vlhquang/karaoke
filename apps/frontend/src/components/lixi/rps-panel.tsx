import { useState } from "react";
import type { LiXiActionProps } from "./types";

const options = [
  { value: "rock", label: "Búa" },
  { value: "paper", label: "Bao" },
  { value: "scissors", label: "Kéo" }
] as const;

export function RpsPanel({ disabled, onEmit }: LiXiActionProps) {
  const [selected, setSelected] = useState<(typeof options)[number]["value"]>("rock");

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => {
            setSelected(option.value);
            onEmit("rps:submit", { choice: option.value });
          }}
          disabled={disabled}
          className={`rounded-lg px-3 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${selected === option.value ? "bg-amber-500 text-slate-900" : "border border-slate-600"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

import { useState } from "react";
import type { LiXiActionProps } from "./types";

const colors = ["red", "green", "blue", "yellow", "purple", "orange"];

export function ColorPanel({ disabled, onEmit }: LiXiActionProps) {
  const [selected, setSelected] = useState("red");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => {
              setSelected(color);
              onEmit("color:tap", { color });
            }}
            disabled={disabled}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize disabled:cursor-not-allowed disabled:opacity-50 ${selected === color ? "border-rose-300 bg-rose-500/20" : "border-slate-600"}`}
          >
            {color}
          </button>
        ))}
      </div>
    </div>
  );
}

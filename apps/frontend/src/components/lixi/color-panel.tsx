import { useState } from "react";
import type { LiXiActionProps } from "./types";

const colors = ["red", "green", "blue", "yellow", "purple", "orange"];

export function ColorPanel({ disabled, onEmit, onClose }: LiXiActionProps) {
  const [selected, setSelected] = useState("red");

  return (
    <div className="relative flex h-[min(85vh,750px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl">
      {/* HUD Layer */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Color Tap</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">Chạm Màu</span>
          </div>
        </div>


        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Màu chọn</span>
          <p className="font-mono text-sm font-bold text-white leading-tight capitalize">
            {selected || "---"}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative h-full w-full flex flex-col pt-16 px-6">
        <div className="flex flex-1 flex-col items-center justify-center">
          <h2 className="text-xl font-black text-white mb-8 uppercase italic text-center">Bấm vào các màu bên dưới!</h2>

          <div className="grid w-full max-w-sm grid-cols-3 gap-3">
            {colors.map((color) => {
              const isActive = selected === color;
              const colorMap: Record<string, string> = {
                red: "bg-rose-500",
                green: "bg-emerald-500",
                blue: "bg-blue-500",
                yellow: "bg-amber-400",
                purple: "bg-purple-500",
                orange: "bg-orange-500"
              };

              return (
                <button
                  key={color}
                  onClick={() => {
                    setSelected(color);
                    onEmit("color:tap", { color });
                  }}
                  disabled={disabled}
                  className={`group relative flex aspect-square items-center justify-center rounded-2xl border-2 transition-all duration-300
                    ${isActive
                      ? "border-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
                    }
                    disabled:cursor-not-allowed disabled:opacity-50
                  `}
                >
                  <div className={`h-12 w-12 rounded-full ${colorMap[color]} shadow-lg transition-transform group-hover:scale-110`} />
                  {isActive && (
                    <div className="absolute -top-2 -right-2 rounded-full bg-white p-1 text-slate-950">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

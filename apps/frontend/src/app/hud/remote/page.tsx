"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Car, Bike, Plus, Minus, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useHudStore } from "../../../store/hud-store";
import type { HudState } from "@karaoke/shared";

export default function HudRemotePage() {
  const {
    connected, roomCode, role, state, error,
    connect, joinRoom, updateState, leaveRoom, clearError,
  } = useHudStore();

  const [inputCode, setInputCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  const handleJoin = async () => {
    if (!inputCode.trim()) return;
    setJoining(true);
    await joinRoom(inputCode.trim());
    setJoining(false);
  };

  const patch = (p: Partial<HudState>) => updateState(p);

  // Tính tốc độ tối đa hiện tại
  const currentMaxSpeed = (() => {
    if (state.roadType === "manual") return state.manualMax;
    if (state.roadType === "1_lane") return state.zone === "residential" ? 50 : 80;
    return state.zone === "residential" ? 60 : 90;
  })();

  if (!role) {
    return (
      <main className="min-h-[100dvh] bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/hud" className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Điều Khiển HUD</h1>
              <p className="text-sm text-slate-400">Nhập mã phòng từ màn hình HUD</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-300 text-sm flex justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-400 ml-2">✕</button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
              <span className={connected ? "text-green-400" : "text-red-400"}>
                {connected ? "Đã kết nối server" : "Chưa kết nối server"}
              </span>
            </div>

            <input
              className="w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-4 text-3xl font-bold text-center tracking-[0.3em] uppercase outline-none transition"
              placeholder="XXXX"
              maxLength={4}
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
            />

            <button
              onClick={handleJoin}
              disabled={!connected || joining || inputCode.length < 4}
              className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl text-xl font-bold transition flex items-center justify-center gap-2"
            >
              {joining ? <><Loader2 size={22} className="animate-spin" /> Đang kết nối...</> : "Kết nối"}
            </button>
          </div>

          <div className="text-center text-slate-500 text-xs">
            Mã phòng hiển thị trên màn hình HUD sau khi bấm nút <strong className="text-slate-300">Phát sóng</strong>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button onClick={leaveRoom} className="p-1.5 bg-slate-800 rounded-full text-slate-300">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="text-xs text-slate-400">Điều khiển HUD</div>
            <div className="font-mono font-bold text-cyan-300 tracking-widest">{roomCode}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {connected
            ? <><Wifi size={14} className="text-green-400" /><span className="text-green-400">Đã kết nối</span></>
            : <><WifiOff size={14} className="text-red-400" /><span className="text-red-400">Mất kết nối</span></>
          }
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-5 p-4 overflow-y-auto">

        {/* Tốc độ giới hạn hiện tại */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="w-28 h-28 rounded-full border-[10px] border-red-600 bg-white flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.4)]">
            <span className="text-5xl font-bold text-black">{currentMaxSpeed}</span>
          </div>
          <div className="text-slate-400 text-sm">
            <div className="text-white font-bold text-xl">Giới hạn hiện tại</div>
            <div>{state.roadType === "manual" ? "Tự chọn" : state.roadType === "1_lane" ? "Đường 1 làn" : "Đường 2 làn"}</div>
            <div className={state.zone === "residential" ? "text-orange-400" : "text-green-400"}>
              {state.zone === "residential" ? "Khu dân cư" : "Ngoài khu dân cư"}
            </div>
          </div>
        </div>

        {/* Chuyển Khu dân cư */}
        <button
          onClick={() => patch({ zone: state.zone === "residential" ? "outside" : "residential", roadType: state.roadType === "manual" ? "1_lane" : state.roadType })}
          className={`w-full py-5 rounded-2xl border-2 text-2xl font-bold transition-all ${
            state.zone === "residential"
              ? "bg-orange-950/60 border-orange-500 text-orange-300"
              : "bg-green-950/60 border-green-500 text-green-300"
          }`}
        >
          {state.zone === "residential" ? "🏘 Khu dân cư → Ngoài KDC" : "🌿 Ngoài KDC → Khu dân cư"}
        </button>

        {/* Loại đường */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => patch({ roadType: "1_lane" })}
            className={`py-4 rounded-xl border-2 text-lg font-bold transition-all ${state.roadType === "1_lane" ? "bg-blue-900/60 border-blue-400 text-blue-200" : "bg-slate-800/60 border-slate-700 text-slate-400"}`}
          >
            🛣 Đường 1 làn
          </button>
          <button
            onClick={() => patch({ roadType: "2_lane" })}
            className={`py-4 rounded-xl border-2 text-lg font-bold transition-all ${state.roadType === "2_lane" ? "bg-blue-900/60 border-blue-400 text-blue-200" : "bg-slate-800/60 border-slate-700 text-slate-400"}`}
          >
            🛤 Đường 2 làn
          </button>
        </div>

        {/* Biển báo tốc độ */}
        <div>
          <div className="text-sm text-slate-400 mb-3 font-semibold uppercase tracking-wide">Biển báo thủ công</div>
          <div className="grid grid-cols-4 gap-3">
            {[40, 50, 60, 80, 90, 100, 120].map(s => (
              <button
                key={s}
                onClick={() => patch({ roadType: "manual", manualMax: s })}
                className={`py-4 rounded-full border-[3px] text-2xl font-bold flex items-center justify-center transition-all ${
                  state.roadType === "manual" && state.manualMax === s
                    ? "border-red-500 bg-white text-black scale-110 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                    : "border-slate-600 bg-slate-800/60 text-slate-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Sai số GPS */}
        <div>
          <div className="text-sm text-slate-400 mb-3 font-semibold uppercase tracking-wide">
            Sai số GPS
            <span className={`ml-2 font-bold text-base ${state.offset === 0 ? "text-slate-500" : state.offset > 0 ? "text-cyan-400" : "text-yellow-400"}`}>
              {state.offset > 0 ? `+${state.offset}` : state.offset} km/h
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => patch({ offset: state.offset - 1 })}
              className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-center text-white transition"
            >
              <Minus size={32} />
            </button>
            <button
              onClick={() => patch({ offset: 0 })}
              className="px-6 py-5 bg-slate-700 hover:bg-slate-600 rounded-2xl text-slate-300 text-sm font-bold transition"
            >
              Reset
            </button>
            <button
              onClick={() => patch({ offset: state.offset + 1 })}
              className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-center text-white transition"
            >
              <Plus size={32} />
            </button>
          </div>
        </div>

        {/* Phương tiện */}
        <div>
          <div className="text-sm text-slate-400 mb-3 font-semibold uppercase tracking-wide">Phương tiện</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => patch({ mode: "moto" })}
              className={`py-4 rounded-xl border-2 text-lg font-bold flex items-center justify-center gap-2 transition-all ${state.mode === "moto" ? "bg-cyan-900/60 border-cyan-400 text-cyan-200" : "bg-slate-800/60 border-slate-700 text-slate-400"}`}
            >
              <Bike size={22} /> Xe máy
            </button>
            <button
              onClick={() => patch({ mode: "car" })}
              className={`py-4 rounded-xl border-2 text-lg font-bold flex items-center justify-center gap-2 transition-all ${state.mode === "car" ? "bg-cyan-900/60 border-cyan-400 text-cyan-200" : "bg-slate-800/60 border-slate-700 text-slate-400"}`}
            >
              <Car size={22} /> Ô tô (HUD)
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

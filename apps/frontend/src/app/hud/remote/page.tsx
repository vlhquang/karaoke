"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Car, Bike, Plus, Minus, Wifi, WifiOff, Loader2, MapPin, Trash2, RefreshCw, Eye, EyeOff, Map as MapIcon, List } from "lucide-react";
import { useHudStore } from "../../../store/hud-store";
import { useSpeedZoneStore } from "../../../store/speed-zone-store";
import type { HudState } from "@karaoke/shared";

const SpeedZoneMap = dynamic(() => import("./SpeedZoneMap"), {
  ssr: false,
  loading: () => <div className="w-full h-[500px] bg-slate-900 animate-pulse rounded-xl flex items-center justify-center text-slate-500 mt-3">Đang tải bản đồ...</div>
});

export default function HudRemotePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Đang tải...</div>}>
      <HudRemoteContent />
    </Suspense>
  );
}

function HudRemoteContent() {
  const {
    connected, roomCode, role, state, error,
    connect, joinRoom, updateState, leaveRoom, clearError,
  } = useHudStore();

  const speedZoneStore = useSpeedZoneStore();
  const [inputCode, setInputCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showZones, setShowZones] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("map");

  const searchParams = useSearchParams();

  useEffect(() => {
    connect();
    const roomParam = searchParams.get("room");
    if (roomParam && !role) {
      setInputCode(roomParam.toUpperCase());
      void joinRoom(roomParam.toUpperCase());
    }
  }, [connect, searchParams, role, joinRoom]);

  const handleJoin = async (codeOverride?: string) => {
    const code = codeOverride || inputCode;
    if (!code.trim()) return;
    setJoining(true);
    await joinRoom(code.trim());
    setJoining(false);
  };

  const patch = (p: Partial<HudState>) => updateState(p);

  const currentMaxSpeed = state.manualMax;

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
              onClick={() => handleJoin()}
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
            <div>Biển báo: {currentMaxSpeed} km/h</div>
            <div className={state.zone === "residential" ? "text-orange-400" : "text-green-400"}>
              {state.zone === "residential" ? "Khu dân cư" : "Ngoài khu dân cư"}
            </div>
          </div>
        </div>

        {/* Chuyển Khu dân cư */}
        <button
          onClick={() => patch({ zone: state.zone === "residential" ? "outside" : "residential" })}
          className={`w-full py-5 rounded-2xl border-2 text-2xl font-bold transition-all ${
            state.zone === "residential"
              ? "bg-orange-950/60 border-orange-500 text-orange-300"
              : "bg-green-950/60 border-green-500 text-green-300"
          }`}
        >
          {state.zone === "residential" ? "🏘 Khu dân cư → Ngoài KDC" : "🌿 Ngoài KDC → Khu dân cư"}
        </button>

        {/* Biển báo tốc độ */}
        <div>
          <div className="text-sm text-slate-400 mb-3 font-semibold uppercase tracking-wide">Biển báo thủ công</div>
          <div className="grid grid-cols-4 gap-3">
            {[40, 50, 60, 80, 90, 100, 120].map(s => (
              <button
                key={s}
                onClick={() => patch({ manualMax: s })}
                className={`py-4 rounded-full border-[3px] text-2xl font-bold flex items-center justify-center transition-all ${
                  state.manualMax === s
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

        {/* Speed Zones Management */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-400 font-semibold uppercase tracking-wide flex items-center gap-2">
              <MapPin size={16} /> Dữ liệu Speed Zones
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => speedZoneStore.loadZones()}
                disabled={speedZoneStore.loading}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition disabled:opacity-50"
                title="Nạp lại dữ liệu"
              >
                <RefreshCw size={16} className={speedZoneStore.loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => { setShowZones(!showZones); if (!showZones && speedZoneStore.zones.length === 0) speedZoneStore.loadZones(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${showZones ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
              >
                {showZones ? "Đóng" : `Mở (${speedZoneStore.zones.length})`}
              </button>
            </div>
          </div>

          {showZones && (
            <div className="flex bg-slate-800/60 p-1 rounded-lg mb-3">
              <button
                onClick={() => setViewMode("map")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition ${viewMode === "map" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-300"}`}
              >
                <MapIcon size={14} /> Bản đồ
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition ${viewMode === "list" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-300"}`}
              >
                <List size={14} /> Danh sách
              </button>
            </div>
          )}

          {speedZoneStore.error && (
            <div className="bg-red-900/40 border border-red-500/40 rounded-xl px-3 py-2 text-red-300 text-xs mb-3 flex justify-between">
              <span>{speedZoneStore.error}</span>
              <button onClick={() => speedZoneStore.clearError()} className="text-red-400">✕</button>
            </div>
          )}

          {showZones && (
            <>
              {speedZoneStore.zones.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-4">Chưa có dữ liệu zone nào</div>
              ) : viewMode === "map" ? (
                <SpeedZoneMap 
                  zones={speedZoneStore.zones} 
                  onToggleStatus={speedZoneStore.toggleZoneStatus}
                  onDelete={speedZoneStore.deleteZone}
                />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {speedZoneStore.zones.map((z) => (
                  <div key={z.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${z.status === "inactive" ? "bg-slate-900/60 opacity-60" : "bg-slate-800/60"}`}>
                    <div className={`w-10 h-10 rounded-full border-[3px] flex items-center justify-center font-bold text-sm shrink-0 ${z.zone === "residential" ? "border-orange-500 text-orange-300" : "border-green-500 text-green-300"}`}>
                      {z.maxSpeed}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-300 truncate">
                        {z.lat.toFixed(5)}, {z.lng.toFixed(5)}
                        {z.label && <span className="text-cyan-400 ml-1">• {z.label}</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{z.zone === "residential" ? "KDC" : "Ngoài KDC"} • {z.maxSpeed} km/h • {Math.round(z.heading)}°</span>
                        {z.status === "inactive" ? (
                          <span className="px-1.5 py-0.5 bg-red-900/40 text-red-400 rounded text-[8px] font-bold uppercase tracking-wider border border-red-500/20">Inactive</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-green-900/40 text-green-400 rounded text-[8px] font-bold uppercase tracking-wider border border-green-500/20">Active</span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => z.id && speedZoneStore.toggleZoneStatus(z.id, z.status === "inactive" ? "active" : "inactive")}
                      className={`p-2 transition shrink-0 rounded-lg ${z.status === "inactive" ? "text-slate-500 hover:text-green-400 hover:bg-green-950/30" : "text-slate-400 hover:text-yellow-400 hover:bg-yellow-950/30"}`}
                      title={z.status === "inactive" ? "Bật cảnh báo (Active)" : "Tắt cảnh báo (Deactivate)"}
                    >
                      {z.status === "inactive" ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm("Bạn có chắc chắn muốn xoá vĩnh viễn biển báo này khỏi Google Sheet không?")) {
                          z.id && speedZoneStore.deleteZone(z.id);
                        }
                      }}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition shrink-0 rounded-lg"
                      title="Xoá vĩnh viễn"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                </div>
              )}
            </>
          )}

          {speedZoneStore.lastSyncTime && (
            <div className="text-[10px] text-slate-600 mt-2 text-center">
              Cập nhật lúc: {new Date(speedZoneStore.lastSyncTime).toLocaleTimeString("vi-VN")}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

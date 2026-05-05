"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { ArrowLeft, Car, Bike, Settings, Plus, Minus, Mic, MicOff, X, Maximize, Minimize, Radio, QrCode, AlertTriangle, MapPin, Save, Loader2 } from "lucide-react";
import { useHudStore } from "../../store/hud-store";
import { useSpeedZoneStore, calcHeading, haversineDistance } from "../../store/speed-zone-store";
import type { SpeedZoneRecord } from "@karaoke/shared";
import dynamic from "next/dynamic";

const HudMiniMap = dynamic(() => import("./HudMiniMap"), { ssr: false });

export default function HUDPage() {
  const [speed, setSpeed] = useState<number>(0);
  const [displaySpeed, setDisplaySpeed] = useState<number>(0);
  const [status, setStatus] = useState<"Đang tìm GPS..." | "Đã kết nối GPS" | "Lỗi GPS">("Đang tìm GPS...");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showQuickMenu, setShowQuickMenu] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHosting, setIsHosting] = useState<boolean>(false);
  const [hostRoomCode, setHostRoomCode] = useState<string>("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [showSaveConfirm, setShowSaveConfirm] = useState<boolean>(false);
  const mainRef = useRef<HTMLElement>(null);
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSavedZoneRef = useRef<{ lat: number; lng: number; heading: number; maxSpeed: number; zone: "residential" | "outside" } | null>(null);

  const [remoteUrl, setRemoteUrl] = useState<string>("");
  useEffect(() => {
    if (hostRoomCode && typeof window !== "undefined") {
      setRemoteUrl(`${window.location.origin}/hud/remote?room=${hostRoomCode}`);
    }
  }, [hostRoomCode]);

  const hudStore = useHudStore();
  const { mode, roadType, zone, manualMax, offset } = hudStore.state;
  const speedZoneStore = useSpeedZoneStore();
  const { prediction, pendingZone } = speedZoneStore;

  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechFeedback, setSpeechFeedback] = useState<string>("");
  const recognitionRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);

  const currentMaxSpeed = manualMax;

  const effectiveDisplaySpeed = displaySpeed < 0.5 ? 0 : displaySpeed;
  const finalSpeed = Math.max(0, Math.round(effectiveDisplaySpeed + offset));
  const isOverSpeed = finalSpeed > currentMaxSpeed;
  // Effects - giữ nguyên logic cũ
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hud_config");
      if (saved) {
        const config = JSON.parse(saved);
        hudStore.syncState({
          mode: config.mode || "moto",
          roadType: "manual",
          zone: config.zone || "residential",
          manualMax: config.manualMax || 60,
          offset: config.offset !== undefined ? config.offset : 0,
        });
      }
    } catch (e) { console.error("Lỗi đọc cache", e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem("hud_config", JSON.stringify(hudStore.state));
  }, [hudStore.state]);

  // Load speed zones khi mount
  useEffect(() => {
    speedZoneStore.loadZones();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Speed smoothing animation
  useEffect(() => {
    let animationId: number;
    const smoothUpdate = () => {
      setDisplaySpeed(prev => {
        const diff = speed - prev;
        if (Math.abs(diff) < 0.1) return speed;
        return prev + diff * 0.12;
      });
      animationId = requestAnimationFrame(smoothUpdate);
    };
    animationId = requestAnimationFrame(smoothUpdate);
    return () => cancelAnimationFrame(animationId);
  }, [speed]);

  // GPS + WakeLock
  useEffect(() => {
    let wakeLockObj: any = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockObj = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) { console.error("WakeLock failed", err); }
    };
    requestWakeLock();
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          setStatus("Đã kết nối GPS");
          const mps = position.coords.speed || 0;
          setSpeed(mps * 3.6);
          const newCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCoords(newCoords);

          // Tính heading từ 2 điểm GPS liên tiếp
          if (prevCoordsRef.current) {
            const dist = Math.abs(newCoords.lat - prevCoordsRef.current.lat) + Math.abs(newCoords.lng - prevCoordsRef.current.lng);
            if (dist > 0.00005) { // ~5m threshold
              const h = calcHeading(prevCoordsRef.current.lat, prevCoordsRef.current.lng, newCoords.lat, newCoords.lng);
              setHeading(h);

              // Get fresh state instead of stale closure variables
              const freshState = useHudStore.getState().state;
              const freshMaxSpeed = freshState.manualMax;
              const freshZone = freshState.zone as "residential" | "outside";
              const freshRoadType = freshState.roadType;

              // Update prediction
              speedZoneStore.updatePrediction(newCoords.lat, newCoords.lng, h, freshMaxSpeed);

              // Tự động lưu khi bẻ lái chuyển đường (heading thay đổi > 45 độ, khoảng cách > 50m)
              if (!lastSavedZoneRef.current) {
                lastSavedZoneRef.current = { lat: newCoords.lat, lng: newCoords.lng, heading: h, maxSpeed: freshMaxSpeed, zone: freshZone };
              } else {
                const angleDiff = Math.abs(h - lastSavedZoneRef.current.heading);
                const normalizedAngleDiff = Math.min(angleDiff, 360 - angleDiff);
                const distSinceSave = haversineDistance(newCoords.lat, newCoords.lng, lastSavedZoneRef.current.lat, lastSavedZoneRef.current.lng);

                if (normalizedAngleDiff >= 45 && distSinceSave > 50 && lastSavedZoneRef.current.maxSpeed === freshMaxSpeed && lastSavedZoneRef.current.zone === freshZone) {
                  // Lưu vết trước để tránh lưu liên tục
                  lastSavedZoneRef.current = { lat: newCoords.lat, lng: newCoords.lng, heading: h, maxSpeed: freshMaxSpeed, zone: freshZone };
                  
                  // Tạo record mới
                  const record: SpeedZoneRecord = {
                    lat: newCoords.lat, lng: newCoords.lng, heading: h,
                    zone: freshZone, roadType: freshRoadType, maxSpeed: freshMaxSpeed,
                    createdAt: new Date().toISOString(),
                    status: "active"
                  };
                  speedZoneStore.recordZone(record);
                }
              }
            }
          }
          prevCoordsRef.current = newCoords;
        },
        () => setStatus("Lỗi GPS"),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    } else {
      setStatus("Lỗi GPS");
    }

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (wakeLockObj) wakeLockObj.release();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen events
  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);
  // Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const command = event.results[0][0].transcript.toLowerCase();
          let parsed = false;
          if (command.includes("hết khu dân cư") || command.includes("ngoài khu dân cư")) {
            hudStore.updateState({ zone: "outside" });
            setSpeechFeedback("Đã chuyển: Ngoài KDC"); parsed = true;
          } else if (command.includes("khu dân cư")) {
            hudStore.updateState({ zone: "residential" });
            setSpeechFeedback("Đã chuyển: Trong KDC"); parsed = true;
          } else {
            let parsedSpeed = null;
            if (command.match(/\b(40|bốn mươi|bốn chục)\b/)) parsedSpeed = 40;
            else if (command.match(/\b(50|năm mươi|năm chục)\b/)) parsedSpeed = 50;
            else if (command.match(/\b(60|sáu mươi|sáu chục)\b/)) parsedSpeed = 60;
            else if (command.match(/\b(70|bảy mươi|bảy chục)\b/)) parsedSpeed = 70;
            else if (command.match(/\b(80|tám mươi|tám chục)\b/)) parsedSpeed = 80;
            else if (command.match(/\b(90|chín mươi|chín chục)\b/)) parsedSpeed = 90;
            else if (command.match(/\b(100|một trăm|trăm chẵn)\b/)) parsedSpeed = 100;
            else if (command.match(/\b(120|trăm hai|một trăm hai)\b/)) parsedSpeed = 120;
            if (parsedSpeed !== null) {
              hudStore.updateState({ roadType: "manual", manualMax: parsedSpeed });
              setSpeechFeedback(`Giới hạn: ${parsedSpeed} km/h`); parsed = true;
            }
          }
          if (!parsed) setSpeechFeedback("Không hiểu lệnh: " + command);
          setTimeout(() => setSpeechFeedback(""), 3000);
        };
        recognition.onerror = (event: any) => { setIsListening(false); setSpeechFeedback("Lỗi micro: " + event.error); setTimeout(() => setSpeechFeedback(""), 3000); };
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false); setSpeechFeedback("");
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    } else {
      setSpeechFeedback("Đang nghe..."); recognitionRef.current?.start(); setIsListening(true);
    }
  };

  const autoSaveZone = async (newMaxSpeed: number, newZone: "residential" | "outside") => {
    if (!coords) return;
    const record: SpeedZoneRecord = {
      lat: coords.lat, lng: coords.lng, heading,
      zone: newZone, roadType, maxSpeed: newMaxSpeed,
      createdAt: new Date().toISOString(),
      status: "active"
    };
    const ok = await speedZoneStore.recordZone(record);
    if (ok) {
      lastSavedZoneRef.current = { lat: coords.lat, lng: coords.lng, heading, maxSpeed: newMaxSpeed, zone: newZone };
    }
  };

  const handleQuickSelect = (type: string, val?: number | string) => {
    let newZone = zone;
    let newMaxSpeed = currentMaxSpeed;

    if (type === "zone") {
      newZone = val as "residential" | "outside";
      hudStore.updateState({ zone: newZone });
    } else if (type === "manual") {
      newMaxSpeed = val as number;
      hudStore.updateState({ manualMax: newMaxSpeed });
    }
    setShowQuickMenu(false);
    autoSaveZone(newMaxSpeed, newZone);
  };

  const toggleZone = () => {
    const newZone = zone === "residential" ? "outside" : "residential";
    hudStore.updateState({ zone: newZone });
    autoSaveZone(currentMaxSpeed, newZone);
  };

  const toggleFullscreen = () => {
    const doc = document as any;
    const de = (mainRef.current || document.documentElement) as any;
    try {
      const isCurrentlyFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      if (!isCurrentlyFs) {
        if (de.requestFullscreen) de.requestFullscreen();
        else if (de.webkitRequestFullscreen) de.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) { setIsFullscreen(!isFullscreen); }
  };

  const handleStartHosting = async () => {
    await hudStore.connect();
    const result = await hudStore.createRoom();
    if (result) { setIsHosting(true); setHostRoomCode(result.roomCode); void hudStore.updateState({ mode, roadType, zone, manualMax, offset }); }
  };
  const handleStopHosting = async () => { await hudStore.leaveRoom(); setIsHosting(false); setHostRoomCode(""); };

  // Xác nhận lưu zone
  const handleSaveZone = () => {
    if (!coords) return;
    const record: SpeedZoneRecord = {
      lat: coords.lat, lng: coords.lng, heading,
      zone, roadType, maxSpeed: currentMaxSpeed,
      createdAt: new Date().toISOString(),
    };
    speedZoneStore.setPendingZone(record);
    setShowSaveConfirm(true);
  };

  const confirmSave = async () => {
    await speedZoneStore.confirmPendingZone();
    setShowSaveConfirm(false);
  };

  const addMockZone = () => {
    if (!coords) {
      alert("Chưa có toạ độ GPS hiện tại!");
      return;
    }
    const currentHeading = heading || 0;
    const lat1 = coords.lat * Math.PI / 180;
    const lng1 = coords.lng * Math.PI / 180;
    const d = 500; // 500 meters
    const R = 6371000;
    const brng = currentHeading * Math.PI / 180;
    
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));
    
    const record: SpeedZoneRecord = {
      id: "mock-" + Date.now(),
      lat: lat2 * 180 / Math.PI,
      lng: lng2 * 180 / Math.PI,
      heading: currentHeading,
      maxSpeed: currentMaxSpeed === 60 ? 50 : 60,
      zone: zone === "residential" ? "outside" : "residential",
      roadType: "manual",
      createdAt: new Date().toISOString(),
      label: "Biển báo giả lập",
    };
    
    useSpeedZoneStore.setState(s => ({ zones: [...s.zones, record] }));
    alert(`Đã tạo biển báo giả lập cách 500m!\nMaxSpeed: ${record.maxSpeed}\nZone: ${record.zone}`);
  };
  return (
    <main
      ref={mainRef} id="hud-main"
      className={`h-[100dvh] w-full overflow-hidden text-white flex flex-col fixed inset-0 select-none touch-none transition-colors duration-300 ${isOverSpeed && !showSettings ? "bg-red-950" : "bg-black"}`}
    >
      <style jsx global>{`
        body, html { overflow: hidden; overscroll-behavior: none; touch-action: none; }
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        .font-digital { font-family: 'Orbitron', monospace; }
      `}</style>

      <div className={`flex flex-col w-full h-full relative ${mode === "car" && !showSettings ? "scale-y-[-1]" : ""}`}>
        {/* Top Bar - Compact */}
        {!isFullscreen && (
          <div className="flex items-center justify-between px-6 py-2 bg-black z-20 shrink-0 border-b border-[#2C2C2E]">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-1.5 text-slate-500 hover:text-white mr-2">
                <ArrowLeft size={14} />
              </Link>
              <div className={`w-2 h-2 rounded-full ${status === "Đã kết nối GPS" ? "bg-[#B5FF00]" : "bg-yellow-400"}`}></div>
              <div className="text-xs text-slate-400 font-medium tracking-wide uppercase">
                {status === "Đã kết nối GPS" ? "GPS Connected" : status}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={toggleFullscreen} className="text-slate-500 hover:text-white"><Maximize size={14} /></button>
              <button onClick={() => hudStore.updateState({ mode: mode === "car" ? "moto" : "car" })} className="text-slate-500 hover:text-white flex items-center gap-1.5">
                {mode === "car" ? <Car size={14} /> : <Bike size={14} />}
                <span className="text-xs font-medium uppercase tracking-wide">Compass</span>
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className="text-slate-500 hover:text-white"><Settings size={14} /></button>
            </div>
          </div>
        )}

        {isFullscreen && !showSettings && (
          <button onClick={toggleFullscreen} className="absolute top-2 right-2 p-1.5 bg-slate-800/40 rounded-full text-slate-500 hover:text-white z-50 opacity-20 hover:opacity-100 transition-opacity"><Minimize size={18} /></button>
        )}

        {/* ═══ MAIN HUD - LANDSCAPE 2 PANELS ═══ */}
        <div className={`flex-1 flex gap-3 p-3 relative ${showSettings ? "hidden" : "flex"} bg-black`}>
          
          {/* Speech Feedback */}
          {speechFeedback && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-cyan-300 px-3 py-1 rounded-full shadow-lg z-30 border border-cyan-500/30 text-sm">
              {speechFeedback}
            </div>
          )}

          {/* ── LEFT PANEL: Next Zone / Prediction ── */}
          <div className="w-[35%] bg-[#1E1E1E] rounded-3xl flex flex-col p-2 relative border border-[#2C2C2E] overflow-hidden gap-2">
            {/* Top compact indicator */}
            {prediction ? (
              <div className="flex items-center justify-center gap-3 bg-black/40 rounded-xl py-2 shrink-0">
                <div className="text-xl font-bold text-[#B5FF00] font-digital tabular-nums">{prediction.distanceMeters}m</div>
                <div className="text-[#B5FF00] font-bold text-xl">↑</div>
                <div className="w-10 h-10 rounded-full bg-white border-[3px] border-red-600 flex items-center justify-center font-bold text-black text-lg tabular-nums shadow-lg">
                  {prediction.nextMaxSpeed}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-3 bg-black/40 rounded-xl shrink-0 text-slate-500 text-xs">
                Không có biển báo (500m)
              </div>
            )}

            {/* Bottom Map */}
            <div className="flex-1 w-full rounded-2xl overflow-hidden relative">
              <HudMiniMap coords={coords} heading={heading} prediction={prediction} />
            </div>
          </div>

          {/* ── RIGHT PANEL: Current Speed / Limit ── */}
          <div className="flex-1 bg-[#1E1E1E] rounded-3xl relative flex flex-col items-center justify-center border border-[#2C2C2E]">
            
            {/* Top-Right Max Speed Sign */}
            <button onClick={() => setShowQuickMenu(!showQuickMenu)} 
              className="absolute top-4 right-4 bg-transparent border border-white/20 rounded-xl p-2 flex flex-col items-center justify-center w-20 hover:scale-105 transition-transform"
            >
              <div className="w-14 h-14 rounded-full bg-white border-[5px] border-red-600 flex items-center justify-center font-bold text-black text-2xl tabular-nums">
                {currentMaxSpeed}
              </div>
              <div className="text-[9px] font-bold text-white mt-1.5 tracking-wider">MAX LIMIT</div>
            </button>

            {/* Current Speed */}
            <div className="flex flex-col items-center justify-center mt-6">
              <div className={`font-digital text-[min(38vw,30vh)] font-black leading-none tabular-nums tracking-tighter transition-all ${isOverSpeed ? "text-red-500 animate-pulse" : "text-[#B5FF00]"}`}>
                {finalSpeed}
              </div>
              <div className="text-4xl font-bold text-white -mt-2">
                km/h
              </div>
            </div>

            {/* Hidden Offset controls / Mic for clickability */}
            <div className="absolute bottom-4 left-4 flex gap-2">
               <button onClick={() => hudStore.updateState({ offset: offset - 1 })} className="w-10 h-10 rounded-full bg-slate-800/50 text-slate-400 flex items-center justify-center active:scale-90"><Minus size={16}/></button>
               <button onClick={() => hudStore.updateState({ offset: offset + 1 })} className="w-10 h-10 rounded-full bg-slate-800/50 text-slate-400 flex items-center justify-center active:scale-90"><Plus size={16}/></button>
               {offset !== 0 && <div className="flex items-center text-cyan-400 text-xs font-bold px-2">{offset > 0 ? `+${offset}` : offset}</div>}
               
               {!isHosting && (
                 <button onClick={toggleListening} className={`w-10 h-10 rounded-full flex items-center justify-center ml-2 transition-all active:scale-90 ${isListening ? "bg-red-600" : "bg-slate-800/50 text-slate-400"}`}>
                   {isListening ? <Mic size={16} className="text-white" /> : <MicOff size={16} />}
                 </button>
               )}
            </div>

            {/* Save Zone button */}
            {!isHosting && coords && (
              <button onClick={handleSaveZone} className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-slate-800/50 text-slate-400 flex items-center justify-center active:scale-90 transition-all hover:text-cyan-400" title="Ghi nhận toạ độ">
                <MapPin size={18} />
              </button>
            )}

            {/* Side Speed Presets (Quick Menu) */}
            {!isHosting && showQuickMenu && (
              <div className="absolute right-24 top-4 flex gap-2 z-10 bg-black/80 p-2 rounded-xl backdrop-blur">
                {[50, 60, 80, 100].map(s => (
                  <button key={s} onClick={() => handleQuickSelect("manual", s)}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all ${currentMaxSpeed === s ? "border-red-500 bg-white text-black scale-110 shadow-[0_0_15px_rgba(239,68,68,0.7)]" : "border-[#2C2C2E] bg-[#1c1c1e] text-slate-400 hover:border-slate-500"}`}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Save Zone Confirmation Modal */}
        {showSaveConfirm && pendingZone && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full">
              <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2"><Save size={20} /> Xác nhận lưu toạ độ</h3>
              <div className="space-y-2 text-sm text-slate-300 mb-4">
                <div className="flex justify-between"><span className="text-slate-500">Toạ độ:</span><span>{pendingZone.lat.toFixed(6)}, {pendingZone.lng.toFixed(6)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Heading:</span><span>{Math.round(pendingZone.heading)}°</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tốc độ tối đa:</span><span className="font-bold text-red-400">{pendingZone.maxSpeed} km/h</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Zone:</span><span>{pendingZone.zone === "residential" ? "Khu dân cư" : "Ngoài KDC"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Loại đường:</span><span>Biển báo</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSaveConfirm(false)} className="flex-1 py-3 bg-slate-800 rounded-xl text-slate-400 font-bold hover:bg-slate-700 transition">Huỷ</button>
                <button onClick={confirmSave} className="flex-1 py-3 bg-cyan-600 rounded-xl text-white font-bold hover:bg-cyan-500 transition flex items-center justify-center gap-2">
                  <Save size={16} /> Lưu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Menu Overlay */}
        {showQuickMenu && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4">
            <button onClick={() => setShowQuickMenu(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-white"><X size={24} /></button>
            <h3 className="text-xl font-bold text-cyan-400 mb-4">Chạm Nhanh Biển Báo</h3>
            <div className="grid grid-cols-4 gap-3 max-w-md w-full">
              <button onClick={() => handleQuickSelect("zone", "residential")} className="col-span-2 py-3 bg-orange-900/50 border-2 border-orange-500 rounded-xl text-lg font-bold text-orange-200">KDC</button>
              <button onClick={() => handleQuickSelect("zone", "outside")} className="col-span-2 py-3 bg-green-900/50 border-2 border-green-500 rounded-xl text-lg font-bold text-green-200">Ngoài KDC</button>
              {[40, 50, 60, 70, 80, 90, 100, 120].map(s => (
                <button key={s} onClick={() => handleQuickSelect("manual", s)} className="py-3 border-4 border-red-600 bg-white rounded-full text-2xl font-bold text-black flex items-center justify-center aspect-square shadow-lg">{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Settings Panel - giữ nguyên */}
        {showSettings && (
          <div className="flex-1 p-4 overflow-y-auto pb-16">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Cài đặt HUD</h2>
            <div className="space-y-6 max-w-2xl mx-auto">
              <section>
                <h3 className="text-sm font-semibold mb-2 text-slate-300">Điều khiển giọng nói</h3>
                <button onClick={toggleListening} className={`w-full py-3 flex items-center justify-center gap-2 rounded-xl border-2 transition text-sm ${isListening ? "border-red-500 bg-red-900/30 text-white animate-pulse" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                  {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                  <span className="font-bold">{isListening ? "Đang lắng nghe..." : "Bật nhận diện giọng nói"}</span>
                </button>
              </section>
              <section>
                <h3 className="text-sm font-semibold mb-2 text-slate-300">Chế độ hiển thị</h3>
                <div className="flex gap-3">
                  <button onClick={() => { hudStore.updateState({ mode: "moto" }); setShowSettings(false); }} className={`flex-1 py-3 flex flex-col items-center gap-1 rounded-xl border-2 transition ${mode === "moto" ? "border-cyan-500 bg-cyan-900/30 text-cyan-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                    <Bike size={24} /><span className="text-xs">Xe Máy</span>
                  </button>
                  <button onClick={() => { hudStore.updateState({ mode: "car" }); setShowSettings(false); }} className={`flex-1 py-3 flex flex-col items-center gap-1 rounded-xl border-2 transition ${mode === "car" ? "border-cyan-500 bg-cyan-900/30 text-cyan-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                    <Car size={24} /><span className="text-xs">Ô tô (HUD)</span>
                  </button>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold mb-2 text-slate-300">Công cụ Debug</h3>
                <button onClick={addMockZone} className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border-2 border-purple-500 bg-purple-900/30 text-purple-300 transition text-sm font-bold">
                  <MapPin size={18} /> Tạo biển báo giả lập (500m phía trước)
                </button>
              </section>
              <section>
                <h3 className="text-sm font-semibold mb-2 text-slate-300">Sai số GPS (Offset)</h3>
                <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl">
                  <button onClick={() => hudStore.updateState({ offset: offset - 1 })} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600"><Minus size={20} /></button>
                  <div className="flex-1 text-center text-2xl font-bold tabular-nums">{offset > 0 ? `+${offset}` : offset}</div>
                  <button onClick={() => hudStore.updateState({ offset: offset + 1 })} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600"><Plus size={20} /></button>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold mb-2 text-slate-300">Giới hạn tốc độ (Biển báo)</h3>
                <div className="space-y-3">
                  <div className="flex gap-3 mb-2">
                    <button onClick={() => hudStore.updateState({ zone: "residential" })} className={`flex-1 py-3 rounded-xl border-2 transition text-sm font-semibold ${zone === "residential" ? "border-orange-500 bg-orange-900/20 text-orange-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>Khu dân cư</button>
                    <button onClick={() => hudStore.updateState({ zone: "outside" })} className={`flex-1 py-3 rounded-xl border-2 transition text-sm font-semibold ${zone === "outside" ? "border-green-500 bg-green-900/20 text-green-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>Ngoài KDC</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[40, 50, 60, 70, 80, 90, 100, 120].map(s => (
                      <button key={s} onClick={() => hudStore.updateState({ manualMax: s })} className={`py-2 text-lg font-bold rounded-xl border-2 transition ${manualMax === s ? "border-cyan-500 bg-cyan-900/40 text-white" : "border-slate-700 bg-slate-800 text-slate-400"}`}>{s}</button>
                    ))}
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Tốc độ tối đa:</span>
                    <span className="text-2xl font-bold text-red-400">{currentMaxSpeed} km/h</span>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold mb-2 text-slate-300 flex items-center gap-2">
                  <Radio size={16} className={isHosting ? "text-green-400 animate-pulse" : "text-slate-400"} /> Điều khiển từ xa
                </h3>
                {!isHosting ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">Tạo phòng để điều khiển HUD từ thiết bị khác</p>
                    <button onClick={handleStartHosting} className="w-full py-3 bg-green-700 hover:bg-green-600 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                      <Radio size={18} /> Phát sóng HUD
                    </button>
                    <a href="/hud/remote" target="_blank" rel="noopener noreferrer" className="w-full py-2 border border-cyan-500/50 rounded-xl font-semibold text-cyan-400 hover:bg-cyan-900/20 text-center text-xs flex items-center justify-center gap-2 transition">
                      <QrCode size={14} /> Mở điều khiển
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-green-500/40 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 mb-2">Quét mã để điều khiển</p>
                      <div className="flex justify-center mb-3 p-2 bg-white rounded-lg w-fit mx-auto"><QRCodeSVG value={remoteUrl} size={120} /></div>
                      <div className="text-4xl font-black tracking-[0.3em] text-green-300 font-mono">{hostRoomCode}</div>
                    </div>
                    <button onClick={handleStopHosting} className="w-full py-2 border border-red-500/50 rounded-xl font-semibold text-red-400 hover:bg-red-900/20 text-xs transition">Dừng phát sóng</button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import {
  ArrowLeft, Car, Bike, Settings, Plus, Minus, Mic, MicOff, X,
  Maximize, Minimize, Radio, QrCode, MapPin, Save, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium,
} from "lucide-react";
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
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechFeedback, setSpeechFeedback] = useState<string>("");
  const [compassGranted, setCompassGranted] = useState<boolean | null>(null);

  const mainRef = useRef<HTMLElement>(null);
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSavedZoneRef = useRef<{ lat: number; lng: number; heading: number; maxSpeed: number; zone: "residential" | "outside" } | null>(null);
  const recognitionRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const compassHeadingRef = useRef<number | null>(null);
  const lastGpsSpeedKmhRef = useRef<number>(0);

  const [remoteUrl, setRemoteUrl] = useState<string>("");
  useEffect(() => {
    if (hostRoomCode && typeof window !== "undefined") {
      setRemoteUrl(`${window.location.origin}/hud/remote?room=${hostRoomCode}`);
    }
  }, [hostRoomCode]);

  const hudStore = useHudStore();
  const { mode, roadType, zone, manualMax, offset } = hudStore.state;
  const speedZoneStore = useSpeedZoneStore();
  const { predictions, pendingZone } = speedZoneStore;
  const prediction = predictions.length > 0 ? predictions[0] : null;

  const currentMaxSpeed = manualMax;
  const effectiveDisplaySpeed = displaySpeed < 0.5 ? 0 : displaySpeed;
  const finalSpeed = Math.max(0, Math.round(effectiveDisplaySpeed + offset));
  const isOverSpeed = finalSpeed > currentMaxSpeed;

  // ── localStorage cache ──
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

  useEffect(() => { speedZoneStore.loadZones(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Battery API ──
  useEffect(() => {
    if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
    (navigator as any).getBattery().then((bat: any) => {
      const update = () => setBattery({ level: Math.round(bat.level * 100), charging: bat.charging });
      update();
      bat.addEventListener("levelchange", update);
      bat.addEventListener("chargingchange", update);
    }).catch(() => {});
  }, []);

  // ── Speed smoothing — dừng khi hội tụ ──
  useEffect(() => {
    let animationId: number;
    let running = true;
    const smoothUpdate = () => {
      let needsNext = false;
      setDisplaySpeed(prev => {
        const diff = speed - prev;
        if (Math.abs(diff) < 0.1) return speed;
        needsNext = true;
        return prev + diff * 0.12;
      });
      if (needsNext && running) animationId = requestAnimationFrame(smoothUpdate);
    };
    animationId = requestAnimationFrame(smoothUpdate);
    return () => { running = false; cancelAnimationFrame(animationId); };
  }, [speed]);

  // ── GPS + WakeLock ──
  useEffect(() => {
    let wakeLockObj: any = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) wakeLockObj = await (navigator as any).wakeLock.request("screen");
      } catch { /* ignore */ }
    };
    requestWakeLock();
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          setStatus("Đã kết nối GPS");
          const mps = position.coords.speed || 0;
          const kmh = mps * 3.6;
          setSpeed(kmh);
          lastGpsSpeedKmhRef.current = kmh;
          setAccuracy(position.coords.accuracy ?? null);
          const newCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCoords(newCoords);

          if (prevCoordsRef.current) {
            const dist = Math.abs(newCoords.lat - prevCoordsRef.current.lat) + Math.abs(newCoords.lng - prevCoordsRef.current.lng);
            if (dist > 0.00005) {
              const gpsH = calcHeading(prevCoordsRef.current.lat, prevCoordsRef.current.lng, newCoords.lat, newCoords.lng);
              const h = (kmh < 5 && compassHeadingRef.current !== null) ? compassHeadingRef.current : gpsH;
              setHeading(h);

              const freshState = useHudStore.getState().state;
              const freshMaxSpeed = freshState.manualMax;
              const freshZone = freshState.zone as "residential" | "outside";
              const freshRoadType = freshState.roadType;

              const { arrivedZone } = speedZoneStore.updatePrediction(newCoords.lat, newCoords.lng, h, freshMaxSpeed);
              if (arrivedZone) {
                useHudStore.getState().updateState({ manualMax: arrivedZone.maxSpeed, zone: arrivedZone.zone });
                setSpeechFeedback(`🚦 ${arrivedZone.maxSpeed} km/h • ${arrivedZone.zone === "residential" ? "KDC" : "Ngoài KDC"}`);
                setTimeout(() => setSpeechFeedback(""), 3000);
              }

              if (!lastSavedZoneRef.current) {
                lastSavedZoneRef.current = { lat: newCoords.lat, lng: newCoords.lng, heading: h, maxSpeed: freshMaxSpeed, zone: freshZone };
              } else {
                const angleDiff = Math.abs(h - lastSavedZoneRef.current.heading);
                const normalizedAngleDiff = Math.min(angleDiff, 360 - angleDiff);
                const distSinceSave = haversineDistance(newCoords.lat, newCoords.lng, lastSavedZoneRef.current.lat, lastSavedZoneRef.current.lng);
                if (normalizedAngleDiff >= 45 && distSinceSave > 50 && lastSavedZoneRef.current.maxSpeed === freshMaxSpeed && lastSavedZoneRef.current.zone === freshZone) {
                  lastSavedZoneRef.current = { lat: newCoords.lat, lng: newCoords.lng, heading: h, maxSpeed: freshMaxSpeed, zone: freshZone };
                  const record: SpeedZoneRecord = {
                    lat: newCoords.lat, lng: newCoords.lng, heading: h,
                    zone: freshZone, roadType: freshRoadType, maxSpeed: freshMaxSpeed,
                    createdAt: new Date().toISOString(), status: "active",
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

  // ── DeviceOrientation compass ──
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const wk = (e as any).webkitCompassHeading;
      if (wk != null) {
        compassHeadingRef.current = wk;
      } else if ((e as any).absolute && e.alpha != null) {
        compassHeadingRef.current = (360 - e.alpha) % 360;
      } else if (e.alpha != null) {
        compassHeadingRef.current = (360 - e.alpha) % 360;
      }
      if (lastGpsSpeedKmhRef.current < 5 && compassHeadingRef.current !== null) {
        setHeading(compassHeadingRef.current);
      }
    };
    const DevOE = DeviceOrientationEvent as any;
    if (typeof DevOE.requestPermission === "function") {
      setCompassGranted(false);
    } else {
      window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      window.addEventListener("deviceorientation", handleOrientation as EventListener, true);
      setCompassGranted(true);
    }
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      window.removeEventListener("deviceorientation", handleOrientation as EventListener, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestCompassPermission = async () => {
    const DevOE = DeviceOrientationEvent as any;
    if (typeof DevOE.requestPermission !== "function") return;
    const result = await DevOE.requestPermission();
    if (result === "granted") {
      const handleOrientation = (e: DeviceOrientationEvent) => {
        const wk = (e as any).webkitCompassHeading;
        if (wk != null) compassHeadingRef.current = wk;
        if (lastGpsSpeedKmhRef.current < 5 && compassHeadingRef.current !== null) setHeading(compassHeadingRef.current);
      };
      window.addEventListener("deviceorientation", handleOrientation as EventListener, true);
      setCompassGranted(true);
    }
  };

  // ── Fullscreen ──
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

  // ── Speech Recognition ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const command = event.results[0][0].transcript.toLowerCase();
      let parsed = false;
      if (command.includes("hết khu dân cư") || command.includes("ngoài khu dân cư")) {
        hudStore.updateState({ zone: "outside" }); setSpeechFeedback("Ngoài KDC"); parsed = true;
      } else if (command.includes("khu dân cư")) {
        hudStore.updateState({ zone: "residential" }); setSpeechFeedback("Trong KDC"); parsed = true;
      } else {
        const speeds: [RegExp, number][] = [
          [/\b(40|bốn mươi|bốn chục)\b/, 40], [/\b(50|năm mươi|năm chục)\b/, 50],
          [/\b(60|sáu mươi|sáu chục)\b/, 60], [/\b(70|bảy mươi|bảy chục)\b/, 70],
          [/\b(80|tám mươi|tám chục)\b/, 80], [/\b(90|chín mươi|chín chục)\b/, 90],
          [/\b(100|một trăm|trăm chẵn)\b/, 100], [/\b(120|trăm hai|một trăm hai)\b/, 120],
        ];
        for (const [re, s] of speeds) {
          if (command.match(re)) { hudStore.updateState({ roadType: "manual", manualMax: s }); setSpeechFeedback(`${s} km/h`); parsed = true; break; }
        }
      }
      if (!parsed) setSpeechFeedback("Không hiểu: " + command);
      setTimeout(() => setSpeechFeedback(""), 3000);
    };
    recognition.onerror = (e: any) => { setIsListening(false); setSpeechFeedback("Lỗi micro: " + e.error); setTimeout(() => setSpeechFeedback(""), 3000); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──
  const toggleListening = () => {
    if (isListening) { setIsListening(false); setSpeechFeedback(""); try { recognitionRef.current?.stop(); } catch { /* ignore */ } }
    else { setSpeechFeedback("Đang nghe..."); recognitionRef.current?.start(); setIsListening(true); }
  };

  const autoSaveZone = async (newMaxSpeed: number, newZone: "residential" | "outside") => {
    if (!coords) return;
    setSpeechFeedback("⏳ Đang lưu...");
    const record: SpeedZoneRecord = { lat: coords.lat, lng: coords.lng, heading, zone: newZone, roadType, maxSpeed: newMaxSpeed, createdAt: new Date().toISOString(), status: "active" };
    const ok = await speedZoneStore.recordZone(record);
    if (ok) { lastSavedZoneRef.current = { lat: coords.lat, lng: coords.lng, heading, maxSpeed: newMaxSpeed, zone: newZone }; setSpeechFeedback(`✅ ${newMaxSpeed} km/h lưu xong`); }
    else setSpeechFeedback("❌ Lưu thất bại!");
    setTimeout(() => setSpeechFeedback(""), 3000);
  };

  const handleQuickSelect = (type: string, val?: number | string) => {
    let newZone = zone; let newMaxSpeed = currentMaxSpeed;
    if (type === "zone") { newZone = val as "residential" | "outside"; hudStore.updateState({ zone: newZone }); }
    else if (type === "manual") { newMaxSpeed = val as number; hudStore.updateState({ manualMax: newMaxSpeed }); }
    setShowQuickMenu(false);
    autoSaveZone(newMaxSpeed, newZone);
  };

  const toggleFullscreen = () => {
    const doc = document as any;
    const de = (mainRef.current || document.documentElement) as any;
    try {
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      if (!isFs) { if (de.requestFullscreen) de.requestFullscreen(); else if (de.webkitRequestFullscreen) de.webkitRequestFullscreen(); setIsFullscreen(true); }
      else { if (doc.exitFullscreen) doc.exitFullscreen(); else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen(); setIsFullscreen(false); }
    } catch { setIsFullscreen(v => !v); }
  };

  const handleStartHosting = async () => {
    await hudStore.connect();
    const result = await hudStore.createRoom();
    if (result) { setIsHosting(true); setHostRoomCode(result.roomCode); void hudStore.updateState({ mode, roadType, zone, manualMax, offset }); }
  };
  const handleStopHosting = async () => { await hudStore.leaveRoom(); setIsHosting(false); setHostRoomCode(""); };

  const handleSaveZone = () => {
    if (!coords) return;
    speedZoneStore.setPendingZone({ lat: coords.lat, lng: coords.lng, heading, zone, roadType, maxSpeed: currentMaxSpeed, createdAt: new Date().toISOString() });
    setShowSaveConfirm(true);
  };
  const confirmSave = async () => { await speedZoneStore.confirmPendingZone(); setShowSaveConfirm(false); };

  const addMockZone = () => {
    if (!coords) { alert("Chưa có toạ độ GPS!"); return; }
    const h = heading || 0;
    const lat1 = coords.lat * Math.PI / 180, lng1 = coords.lng * Math.PI / 180;
    const d = 500, R = 6371000, brng = h * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));
    const record: SpeedZoneRecord = { id: "mock-" + Date.now(), lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI, heading: h, maxSpeed: currentMaxSpeed === 60 ? 50 : 60, zone: zone === "residential" ? "outside" : "residential", roadType: "manual", createdAt: new Date().toISOString(), label: "Giả lập" };
    useSpeedZoneStore.setState(s => ({ zones: [...s.zones, record] }));
    alert(`Biển báo giả lập cách 500m: ${record.maxSpeed} km/h`);
  };

  const BatteryIcon = battery?.charging ? BatteryCharging : battery && battery.level > 60 ? BatteryFull : battery && battery.level > 20 ? BatteryMedium : BatteryLow;
  const batteryColor = !battery ? "text-slate-500" : battery.charging ? "text-green-400" : battery.level > 30 ? "text-green-400" : battery.level > 15 ? "text-yellow-400" : "text-red-400";

  // ══════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════
  return (
    <main
      ref={mainRef} id="hud-main"
      className={`h-[100dvh] w-full overflow-hidden text-white flex flex-col fixed inset-0 select-none touch-none bg-black`}
    >
      <style jsx global>{`
        body, html { overflow: hidden; overscroll-behavior: none; touch-action: none; background: #000; }
      `}</style>

      <div className={`flex flex-col w-full h-full ${mode === "car" && !showSettings ? "scale-y-[-1]" : ""}`}>

        {/* ═══ TOP BAR ═══ */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0 z-20">
          {/* Left: back + GPS */}
          <div className="flex items-center gap-2">
            {!isFullscreen && (
              <Link href="/" className="p-1 text-slate-600 hover:text-white transition">
                <ArrowLeft size={16} />
              </Link>
            )}
            <div className={`w-2 h-2 rounded-full shrink-0 ${status === "Đã kết nối GPS" ? "bg-green-400" : status === "Lỗi GPS" ? "bg-red-500" : "bg-yellow-400 animate-pulse"}`} />
            <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-green-400">GPS</span>
            {accuracy !== null && (
              <span className={`text-[9px] font-medium ${accuracy <= 10 ? "text-green-500" : accuracy <= 30 ? "text-yellow-500" : "text-red-500"}`}>
                ±{Math.round(accuracy)}m
              </span>
            )}
          </div>

          {/* Right: battery + controls */}
          <div className="flex items-center gap-3">
            {battery && (
              <div className="flex items-center gap-1">
                <BatteryIcon size={16} className={batteryColor} />
                <span className={`text-[11px] font-bold ${batteryColor}`}>{battery.level}%</span>
              </div>
            )}
            <button onClick={toggleFullscreen} className="p-1 text-slate-600 hover:text-green-400 transition">
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
            <button onClick={() => setShowSettings(v => !v)} className="p-1 text-slate-600 hover:text-green-400 transition">
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* ═══ SETTINGS PANEL ═══ */}
        {showSettings && (
          <div className="flex-1 overflow-y-auto p-4 pb-20 z-30 bg-black" style={{ overscrollBehavior: "contain" }}>
            <h2 className="text-lg font-bold mb-4 text-green-400">Cài đặt HUD</h2>
            <div className="space-y-5 max-w-lg mx-auto">

              {compassGranted === false && (
                <section>
                  <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">La bàn iOS</h3>
                  <button onClick={requestCompassPermission} className="w-full py-3 rounded-xl border border-green-500/40 bg-green-900/20 text-green-300 text-sm font-bold">
                    Cho phép La Bàn
                  </button>
                </section>
              )}

              <section>
                <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">Giọng nói</h3>
                <button onClick={toggleListening} className={`w-full py-3 flex items-center justify-center gap-2 rounded-xl border transition text-sm font-bold ${isListening ? "border-red-500 bg-red-900/30 text-white animate-pulse" : "border-slate-700 bg-slate-900 text-slate-400"}`}>
                  {isListening ? <Mic size={16} /> : <MicOff size={16} />}
                  {isListening ? "Đang lắng nghe..." : "Bật nhận diện giọng nói"}
                </button>
              </section>

              <section>
                <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">Phương tiện</h3>
                <div className="flex gap-3">
                  <button onClick={() => { hudStore.updateState({ mode: "moto" }); setShowSettings(false); }} className={`flex-1 py-3 flex flex-col items-center gap-1 rounded-xl border transition ${mode === "moto" ? "border-green-500 bg-green-900/20 text-green-300" : "border-slate-700 bg-slate-900 text-slate-500"}`}>
                    <Bike size={22} /><span className="text-xs">Xe Máy</span>
                  </button>
                  <button onClick={() => { hudStore.updateState({ mode: "car" }); setShowSettings(false); }} className={`flex-1 py-3 flex flex-col items-center gap-1 rounded-xl border transition ${mode === "car" ? "border-green-500 bg-green-900/20 text-green-300" : "border-slate-700 bg-slate-900 text-slate-500"}`}>
                    <Car size={22} /><span className="text-xs">Ô tô (HUD)</span>
                  </button>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">Sai số GPS</h3>
                <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <button onClick={() => hudStore.updateState({ offset: offset - 1 })} className="w-11 h-11 rounded-full bg-slate-800 text-white flex items-center justify-center active:scale-90 transition"><Minus size={18} /></button>
                  <div className="flex-1 text-center text-2xl font-bold tabular-nums text-green-400">{offset > 0 ? `+${offset}` : offset}</div>
                  <button onClick={() => hudStore.updateState({ offset: offset + 1 })} className="w-11 h-11 rounded-full bg-slate-800 text-white flex items-center justify-center active:scale-90 transition"><Plus size={18} /></button>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">Giới hạn tốc độ</h3>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => hudStore.updateState({ zone: "residential" })} className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition ${zone === "residential" ? "border-orange-500 bg-orange-900/20 text-orange-300" : "border-slate-700 bg-slate-900 text-slate-500"}`}>KDC</button>
                  <button onClick={() => hudStore.updateState({ zone: "outside" })} className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition ${zone === "outside" ? "border-green-500 bg-green-900/20 text-green-300" : "border-slate-700 bg-slate-900 text-slate-500"}`}>Ngoài KDC</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[40, 50, 60, 70, 80, 90, 100, 120].map(s => (
                    <button key={s} onClick={() => hudStore.updateState({ manualMax: s })} className={`py-2 text-lg font-bold rounded-xl border transition ${manualMax === s ? "border-green-500 bg-green-900/30 text-green-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}>{s}</button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider">Debug</h3>
                <button onClick={addMockZone} className="w-full py-3 flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-900/20 text-purple-300 text-sm font-bold">
                  <MapPin size={16} /> Biển báo giả lập 500m
                </button>
              </section>

              <section>
                <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Radio size={13} className={isHosting ? "text-green-400 animate-pulse" : ""} /> Điều khiển từ xa
                </h3>
                {!isHosting ? (
                  <div className="space-y-2">
                    <button onClick={handleStartHosting} className="w-full py-3 bg-green-800 hover:bg-green-700 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition">
                      <Radio size={16} /> Phát sóng HUD
                    </button>
                    <a href="/hud/remote" target="_blank" rel="noopener noreferrer" className="w-full py-2 border border-green-500/30 rounded-xl font-semibold text-green-400 text-xs flex items-center justify-center gap-2 transition">
                      <QrCode size={13} /> Mở điều khiển
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-slate-900 border border-green-500/30 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 mb-2">Quét mã để điều khiển</p>
                      <div className="flex justify-center mb-2 p-2 bg-white rounded-lg w-fit mx-auto"><QRCodeSVG value={remoteUrl} size={100} /></div>
                      <div className="text-3xl font-black tracking-[0.3em] text-green-300 font-mono">{hostRoomCode}</div>
                    </div>
                    <button onClick={handleStopHosting} className="w-full py-2 border border-red-500/40 rounded-xl text-red-400 text-xs font-bold transition">Dừng phát sóng</button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ═══ MAIN HUD (speed + map) ═══ */}
        {!showSettings && (
          <>
            {/* Speech feedback toast */}
            {speechFeedback && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-black/90 text-green-300 px-4 py-2 rounded-full border border-green-500/30 text-sm font-bold shadow-lg backdrop-blur-md pointer-events-none">
                {speechFeedback}
              </div>
            )}

            {/* ── SPEED SECTION ── */}
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">

              {/* Next Sign — top-left corner */}
              {prediction && (
                <div className="absolute top-2 left-3 flex items-center gap-1.5 z-10">
                  <div className="w-12 h-12 rounded-full bg-white border-[4px] border-red-600 flex items-center justify-center font-bold text-black text-base tabular-nums shadow-lg">
                    {prediction.nextMaxSpeed}
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm border tabular-nums ${prediction.distanceMeters <= 100 ? "text-red-400 border-red-500/40 bg-red-950/60 animate-pulse" : prediction.distanceMeters <= 200 ? "text-yellow-400 border-yellow-500/30 bg-yellow-950/60" : "text-green-400 border-green-500/30 bg-black/60"}`}>
                    {prediction.distanceMeters}m
                  </div>
                </div>
              )}

              {/* Speed limit — top-right corner, tap to open quick menu */}
              <button
                onClick={() => setShowQuickMenu(true)}
                className="absolute top-2 right-3 z-10 flex flex-col items-center gap-0.5 active:scale-95 transition"
              >
                <div className={`w-14 h-14 rounded-full border-[5px] flex items-center justify-center font-bold text-xl tabular-nums ${isOverSpeed ? "border-red-500 bg-black text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)]" : "border-orange-500 bg-black text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]"}`}>
                  {currentMaxSpeed}
                </div>
                <span className="text-[8px] text-slate-500 uppercase tracking-widest">Limit</span>
              </button>

              {/* Main speed display */}
              <div className="flex flex-col items-center">
                <div
                  className={`font-digital font-black leading-none tabular-nums tracking-tighter select-none ${isOverSpeed ? "text-red-500" : "text-green-400"}`}
                  style={{
                    fontSize: "clamp(100px, 38vw, 260px)",
                    textShadow: isOverSpeed
                      ? "0 0 30px rgba(239,68,68,0.9), 0 0 60px rgba(239,68,68,0.5), 0 0 100px rgba(239,68,68,0.2)"
                      : "0 0 30px rgba(74,222,128,0.9), 0 0 60px rgba(74,222,128,0.5), 0 0 100px rgba(74,222,128,0.2)",
                  }}
                >
                  {finalSpeed}
                </div>
                <div
                  className={`text-xl font-bold tracking-[0.35em] mt-1 ${isOverSpeed ? "text-red-400" : "text-green-400"}`}
                  style={{ textShadow: isOverSpeed ? "0 0 10px rgba(239,68,68,0.6)" : "0 0 10px rgba(74,222,128,0.6)" }}
                >
                  KM/H
                </div>
              </div>
            </div>

            {/* ── GLOW DIVIDER ── */}
            <div
              className="shrink-0 h-px mx-0 relative"
              style={{
                background: isOverSpeed
                  ? "linear-gradient(to right, transparent 0%, rgba(239,68,68,0.5) 20%, rgba(239,68,68,1) 50%, rgba(239,68,68,0.5) 80%, transparent 100%)"
                  : "linear-gradient(to right, transparent 0%, rgba(74,222,128,0.5) 20%, rgba(74,222,128,1) 50%, rgba(74,222,128,0.5) 80%, transparent 100%)",
                boxShadow: isOverSpeed
                  ? "0 0 8px rgba(239,68,68,0.8), 0 0 20px rgba(239,68,68,0.4)"
                  : "0 0 8px rgba(74,222,128,0.8), 0 0 20px rgba(74,222,128,0.4)",
              }}
            />

            {/* ── MAP SECTION ── */}
            <div className="shrink-0 relative overflow-hidden" style={{ height: "33dvh" }}>
              <HudMiniMap coords={coords} heading={heading} predictions={predictions} />
            </div>

            {/* ── BOTTOM BAR ── */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-black border-t border-slate-900 z-20">
              {/* Battery card */}
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 min-w-[120px]">
                {battery ? (
                  <>
                    <BatteryIcon size={26} className={batteryColor} />
                    <div>
                      <div className={`text-xl font-bold tabular-nums leading-none ${batteryColor}`}>{battery.level}<span className="text-xs">%</span></div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">PIN</div>
                    </div>
                  </>
                ) : (
                  <>
                    <BatteryFull size={26} className="text-slate-700" />
                    <div>
                      <div className="text-xl font-bold text-slate-600">--</div>
                      <div className="text-[9px] text-slate-700 uppercase tracking-widest mt-0.5">PIN</div>
                    </div>
                  </>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button onClick={() => hudStore.updateState({ offset: offset - 1 })} className="w-11 h-11 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center active:scale-90 transition"><Minus size={16} /></button>
                <button onClick={() => hudStore.updateState({ offset: offset + 1 })} className="w-11 h-11 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center active:scale-90 transition"><Plus size={16} /></button>
                {offset !== 0 && <span className="text-[10px] font-bold text-green-400 w-5 text-center">{offset > 0 ? `+${offset}` : offset}</span>}
                <button onClick={toggleListening} className={`w-11 h-11 rounded-full border flex items-center justify-center active:scale-90 transition ${isListening ? "bg-red-600 border-red-500 text-white" : "bg-slate-900 border-slate-800 text-slate-500"}`}>
                  {isListening ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
                {coords && (
                  <button onClick={handleSaveZone} className="w-11 h-11 rounded-full bg-slate-900 border border-slate-800 text-slate-500 hover:text-green-400 flex items-center justify-center active:scale-90 transition">
                    <MapPin size={16} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ QUICK MENU OVERLAY ═══ */}
      {showQuickMenu && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4">
          <button onClick={() => setShowQuickMenu(false)} className="absolute top-4 right-4 w-11 h-11 bg-slate-900 rounded-full text-white flex items-center justify-center"><X size={20} /></button>
          <h3 className="text-lg font-bold text-green-400 mb-5">Biển Báo Tốc Độ</h3>
          <div className="grid grid-cols-4 gap-3 max-w-xs w-full mb-4">
            <button onClick={() => handleQuickSelect("zone", "residential")} className="col-span-2 py-3.5 bg-orange-950/60 border-2 border-orange-500 rounded-xl text-base font-bold text-orange-200">KDC</button>
            <button onClick={() => handleQuickSelect("zone", "outside")} className="col-span-2 py-3.5 bg-green-950/60 border-2 border-green-500 rounded-xl text-base font-bold text-green-200">Ngoài KDC</button>
          </div>
          <div className="grid grid-cols-4 gap-3 max-w-xs w-full">
            {[40, 50, 60, 70, 80, 90, 100, 120].map(s => (
              <button key={s} onClick={() => handleQuickSelect("manual", s)} className={`aspect-square rounded-full border-[3px] text-xl font-bold flex items-center justify-center transition active:scale-90 ${currentMaxSpeed === s ? "border-green-400 bg-green-900/40 text-green-300 shadow-[0_0_15px_rgba(74,222,128,0.4)]" : "border-slate-600 bg-slate-900 text-white"}`}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SAVE ZONE MODAL ═══ */}
      {showSaveConfirm && pendingZone && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 max-w-sm w-full">
            <h3 className="text-base font-bold text-green-400 mb-3 flex items-center gap-2"><Save size={18} /> Xác nhận lưu toạ độ</h3>
            <div className="space-y-2 text-sm text-slate-300 mb-4">
              <div className="flex justify-between"><span className="text-slate-500">Toạ độ</span><span>{pendingZone.lat.toFixed(5)}, {pendingZone.lng.toFixed(5)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Heading</span><span>{Math.round(pendingZone.heading)}°</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tốc độ tối đa</span><span className="font-bold text-red-400">{pendingZone.maxSpeed} km/h</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Zone</span><span>{pendingZone.zone === "residential" ? "Khu dân cư" : "Ngoài KDC"}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSaveConfirm(false)} className="flex-1 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 font-bold text-sm">Huỷ</button>
              <button onClick={confirmSave} className="flex-1 py-3 bg-green-700 hover:bg-green-600 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition"><Save size={15} /> Lưu</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

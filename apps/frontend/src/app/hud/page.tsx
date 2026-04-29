"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { ArrowLeft, Car, Bike, Settings, Plus, Minus, Mic, MicOff, X, Maximize, Minimize, Radio, QrCode } from "lucide-react";
import { useHudStore } from "../../store/hud-store";

export default function HUDPage() {
  const [speed, setSpeed] = useState<number>(0);
  const [status, setStatus] = useState<"Đang tìm GPS..." | "Đã kết nối GPS" | "Lỗi GPS">("Đang tìm GPS...");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showQuickMenu, setShowQuickMenu] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHosting, setIsHosting] = useState<boolean>(false);
  const [hostRoomCode, setHostRoomCode] = useState<string>("");
  
  const [remoteUrl, setRemoteUrl] = useState<string>("");
  useEffect(() => {
    if (hostRoomCode && typeof window !== "undefined") {
      setRemoteUrl(`${window.location.origin}/hud/remote?room=${hostRoomCode}`);
    }
  }, [hostRoomCode]);
  
  // HUD Remote Store
  const hudStore = useHudStore();

  const { mode, roadType, zone, manualMax, offset } = hudStore.state;

  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechFeedback, setSpeechFeedback] = useState<string>("");
  const recognitionRef = useRef<any>(null);

  const watchId = useRef<number | null>(null);

  // Tính max speed
  let currentMaxSpeed = 60;
  if (roadType === "manual") {
    currentMaxSpeed = manualMax;
  } else if (roadType === "1_lane") {
    currentMaxSpeed = zone === "residential" ? 50 : 80;
  } else if (roadType === "2_lane") {
    currentMaxSpeed = zone === "residential" ? 60 : 90;
  }

  const finalSpeed = Math.max(0, Math.round(speed + offset));
  const isOverSpeed = finalSpeed > currentMaxSpeed;

  // Load state từ localStorage khi khởi động
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hud_config");
      if (saved) {
        const config = JSON.parse(saved);
        // Sync vào store (không emit)
        hudStore.syncState({
          mode: config.mode || "moto",
          roadType: config.roadType || "1_lane",
          zone: config.zone || "residential",
          manualMax: config.manualMax || 60,
          offset: config.offset !== undefined ? config.offset : 0,
        });
      }
    } catch (e) { console.error("Lỗi đọc cache", e); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lưu state vào localStorage khi state trong store thay đổi
  useEffect(() => {
    localStorage.setItem("hud_config", JSON.stringify(hudStore.state));
  }, [hudStore.state]);

  useEffect(() => {
    // WakeLock
    let wakeLockObj: any = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockObj = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.error("WakeLock failed", err);
      }
    };
    requestWakeLock();
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Geolocation
    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          setStatus("Đã kết nối GPS");
          // position.coords.speed is in m/s, convert to km/h
          const mps = position.coords.speed || 0;
          setSpeed(mps * 3.6);
        },
        (error) => {
          setStatus("Lỗi GPS");
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    } else {
      setStatus("Lỗi GPS");
    }

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (wakeLockObj) {
        wakeLockObj.release();
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Thiết lập Speech Recognition
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
          console.log("Nghe được: ", command);
          
          let parsed = false;
          
          if (command.includes("hết khu dân cư") || command.includes("ngoài khu dân cư")) {
            const curRoadType = useHudStore.getState().state.roadType;
            hudStore.updateState({ 
              roadType: curRoadType === "manual" ? "1_lane" : curRoadType,
              zone: "outside" 
            });
            setSpeechFeedback("Đã chuyển: Ngoài KDC");
            parsed = true;
          } else if (command.includes("khu dân cư")) {
            const curRoadType = useHudStore.getState().state.roadType;
            hudStore.updateState({ 
              roadType: curRoadType === "manual" ? "1_lane" : curRoadType,
              zone: "residential" 
            });
            setSpeechFeedback("Đã chuyển: Trong KDC");
            parsed = true;
          } else if (command.includes("một làn") || command.includes("1 làn")) {
            hudStore.updateState({ roadType: "1_lane" });
            setSpeechFeedback("Đã chuyển: Đường 1 làn");
            parsed = true;
          } else if (command.includes("hai làn") || command.includes("2 làn")) {
            hudStore.updateState({ roadType: "2_lane" });
            setSpeechFeedback("Đã chuyển: Đường 2 làn");
            parsed = true;
          } else {
            // Tối ưu nhận diện giọng nói: bắt cả chữ và số (rất hay bị lỗi API trả về chữ thay vì số)
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
              setSpeechFeedback(`Giới hạn: ${parsedSpeed} km/h`);
              parsed = true;
            }
          }

          if (!parsed) {
            setSpeechFeedback("Không hiểu lệnh: " + command);
          }

          setTimeout(() => setSpeechFeedback(""), 3000);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
          setSpeechFeedback("Lỗi micro: " + event.error);
          setTimeout(() => setSpeechFeedback(""), 3000);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        console.warn("Trình duyệt không hỗ trợ Web Speech API");
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      // Force stop và cập nhật state ngay lập tức, không chờ onend
      setIsListening(false);
      setSpeechFeedback("");
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    } else {
      setSpeechFeedback("Đang nghe...");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleQuickSelect = (type: string, val?: number | string) => {
    if (type === "zone") {
      hudStore.updateState({ 
        roadType: roadType === "manual" ? "1_lane" : roadType,
        zone: val as "residential" | "outside"
      });
    } else if (type === "manual") {
      hudStore.updateState({
        roadType: "manual",
        manualMax: val as number
      });
    }
    setShowQuickMenu(false);
  };

  const toggleZone = () => {
    hudStore.updateState({
      roadType: roadType === "manual" ? "1_lane" : roadType,
      zone: zone === "residential" ? "outside" : "residential"
    });
  };

  const toggleFullscreen = () => {
    const doc = document as any;
    const de = document.documentElement as any;

    if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
      if (de.requestFullscreen) de.requestFullscreen();
      else if (de.webkitRequestFullscreen) de.webkitRequestFullscreen();
      else if (de.mozRequestFullScreen) de.mozRequestFullScreen();
      else if (de.msRequestFullscreen) de.msRequestFullscreen();
      setIsFullscreen(true);
    } else {
      if (doc.exitFullscreen) doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
      else if (doc.msExitFullscreen) doc.msExitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleStartHosting = async () => {
    await hudStore.connect();
    const result = await hudStore.createRoom();
    if (result) {
      setIsHosting(true);
      setHostRoomCode(result.roomCode);
      void hudStore.updateState({ mode, roadType, zone, manualMax, offset });
    }
  };

  const handleStopHosting = async () => {
    await hudStore.leaveRoom();
    setIsHosting(false);
    setHostRoomCode("");
  };

  return (
    <main 
      id="hud-main"
      className={`min-h-[100dvh] h-[100dvh] w-full overflow-hidden text-white flex flex-col transition-colors duration-300 fixed inset-0 select-none touch-none ${
        isOverSpeed && !showSettings ? "bg-red-950" : "bg-black"
      }`}
    >
      <style jsx global>{`
        body, html {
          overflow: hidden;
          overscroll-behavior: none;
          touch-action: none;
        }
      `}</style>
      <div className={`flex flex-col w-full h-full ${mode === "car" && !showSettings ? "scale-y-[-1]" : ""}`}>
        {/* Top Navigation */}
        <div className="flex items-center justify-between p-4 bg-slate-900/30">
          <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-white">
            <ArrowLeft size={24} />
            <span className="font-semibold">Portal</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className={`text-sm font-medium ${status === "Đã kết nối GPS" ? "text-green-400" : "text-yellow-400"}`}>
              {status}
            </div>
            
            {/* Cảnh báo chế độ lật gương (chỉ hiển thị icon nếu không ở trang Setting để tránh ngược chữ) */}
            {!showSettings && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleFullscreen}
                  className="p-1.5 bg-slate-800 rounded-full text-slate-300 hover:text-white"
                  title="Toàn màn hình"
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>

                <button 
                  onClick={() => hudStore.updateState({ mode: mode === "car" ? "moto" : "car" })}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-full text-cyan-300 hover:bg-slate-700 transition"
                  title="Bấm để đổi phương tiện"
                >
                  {mode === "car" ? <Car size={18} /> : <Bike size={18} />}
                  <span className="text-xs font-semibold uppercase hidden sm:inline">{mode === "car" ? "Ô tô (HUD)" : "Xe máy"}</span>
                </button>
              </div>
            )}

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white"
            >
              <Settings size={24} />
            </button>
          </div>
        </div>

        {/* HUD Speed Display */}
        <div className={`flex-1 flex flex-col items-center justify-center relative ${showSettings ? "hidden" : "flex"}`}>
          {/* Thông báo giọng nói */}
          {speechFeedback && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-cyan-300 px-4 py-2 rounded-full shadow-lg z-20">
              {speechFeedback}
            </div>
          )}

          {/* Nút Mic - Chỉ hiện khi không phát sóng */}
          {!isHosting && (
            <button 
              onClick={toggleListening}
              className={`absolute bottom-10 left-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors z-10 ${
                isListening ? "bg-red-600 animate-pulse" : "bg-slate-800 border-2 border-slate-700"
              }`}
            >
              {isListening ? <Mic size={40} className="text-white" /> : <MicOff size={40} className="text-slate-400" />}
            </button>
          )}
          {/* Speed Number & Offset Controls */}
          <div className="flex items-center justify-center gap-2 md:gap-8 w-full max-w-4xl px-4">
            <button 
              onClick={() => hudStore.updateState({ offset: offset - 1 })}
              className="p-3 md:p-6 rounded-full bg-slate-800/40 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors z-10"
              title="Giảm 1 km/h"
            >
              <Minus size={36} className="md:w-12 md:h-12" />
            </button>

            <div className={`text-[14rem] md:text-[20rem] font-black leading-none tabular-nums tracking-tighter ${isOverSpeed ? "text-red-500 animate-pulse" : "text-white"}`}>
              {finalSpeed}
            </div>

            <button 
              onClick={() => hudStore.updateState({ offset: offset + 1 })}
              className="p-3 md:p-6 rounded-full bg-slate-800/40 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors z-10"
              title="Tăng 1 km/h"
            >
              <Plus size={36} className="md:w-12 md:h-12" />
            </button>
          </div>
          
          <div className="flex items-center gap-3 mt-2">
            <div className="text-4xl md:text-5xl font-semibold text-slate-400">km/h</div>
            {offset !== 0 && (
              <div className="text-xl md:text-2xl font-bold text-cyan-400 bg-slate-800/80 px-3 py-1 rounded-lg border border-cyan-500/30">
                {offset > 0 ? `+${offset}` : offset}
              </div>
            )}
          </div>

          {/* Hiển thị Zone (KDC / Ngoài KDC) bên dưới - Thu gọn lại và chỉ hiện khi không phát sóng */}
          {!isHosting && (
            <button 
              onClick={toggleZone}
              className={`mt-4 px-5 py-2 rounded-full border text-lg md:text-xl font-bold uppercase tracking-widest shadow-lg transition-transform hover:scale-105 active:scale-95 ${
                zone === "residential" ? "border-orange-500/50 text-orange-400 bg-orange-950/40" : "border-green-500/50 text-green-400 bg-green-950/40"
              }`}
            >
              {zone === "residential" ? "Khu dân cư" : "Ngoài KDC"}
            </button>
          )}

          {/* Max Speed Sign (To góc trái) */}
          <button 
            onClick={() => setShowQuickMenu(true)}
            className="absolute top-10 left-10 md:top-20 md:left-20 w-24 h-24 md:w-36 md:h-36 rounded-full border-[10px] border-red-600 bg-white flex items-center justify-center shadow-[0_0_25px_rgba(220,38,38,0.4)] hover:scale-105 transition-transform z-10"
          >
            <span className="text-4xl md:text-6xl font-bold text-black tabular-nums tracking-tighter">{currentMaxSpeed}</span>
          </button>

          {/* Thanh chọn tốc độ dọc bên phải - Chỉ hiện khi không phát sóng */}
          {!isHosting && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 md:gap-4 z-10">
              {[50, 60, 80, 90, 100, 120].map(s => (
                <button 
                  key={s}
                  onClick={() => handleQuickSelect("manual", s)}
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-[4px] flex items-center justify-center font-bold text-xl md:text-2xl transition-all ${
                    currentMaxSpeed === s && roadType === "manual" ? "border-red-600 bg-white text-black scale-110 shadow-[0_0_15px_rgba(239,68,68,0.6)]" : "border-slate-600 bg-slate-800/80 text-slate-300 opacity-70 hover:opacity-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Quick Menu Overlay */}
          {showQuickMenu && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
              <button 
                onClick={() => setShowQuickMenu(false)}
                className="absolute top-10 right-10 p-3 bg-slate-800 rounded-full text-white"
              >
                <X size={32} />
              </button>
              
              <h3 className="text-2xl font-bold text-cyan-400 mb-8">Chạm Nhanh Biển Báo</h3>
              
              <div className="grid grid-cols-3 gap-4 md:gap-6 max-w-lg w-full">
                <button onClick={() => handleQuickSelect("zone", "residential")} className="col-span-3 py-4 bg-orange-900/50 border-2 border-orange-500 rounded-xl text-xl font-bold text-orange-200">
                  Khu dân cư (KDC)
                </button>
                <button onClick={() => handleQuickSelect("zone", "outside")} className="col-span-3 py-4 bg-green-900/50 border-2 border-green-500 rounded-xl text-xl font-bold text-green-200 mb-4">
                  Hết khu dân cư (Ngoài KDC)
                </button>
                
                {[40, 50, 60, 80, 90, 100, 120].map(s => (
                  <button 
                    key={s}
                    onClick={() => handleQuickSelect("manual", s)}
                    className="py-4 border-4 border-red-600 bg-white rounded-full text-3xl font-bold text-black flex items-center justify-center aspect-square shadow-lg"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="flex-1 p-6 overflow-y-auto pb-20">
            <h2 className="text-2xl font-bold mb-6 text-cyan-400">Cài đặt HUD</h2>
            
            <div className="space-y-8 max-w-2xl mx-auto">
              {/* Điều khiển giọng nói */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-slate-300">Điều khiển giọng nói</h3>
                <button 
                  onClick={toggleListening}
                  className={`w-full py-4 flex items-center justify-center gap-3 rounded-xl border-2 transition ${isListening ? "border-red-500 bg-red-900/30 text-white animate-pulse" : "border-slate-700 bg-slate-800 text-slate-400"}`}
                >
                  {isListening ? <Mic size={24} /> : <MicOff size={24} />}
                  <span className="font-bold">{isListening ? "Đang lắng nghe..." : "Bật nhận diện giọng nói"}</span>
                </button>
                <p className="text-xs text-slate-500 mt-2">Dùng giọng nói để chuyển "Khu dân cư", "1 làn", "2 làn" hoặc đọc số tốc độ.</p>
              </section>

              {/* Chế độ hiển thị */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-slate-300">Chế độ hiển thị</h3>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { hudStore.updateState({ mode: "moto" }); setShowSettings(false); }}
                    className={`flex-1 py-4 flex flex-col items-center gap-2 rounded-xl border-2 transition ${mode === "moto" ? "border-cyan-500 bg-cyan-900/30 text-cyan-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}
                  >
                    <Bike size={32} />
                    <span>Xe Máy (Thường)</span>
                  </button>
                  <button 
                    onClick={() => { hudStore.updateState({ mode: "car" }); setShowSettings(false); }}
                    className={`flex-1 py-4 flex flex-col items-center gap-2 rounded-xl border-2 transition ${mode === "car" ? "border-cyan-500 bg-cyan-900/30 text-cyan-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}
                  >
                    <Car size={32} />
                    <span>Ô tô (Phản chiếu)</span>
                  </button>
                </div>
              </section>

              {/* Điều chỉnh sai số */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-slate-300">Tinh chỉnh sai số (Offset)</h3>
                <div className="flex items-center gap-6 bg-slate-800 p-4 rounded-xl">
                  <button onClick={() => hudStore.updateState({ offset: offset - 1 })} className="p-3 bg-slate-700 rounded-lg hover:bg-slate-600">
                    <Minus size={24} />
                  </button>
                  <div className="flex-1 text-center text-3xl font-bold tabular-nums text-white">
                    {offset > 0 ? `+${offset}` : offset}
                  </div>
                  <button onClick={() => hudStore.updateState({ offset: offset + 1 })} className="p-3 bg-slate-700 rounded-lg hover:bg-slate-600">
                    <Plus size={24} />
                  </button>
                </div>
                <p className="text-sm text-slate-500 mt-2">Dùng để bù trừ sai số giữa GPS điện thoại và đồng hồ thật của xe.</p>
              </section>

              {/* Giới hạn tốc độ */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-slate-300">Cài đặt giới hạn tốc độ</h3>
                
                <div className="space-y-4">
                  <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
                    <button onClick={() => hudStore.updateState({ roadType: "1_lane" })} className={`flex-1 py-2 text-sm rounded-md transition ${roadType === "1_lane" ? "bg-slate-600 text-white shadow" : "text-slate-400"}`}>Đường 1 làn</button>
                    <button onClick={() => hudStore.updateState({ roadType: "2_lane" })} className={`flex-1 py-2 text-sm rounded-md transition ${roadType === "2_lane" ? "bg-slate-600 text-white shadow" : "text-slate-400"}`}>Đường ≥2 làn</button>
                    <button onClick={() => hudStore.updateState({ roadType: "manual" })} className={`flex-1 py-2 text-sm rounded-md transition ${roadType === "manual" ? "bg-slate-600 text-white shadow" : "text-slate-400"}`}>Biển báo</button>
                  </div>

                  {roadType !== "manual" ? (
                    <div className="flex gap-4">
                      <button onClick={() => hudStore.updateState({ zone: "residential" })} className={`flex-1 py-4 flex flex-col gap-1 items-center rounded-xl border-2 transition ${zone === "residential" ? "border-orange-500 bg-orange-900/20 text-orange-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                        <span className="font-semibold text-lg">Khu dân cư</span>
                        <span className="text-sm opacity-80">(Biển nhà)</span>
                      </button>
                      <button onClick={() => hudStore.updateState({ zone: "outside" })} className={`flex-1 py-4 flex flex-col gap-1 items-center rounded-xl border-2 transition ${zone === "outside" ? "border-green-500 bg-green-900/20 text-green-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                        <span className="font-semibold text-lg">Ngoài KDC</span>
                        <span className="text-sm opacity-80">(Biển báo hiệu)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {[40, 50, 60, 80, 90, 100, 120].map(s => (
                        <button 
                          key={s} 
                          onClick={() => hudStore.updateState({ manualMax: s })}
                          className={`py-3 text-xl font-bold rounded-xl border-2 transition ${manualMax === s ? "border-cyan-500 bg-cyan-900/40 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]" : "border-slate-700 bg-slate-800 text-slate-400"}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl mt-4 flex justify-between items-center">
                    <span className="text-slate-300">Tốc độ tối đa giới hạn:</span>
                    <span className="text-3xl font-bold text-red-400">{currentMaxSpeed} km/h</span>
                  </div>
                </div>
              </section>

              {/* Phát sóng Remote */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-slate-300 flex items-center gap-2">
                  <Radio size={20} className={isHosting ? "text-green-400 animate-pulse" : "text-slate-400"} />
                  Điều khiển từ xa
                </h3>
                {!isHosting ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400">Tạo một phòng để điều khiển HUD từ thiết bị thứ hai (điện thoại phụ)</p>
                    <button
                      onClick={handleStartHosting}
                      className="w-full py-4 bg-green-700 hover:bg-green-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition"
                    >
                      <Radio size={22} /> Phát sóng HUD
                    </button>
                    <a
                      href="/hud/remote"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 border border-cyan-500/50 rounded-xl font-semibold text-cyan-400 hover:bg-cyan-900/20 text-center text-sm flex items-center justify-center gap-2 transition"
                    >
                      <QrCode size={18} /> Mở màn hình điều khiển
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-slate-900 border border-green-500/40 rounded-xl p-4 text-center">
                      <p className="text-sm text-slate-400 mb-2">Quét mã để điều khiển</p>
                      <div className="flex justify-center mb-4 p-2 bg-white rounded-lg w-fit mx-auto">
                        <QRCodeSVG value={remoteUrl} size={150} />
                      </div>
                      <p className="text-sm text-slate-400 mb-1">Hoặc nhập mã phòng</p>
                      <div className="text-5xl font-black tracking-[0.3em] text-green-300 font-mono mb-2">{hostRoomCode}</div>
                      <p className="text-xs text-slate-500">Truy cập: {remoteUrl.split('?')[0]}</p>
                    </div>
                    <button
                      onClick={handleStopHosting}
                      className="w-full py-3 border border-red-500/50 rounded-xl font-semibold text-red-400 hover:bg-red-900/20 text-sm transition"
                    >
                      Dừng phát sóng
                    </button>
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

"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Car, Bike, Settings, Plus, Minus, Mic, MicOff, X } from "lucide-react";

export default function HUDPage() {
  const [speed, setSpeed] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [status, setStatus] = useState<"Đang tìm GPS..." | "Đã kết nối GPS" | "Lỗi GPS">("Đang tìm GPS...");
  const [mode, setMode] = useState<"moto" | "car">("moto");
  
  const [roadType, setRoadType] = useState<"1_lane" | "2_lane" | "manual">("1_lane");
  const [zone, setZone] = useState<"residential" | "outside">("residential");
  const [manualMax, setManualMax] = useState<number>(60);
  
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showQuickMenu, setShowQuickMenu] = useState<boolean>(false);
  
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
            setRoadType(t => t === "manual" ? "1_lane" : t);
            setZone("outside");
            setSpeechFeedback("Đã chuyển: Ngoài KDC");
            parsed = true;
          } else if (command.includes("khu dân cư")) {
            setRoadType(t => t === "manual" ? "1_lane" : t);
            setZone("residential");
            setSpeechFeedback("Đã chuyển: Trong KDC");
            parsed = true;
          } else if (command.includes("một làn") || command.includes("1 làn")) {
            setRoadType("1_lane");
            setSpeechFeedback("Đã chuyển: Đường 1 làn");
            parsed = true;
          } else if (command.includes("hai làn") || command.includes("2 làn")) {
            setRoadType("2_lane");
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
              setRoadType("manual");
              setManualMax(parsedSpeed);
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
      recognitionRef.current?.stop();
    } else {
      setSpeechFeedback("Đang nghe...");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleQuickSelect = (type: string, val?: number | string) => {
    if (type === "zone") {
      setRoadType(t => t === "manual" ? "1_lane" : t);
      setZone(val as "residential" | "outside");
    } else if (type === "manual") {
      setRoadType("manual");
      setManualMax(val as number);
    }
    setShowQuickMenu(false);
  };

  return (
    <main 
      className={`min-h-[100dvh] text-white flex flex-col transition-colors duration-300 ${
        isOverSpeed && !showSettings ? "bg-red-950" : "bg-black"
      }`}
    >
      <div className={`flex flex-col w-full h-full min-h-[100dvh] ${mode === "car" && !showSettings ? "scale-y-[-1]" : ""}`}>
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
              <button 
                onClick={() => setMode(m => m === "car" ? "moto" : "car")}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-full text-cyan-300 hover:bg-slate-700 transition"
                title="Bấm để đổi phương tiện"
              >
                {mode === "car" ? <Car size={18} /> : <Bike size={18} />}
                <span className="text-xs font-semibold uppercase">{mode === "car" ? "Ô tô (HUD)" : "Xe máy"}</span>
              </button>
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

          {/* Nút Mic */}
          <button 
            onClick={toggleListening}
            className={`absolute bottom-10 left-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors z-10 ${
              isListening ? "bg-red-600 animate-pulse" : "bg-slate-800 border-2 border-slate-700"
            }`}
          >
            {isListening ? <Mic size={40} className="text-white" /> : <MicOff size={40} className="text-slate-400" />}
          </button>
          {/* Speed Number */}
          <div className={`text-[12rem] md:text-[16rem] font-bold leading-none tabular-nums tracking-tighter ${isOverSpeed ? "text-red-500 animate-pulse" : "text-white"}`}>
            {finalSpeed}
          </div>
          <div className="text-4xl md:text-5xl font-semibold text-slate-400 mt-2">km/h</div>

          {/* Max Speed Sign (Clickable for Quick Menu) */}
          <button 
            onClick={() => setShowQuickMenu(true)}
            className="absolute top-10 right-10 w-28 h-28 md:w-40 md:h-40 rounded-full border-[12px] border-red-600 bg-white flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:scale-105 transition-transform"
          >
            <span className="text-5xl md:text-7xl font-bold text-black tabular-nums tracking-tighter">{currentMaxSpeed}</span>
          </button>

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
              {/* Chế độ hiển thị */}
              <section>
                <h3 className="text-lg font-semibold mb-3 text-slate-300">Chế độ hiển thị</h3>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setMode("moto"); setShowSettings(false); }}
                    className={`flex-1 py-4 flex flex-col items-center gap-2 rounded-xl border-2 transition ${mode === "moto" ? "border-cyan-500 bg-cyan-900/30 text-cyan-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}
                  >
                    <Bike size={32} />
                    <span>Xe Máy (Thường)</span>
                  </button>
                  <button 
                    onClick={() => { setMode("car"); setShowSettings(false); }}
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
                  <button onClick={() => setOffset(o => o - 1)} className="p-3 bg-slate-700 rounded-lg hover:bg-slate-600">
                    <Minus size={24} />
                  </button>
                  <div className="flex-1 text-center text-3xl font-bold tabular-nums text-white">
                    {offset > 0 ? `+${offset}` : offset}
                  </div>
                  <button onClick={() => setOffset(o => o + 1)} className="p-3 bg-slate-700 rounded-lg hover:bg-slate-600">
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
                    <button onClick={() => setRoadType("1_lane")} className={`flex-1 py-2 text-sm rounded-md transition ${roadType === "1_lane" ? "bg-slate-600 text-white shadow" : "text-slate-400"}`}>Đường 1 làn</button>
                    <button onClick={() => setRoadType("2_lane")} className={`flex-1 py-2 text-sm rounded-md transition ${roadType === "2_lane" ? "bg-slate-600 text-white shadow" : "text-slate-400"}`}>Đường ≥2 làn</button>
                    <button onClick={() => setRoadType("manual")} className={`flex-1 py-2 text-sm rounded-md transition ${roadType === "manual" ? "bg-slate-600 text-white shadow" : "text-slate-400"}`}>Biển báo</button>
                  </div>

                  {roadType !== "manual" ? (
                    <div className="flex gap-4">
                      <button onClick={() => setZone("residential")} className={`flex-1 py-4 flex flex-col gap-1 items-center rounded-xl border-2 transition ${zone === "residential" ? "border-orange-500 bg-orange-900/20 text-orange-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                        <span className="font-semibold text-lg">Khu dân cư</span>
                        <span className="text-sm opacity-80">(Biển nhà)</span>
                      </button>
                      <button onClick={() => setZone("outside")} className={`flex-1 py-4 flex flex-col gap-1 items-center rounded-xl border-2 transition ${zone === "outside" ? "border-green-500 bg-green-900/20 text-green-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                        <span className="font-semibold text-lg">Ngoài KDC</span>
                        <span className="text-sm opacity-80">(Biển báo hiệu)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {[40, 50, 60, 80, 90, 100, 120].map(s => (
                        <button 
                          key={s} 
                          onClick={() => setManualMax(s)}
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
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Sun, CalendarDays, Snowflake, Droplets, Play, Pause, Settings2 } from "lucide-react";
import Link from "next/link";

// Dynamically import the 3D simulation to avoid SSR issues
const SpaceSimulation = dynamic(
  () => import("./components/SpaceSimulation"),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">Đang tải phòng thí nghiệm...</div> }
);

export type SimulationState = {
  dayNight: boolean;
  seasons: boolean;
  polar: boolean;
  tides: boolean;
};

export default function SpaceLabPage() {
  const [simState, setSimState] = useState<SimulationState>({
    dayNight: true,
    seasons: false,
    polar: false,
    tides: false,
  });

  const toggleModule = (module: keyof SimulationState) => {
    setSimState((prev) => ({
      ...prev,
      [module]: !prev[module],
    }));
  };

  const modules = [
    {
      id: "dayNight" as keyof SimulationState,
      title: "Ngày và Đêm",
      icon: <Sun className="w-8 h-8 text-yellow-400" />,
      description: "Trái đất xoay tròn như một chú quay. Mặt nào nhìn thấy bác Mặt trời là ban ngày, mặt nào quay lưng đi là ban đêm.",
      color: "from-yellow-400/20 to-orange-500/20",
      borderColor: "border-yellow-500",
    },
    {
      id: "seasons" as keyof SimulationState,
      title: "Các Mùa trong năm",
      icon: <CalendarDays className="w-8 h-8 text-green-400" />,
      description: "Trái đất nghiêng đầu 23.5 độ khi chạy quanh Mặt trời. Vùng nào nghiêng về phía Mặt trời nhiều hơn sẽ là mùa Hè ấm áp.",
      color: "from-green-400/20 to-emerald-500/20",
      borderColor: "border-green-500",
    },
    {
      id: "polar" as keyof SimulationState,
      title: "Ngày dài đêm ngắn & Vùng cực",
      icon: <Snowflake className="w-8 h-8 text-cyan-400" />,
      description: "Do cái đầu nghiêng, có những nơi bác Mặt trời chẳng bao giờ đi ngủ (Ngày trắng) hoặc chẳng bao giờ thức dậy (Đêm cực).",
      color: "from-cyan-400/20 to-blue-500/20",
      borderColor: "border-cyan-500",
    },
    {
      id: "tides" as keyof SimulationState,
      title: "Thủy triều",
      icon: <Droplets className="w-8 h-8 text-indigo-400" />,
      description: "Bạn Mặt trăng như một thỏi nam châm khổng lồ, kéo nước biển dâng cao mỗi khi bạn ấy bay qua.",
      color: "from-indigo-400/20 to-purple-500/20",
      borderColor: "border-indigo-500",
    },
  ];

  const [activeHint, setActiveHint] = useState<keyof SimulationState | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'space' | 'surface'>('space');
  const [dayOfYear, setDayOfYear] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSpan, setTimeSpan] = useState(365.25);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [showTimeConfig, setShowTimeConfig] = useState(false);

  // Play loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const deltaMs = currentTime - lastTime;
      lastTime = currentTime;

      if (isPlaying) {
        setDayOfYear(prev => {
          // Tính toán sao cho thời gian chạy hết thanh trượt (timeSpan) luôn mất khoảng 30 giây ở tốc độ 1x
          const daysPerSecond = (timeSpan / 30) * playSpeed;
          let next = prev + (deltaMs / 1000) * daysPerSecond;
          if (next > timeSpan) next = 0;
          return next;
        });
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(loop);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, timeSpan, playSpeed]);

  const formatDate = (days: number) => {
    const baseDate = new Date(2025, 0, 1, 0, 0, 0);
    baseDate.setTime(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    
    const d = baseDate.getDate().toString().padStart(2, '0');
    const m = (baseDate.getMonth() + 1).toString().padStart(2, '0');
    const h = baseDate.getHours().toString().padStart(2, '0');
    
    return `${d}/${m} - ${h}:00`;
  };

  const toggleHint = (e: React.MouseEvent, id: keyof SimulationState) => {
    e.stopPropagation();
    setActiveHint(activeHint === id ? null : id);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      
      {/* 3D Simulation Canvas - Full Screen */}
      <div className="absolute inset-0 z-0">
        <SpaceSimulation simState={simState} viewMode={viewMode} dayOfYear={dayOfYear} />
      </div>

      {/* Floating Buttons Group (Top Left) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3">
        {/* Toggle Panel Button */}
        <button 
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="w-12 h-12 bg-slate-900/60 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center text-cyan-400 hover:text-white hover:bg-slate-800/80 transition-all shadow-lg"
        >
          {isPanelOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Floating Control Panel */}
      <div className={`absolute top-20 left-4 z-10 w-64 md:w-72 max-h-[calc(100vh-6rem)] flex flex-col bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-y-auto transition-all duration-300 origin-top-left ${
        isPanelOpen ? "scale-100 opacity-100" : "scale-90 opacity-0 pointer-events-none"
      }`}>
        <div className="p-3 md:p-4 pb-2 md:pb-3 sticky top-0 bg-slate-900/60 backdrop-blur-lg z-20 border-b border-white/5">
          <Link href="/" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors mb-1 md:mb-2 text-xs md:text-sm font-medium bg-black/30 px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-cyan-500/30">
            <ArrowLeft className="w-3 h-3 md:w-4 md:h-4 mr-1" /> Trang chủ
          </Link>
          <h1 className="text-lg md:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400 leading-tight">
            PTN Vũ Trụ Của Bé
          </h1>
        </div>

        <div className="p-2 md:p-3 flex flex-col gap-2 md:gap-3">
          {/* View Mode Toggle */}
          <div 
            onClick={() => setViewMode(prev => prev === 'space' ? 'surface' : 'space')}
            className="relative overflow-hidden rounded-xl md:rounded-2xl cursor-pointer transition-all duration-300 border border-purple-500/50 bg-black/40 hover:bg-black/60 shadow-lg p-2 md:p-3 flex items-center gap-3"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-30"></div>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-purple-900/50 text-white shrink-0">
              {viewMode === 'space' ? "🌌" : "🌍"}
            </div>
            <div className="flex-1">
              <h2 className="text-xs md:text-sm font-bold text-white">Góc nhìn</h2>
              <p className="text-[10px] text-purple-200">
                {viewMode === 'space' ? "Từ Không gian" : "Từ Mặt đất (GPS)"}
              </p>
            </div>
          </div>

          <div className="h-px w-full bg-white/10 my-1"></div>

          {modules.map((mod) => {
            const isActive = simState[mod.id];
            const isHintOpen = activeHint === mod.id;
            
            return (
              <div
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`relative overflow-hidden rounded-xl md:rounded-2xl cursor-pointer transition-all duration-300 border border-white/10 ${
                  isActive ? "bg-black/50 shadow-lg" : "bg-black/20 hover:bg-black/30"
                }`}
              >
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} opacity-20 transition-opacity`}></div>
                )}
                <div className="relative p-2 md:p-3 flex flex-col">
                  <div className="flex gap-2 items-center">
                    <div className="shrink-0">
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors shadow-inner ${
                        isActive ? "bg-slate-900" : "bg-slate-900/50"
                      }`}>
                        <div className="scale-75 md:scale-100">{mod.icon}</div>
                      </div>
                    </div>
                    <div className="flex-1 pr-6">
                      <h2 className={`text-xs md:text-sm font-bold transition-colors ${
                        isActive ? "text-white" : "text-slate-300"
                      } flex items-center gap-1`}>
                        {mod.title}
                        <button 
                          onClick={(e) => toggleHint(e, mod.id)}
                          className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white hover:bg-white/20"
                        >
                          i
                        </button>
                      </h2>
                    </div>
                    <div className="absolute top-1/2 -translate-y-1/2 right-2 md:right-3">
                      <div className={`w-4 h-4 md:w-5 md:h-5 rounded-[4px] flex items-center justify-center transition-colors border ${
                        isActive ? "bg-cyan-500 border-cyan-400" : "border-slate-500 bg-slate-800/50"
                      }`}>
                        {isActive && (
                          <svg className="w-3 h-3 text-black font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isHintOpen && (
                    <div className="mt-2 p-2 bg-black/40 rounded-lg border border-white/5" onClick={(e) => e.stopPropagation()}>
                      <p className="text-[10px] md:text-xs leading-relaxed text-cyan-100">
                        💡 {mod.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instruction overlay */}
      <div className="absolute top-4 right-4 pointer-events-none bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white/90 text-[10px] md:text-sm flex items-center gap-2 shadow-xl whitespace-nowrap">
        <span className="animate-bounce">👆</span> 
        {viewMode === 'space' ? "Vuốt để xoay góc nhìn, cuộn/zoom để phóng to" : "Di chuột/ngón tay để nhìn quanh bầu trời"}
      </div>

      {/* Bottom Timeline Scrubber */}
      <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 w-[90%] md:w-[600px] z-20 bg-slate-900/60 backdrop-blur-md border border-white/20 p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col gap-2 transition-all">
        {showTimeConfig && (
          <div className="absolute bottom-[110%] left-0 w-64 bg-slate-900/90 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-2xl flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate-300 mb-1.5 block font-semibold">Phạm vi thời gian (Timeline)</label>
              <select 
                value={timeSpan} 
                onChange={(e) => {
                  const newSpan = parseFloat(e.target.value);
                  setTimeSpan(newSpan);
                  if (dayOfYear > newSpan) setDayOfYear(newSpan);
                }}
                className="w-full bg-black/50 text-cyan-300 text-sm rounded-lg border border-cyan-500/30 px-3 py-2 outline-none focus:border-cyan-400"
              >
                <option value={1}>1 Ngày (Chi tiết ngày đêm)</option>
                <option value={7}>1 Tuần</option>
                <option value={30}>1 Tháng (Xem thủy triều)</option>
                <option value={365.25}>1 Năm (Xem các mùa)</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs text-slate-300 mb-1.5 flex justify-between font-semibold">
                <span>Tốc độ tự động</span>
                <span className="text-purple-400">{playSpeed}x</span>
              </label>
              <input 
                type="range" 
                min="0.1" max="5" step="0.1" 
                value={playSpeed}
                onChange={(e) => setPlaySpeed(parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black flex items-center justify-center transition-colors shadow-lg shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" /> : <Play className="w-4 h-4 md:w-5 md:h-5 fill-current translate-x-[1px]" />}
            </button>
            <button 
              onClick={() => setShowTimeConfig(!showTimeConfig)}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors shadow-lg shrink-0 ${showTimeConfig ? "bg-purple-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              <Settings2 className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          
          <div className="text-center font-mono text-cyan-300 font-bold text-sm md:text-base bg-black/40 px-4 py-1.5 rounded-full border border-cyan-500/30">
            {formatDate(dayOfYear)}
          </div>
          
          <div className="w-[72px] md:w-[88px] opacity-0 shrink-0">{/* spacer */}</div>
        </div>
        
        <div className="px-2 pb-1">
          <input 
            type="range" 
            min="0" max={timeSpan} step={1/24} 
            value={dayOfYear}
            onChange={(e) => {
              setIsPlaying(false);
              setDayOfYear(parseFloat(e.target.value));
            }}
            className="w-full accent-cyan-400 h-2 bg-slate-700/80 rounded-lg appearance-none cursor-pointer border border-white/5 shadow-inner"
          />
        </div>
      </div>
    </div>
  );

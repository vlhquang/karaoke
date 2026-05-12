"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Sun, CalendarDays, Snowflake, Droplets } from "lucide-react";
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

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      
      {/* 3D Simulation Canvas - Full Screen */}
      <div className="absolute inset-0 z-0">
        <SpaceSimulation simState={simState} />
      </div>

      {/* Floating Control Panel */}
      <div className="absolute top-4 left-4 z-10 w-72 max-h-[calc(100vh-2rem)] flex flex-col bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl overflow-y-auto">
        <div className="p-4 pb-3 sticky top-0 bg-slate-900/60 backdrop-blur-lg z-20 border-b border-white/5">
          <Link href="/" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors mb-2 text-sm font-medium bg-black/30 px-3 py-1 rounded-full border border-cyan-500/30">
            <ArrowLeft className="w-4 h-4 mr-1" /> Về trang chủ
          </Link>
          <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400 leading-tight">
            Phòng Thí Nghiệm Vũ Trụ
          </h1>
        </div>

        <div className="p-3 flex flex-col gap-3">
          {modules.map((mod) => {
            const isActive = simState[mod.id];
            return (
              <div
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-[1.02] border border-white/10 ${
                  isActive ? "bg-black/40 shadow-lg" : "bg-black/20 hover:bg-black/30"
                }`}
              >
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} opacity-30 transition-opacity`}></div>
                )}
                <div className="relative p-3 flex gap-3 items-center">
                  <div className="shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-inner ${
                      isActive ? "bg-slate-900" : "bg-slate-900/50"
                    }`}>
                      {mod.icon}
                    </div>
                  </div>
                  <div className="flex-1 pr-6">
                    <h2 className={`text-sm font-bold mb-0.5 transition-colors ${
                      isActive ? "text-white" : "text-slate-300"
                    }`}>
                      {mod.title}
                    </h2>
                    {isActive && (
                      <p className="text-[10px] leading-tight text-slate-300 mt-1">
                        {mod.description}
                      </p>
                    )}
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 right-3">
                    <div className={`w-5 h-5 rounded-[4px] flex items-center justify-center transition-colors border ${
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Instruction overlay */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-none bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 text-white/90 text-sm flex items-center gap-2 shadow-xl">
        <span className="animate-bounce">👆</span> Vuốt/kéo để xoay góc nhìn, cuộn để phóng to
      </div>
    </div>
  );
}

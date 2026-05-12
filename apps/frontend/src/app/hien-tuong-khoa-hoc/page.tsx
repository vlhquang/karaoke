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
    <div className="flex flex-col md:flex-row w-full h-screen bg-slate-950 overflow-hidden font-sans">
      {/* Left Sidebar (Control Panel) */}
      <div className="w-full md:w-[450px] flex flex-col bg-slate-900 border-r border-slate-800 z-10 shadow-2xl h-1/2 md:h-full overflow-y-auto">
        <div className="p-6 pb-2 sticky top-0 bg-slate-900/90 backdrop-blur z-20 border-b border-slate-800">
          <Link href="/" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Về trang chủ
          </Link>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
            Phòng Thí Nghiệm<br/>Vũ Trụ Của Bé
          </h1>
          <p className="text-slate-400 text-sm">Cùng khám phá các hiện tượng kỳ diệu của Trái đất và Mặt trời nhé!</p>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {modules.map((mod) => {
            const isActive = simState[mod.id];
            return (
              <div
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-[1.02] border-2 ${
                  isActive ? mod.borderColor + " shadow-lg" : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {isActive && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} opacity-100 transition-opacity`}></div>
                )}
                {!isActive && (
                  <div className="absolute inset-0 bg-slate-800/50"></div>
                )}
                <div className="relative p-5 flex gap-4">
                  <div className="mt-1 shrink-0">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                      isActive ? "bg-slate-900" : "bg-slate-900/80"
                    }`}>
                      {mod.icon}
                    </div>
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold mb-2 transition-colors ${
                      isActive ? "text-white" : "text-slate-300"
                    }`}>
                      {mod.title}
                    </h2>
                    <p className={`text-sm leading-relaxed transition-colors ${
                      isActive ? "text-slate-100" : "text-slate-400"
                    }`}>
                      {mod.description}
                    </p>
                  </div>
                  <div className="absolute top-5 right-5">
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isActive ? "bg-green-500 border-green-500" : "border-slate-600 bg-slate-800"
                    }`}>
                      {isActive && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
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

      {/* Right Side (3D Simulation Canvas) */}
      <div className="flex-1 relative h-1/2 md:h-full bg-black">
        <SpaceSimulation simState={simState} />
        {/* Instruction overlay */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-none bg-black/50 backdrop-blur px-4 py-2 rounded-full border border-white/10 text-white/70 text-sm flex items-center gap-2">
          <span className="animate-pulse">👆</span> Vuốt hoặc kéo để xoay góc nhìn, cuộn để phóng to
        </div>
      </div>
    </div>
  );
}

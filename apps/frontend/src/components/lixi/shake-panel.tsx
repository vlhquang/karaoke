import { useState, useEffect, useCallback, useRef } from "react";
import type { LiXiActionProps } from "./types";

type GamePhase = "preview" | "playing" | "result";

export function ShakePanel({ disabled, onEmit, gameState, playerId, onClose }: LiXiActionProps) {
  const [phase, setPhase] = useState<GamePhase>("preview");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(5.0);
  const [intensity, setIntensity] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const scoreRef = useRef<number>(0);
  const lastAcc = useRef({ x: 0, y: 0, z: 0 });
  const timerRef = useRef<any>(null);

  // iOS Permission Request
  const requestPermission = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        setHasPermission(permission === 'granted');
        if (permission === 'granted') startGame();
      } catch (err) {
        console.error("DeviceMotion permission error:", err);
        setHasPermission(false);
      }
    } else {
      setHasPermission(true);
      startGame();
    }
  };

  const startGame = () => {
    setPhase("playing");
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(5.0);
  };

  // Timer Logic
  useEffect(() => {
    if (phase === "playing" && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev: number) => {
          const next = Math.max(0, prev - 0.1);
          if (next === 0) {
            setPhase("result");
            onEmit("shake:submit", { shakeScore: Math.floor(scoreRef.current) });
          }
          return next;
        });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, timeLeft, onEmit]);

  // Shake Detection Logic
  useEffect(() => {
    if (phase !== "playing") return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const deltaX = Math.abs(acc.x! - lastAcc.current.x);
      const deltaY = Math.abs(acc.y! - lastAcc.current.y);
      const deltaZ = Math.abs(acc.z! - lastAcc.current.z);

      const combined = deltaX + deltaY + deltaZ;

      // Threshold to filter out minor movements
      if (combined > 8) {
        const addedValue = Math.pow(combined, 1.2) * 2;
        scoreRef.current += addedValue;
        setScore(Math.floor(scoreRef.current));
        setIntensity(Math.min(100, combined * 2));
      } else {
        setIntensity((prev: number) => Math.max(0, prev - 5));
      }

      lastAcc.current = { x: acc.x!, y: acc.y!, z: acc.z! };
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [phase]);

  // Simulation for desktop testing
  const simulateShake = () => {
    if (phase !== "playing") return;
    const fakeIntensity = 15 + Math.random() * 20;
    const addedValue = Math.pow(fakeIntensity, 1.2) * 5;
    scoreRef.current += addedValue;
    setScore(Math.floor(scoreRef.current));
    setIntensity(100);
    setTimeout(() => setIntensity(0), 100);
  };

  // Ranking data from gameState
  const ranking = (gameState as any)?.ranking || [];
  const myRank = ranking.findIndex((r: any) => r[0] === playerId) + 1;

  return (
    <div className="relative flex h-[min(85vh,750px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/60 border border-slate-800 shadow-2xl backdrop-blur-xl transition-all duration-500">
      {/* Background Glow Effect */}
      <div
        className="absolute inset-0 opacity-20 transition-all duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${phase === 'playing' ? 'rgba(236, 72, 153, 0.4)' : 'rgba(99, 102, 241, 0.2)'} 0%, transparent 70%)`,
          transform: `scale(${1 + intensity / 200})`
        }}
      />

      {/* HUD Layer */}
      <div className="absolute top-6 left-6 right-6 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-400">Shake It Challenge</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white italic">LẮC TAY</span>
            {phase === "playing" && (
              <span className="px-2 py-0.5 rounded-md bg-fuchsia-500 text-[10px] font-bold text-white animate-pulse">LIVE</span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Điểm số</span>
          <p className="font-mono text-3xl font-black text-white leading-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            {score.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative h-full w-full flex flex-col pt-24 px-8">
        {phase === "preview" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-fuchsia-500 blur-3xl opacity-20 animate-pulse" />
              <div className="relative p-10 rounded-full bg-slate-900 border-4 border-slate-800 shadow-2xl">
                <span className="text-8xl animate-bounce inline-block">📱</span>
              </div>
            </div>

            <h2 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tight">Chuẩn bị lắc nào!</h2>
            <p className="text-slate-400 text-sm mb-10 max-w-xs leading-relaxed">
              Dùng hết sức bình sinh lắc điện thoại để đạt điểm cao nhất trong 5 giây!
            </p>

            <button
              onClick={requestPermission}
              disabled={disabled}
              className="group relative w-full max-w-xs overflow-hidden rounded-2xl bg-white p-5 text-slate-950 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 to-violet-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              <span className="relative font-black tracking-widest uppercase">SẴN SÀNG</span>
            </button>

            {hasPermission === false && (
              <p className="mt-4 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                Cần quyền truy cập cảm biến để chơi!
              </p>
            )}
          </div>
        )}

        {phase === "playing" && (
          <div className="flex flex-1 flex-col items-center justify-center animate-in fade-in duration-300">
            {/* Timer Circle */}
            <div className="relative h-48 w-48 mb-12">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="92"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 92}
                  strokeDashoffset={2 * Math.PI * 92 * (1 - timeLeft / 5)}
                  className="text-fuchsia-500 transition-all duration-100"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-black text-white italic drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                  {timeLeft.toFixed(1)}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Thời gian</span>
              </div>
            </div>

            {/* Intensity Display */}
            <div className="w-full max-w-sm space-y-6">
              <div className="relative h-4 w-full bg-slate-900 rounded-full border border-slate-800 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-fuchsia-500 to-rose-500 transition-all duration-100"
                  style={{ width: `${intensity}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 text-center">
                  <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Cường độ</span>
                  <span className="text-xl font-black text-fuchsia-400 font-mono">{Math.floor(intensity)}%</span>
                </div>
                {/* Simulation Button for testing */}
                <button
                  onMouseDown={simulateShake}
                  className="rounded-2xl bg-slate-800 border border-slate-700 p-4 text-center active:bg-slate-700 transition-colors"
                >
                  <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Click để thử</span>
                  <span className="text-xl">🔥</span>
                </button>
              </div>

              <p className="text-[10px] font-bold text-slate-500 text-center animate-pulse uppercase tracking-[0.2em]">
                LẮC MẠNH LÊN! LẮC MẠNH LÊN!
              </p>
            </div>
          </div>
        )}

        {phase === "result" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
            <div className="mb-8">
              <div className="inline-block p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <span className="text-5xl">🏆</span>
              </div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">XONG RỒI!</h2>
              <p className="text-slate-400 text-sm">Điểm của bạn đã được gửi</p>
            </div>

            <div className="w-full max-w-xs space-y-3 mb-10">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-white/5 shadow-xl">
                <span className="text-xs font-bold text-slate-500 uppercase">Hạng của bạn</span>
                <span className="text-2xl font-black text-cyan-300">#{myRank || "?"}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-white/5 shadow-xl">
                <span className="text-xs font-bold text-slate-500 uppercase">Điểm đạt được</span>
                <span className="text-2xl font-black text-fuchsia-400">{score.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-800/40 p-4 text-xs font-black text-slate-300 hover:bg-slate-800 transition-all active:scale-95"
            >
              QUAY LẠI PHÒNG ĐANG CHỜ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

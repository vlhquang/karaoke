import { useEffect, useMemo, useState } from "react";
import type { LiXiActionProps } from "./types";

interface RpsPanelProps extends LiXiActionProps {
  gameState?: unknown;
  playerId?: string;
  room?: any;
}

interface RpsRound {
  submissions: Record<string, "rock" | "paper" | "scissors">;
  winnerId: string | null;
  revealed: boolean;
}

interface RpsState {
  mode: "BO1" | "BO3" | "BO5" | "BO7" | "BO11";
  rounds: RpsRound[];
  currentRoundIndex: number;
  scores: Record<string, number>;
  deadlineAt: number;
  winnerId: string | null;
  done: boolean;
  requiredWins: number;
}

const parseRpsState = (payload: unknown): RpsState | null => {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { gameState?: unknown; result?: unknown };
  const candidate = root?.gameState ?? root?.result ?? payload;
  if (!candidate || typeof candidate !== "object") return null;

  const s = candidate as Partial<RpsState>;
  if (!s.rounds || !Array.isArray(s.rounds) || !s.scores || typeof s.currentRoundIndex !== "number") {
    return null;
  }

  return candidate as RpsState;
};

const options = [
  { value: "rock", label: "Búa", icon: "✊", color: "from-rose-500 to-rose-600" },
  { value: "paper", label: "Bao", icon: "✋", color: "from-blue-500 to-blue-600" },
  { value: "scissors", label: "Kéo", icon: "✌️", color: "from-amber-500 to-amber-600" }
] as const;

export function RpsPanel({ disabled, onEmit, gameState, playerId, room, onClose }: RpsPanelProps) {
  const rps = useMemo(() => parseRpsState(gameState), [gameState]);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!rps || rps.done) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [rps]);

  // Reset local selection when round changes
  useEffect(() => {
    setSelected(null);
  }, [rps?.currentRoundIndex]);

  if (!rps) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-slate-700 rounded-3xl bg-slate-900/40 w-full">
        <div className="text-4xl mb-4">✊✌️✋</div>
        <p className="text-slate-300 font-bold">Chờ Host nhấn BẮT ĐẦU</p>
        <p className="text-xs text-slate-500 mt-2">Trò chơi Oẳn Tù Tì sẽ bắt đầu sau countdown</p>
      </div>
    );
  }

  const currentRound = rps.rounds[rps.currentRoundIndex];
  if (!currentRound) {
    return <p className="text-sm text-slate-400">Vòng chơi không hợp lệ.</p>;
  }

  const timeLeft = Math.max(0, Math.ceil((rps.deadlineAt - now) / 1000));
  const hasSubmitted = (playerId && currentRound.submissions) ? !!currentRound.submissions[playerId] : false;

  const handleChoice = (choice: "rock" | "paper" | "scissors") => {
    if (disabled || hasSubmitted || timeLeft <= 0 || currentRound.revealed) return;
    setSelected(choice);
    onEmit("rps:submit", { choice });
  };

  const players = Object.keys(rps.scores || {});
  const opponentId = players.find(id => id !== playerId) || "Enemy";
  const myScore = (playerId && rps.scores) ? rps.scores[playerId] || 0 : 0;
  const opponentScore = rps.scores && opponentId ? rps.scores[opponentId] || 0 : 0;

  return (
    <div className="relative flex h-[min(85vh,750px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl">
      {/* HUD Layer */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Oẳn Tù Tì</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">Hiệp {rps.currentRoundIndex + 1}</span>
            <span className="text-xs font-semibold text-slate-500">/ {rps.mode}</span>
          </div>
        </div>


        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Điểm số</span>
          <p className="font-mono text-sm font-bold text-white">
            {myScore} - {opponentScore}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative h-full w-full flex flex-col pt-16 px-6">
        <div className="flex flex-1 flex-col items-center justify-center">
          {!currentRound.revealed ? (
            <>
              {/* Countdown */}
              <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
                <div className={`absolute inset-0 animate-ping rounded-full bg-rose-500/20 ${timeLeft === 1 ? 'opacity-100' : 'opacity-0'}`} />
                <span className={`text-6xl font-black ${timeLeft <= 1 ? 'text-rose-500' : 'text-white'}`}>
                  {timeLeft}
                </span>
              </div>

              {/* Choices */}
              <div className="grid w-full max-w-sm grid-cols-3 gap-3">
                {options.map((option) => {
                  const isSelected = selected === option.value || (playerId && currentRound.submissions?.[playerId] === option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleChoice(option.value)}
                      disabled={disabled || hasSubmitted || timeLeft <= 0}
                      className={`group relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition-all duration-300
                        ${isSelected
                          ? `scale-105 border-white bg-gradient-to-br ${option.color} shadow-[0_0_20px_rgba(255,255,255,0.2)]`
                          : "border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800"
                        }
                        disabled:cursor-not-allowed disabled:opacity-50
                      `}
                    >
                      <span className="text-4xl md:text-5xl">{option.icon}</span>
                      <span className={`mt-1 text-[10px] font-bold uppercase tracking-tighter ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {hasSubmitted ? "Đang chờ đối thủ..." : "Chọn tay đi bạn ơi!"}
              </p>
            </>
          ) : (
            /* Reveal Phase */
            <div className="flex w-full flex-col items-center">
              <div className="mb-8 flex items-center justify-around w-full max-w-sm">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase">BẠN</span>
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-900 border border-blue-500/30">
                    <span className="text-5xl">{options.find(o => o.value === currentRound.submissions?.[playerId || ""])?.icon || "❓"}</span>
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-700 italic">VS</div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-rose-400 uppercase">ĐỐI THỦ</span>
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-900 border border-rose-500/30">
                    <span className="text-5xl">{options.find(o => o.value === currentRound.submissions?.[opponentId])?.icon || "❓"}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                <p className="text-2xl font-black text-white italic">
                  {currentRound.winnerId === playerId ? "THẮNG RỒI! 🎉" : currentRound.winnerId ? "THUA RỒI... 😢" : "HÒA NHA! 🤝"}
                </p>
                {!rps.done && (
                  <p className="text-[10px] uppercase font-bold text-slate-500 animate-pulse">Vòng sau sắp bắt đầu...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

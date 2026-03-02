import { useEffect, useMemo, useState } from "react";
import type { LiXiActionProps } from "./types";

interface RpsPanelProps extends LiXiActionProps {
  gameState?: unknown;
  playerId?: string;
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

export function RpsPanel({ disabled, onEmit, gameState, playerId }: RpsPanelProps) {
  const rps = useMemo(() => parseRpsState(gameState), [gameState]);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    if (rps) setOverlayOpen(true);
  }, [rps]);

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
    return <p className="text-sm text-slate-400">Đang chờ host bắt đầu game Oẳn Tù Tì.</p>;
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
    <>
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        Game Oẳn Tù Tì Tốc Độ. Chế độ: <b>{rps.mode}</b>. Hãy chọn trước khi hết giờ!
      </div>

      {overlayOpen && (
        <div className="fixed inset-0 z-[130] flex flex-col overflow-hidden bg-slate-950 p-4 md:p-8">
          {/* Header */}
          <div className="mb-6 flex shrink-0 items-center justify-between">
            <div>
              <p className="text-2xl font-black tracking-tighter text-white md:text-4xl">Oẳn Tù Tì Online</p>
              <div className="flex gap-2">
                <span className="rounded bg-rose-600/20 px-2 py-0.5 text-xs font-bold text-rose-400 uppercase tracking-widest">{rps.mode}</span>
                <span className="text-xs text-slate-400 italic">Vòng {rps.currentRoundIndex + 1}</span>
              </div>
            </div>
            <button
              onClick={() => setOverlayOpen(false)}
              className="rounded-full bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scoreboard */}
          <div className="mb-8 flex justify-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-500 uppercase">BẠN</span>
              <span className="text-4xl font-black text-blue-400">{myScore}</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-slate-700">VS</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-slate-500 uppercase">ĐỐI THỦ</span>
              <span className="text-4xl font-black text-rose-400">{opponentScore}</span>
            </div>
          </div>

          {/* Main Area */}
          <div className="flex flex-1 flex-col items-center justify-center">
            {!currentRound.revealed ? (
              <>
                {/* Countdown */}
                <div className="relative mb-12 flex h-32 w-32 items-center justify-center">
                  <div className={`absolute inset-0 animate-ping rounded-full bg-rose-500/20 ${timeLeft === 1 ? 'opacity-100' : 'opacity-0'}`} />
                  <span className={`text-7xl font-black ${timeLeft <= 1 ? 'text-rose-500' : 'text-white'}`}>
                    {timeLeft}
                  </span>
                </div>

                {/* Choices */}
                <div className="grid w-full max-w-lg grid-cols-3 gap-4">
                  {options.map((option) => {
                    const isSelected = selected === option.value || (playerId && currentRound.submissions?.[playerId] === option.value);
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleChoice(option.value)}
                        disabled={disabled || hasSubmitted || timeLeft <= 0}
                        className={`group relative flex aspect-square flex-col items-center justify-center rounded-3xl border-4 transition-all duration-300
                          ${isSelected
                            ? `scale-105 border-white bg-gradient-to-br ${option.color} shadow-[0_0_30px_rgba(255,255,255,0.3)]`
                            : "border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800"
                          }
                          disabled:cursor-not-allowed disabled:opacity-50
                        `}
                      >
                        <span className="text-6xl md:text-8xl">{option.icon}</span>
                        <span className={`mt-2 text-sm font-bold uppercase tracking-widest ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                          {option.label}
                        </span>
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 rounded-full bg-white p-1 text-slate-950">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-8 text-slate-400">
                  {hasSubmitted ? "Đã gửi lựa chọn. Chờ đối thủ..." : "Chọn tay đi bạn ơi!"}
                </p>
              </>
            ) : (
              /* Reveal Phase */
              <div className="flex w-full max-w-2xl flex-col items-center">
                <div className="mb-12 flex items-center justify-between w-full">
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-sm font-bold text-blue-400">BẠN</span>
                    <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-slate-900 border-2 border-blue-500/50">
                      <span className="text-8xl">{options.find(o => o.value === currentRound.submissions?.[playerId || ""])?.icon || "❓"}</span>
                    </div>
                  </div>
                  <div className="text-4xl font-black text-slate-700 italic">VS</div>
                  <div className="flex flex-col items-center gap-4">
                    <span className="text-sm font-bold text-rose-400">ĐỐI THỦ</span>
                    <div className="flex h-40 w-40 items-center justify-center rounded-3xl bg-slate-900 border-2 border-rose-500/50">
                      <span className="text-8xl">{options.find(o => o.value === currentRound.submissions?.[opponentId])?.icon || "❓"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <p className="text-4xl font-black text-white italic">
                    {currentRound.winnerId === playerId ? "THẮNG RỒI! 🎉" : currentRound.winnerId ? "THUA MẤT RỒI... 😢" : "HÒA NHA! 🤝"}
                  </p>
                  {!rps.done && (
                    <p className="text-slate-400 animate-pulse">Chuẩn bị vòng tiếp theo...</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Victory Overlay */}
          {rps.done && (
            <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 text-9xl">
                  {rps.winnerId === playerId ? "🏆" : "💀"}
                </div>
                <h2 className="mb-2 text-5xl font-black text-white">
                  {rps.winnerId === playerId ? "VICTORY" : "DEFEAT"}
                </h2>
                <p className="mb-8 text-xl text-slate-400">
                  {rps.winnerId === playerId ? "Bạn là nhà vô địch Oẳn Tù Tì!" : "Thua keo này ta bày keo khác!"}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => onEmit("host:restartGame", { roomId: (gameState as any)?.roomId })}
                    className="rounded-2xl bg-emerald-500 px-8 py-4 text-xl font-black text-slate-950 hover:bg-emerald-400"
                  >
                    CHƠI LẠI
                  </button>
                  <button
                    onClick={() => setOverlayOpen(false)}
                    className="rounded-2xl bg-white/10 px-8 py-4 text-sm font-bold text-white hover:bg-white/20"
                  >
                    QUAY LẠI PHÒNG CHỜ
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { LiXiActionProps } from "./types";

interface MathKingPanelProps extends LiXiActionProps {
  gameState?: unknown;
  playerId?: string;
  room?: any;
}

type MathPhase = "prep" | "answer" | "reveal" | "finished";

interface MathQuestion {
  prompt: string;
  options: number[];
  level: number;
  correctIndex?: number;
}

interface MathAnswer {
  selectedIndex: number;
  answeredAt: number;
  correct: boolean;
}

interface MathKingState {
  grade: "1" | "2" | "3" | "4" | "5";
  targetScore: 5 | 10 | 15 | 20;
  phase: MathPhase;
  phaseEndsAt: number;
  questionIndex: number;
  currentQuestion: MathQuestion;
  answers: Record<string, MathAnswer>;
  firstCorrectPlayerId: string | null;
  scores: Record<string, number>;
  winnerId: string | null;
  done: boolean;
}

const parseMathState = (payload: unknown): MathKingState | null => {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { gameState?: unknown; result?: unknown };
  const candidate = root?.gameState ?? root?.result ?? payload;
  if (!candidate || typeof candidate !== "object") return null;

  const source = candidate as Partial<MathKingState>;
  if (!source.currentQuestion || typeof source.currentQuestion !== "object") return null;
  if (!Array.isArray(source.currentQuestion.options)) return null;
  if (typeof source.phase !== "string") return null;
  if (typeof source.phaseEndsAt !== "number") return null;
  if (typeof source.questionIndex !== "number") return null;
  if (typeof source.targetScore !== "number") return null;

  return candidate as MathKingState;
};

export function MathKingPanel({ disabled, onEmit, gameState, playerId, room }: MathKingPanelProps) {
  const math = useMemo(() => parseMathState(gameState), [gameState]);
  const [now, setNow] = useState(Date.now());
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!math || math.phase === "finished") return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [math]);

  useEffect(() => {
    setPickedIndex(null);
  }, [math?.questionIndex]);

  if (!math) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-slate-700 rounded-3xl bg-slate-900/40 w-full">
        <div className="text-4xl mb-4">🧠</div>
        <p className="text-slate-300 font-bold">Chờ chủ phòng bắt đầu game Vua toán học</p>
      </div>
    );
  }

  const timeLeft = Math.max(0, Math.ceil((math.phaseEndsAt - now) / 1000));
  const myAnswered = Boolean(playerId && math.answers[playerId]);
  const myAnswer = playerId ? math.answers[playerId] : undefined;

  const submitAnswer = (idx: number): void => {
    if (disabled || math.phase !== "answer" || myAnswered) return;
    setPickedIndex(idx);
    onEmit("math:answer", { selectedIndex: idx });
  };

  const sortedScores = Object.entries(math.scores)
    .map(([id, score]) => {
      const p = room?.players?.find((item: any) => item.playerId === id);
      return {
        id,
        name: p?.name ?? "Người chơi",
        score,
        isMe: id === playerId
      };
    })
    .sort((a, b) => b.score - a.score);

  const winnerName = math.winnerId
    ? room?.players?.find((item: any) => item.playerId === math.winnerId)?.name ?? "Người chơi"
    : null;

  return (
    <div className="relative flex h-[min(85vh,850px)] w-full flex-col overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Vua toán học • Lớp {math.grade}</p>
          <p className="text-lg font-black text-white">Câu {math.questionIndex}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Điểm thắng</p>
          <p className="text-lg font-black text-emerald-400">{math.targetScore}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {math.phase === "prep" && "Chuẩn bị"}
            {math.phase === "answer" && "Trả lời"}
            {math.phase === "reveal" && "Đáp án"}
            {math.phase === "finished" && "Kết thúc"}
          </p>
          <p className="mt-1 text-2xl font-black text-amber-300">{timeLeft}s</p>
          <p className="mt-3 text-2xl md:text-3xl font-black text-white">{math.currentQuestion.prompt}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {math.currentQuestion.options.map((value, index) => {
            const selectedByMe = myAnswer?.selectedIndex === index || pickedIndex === index;
            const revealCorrect = math.phase !== "answer" && math.currentQuestion.correctIndex === index;
            const revealWrong = math.phase !== "answer" && selectedByMe && !myAnswer?.correct;
            return (
              <button
                key={`${math.questionIndex}-${index}`}
                onClick={() => submitAnswer(index)}
                disabled={disabled || math.phase !== "answer" || myAnswered}
                className={`rounded-2xl border px-3 py-5 text-2xl font-black transition-all ${
                  revealCorrect
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                    : revealWrong
                      ? "border-rose-400 bg-rose-500/20 text-rose-300"
                      : selectedByMe
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                        : "border-slate-700 bg-slate-900/60 text-white hover:border-slate-500"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {value}
              </button>
            );
          })}
        </div>

        {myAnswer && (
          <div className={`mt-4 rounded-xl border px-3 py-2 text-sm font-semibold ${myAnswer.correct ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
            {myAnswer.correct ? "Bạn trả lời đúng." : "Bạn trả lời chưa đúng."}
          </div>
        )}

        {math.phase === "finished" && winnerName && (
          <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Chiến thắng</p>
            <p className="text-xl font-black text-white">{winnerName}</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Bảng điểm</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sortedScores.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 ${entry.isMe ? "border-cyan-500/40 bg-cyan-500/10" : "border-slate-700 bg-slate-900/70"}`}
            >
              <span className="text-sm font-semibold text-white truncate">{entry.name}</span>
              <span className="text-base font-black text-emerald-300">{entry.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

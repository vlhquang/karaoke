import { useEffect, useMemo, useRef, useState } from "react";
import type { LiXiActionProps } from "./types";

type Side = "left" | "right";
type Phase = "idle" | "ready" | "go" | "finished";

interface ReactionPanelProps extends LiXiActionProps {
  gameState?: unknown;
  playerId?: string;
}

interface RoundResult {
  winner: Side | "draw";
  reason: "reaction" | "early";
  leftDeltaMs: number | null;
  rightDeltaMs: number | null;
}

const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 10000;
const DRAW_THRESHOLD_MS = 40;

export function ReactionPanel({ disabled }: ReactionPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [message, setMessage] = useState("Nhấn Bắt đầu lượt mới để chơi");
  const [result, setResult] = useState<RoundResult | null>(null);
  const [leftTappedAt, setLeftTappedAt] = useState<number | null>(null);
  const [rightTappedAt, setRightTappedAt] = useState<number | null>(null);

  const goTimeRef = useRef<number>(0);
  const startTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
      }
    };
  }, []);

  const resetRoundState = (): void => {
    setLeftTappedAt(null);
    setRightTappedAt(null);
    setResult(null);
  };

  const startRound = (): void => {
    if (disabled) return;
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }

    setOverlayOpen(true);
    resetRoundState();
    setPhase("ready");
    setMessage("Chuẩn bị...");

    const delay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
    startTimerRef.current = window.setTimeout(() => {
      goTimeRef.current = performance.now();
      setPhase("go");
      setMessage("BẤM NGAY!");
    }, delay);
  };

  const closeOverlay = (): void => {
    if (startTimerRef.current !== null) {
      window.clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    setOverlayOpen(false);
    setPhase("idle");
    setMessage("Nhấn Bắt đầu lượt mới để chơi");
  };

  const finishEarlyLose = (earlySide: Side): void => {
    const winner: Side = earlySide === "left" ? "right" : "left";
    setPhase("finished");
    setResult({
      winner,
      reason: "early",
      leftDeltaMs: null,
      rightDeltaMs: null
    });
    setMessage(earlySide === "left" ? "Bên Trái bấm sớm, Bên Phải thắng!" : "Bên Phải bấm sớm, Bên Trái thắng!");
  };

  const evaluateWinner = (leftAt: number, rightAt: number): RoundResult => {
    const goTime = goTimeRef.current;
    const leftDelta = Math.max(0, Math.round(leftAt - goTime));
    const rightDelta = Math.max(0, Math.round(rightAt - goTime));
    const diff = Math.abs(leftDelta - rightDelta);

    if (diff < DRAW_THRESHOLD_MS) {
      return {
        winner: "draw",
        reason: "reaction",
        leftDeltaMs: leftDelta,
        rightDeltaMs: rightDelta
      };
    }

    return {
      winner: leftDelta < rightDelta ? "left" : "right",
      reason: "reaction",
      leftDeltaMs: leftDelta,
      rightDeltaMs: rightDelta
    };
  };

  const registerTap = (side: Side): void => {
    if (disabled) return;
    const now = performance.now();

    if (phase === "ready") {
      finishEarlyLose(side);
      return;
    }

    if (phase !== "go") return;

    if (side === "left" && leftTappedAt === null) {
      setLeftTappedAt(now);
      if (rightTappedAt !== null) {
        const finalResult = evaluateWinner(now, rightTappedAt);
        setResult(finalResult);
        setPhase("finished");
        setMessage(finalResult.winner === "draw" ? "Hòa!" : finalResult.winner === "left" ? "Bên Trái thắng!" : "Bên Phải thắng!");
      }
      return;
    }

    if (side === "right" && rightTappedAt === null) {
      setRightTappedAt(now);
      if (leftTappedAt !== null) {
        const finalResult = evaluateWinner(leftTappedAt, now);
        setResult(finalResult);
        setPhase("finished");
        setMessage(finalResult.winner === "draw" ? "Hòa!" : finalResult.winner === "left" ? "Bên Trái thắng!" : "Bên Phải thắng!");
      }
    }
  };

  useEffect(() => {
    if (phase !== "go") return;
    if (leftTappedAt !== null && rightTappedAt === null) {
      const t = window.setTimeout(() => {
        setPhase("finished");
        setResult({
          winner: "left",
          reason: "reaction",
          leftDeltaMs: Math.max(0, Math.round(leftTappedAt - goTimeRef.current)),
          rightDeltaMs: null
        });
        setMessage("Bên Trái thắng!");
      }, 220);
      return () => window.clearTimeout(t);
    }
    if (rightTappedAt !== null && leftTappedAt === null) {
      const t = window.setTimeout(() => {
        setPhase("finished");
        setResult({
          winner: "right",
          reason: "reaction",
          leftDeltaMs: null,
          rightDeltaMs: Math.max(0, Math.round(rightTappedAt - goTimeRef.current))
        });
        setMessage("Bên Phải thắng!");
      }, 220);
      return () => window.clearTimeout(t);
    }
  }, [leftTappedAt, phase, rightTappedAt]);

  const resultText = useMemo(() => {
    if (!result) return "Chưa có kết quả.";
    if (result.reason === "early") return "Kết quả: bấm sớm bị xử thua ngay.";
    return `Trái ${result.leftDeltaMs ?? "-"}ms • Phải ${result.rightDeltaMs ?? "-"}ms`;
  }, [result]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
        2 người chơi cùng chạm trên màn hình host. Delay ngẫu nhiên 3-10 giây, bấm sớm sẽ thua.
      </div>

      <button
        onClick={startRound}
        disabled={disabled}
        className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Bắt đầu lượt mới
      </button>

      {overlayOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/95 p-3 md:p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-lg font-bold text-amber-200 md:text-2xl">{message}</p>
            {phase !== "finished" && (
              <button onClick={closeOverlay} className="rounded-lg border border-slate-500 px-3 py-1.5 text-sm text-slate-200">
                Đóng
              </button>
            )}
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3">
            <button
              onClick={() => registerTap("left")}
              disabled={disabled || phase === "finished"}
              className="rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-3 py-8 text-center text-2xl font-extrabold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 md:text-4xl"
            >
              BÊN TRÁI
            </button>
            <button
              onClick={() => registerTap("right")}
              disabled={disabled || phase === "finished"}
              className="rounded-2xl border border-fuchsia-300/40 bg-fuchsia-500/15 px-3 py-8 text-center text-2xl font-extrabold text-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50 md:text-4xl"
            >
              BÊN PHẢI
            </button>
          </div>

          {phase === "finished" && (
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <p className="text-center text-lg font-bold text-emerald-300 md:text-2xl">{message}</p>
              <p className="text-center text-sm text-slate-200">{resultText}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={startRound} className="rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold text-slate-900 hover:bg-emerald-400">
                  Chơi lại
                </button>
                <button onClick={closeOverlay} className="rounded-xl border border-slate-500 px-4 py-3 text-base font-semibold text-slate-200 hover:bg-slate-800">
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

export function ReactionPanel({ disabled, room, onClose }: ReactionPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("Đang chuẩn bị lượt chơi...");
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
    setPhase("idle");
    setMessage("Đang chuẩn bị lượt chơi...");
    onClose?.();
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

  useEffect(() => {
    // Auto-start when the room status becomes "playing" and we are idle
    if (room?.status === "playing" && phase === "idle" && !disabled) {
      startRound();
    }
    // If room returns to waiting/finished, ensure we reset overlay
    if (room?.status !== "playing" && phase !== "idle" && phase !== "finished") {
      setPhase("idle");
    }
  }, [room?.status, phase, disabled]);

  const resultText = useMemo(() => {
    if (!result) return "Chưa có kết quả.";
    if (result.reason === "early") return "Kết quả: bấm sớm bị xử thua ngay.";
    return `Trái ${result.leftDeltaMs ?? "-"}ms • Phải ${result.rightDeltaMs ?? "-"}ms`;
  }, [result]);

  return (
    <div className="relative flex h-[min(85vh,750px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl">
      {/* HUD Layer */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Phản Xạ</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">Chạm Đấu</span>
          </div>
        </div>


        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Kết quả</span>
          <p className="font-mono text-[10px] font-bold text-white max-w-[100px] leading-tight text-right">
            {result ? resultText : "---"}
          </p>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative h-full w-full flex flex-col pt-16">
        <div className="mb-4 flex flex-col items-center justify-center shrink-0">
          <p className="text-xl font-black text-amber-200 uppercase italic tracking-tighter md:text-3xl animate-in zoom-in duration-300">{message}</p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-4 p-4">
          <button
            onClick={() => registerTap("left")}
            disabled={disabled || phase === "finished" || phase === "idle"}
            className={`group relative flex flex-col items-center justify-center rounded-3xl border-4 transition-all duration-300
              ${phase === "go" || leftTappedAt !== null
                ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                : "border-slate-800 bg-slate-900/50"
              }
              disabled:cursor-not-allowed
            `}
          >
            <span className="text-4xl font-black text-cyan-200 md:text-5xl">TRÁI</span>
            {leftTappedAt !== null && (
              <span className="absolute bottom-4 font-mono text-sm text-cyan-400">
                {Math.round(leftTappedAt - goTimeRef.current)}ms
              </span>
            )}
          </button>

          <button
            onClick={() => registerTap("right")}
            disabled={disabled || phase === "finished" || phase === "idle"}
            className={`group relative flex flex-col items-center justify-center rounded-3xl border-4 transition-all duration-300
              ${phase === "go" || rightTappedAt !== null
                ? "border-fuchsia-400 bg-fuchsia-500/20 shadow-[0_0_30_px_rgba(232,121,249,0.2)]"
                : "border-slate-800 bg-slate-900/50"
              }
              disabled:cursor-not-allowed
            `}
          >
            <span className="text-4xl font-black text-fuchsia-200 md:text-5xl">PHẢI</span>
            {rightTappedAt !== null && (
              <span className="absolute bottom-4 font-mono text-sm text-fuchsia-400">
                {Math.round(rightTappedAt - goTimeRef.current)}ms
              </span>
            )}
          </button>
        </div>

        {phase === "finished" && (
          <div className="absolute inset-x-0 bottom-4 z-50 flex justify-center px-4">
            <button
              onClick={() => startRound()}
              className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 py-4 text-sm font-black text-slate-950 shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              CHƠI LẠI LƯỢT NÀY
            </button>
          </div>
        )}
      </div>

      {/* Intro / Waiting State */}
      {phase === "idle" && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-8 text-center">
          <div className="mb-6 h-20 w-20 flex items-center justify-center rounded-3xl bg-cyan-500 text-slate-950 shadow-2xl shadow-cyan-500/20">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">PHẢN XẠ SIÊU TỐC</h2>
          <p className="text-sm text-slate-400 max-w-[240px] leading-relaxed">
            Chờ Host nhấn Bắt đầu. Hai người chơi chạm nhanh nhất để chiến thắng!
          </p>
        </div>
      )}
    </div>
  );
}

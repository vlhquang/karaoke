import { useEffect, useMemo, useRef, useState } from "react";
import type { LiXiActionProps } from "./types";

interface MemoryPanelProps extends LiXiActionProps {
  gameState?: unknown;
  playerId?: string;
}

interface MemoryStatePayload {
  board: number[];
  pairCount: number;
  seed: number;
  startTime: number | null;
  phase: "syncing" | "running" | "finished";
  requiredPlayers: number;
  readyCount: number;
  completes: Record<string, { durationMs: number; moves: number }>;
  ranking: Array<[string, { durationMs: number; moves: number }]>;
}

const parseMemoryState = (payload: unknown): MemoryStatePayload | null => {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as { gameState?: unknown; result?: unknown };
  const candidate = root?.gameState ?? root?.result ?? payload;
  if (!candidate || typeof candidate !== "object") return null;

  const source = candidate as Partial<MemoryStatePayload>;

  const board = source.board;
  if (!Array.isArray(board) || !board.every((v) => Number.isInteger(v))) return null;
  if (typeof source.pairCount !== "number" || !Number.isInteger(source.pairCount) || source.pairCount <= 0) return null;
  if (typeof source.seed !== "number" || !Number.isInteger(source.seed)) return null;

  const phase = source.phase;
  if (phase !== "syncing" && phase !== "running" && phase !== "finished") return null;

  const requiredPlayers = typeof source.requiredPlayers === "number" ? source.requiredPlayers : 2;
  const readyCount = typeof source.readyCount === "number" ? source.readyCount : 0;
  const startTime = typeof source.startTime === "number" ? source.startTime : null;
  const completes = source.completes ?? {};
  const ranking = Array.isArray(source.ranking) ? source.ranking : [];

  return {
    board,
    pairCount: source.pairCount,
    seed: source.seed,
    startTime,
    phase,
    requiredPlayers,
    readyCount,
    completes,
    ranking
  };
};

export function MemoryPanel({ disabled, onEmit, gameState, playerId }: MemoryPanelProps) {
  const memory = useMemo(() => parseMemoryState(gameState), [gameState]);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [viewport, setViewport] = useState({ width: 390, height: 844 });
  const readySentKeyRef = useRef<string>("");

  useEffect(() => {
    if (!memory) return;
    setOverlayOpen(true);
    setRevealed([]);
    setMatched([]);
    setMoves(0);
    setSubmitted(false);
  }, [memory?.seed]);

  useEffect(() => {
    if (!memory || !playerId) return;
    const key = `${memory.seed}:${playerId}`;
    if (readySentKeyRef.current === key) return;
    readySentKeyRef.current = key;
    onEmit("memory:ready", {});
  }, [memory, onEmit, playerId]);

  useEffect(() => {
    if (!memory || submitted || memory.phase !== "running" || memory.startTime === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [memory, submitted]);

  useEffect(() => {
    if (!overlayOpen) return;
    const updateViewport = (): void => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (!memory || memory.phase !== "running") return;
    const matchedPairs = matched.length / 2;
    if (matchedPairs >= memory.pairCount && !submitted) {
      setSubmitted(true);
      onEmit("memory:complete", { moves });
    }
  }, [matched.length, memory, moves, onEmit, submitted]);

  const totalCards = memory?.board.length ?? 12;
  const boardLayout = useMemo(() => {
    const safeTotalCards = Math.max(1, totalCards);
    const availableWidth = Math.max(240, viewport.width - (viewport.width < 768 ? 24 : 48));
    const availableHeight = Math.max(240, viewport.height - (viewport.width < 768 ? 220 : 260));
    const minCols = Math.min(safeTotalCards, safeTotalCards <= 12 ? 3 : 4);
    const maxCols = Math.min(safeTotalCards, 8);

    let best = { cols: minCols, rows: Math.ceil(safeTotalCards / minCols), cell: 48, gap: 6 };

    for (let cols = minCols; cols <= maxCols; cols += 1) {
      const rows = Math.ceil(safeTotalCards / cols);
      const candidateSize = Math.min(availableWidth / cols, availableHeight / rows);
      const gap = Math.min(12, Math.max(4, Math.floor(candidateSize * 0.08)));
      const cell = Math.floor(
        Math.min(
          (availableWidth - gap * (cols - 1)) / cols,
          (availableHeight - gap * (rows - 1)) / rows
        )
      );

      if (cell > best.cell) {
        best = { cols, rows, cell, gap };
      }
    }

    const safeCell = Math.max(36, best.cell);
    return {
      cols: best.cols,
      gap: best.gap,
      cell: safeCell,
      gridWidth: safeCell * best.cols + best.gap * (best.cols - 1),
      fontSize: Math.max(16, Math.min(30, Math.floor(safeCell * 0.38)))
    };
  }, [totalCards, viewport.height, viewport.width]);

  if (!memory) {
    return <p className="text-sm text-slate-400">Đang chờ host bắt đầu game Ghi nhớ.</p>;
  }

  const onCardClick = (index: number): void => {
    if (disabled || submitted || memory.phase !== "running") return;
    if (matched.includes(index) || revealed.includes(index)) return;
    if (revealed.length >= 2) return;

    onEmit("memory:flip", { index });
    const next = [...revealed, index];
    setRevealed(next);

    if (next.length === 2) {
      setMoves((prev) => prev + 1);
      const [a, b] = next;
      if (memory.board[a] === memory.board[b]) {
        window.setTimeout(() => {
          setMatched((prev) => [...prev, a, b]);
          setRevealed([]);
        }, 140);
      } else {
        window.setTimeout(() => {
          setRevealed([]);
        }, 420);
      }
    }
  };

  const elapsedMs = memory.startTime ? Math.max(0, now - memory.startTime) : 0;
  const elapsedText = `${(elapsedMs / 1000).toFixed(2)}s`;
  const matchedPairs = matched.length / 2;

  const myResult = playerId ? memory.completes[playerId] : undefined;
  const rankingPreview = memory.ranking.slice(0, 4);
  const hiddenRankingCount = Math.max(0, memory.ranking.length - rankingPreview.length);

  return (
    <>
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        Trò chơi đã mở toàn màn hình. Seed <b>{memory.seed}</b>. Khi đủ người nhận seed, server mới bắt đầu bấm giờ.
      </div>

      {overlayOpen && (
        <div className="fixed inset-0 z-[130] flex flex-col overflow-hidden bg-slate-950 p-3 md:p-6">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-emerald-200 md:text-2xl">Game Trí Nhớ Nhanh</p>
              <p className="text-sm text-slate-300">
                {memory.phase === "syncing"
                  ? `Đang đồng bộ seed (${memory.readyCount}/${memory.requiredPlayers})`
                  : memory.phase === "running"
                    ? `Đang chơi • Thời gian server: ${elapsedText}`
                    : "Đã kết thúc"}
              </p>
            </div>
            <button onClick={() => setOverlayOpen(false)} className="rounded-lg border border-slate-500 px-3 py-1.5 text-sm text-slate-200">
              Đóng
            </button>
          </div>

          <div className="mb-2 shrink-0 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
            Cặp đúng: <b>{matchedPairs}/{memory.pairCount}</b> • Lượt lật: <b>{moves}</b>
            {myResult && (
              <span> • Thời gian hoàn thành của bạn: <b>{(myResult.durationMs / 1000).toFixed(2)}s</b></span>
            )}
          </div>
          <p className="mb-2 shrink-0 text-xs text-slate-300">
            Màu ô: <span className="font-semibold text-cyan-200">Chưa lật</span> •{" "}
            <span className="font-semibold text-amber-200">Đang lật</span> •{" "}
            <span className="font-semibold text-emerald-200">Đã khớp (ẩn số)</span>
          </p>

          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${boardLayout.cols}, ${boardLayout.cell}px)`,
                gap: `${boardLayout.gap}px`,
                width: `${boardLayout.gridWidth}px`
              }}
            >
            {memory.board.map((value, index) => {
              const isMatched = matched.includes(index);
              const isRevealed = revealed.includes(index);
              const show = isMatched || isRevealed;
              return (
                <button
                  key={`${memory.seed}-${index}`}
                  onClick={() => onCardClick(index)}
                  disabled={disabled || submitted || isMatched || memory.phase !== "running"}
                  aria-label={isMatched ? `Ô ${index + 1} đã khớp` : `Ô ${index + 1}`}
                  className={`aspect-square rounded-lg border text-xl font-bold transition md:text-2xl ${isMatched
                    ? "border-emerald-300/60 bg-emerald-500/10 text-transparent"
                    : isRevealed
                      ? "border-amber-300 bg-amber-400/20 text-amber-100 shadow-[0_0_0_1px_rgba(252,211,77,0.3)]"
                      : "border-cyan-300/90 bg-slate-950 text-cyan-100 hover:border-cyan-200 hover:bg-slate-900"} disabled:cursor-not-allowed disabled:opacity-70`}
                  style={{ width: `${boardLayout.cell}px`, height: `${boardLayout.cell}px`, fontSize: `${boardLayout.fontSize}px`, lineHeight: 1 }}
                >
                  {isMatched ? "" : show ? value + 1 : "?"}
                </button>
              );
            })}
            </div>
          </div>

          <div className="mt-2 shrink-0 rounded-xl border border-slate-700 bg-slate-900/70 p-2.5">
            <p className="mb-1 text-sm font-semibold text-slate-200">Xếp hạng tạm thời</p>
            {memory.ranking.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa có người hoàn thành.</p>
            ) : (
              <div className="space-y-0.5 text-xs text-slate-200 md:text-sm">
                {rankingPreview.map(([pid, data], idx) => (
                  <p key={`${pid}-${idx}`}>
                    {idx + 1}. {pid === playerId ? "Bạn" : pid.slice(0, 8)} • {(data.durationMs / 1000).toFixed(2)}s • {data.moves} lượt
                  </p>
                ))}
                {hiddenRankingCount > 0 && <p className="text-slate-400">+{hiddenRankingCount} người chơi khác</p>}
              </div>
            )}
            {submitted && (
              <p className="mt-1 text-xs text-cyan-200 md:text-sm">Bạn đã hoàn thành. Server đang tổng hợp kết quả cho tất cả người chơi.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

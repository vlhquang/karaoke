import { useEffect, useMemo, useRef, useState } from "react";
import type { LiXiActionProps } from "./types";

interface MemoryPanelProps extends LiXiActionProps {
  gameState?: unknown;
  playerId?: string;
  room?: any;
}

interface MemoryStatePayload {
  board: number[];
  pairCount: number;
  seed: number;
  theme: "sports" | "animals" | "fruits" | "vehicles";
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
  const theme = source.theme;
  if (theme !== "sports" && theme !== "animals" && theme !== "fruits" && theme !== "vehicles") return null;

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
    theme,
    startTime,
    phase,
    requiredPlayers,
    readyCount,
    completes,
    ranking
  };
};

const THEME_LABELS: Record<MemoryStatePayload["theme"], string> = {
  sports: "Thể thao",
  animals: "Động vật",
  fruits: "Trái cây",
  vehicles: "Xe cộ"
};

const THEME_ICONS: Record<MemoryStatePayload["theme"], string[]> = {
  sports: [
    "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉",
    "🥏", "🎱", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏",
    "🥅", "⛳", "🥊", "🥋", "🎽", "🛹", "⛸️", "🥌",
    "🎯", "🪃", "🏹", "🤿", "🏊", "🚴", "🏇", "🏋️"
  ],
  animals: [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
    "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔",
    "🐧", "🐦", "🦆", "🦉", "🦄", "🐝", "🦋", "🐢",
    "🐬", "🐳", "🦖", "🦕", "🦓", "🦒", "🦘", "🦥"
  ],
  fruits: [
    "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓",
    "🫐", "🍒", "🥝", "🍍", "🥭", "🍑", "🍈", "🍅",
    "🥥", "🥑", "🍏", "🍆", "🥕", "🌽", "🫛", "🥔",
    "🍠", "🧄", "🧅", "🥬", "🥦", "🍄", "🌶️", "🥒"
  ],
  vehicles: [
    "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑",
    "🚒", "🚐", "🛻", "🚚", "🚜", "🛵", "🏍️", "🚲",
    "🛴", "🚂", "🚆", "🚇", "🚊", "🚞", "🚁", "✈️",
    "🛩️", "🚀", "🛸", "⛵", "🚤", "🛥️", "🛳️", "🚢"
  ]
};

const iconForCard = (theme: MemoryStatePayload["theme"], value: number): string => {
  const icons = THEME_ICONS[theme];
  return icons[value % icons.length] ?? "🎴";
};

export function MemoryPanel({ disabled, onEmit, gameState, playerId, room, onClose }: MemoryPanelProps) {
  const memory = useMemo(() => parseMemoryState(gameState), [gameState]);

  const [revealed, setRevealed] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [viewport, setViewport] = useState({ width: 390, height: 844 });
  const readySentKeyRef = useRef<string>("");

  useEffect(() => {
    if (!memory) return;
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
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-slate-700 rounded-3xl bg-slate-900/40 w-full">
        <div className="text-4xl mb-4">🧠</div>
        <p className="text-slate-300 font-bold">Chờ Host nhấn BẮT ĐẦU</p>
        <p className="text-xs text-slate-500 mt-2">Trò chơi Ghi nhớ sẽ bắt đầu sau countdown</p>
      </div>
    );
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

  return (
    <div className="relative flex h-[min(85vh,850px)] w-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-950/40 border border-slate-800 shadow-2xl">
      {/* HUD Layer */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Ghi Nhớ</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">{THEME_LABELS[memory.theme]}</span>
          </div>
        </div>


        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tiến độ</span>
          <p className="font-mono text-sm font-bold text-white leading-tight">
            {matchedPairs}/{memory.pairCount}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative h-full w-full flex flex-col pt-16 px-4">
        {/* Stats Row */}
        <div className="mb-4 flex justify-between items-center shrink-0">
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Thời gian</span>
              <span className="text-sm font-mono font-bold text-cyan-300">{elapsedText}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Lượt lật</span>
              <span className="text-sm font-mono font-bold text-amber-300">{moves}</span>
            </div>
          </div>
          {myResult && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase">HOÀN THÀNH</span>
            </div>
          )}
        </div>

        {/* Board */}
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
              const cardIcon = iconForCard(memory.theme, value);
              return (
                <button
                  key={`${memory.seed}-${index}`}
                  onClick={() => onCardClick(index)}
                  disabled={disabled || submitted || isMatched || memory.phase !== "running"}
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 font-bold transition-all
                    ${isMatched
                      ? "border-emerald-500/30 bg-emerald-500/10 opacity-30 shadow-none"
                      : isRevealed
                        ? "border-amber-400 bg-amber-400/20 text-amber-100 shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-105 z-10"
                        : "border-slate-800 bg-slate-900/50 text-cyan-100 hover:border-slate-600 hover:bg-slate-800"
                    } disabled:cursor-not-allowed`}
                  style={{ width: `${boardLayout.cell}px`, height: `${boardLayout.cell}px`, fontSize: `${boardLayout.fontSize}px` }}
                >
                  {isMatched ? (
                    ""
                  ) : show ? (
                    <span style={{ fontSize: `${Math.max(20, Math.floor(boardLayout.cell * 0.7))}px` }}>{cardIcon}</span>
                  ) : (
                    <span className="text-slate-700 opacity-50" style={{ fontSize: `${Math.max(16, Math.floor(boardLayout.cell * 0.4))}px` }}>?</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ranking Mini */}
        <div className="mt-4 mb-4 shrink-0 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Xếp hạng</p>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {memory.ranking.map(([pid, data], idx) => (
              <div key={pid} className={`flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg border ${pid === playerId ? "bg-cyan-500/10 border-cyan-500/30" : "bg-slate-900 border-slate-800"}`}>
                <span className="text-[10px] font-black text-slate-500">{idx + 1}</span>
                <span className={`text-[10px] font-bold ${pid === playerId ? "text-white" : "text-slate-400"}`}>
                  {pid === playerId ? "BẠN" : pid.slice(0, 4)}
                </span>
                <span className="text-[9px] font-mono text-emerald-400">{(data.durationMs / 1000).toFixed(1)}s</span>
              </div>
            ))}
            {memory.ranking.length === 0 && <p className="text-[10px] italic text-slate-600">Chưa có ai hoàn thành...</p>}
          </div>
        </div>
      </div>

    </div>
  );
}

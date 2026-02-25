"use client";

import { useEffect, useState } from "react";

interface LotoNumberBoardProps {
    maxNumber: 60 | 90;
    calledNumbers: number[];
    currentNumber: number | null;
    gameStatus?: "waiting" | "playing" | "paused" | "finished";
    showCurrentNumber?: boolean;
}

export function LotoNumberBoard({ maxNumber, calledNumbers, currentNumber, gameStatus, showCurrentNumber = true }: LotoNumberBoardProps) {
    const cols = maxNumber === 60 ? 6 : 9;
    const calledSet = new Set(calledNumbers);
    const recentCalled = [...calledNumbers].slice(-12).reverse();
    const [highlightPulse, setHighlightPulse] = useState(false);

    useEffect(() => {
        if (currentNumber === null) {
            return;
        }
        setHighlightPulse(true);
        const timer = window.setTimeout(() => setHighlightPulse(false), 900);
        return () => window.clearTimeout(timer);
    }, [currentNumber]);

    const columns: { label: string; numbers: number[] }[] = [];
    for (let c = 0; c < cols; c++) {
        const start = c === 0 ? 1 : c * 10;
        const end = c === cols - 1 ? maxNumber : (c + 1) * 10 - 1;
        const numbers: number[] = [];
        for (let n = start; n <= end; n++) numbers.push(n);
        columns.push({ label: `${start}-${end}`, numbers });
    }

    return (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                    Bảng số ({maxNumber} số)
                </h3>
                <span className="text-xs text-slate-500">
                    Đã gọi: {calledNumbers.length}/{maxNumber}
                </span>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
                {showCurrentNumber && (
                    <div className="flex items-center justify-center">
                        <div
                            className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-400 bg-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.4)] ${highlightPulse ? "animate-pulse" : ""}`}
                        >
                            <span className="text-3xl font-bold text-cyan-100">{currentNumber ?? "-"}</span>
                        </div>
                    </div>
                )}
                <div>
                    {gameStatus === "playing" && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-cyan-300" />
                            <span>Đang quay số ngẫu nhiên...</span>
                        </div>
                    )}
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Số vừa gọi gần nhất
                    </p>
                    {recentCalled.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {recentCalled.map((n, index) => (
                                <span
                                    key={`recent-${n}-${index}`}
                                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                                        n === currentNumber
                                            ? "bg-cyan-500 text-slate-900"
                                            : "bg-slate-800 text-cyan-100"
                                    }`}
                                >
                                    {n}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500">Chưa có số nào được gọi.</p>
                    )}
                </div>
            </div>

            <div className="flex max-h-[52vh] gap-1 overflow-auto rounded-xl border border-slate-800 p-1">
                {columns.map((col) => (
                    <div key={col.label} className="flex min-w-[46px] flex-1 flex-col gap-1">
                        <div className="sticky top-0 z-10 rounded bg-slate-800 px-1 py-1 text-center text-[10px] font-semibold text-slate-300">
                            {col.label}
                        </div>
                        {col.numbers.map((n) => {
                            const isCalled = calledSet.has(n);
                            const isCurrent = n === currentNumber;
                            return (
                                <div
                                    key={n}
                                    className={`flex h-7 items-center justify-center rounded text-xs font-semibold transition-all duration-300 ${
                                        isCurrent
                                            ? "bg-cyan-500 text-slate-900 ring-2 ring-cyan-300"
                                            : isCalled
                                                ? "border border-cyan-400/40 bg-cyan-500/30 text-cyan-100"
                                                : "border border-slate-700/40 bg-slate-800/60 text-slate-500"
                                    }`}
                                >
                                    {n}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { BingoCard } from "../store/loto-store";

interface LotoBingoCardProps {
    card: BingoCard;
    calledNumbers: number[];
    currentNumber?: number | null;
    maxNumber?: 60 | 90;
    gameStatus?: "waiting" | "playing" | "paused" | "finished";
}

export function LotoBingoCard({ card, calledNumbers, currentNumber = null, maxNumber = 90, gameStatus }: LotoBingoCardProps) {
    const calledSet = new Set(calledNumbers);
    const cols = card[0]?.length ?? 0;
    const [displayNumber, setDisplayNumber] = useState<number | null>(currentNumber);
    const [isRolling, setIsRolling] = useState(false);
    const spinTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (spinTimerRef.current !== null) {
            window.clearTimeout(spinTimerRef.current);
            spinTimerRef.current = null;
        }
        if (currentNumber === null) {
            setDisplayNumber(null);
            setIsRolling(false);
            return;
        }

        let cancelled = false;
        let delay = 55;
        let elapsed = 0;
        const totalDuration = 1450;

        const runSpin = () => {
            if (cancelled) {
                return;
            }
            elapsed += delay;
            if (elapsed >= totalDuration) {
                setDisplayNumber(currentNumber);
                setIsRolling(false);
                spinTimerRef.current = null;
                return;
            }
            const randomNumber = Math.floor(Math.random() * maxNumber) + 1;
            setDisplayNumber(randomNumber);
            setIsRolling(true);
            delay = Math.min(Math.floor(delay * 1.18), 240);
            spinTimerRef.current = window.setTimeout(runSpin, delay);
        };

        runSpin();

        return () => {
            cancelled = true;
            if (spinTimerRef.current !== null) {
                window.clearTimeout(spinTimerRef.current);
                spinTimerRef.current = null;
            }
        };
    }, [currentNumber, maxNumber]);

    let totalNumbers = 0;
    let matchedNumbers = 0;
    const completedRows = card.filter((row) => {
        const rowNumbers = row.filter((n) => n > 0);
        totalNumbers += rowNumbers.length;
        const rowMatched = rowNumbers.filter((n) => calledSet.has(n)).length;
        matchedNumbers += rowMatched;
        return rowNumbers.length > 0 && rowMatched === rowNumbers.length;
    }).length;

    const hasWinningRow = completedRows > 0;

    return (
        <div
            className={`rounded-xl border p-3 transition-all ${
                hasWinningRow
                    ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                    : "border-slate-700 bg-slate-900/60"
            }`}
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300">
                    Bảng dò của bạn
                    {hasWinningRow && (
                        <span className="ml-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                            THẮNG HÀNG!
                        </span>
                    )}
                </span>
                <span className="text-[10px] text-slate-400">
                    Trúng: {matchedNumbers}/{totalNumbers}
                </span>
            </div>

            <div className="mb-3 flex items-center justify-between rounded-lg border border-cyan-400/30 bg-slate-950/60 px-3 py-2">
                <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">Số vừa gọi</p>
                    {gameStatus === "playing" && isRolling && (
                        <p className="text-[11px] font-semibold text-cyan-300">Đang quay số...</p>
                    )}
                </div>
                <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-300 bg-cyan-500/20 text-2xl font-bold text-cyan-100 ${isRolling ? "animate-pulse" : ""}`}>
                    {displayNumber ?? "-"}
                </div>
            </div>

            <div className="space-y-1">
                {card.map((row, r) => {
                    const rowNumbers = row.filter((n) => n > 0);
                    const rowMatched = rowNumbers.filter((n) => calledSet.has(n)).length;
                    const rowComplete = rowNumbers.length > 0 && rowMatched === rowNumbers.length;

                    return (
                        <div
                            key={`row-${r}`}
                            className={`grid gap-1 rounded-md p-1 ${
                                rowComplete ? "bg-emerald-500/10" : "bg-transparent"
                            }`}
                            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                        >
                            {row.map((n, c) => {
                                const isMatched = n > 0 && calledSet.has(n);
                                return (
                                    <div
                                        key={`${r}-${c}`}
                                        className={`flex h-9 items-center justify-center rounded text-sm font-bold transition-all duration-300 ${
                                            n === 0
                                                ? "bg-slate-800/30"
                                                : isMatched
                                                    ? "bg-cyan-500 text-slate-900"
                                                    : "border border-slate-700 bg-slate-800 text-slate-200"
                                        }`}
                                    >
                                        {n > 0 ? n : ""}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

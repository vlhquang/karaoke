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
    const cols = card[0]?.length ?? 0;

    const isRolling = gameStatus === "playing";
    const displayNumber = currentNumber;

    // While rolling, we no longer hide the currentNumber. It stays visible.
    const calledSet = new Set(calledNumbers);

    const recentCalled = [...calledNumbers]
        .slice(-12).reverse();

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
            className={`rounded-xl border p-2 transition-all sm:p-3 ${hasWinningRow
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

            <div className="mb-2 rounded-lg border border-cyan-400/30 bg-slate-950/60 px-2 py-1.5 sm:mb-3 sm:px-3 sm:py-2">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-cyan-300 bg-cyan-500/20 text-lg font-bold text-cyan-100 relative sm:h-14 sm:w-14 sm:text-2xl ${isRolling ? "animate-pulse" : ""}`}>
                        {isRolling && (
                            <div className="absolute inset-0 rounded-full border-[3px] border-cyan-400 border-t-transparent animate-spin opacity-70"></div>
                        )}
                        {displayNumber ?? "—"}
                    </div>
                    {recentCalled.length > 0 && (
                        <div className="flex flex-1 flex-wrap gap-1 overflow-hidden">
                            {recentCalled.map((n, index) => (
                                <span
                                    key={`recent-${n}-${index}`}
                                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${n === currentNumber
                                        ? "bg-cyan-500 text-slate-900"
                                        : "bg-slate-800 text-cyan-100"
                                        } ${index >= 6 ? "hidden sm:inline-flex" : "inline-flex"}`}
                                >
                                    {n}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-0.5 sm:space-y-1">
                {card.map((row, r) => {
                    const rowNumbers = row.filter((n) => n > 0);
                    const rowMatched = rowNumbers.filter((n) => calledSet.has(n)).length;
                    const rowComplete = rowNumbers.length > 0 && rowMatched === rowNumbers.length;

                    return (
                        <div
                            key={`row-${r}`}
                            className={`grid gap-0.5 rounded-md p-0.5 sm:gap-1 sm:p-1 ${rowComplete ? "bg-emerald-500/10" : "bg-transparent"
                                }`}
                            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                        >
                            {row.map((n, c) => {
                                const isMatched = n > 0 && calledSet.has(n);
                                return (
                                    <div
                                        key={`${r}-${c}`}
                                        className={`flex h-6 items-center justify-center rounded text-[10px] font-bold transition-all duration-300 sm:h-9 sm:text-sm ${n === 0
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

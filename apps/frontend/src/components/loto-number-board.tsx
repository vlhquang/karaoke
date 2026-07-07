"use client";

import type { LotoThemeConfig } from "../lib/loto-themes";

interface LotoNumberBoardProps {
    maxNumber: 60 | 90;
    calledNumbers: number[];
    currentNumber: number | null;
    theme?: LotoThemeConfig;
}

export function LotoNumberBoard({ maxNumber, calledNumbers, currentNumber, theme }: LotoNumberBoardProps) {
    const cols = maxNumber === 60 ? 6 : 9;
    const calledSet = new Set(calledNumbers);

    const columns: { label: string; numbers: number[] }[] = [];
    for (let c = 0; c < cols; c++) {
        const start = c === 0 ? 1 : c * 10;
        const end = c === cols - 1 ? maxNumber : (c + 1) * 10 - 1;
        const numbers: number[] = [];
        for (let n = start; n <= end; n++) numbers.push(n);
        columns.push({ label: `${start}-${end}`, numbers });
    }

    const borderCls = theme?.border ?? "border-slate-700";
    const cardBgCls = theme?.cardBg ?? "bg-slate-900/60";
    const mutedCls = theme?.muted ?? "text-slate-400";
    const calledCellCls = theme?.calledCell ?? "border border-cyan-400/40 bg-cyan-500/30 text-cyan-100";
    const currentCellCls = theme?.currentCell ?? "bg-cyan-500 text-slate-900 ring-2 ring-cyan-300";
    const uncalledCellCls = theme?.uncalledCell ?? "border border-slate-700/40 bg-slate-800/60 text-slate-500";

    return (
        <div className={`rounded-2xl border ${borderCls} ${cardBgCls} p-2 sm:p-4`}>
            <div className="mb-2 flex items-center justify-between sm:mb-3">
                <h3 className={`text-xs font-semibold uppercase tracking-widest ${mutedCls} sm:text-sm`}>
                    Bảng số ({maxNumber} số)
                </h3>
                <span className={`text-[10px] ${mutedCls} sm:text-xs`}>
                    Đã gọi: {calledNumbers.length}/{maxNumber}
                </span>
            </div>

            <div
                className={`grid max-h-[52vh] gap-0.5 overflow-y-auto rounded-xl border ${borderCls} p-1 sm:gap-1`}
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
                {columns.map((col) => (
                    <div key={col.label} className="flex flex-col gap-0.5 sm:gap-1">
                        <div className={`sticky top-0 z-10 rounded ${cardBgCls} px-0.5 py-0.5 text-center text-[8px] font-semibold sm:px-1 sm:py-1 sm:text-[10px]`}>
                            {col.label}
                        </div>
                        {col.numbers.map((n) => {
                            const isCalled = calledSet.has(n);
                            const isCurrent = n === currentNumber;
                            return (
                                <div
                                    key={n}
                                    className={`flex h-6 items-center justify-center rounded text-[10px] font-semibold transition-all duration-300 sm:h-7 sm:text-xs ${isCurrent
                                        ? currentCellCls
                                        : isCalled
                                            ? calledCellCls
                                            : uncalledCellCls
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

"use client";

interface LotoNumberBoardProps {
    maxNumber: 60 | 90;
    calledNumbers: number[];
    currentNumber: number | null;
    isAnimating?: boolean;
}

export function LotoNumberBoard({ maxNumber, calledNumbers, currentNumber, isAnimating = false }: LotoNumberBoardProps) {
    const cols = maxNumber === 60 ? 6 : 9;
    const calledSet = new Set(calledNumbers);

    // While animation is running, don't mark the current number yet
    if (isAnimating && currentNumber !== null) {
        calledSet.delete(currentNumber);
    }

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

            <div className="flex max-h-[52vh] gap-1 overflow-auto rounded-xl border border-slate-800 p-1">
                {columns.map((col) => (
                    <div key={col.label} className="flex min-w-[46px] flex-1 flex-col gap-1">
                        <div className="sticky top-0 z-10 rounded bg-slate-800 px-1 py-1 text-center text-[10px] font-semibold text-slate-300">
                            {col.label}
                        </div>
                        {col.numbers.map((n) => {
                            const isCalled = calledSet.has(n);
                            const isCurrent = n === currentNumber && !isAnimating;
                            return (
                                <div
                                    key={n}
                                    className={`flex h-7 items-center justify-center rounded text-xs font-semibold transition-all duration-300 ${isCurrent
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

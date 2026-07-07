"use client";

import type { LotoMemberState } from "@karaoke/shared";

interface LotoNearWinPanelProps {
    members: LotoMemberState[];
    calledNumbers: number[];
    maxNumber: 60 | 90;
}

export function LotoNearWinPanel({ members, calledNumbers, maxNumber }: LotoNearWinPanelProps) {
    const nearWinPlayers = members.filter((m) => m.nearWinRows.length > 0);
    if (nearWinPlayers.length === 0) return null;

    const uncalledCount = maxNumber - calledNumbers.length;

    // Collect all unique waiting numbers across all players
    const allWaitingNumbers = new Set<number>();
    for (const player of nearWinPlayers) {
        for (const row of player.nearWinRows) {
            allWaitingNumbers.add(row.waitingNumber);
        }
    }

    // For each player, compute unique waiting numbers and probability
    const playerInfos = nearWinPlayers.map((player) => {
        const uniqueWaiting = new Set(player.nearWinRows.map((r) => r.waitingNumber));
        // Probability: how many unique uncalled numbers would give this player a win
        // = uniqueWaitingNumbers / uncalledNumbers
        const probability = uncalledCount > 0 ? (uniqueWaiting.size / uncalledCount) * 100 : 0;
        return {
            player,
            uniqueWaiting: [...uniqueWaiting].sort((a, b) => a - b),
            rowCount: player.nearWinRows.length,
            probability: Math.min(probability, 100)
        };
    });

    // Sort by probability descending
    playerInfos.sort((a, b) => b.probability - a.probability);

    return (
        <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4">
            <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-200">
                    Sắp chiến thắng!
                </h3>
                <span className="ml-auto text-[10px] text-amber-300/60">
                    Còn {uncalledCount} số chưa gọi
                </span>
            </div>

            <div className="space-y-2">
                {playerInfos.map((info) => (
                    <div
                        key={info.player.userId}
                        className="flex items-center gap-3 rounded-lg border border-amber-400/20 bg-slate-900/50 px-3 py-2 transition-all duration-300 animate-in fade-in"
                    >
                        {/* Player name */}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-amber-100">
                                {info.player.displayName}
                            </p>
                            <p className="text-[10px] text-amber-300/70">
                                {info.rowCount} hàng đang đợi
                            </p>
                        </div>

                        {/* Waiting numbers */}
                        <div className="flex flex-wrap gap-1">
                            {info.uniqueWaiting.map((n) => (
                                <span
                                    key={n}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-400/50 bg-amber-500/20 text-xs font-bold text-amber-100"
                                >
                                    {n}
                                </span>
                            ))}
                        </div>

                        {/* Win probability */}
                        <div className="flex flex-col items-end">
                            <span className="text-base font-bold text-amber-300">
                                {info.probability.toFixed(1)}%
                            </span>
                            <span className="text-[9px] text-amber-300/50">tỉ lệ</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

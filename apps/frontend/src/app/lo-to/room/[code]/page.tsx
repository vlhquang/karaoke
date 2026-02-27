"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLotoStore } from "../../../../store/loto-store";
import { LotoNumberBoard } from "../../../../components/loto-number-board";
import { LotoBingoCard } from "../../../../components/loto-bingo-card";
import { LotoWinnerPopup } from "../../../../components/loto-winner-popup";

import { VIET_BANKS } from "../../../../lib/banks";
import { LOTO_THEMES } from "../../../../lib/loto-themes";

export default function LotoRoomPage() {
    const params = useParams();
    const roomCodeParam = String(params.code ?? "").toUpperCase();

    const {
        connect,
        connected,
        joinRoom,
        roomCode,
        config,
        calledNumbers,
        currentNumber,
        gameStatus,
        memberCount,
        readyCount,
        members,
        isReady,
        boards,
        randomizeBoard,
        claimWin,
        toggleReady,
        winnerName,
        winnerBankingInfo,
        betAmount,
        errorMessage,
        clearError,
        theme,
        setTheme
    } = useLotoStore();

    const [displayName, setDisplayName] = useState("");
    const [loading, setLoading] = useState(false);
    const [bankId, setBankId] = useState("");
    const [accountNo, setAccountNo] = useState("");
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);

    const autoClaimedRef = useRef<string>("");
    const isJoined = Boolean(roomCode && roomCode === roomCodeParam);

    useEffect(() => {
        connect();
    }, [connect]);

    useEffect(() => {
        if (!isJoined || boards.length > 0 || memberCount === 0) {
            return;
        }
        randomizeBoard();
    }, [boards.length, isJoined, memberCount, randomizeBoard]);

    useEffect(() => {
        setShowWinnerPopup(Boolean(winnerName));
    }, [winnerName]);

    useEffect(() => {
        if (gameStatus === "waiting" || calledNumbers.length === 0) {
            autoClaimedRef.current = "";
        }
    }, [calledNumbers.length, gameStatus]);

    useEffect(() => {
        if (gameStatus === "waiting" || calledNumbers.length === 0) {
            autoClaimedRef.current = "";
        }
    }, [calledNumbers.length, gameStatus]);

    const handleJoin = async () => {
        setLoading(true);
        try {
            const bankingInfo = bankId && accountNo ? { bankId, accountNo } : undefined;
            await joinRoom(roomCodeParam, displayName.trim() || "Người chơi", bankingInfo);
        } finally {
            setLoading(false);
        }
    };

    const hasWinningRow = useMemo(() => {
        if (!isReady) {
            return false;
        }
        const calledSet = new Set(calledNumbers);
        return boards.some((card) =>
            card.some((row) => {
                const rowNumbers = row.filter((n) => n > 0);
                return rowNumbers.length > 0 && rowNumbers.every((n) => calledSet.has(n));
            })
        );
    }, [boards, calledNumbers, isReady]);

    useEffect(() => {
        if (!isJoined || !isReady || gameStatus !== "playing" || !hasWinningRow) {
            return;
        }
        const claimKey = `${roomCode}-${calledNumbers.length}`;
        if (autoClaimedRef.current === claimKey) {
            return;
        }
        autoClaimedRef.current = claimKey;
        void claimWin();
    }, [calledNumbers.length, claimWin, gameStatus, hasWinningRow, isJoined, isReady, roomCode]);

    const themeConfig = LOTO_THEMES[theme] || LOTO_THEMES["default"]!;
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/lo-to/room/${roomCode}` : "";

    return (
        <div className={`min-h-screen transition-colors duration-500 ${themeConfig.classes}`}>
            <main className="mx-auto max-w-7xl px-3 py-4 md:px-8 md:py-6">
                <LotoWinnerPopup
                    open={showWinnerPopup}
                    winnerName={winnerName}
                    winnerBankingInfo={winnerBankingInfo}
                    betAmount={betAmount}
                    onClose={() => setShowWinnerPopup(false)}
                />
                <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h1 className="text-xl font-bold md:text-2xl">Lô tô - Phòng {roomCodeParam}</h1>
                        <div className="flex items-center gap-3">
                            <select
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                                className={`rounded border ${themeConfig.inputBorder} ${themeConfig.inputBg} px-2 py-1 text-xs outline-none`}
                            >
                                {Object.entries(LOTO_THEMES).map(([key, t]) => (
                                    <option key={key} value={key}>{t.name}</option>
                                ))}
                            </select>
                            <Link href="/lo-to" className={`text-xs ${themeConfig.muted} hover:opacity-80`}>
                                Quay lại
                            </Link>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="flex items-center justify-between rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                            <span>{errorMessage}</span>
                            <button onClick={clearError} className="ml-3 text-red-300 hover:text-red-100">Đóng</button>
                        </div>
                    )}

                    {!isJoined ? (
                        <section className={`mx-auto max-w-md rounded-2xl border ${themeConfig.border} ${themeConfig.cardBg} p-5`}>
                            <h2 className="mb-4 text-lg font-semibold">Tham gia phòng</h2>
                            <label className={`mb-1 block text-sm ${themeConfig.muted}`}>Tên người chơi</label>
                            <input
                                className={`mb-4 w-full rounded-lg border ${themeConfig.inputBorder} ${themeConfig.inputBg} px-3 py-2`}
                                placeholder="Nhập tên của bạn"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />

                            <div className="mb-4 grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className={`mb-1 block text-sm ${themeConfig.muted}`}>Ngân hàng nhận (Tuỳ chọn)</label>
                                    <select
                                        className={`w-full rounded-lg border ${themeConfig.inputBorder} ${themeConfig.inputBg} px-3 py-2 text-sm`}
                                        value={bankId}
                                        onChange={(e) => setBankId(e.target.value)}
                                    >
                                        <option value="">-- Chọn ngân hàng --</option>
                                        {VIET_BANKS.map((bank) => (
                                            <option key={bank.bin} value={bank.bin}>
                                                {bank.shortName} - {bank.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={`mb-1 block text-sm ${themeConfig.muted}`}>Số tài khoản</label>
                                    <input
                                        className={`w-full rounded-lg border ${themeConfig.inputBorder} ${themeConfig.inputBg} px-3 py-2 text-sm`}
                                        value={accountNo}
                                        onChange={(e) => setAccountNo(e.target.value)}
                                        placeholder="Nhập số tài khoản"
                                    />
                                </div>
                            </div>

                            <button
                                className={`w-full rounded-xl ${themeConfig.accent} px-4 py-2.5 font-semibold ${themeConfig.accentText} transition hover:opacity-90 disabled:opacity-50`}
                                onClick={handleJoin}
                                disabled={loading || !connected}
                            >
                                {loading ? "Đang vào..." : "Vào phòng"}
                            </button>
                        </section>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div className={`flex flex-wrap items-center gap-2 rounded-xl border ${themeConfig.border} ${themeConfig.cardBg} p-3`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs ${themeConfig.muted}`}>Mã phòng:</span>
                                        <span className={`rounded ${themeConfig.accent}/20 px-3 py-1 font-mono text-base font-bold tracking-[0.15em] md:text-lg`}>
                                            {roomCode}
                                        </span>
                                    </div>
                                    <div className={`text-xs ${themeConfig.muted}`}>
                                        {config.maxNumber} số · Sẵn sàng {readyCount}/{memberCount}
                                    </div>
                                    <div
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${gameStatus === "playing"
                                            ? "bg-emerald-500/20 text-emerald-300"
                                            : gameStatus === "paused"
                                                ? "bg-amber-500/20 text-amber-300"
                                                : gameStatus === "finished"
                                                    ? "bg-red-500/20 text-red-300"
                                                    : "bg-slate-700 text-slate-300"
                                            }`}
                                    >
                                        {gameStatus === "playing"
                                            ? "Đang chơi"
                                            : gameStatus === "paused"
                                                ? "Tạm dừng"
                                                : gameStatus === "finished"
                                                    ? "Kết thúc"
                                                    : "Chờ bắt đầu"}
                                    </div>
                                </div>

                                <div className={`rounded-xl border ${themeConfig.border} ${themeConfig.cardBg} p-3`}>
                                    <div className="mb-2 text-sm font-semibold text-slate-200">Người chơi trong phòng (sẵn sàng {readyCount}/{memberCount})</div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {members.map((member) => {
                                            const uniqueWaiting = [...new Set(member.nearWinRows.map(r => r.waitingNumber))];
                                            const uncalled = config.maxNumber - calledNumbers.length;
                                            const probability = uncalled > 0 ? Math.min((uniqueWaiting.length / uncalled) * 100, 100) : 0;
                                            return (
                                                <div key={member.userId} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all ${member.nearWinRows.length > 0 ? "border-amber-400/40 bg-amber-500/10" : "border-slate-700 bg-slate-800/50"}`}>
                                                    <div className="min-w-0 flex-1">
                                                        <span className="truncate text-slate-200 block">{member.displayName}</span>
                                                        {member.nearWinRows.length > 0 && (
                                                            <span className="text-[10px] font-semibold text-amber-300 animate-pulse">
                                                                🎯 Đợi {uniqueWaiting.sort((a, b) => a - b).join(", ")} · {member.nearWinRows.length} hàng
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-2 shrink-0">
                                                        {member.nearWinRows.length > 0 && (
                                                            <span className="text-xs font-bold text-amber-300">{probability.toFixed(1)}%</span>
                                                        )}
                                                        {member.bankingInfo && <span className="text-[10px] text-cyan-300">STK</span>}
                                                        <span className={`rounded-full px-2 py-0.5 text-xs ${member.ready ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                                                            {member.ready ? "Sẵn sàng" : "Chưa"}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    void toggleReady(!isReady);
                                }}
                                disabled={gameStatus !== "waiting"}
                                className={`w-full rounded-xl px-4 py-3 font-semibold transition ${isReady
                                    ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                                    : "bg-amber-400 text-slate-900 hover:bg-amber-300"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isReady ? "Đã sẵn sàng" : "Sẵn sàng"}
                            </button>

                            {hasWinningRow && gameStatus === "playing" && (
                                <div className="rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                                    Bạn đã đủ số trên một hàng. Hệ thống đang tự động thông báo chiến thắng.
                                </div>
                            )}

                            {gameStatus === "finished" && !winnerName && (
                                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
                                    Trò chơi đã kết thúc.
                                </div>
                            )}



                            <div className="grid gap-3 lg:grid-cols-[1fr_1fr] lg:gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                                            Bảng dò của bạn
                                        </h3>
                                        <button
                                            onClick={randomizeBoard}
                                            disabled={gameStatus !== "waiting"}
                                            className="rounded-lg border border-cyan-400/50 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            Xáo số lại
                                        </button>
                                    </div>
                                    <div className={!isReady ? "pointer-events-none opacity-45" : ""}>
                                        {boards.length === 0 && (
                                            <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-400">
                                                Chưa có bảng dò. Nhấn "Xáo số lại" để tạo bảng.
                                            </p>
                                        )}
                                        {boards[0] && (
                                            <LotoBingoCard
                                                card={boards[0]}
                                                calledNumbers={calledNumbers}
                                                currentNumber={currentNumber}
                                                maxNumber={config.maxNumber}
                                                gameStatus={gameStatus}
                                                theme={themeConfig}
                                            />
                                        )}
                                    </div>
                                </div>

                                <LotoNumberBoard
                                    maxNumber={config.maxNumber}
                                    calledNumbers={calledNumbers}
                                    currentNumber={currentNumber}
                                    theme={themeConfig}
                                />
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

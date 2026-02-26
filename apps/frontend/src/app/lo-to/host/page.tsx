"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLotoStore } from "../../../store/loto-store";
import { LotoNumberBoard } from "../../../components/loto-number-board";
import { LotoBingoCard } from "../../../components/loto-bingo-card";
import { LotoWinnerPopup } from "../../../components/loto-winner-popup";
import { LotoNearWinPanel } from "../../../components/loto-near-win-panel";
import { QRCodeCanvas } from "qrcode.react";
import { VIET_BANKS } from "../../../lib/banks";

const THEMES: Record<string, { name: string; classes: string }> = {
    "default": { name: "Mát mẻ (Mặc định)", classes: "bg-slate-950 text-slate-200" },
    "kim": { name: "Kim (Vàng/Trắng)", classes: "bg-amber-50 text-slate-900" },
    "moc": { name: "Mộc (Xanh lá)", classes: "bg-emerald-950 text-emerald-50" },
    "thuy": { name: "Thủy (Xanh dương/Đen)", classes: "bg-blue-950 text-blue-50" },
    "hoa": { name: "Hỏa (Đỏ/Tím)", classes: "bg-rose-950 text-rose-50" },
    "tho": { name: "Thổ (Nâu/Cam)", classes: "bg-orange-950 text-orange-50" },
};

export default function LotoHostPage() {
    const {
        connect,
        connected,
        createRoom,
        closeRoom,
        startGame,
        pauseGame,
        callNumber,
        resetRound,
        toggleReady,
        claimWin,
        roomCode,
        role,
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
        winnerName,
        winnerBankingInfo,
        betAmount,
        errorMessage,
        clearError,
        theme,
        setTheme
    } = useLotoStore();

    const [displayName, setDisplayName] = useState("Chủ phòng");
    const [maxNumber, setMaxNumber] = useState<60 | 90>(90);
    const [intervalSeconds, setIntervalSeconds] = useState(5);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [bankId, setBankId] = useState("");
    const [accountNo, setAccountNo] = useState("");
    const [betAmountStr, setBetAmountStr] = useState("0");
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);
    const autoClaimedRef = useRef<string>("");
    const isHost = role === "host" && Boolean(roomCode);

    useEffect(() => {
        connect();
    }, [connect]);

    useEffect(() => {
        if (!isHost || boards.length > 0) {
            return;
        }
        randomizeBoard();
    }, [boards.length, isHost, randomizeBoard]);

    useEffect(() => {
        setShowWinnerPopup(Boolean(winnerName));
    }, [winnerName]);

    useEffect(() => {
        if (gameStatus === "waiting" || calledNumbers.length === 0) {
            autoClaimedRef.current = "";
        }
    }, [calledNumbers.length, gameStatus]);

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
        if (!isHost || !isReady || gameStatus !== "playing" || !hasWinningRow) {
            return;
        }
        const claimKey = `${roomCode}-${calledNumbers.length}`;
        if (autoClaimedRef.current === claimKey) {
            return;
        }
        autoClaimedRef.current = claimKey;
        void claimWin();
    }, [calledNumbers.length, claimWin, gameStatus, hasWinningRow, isHost, isReady, roomCode]);

    const themeConfig = THEMES[theme] || THEMES["default"]!;
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/lo-to/room/${roomCode}` : "";

    const formatCurrency = (value: string) => {
        const num = parseInt(value.replace(/\D/g, ""), 10);
        return isNaN(num) ? "0" : num.toLocaleString("en-US");
    };

    const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBetAmountStr(formatCurrency(e.target.value));
    };

    const handleCreateRoom = async () => {
        setLoading(true);
        try {
            const betAmount = parseInt(betAmountStr.replace(/,/g, ""), 10) || 0;
            const bankingInfo = bankId && accountNo ? { bankId, accountNo } : undefined;

            await createRoom(
                displayName.trim() || "Chủ phòng",
                {
                    maxNumber,
                    intervalSeconds,
                    voiceEnabled,
                    betAmount
                },
                bankingInfo
            );
        } finally {
            setLoading(false);
        }
    };

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
                        <h1 className="text-xl font-bold md:text-2xl">Lô tô - Chủ phòng</h1>
                        <div className="flex items-center gap-3">
                            <select
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 outline-none"
                            >
                                {Object.entries(THEMES).map(([key, t]) => (
                                    <option key={key} value={key}>{t.name}</option>
                                ))}
                            </select>
                            <Link href="/lo-to" className="text-xs text-slate-400 hover:text-cyan-300">
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

                    {!roomCode ? (
                        <section className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
                            <h2 className="mb-4 text-lg font-semibold">Cấu hình phòng</h2>

                            <label className="mb-1 block text-sm text-slate-300">Tên chủ phòng</label>
                            <input
                                className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />

                            <label className="mb-1 block text-sm text-slate-300">Số tiền cược mỗi ván (VND)</label>
                            <input
                                className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono"
                                value={betAmountStr}
                                onChange={handleBetAmountChange}
                                placeholder="0"
                            />

                            <div className="mb-4 grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm text-slate-300">Ngân hàng nhận (Tuỳ chọn)</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
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
                                    <label className="mb-1 block text-sm text-slate-300">Số tài khoản</label>
                                    <input
                                        className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                                        value={accountNo}
                                        onChange={(e) => setAccountNo(e.target.value)}
                                        placeholder="Nhập số tài khoản"
                                    />
                                </div>
                            </div>

                            <label className="mb-1 block text-sm text-slate-300">Loại bộ số</label>
                            <div className="mb-4 flex gap-2">
                                {([60, 90] as const).map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => setMaxNumber(n)}
                                        className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition ${maxNumber === n
                                            ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                                            : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500"
                                            }`}
                                    >
                                        1 - {n}
                                    </button>
                                ))}
                            </div>

                            <label className="mb-1 block text-sm text-slate-300">
                                Thời gian giữa các số: <span className="font-bold text-cyan-300">{intervalSeconds}s</span>
                            </label>
                            <input
                                type="range"
                                min={1}
                                max={30}
                                value={intervalSeconds}
                                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                                className="mb-4 w-full accent-cyan-500"
                            />

                            <label className="mb-3 flex items-center gap-3 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={voiceEnabled}
                                    onChange={(e) => setVoiceEnabled(e.target.checked)}
                                    className="h-4 w-4 accent-cyan-500"
                                />
                                Bật đọc số tự động
                            </label>

                            <button
                                className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
                                onClick={handleCreateRoom}
                                disabled={loading || !connected}
                            >
                                {loading ? "Đang tạo..." : "Tạo phòng"}
                            </button>
                        </section>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">Mã phòng:</span>
                                    <span className="rounded bg-cyan-500/20 px-3 py-1 font-mono text-base font-bold tracking-[0.15em] text-cyan-100 md:text-lg">
                                        {roomCode}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-400">
                                    {config.maxNumber} số · {config.intervalSeconds}s · Sẵn sàng {readyCount}/{memberCount}
                                </div>
                                <div className="ml-auto flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            void toggleReady(!isReady);
                                        }}
                                        disabled={gameStatus !== "waiting"}
                                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${isReady
                                            ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                                            : "bg-amber-400 text-slate-900 hover:bg-amber-300"
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isReady ? "Đã sẵn sàng" : "Sẵn sàng"}
                                    </button>

                                    {gameStatus === "waiting" || gameStatus === "paused" ? (
                                        <button
                                            onClick={() => {
                                                void startGame();
                                            }}
                                            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400"
                                            disabled={!isHost}
                                        >
                                            {gameStatus === "paused" ? "Tiếp tục" : "Bắt đầu"}
                                        </button>
                                    ) : gameStatus === "playing" ? (
                                        <button
                                            onClick={() => {
                                                void pauseGame();
                                            }}
                                            className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
                                            disabled={!isHost}
                                        >
                                            Tạm dừng
                                        </button>
                                    ) : null}

                                    <button
                                        onClick={() => {
                                            void callNumber();
                                        }}
                                        className="rounded-lg border border-cyan-400/50 px-4 py-1.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={!isHost || gameStatus !== "playing"}
                                    >
                                        Gọi số
                                    </button>

                                    <button
                                        onClick={() => {
                                            void resetRound();
                                        }}
                                        className="rounded-lg border border-violet-400/60 px-4 py-1.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20"
                                        disabled={!isHost}
                                    >
                                        Reset lượt
                                    </button>

                                    <button
                                        onClick={() => {
                                            void closeRoom();
                                        }}
                                        className="rounded-lg border border-red-400/60 px-4 py-1.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
                                        disabled={!isHost}
                                    >
                                        Đóng phòng
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                                    <div className="mb-2 text-sm font-semibold text-slate-200">Người chơi trong phòng (sẵn sàng {readyCount}/{memberCount})</div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {members.map((member) => (
                                            <div key={member.userId} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm">
                                                <span className="truncate text-slate-200">{member.displayName}</span>
                                                <div className="flex items-center gap-2">
                                                    {member.bankingInfo && <span className="text-[10px] text-cyan-300">Có STK</span>}
                                                    <span className={`rounded-full px-2 py-0.5 text-xs ${member.ready ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                                                        {member.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                                    <p className="mb-2 text-xs font-semibold text-slate-300 uppercase tracking-widest">QR Tham gia</p>
                                    <div className="rounded-xl bg-white p-2">
                                        <QRCodeCanvas value={joinUrl} size={120} />
                                    </div>
                                </div>
                            </div>

                            {gameStatus === "finished" && !winnerName && (
                                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
                                    Trò chơi đã kết thúc - đã gọi hết số.
                                </div>
                            )}
                            {hasWinningRow && gameStatus === "playing" && (
                                <div className="rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                                    Bạn đã đủ số trên một hàng. Hệ thống đang tự động thông báo chiến thắng.
                                </div>
                            )}

                            {gameStatus === "playing" && (
                                <LotoNearWinPanel
                                    members={members}
                                    calledNumbers={calledNumbers}
                                    maxNumber={config.maxNumber}
                                />
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
                                    {boards.length === 0 && (
                                        <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-400">
                                            Chưa có bảng dò. Nhấn "Xáo số lại" để bắt đầu.
                                        </p>
                                    )}
                                    {boards[0] && (
                                        <LotoBingoCard
                                            card={boards[0]}
                                            calledNumbers={calledNumbers}
                                            currentNumber={currentNumber}
                                            maxNumber={config.maxNumber}
                                            gameStatus={gameStatus}
                                        />
                                    )}
                                </div>

                                <LotoNumberBoard
                                    maxNumber={config.maxNumber}
                                    calledNumbers={calledNumbers}
                                    currentNumber={currentNumber}
                                    gameStatus={gameStatus}
                                    showCurrentNumber={false}
                                />
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

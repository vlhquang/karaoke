"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLotoStore } from "../../../../store/loto-store";
import { LotoNumberBoard } from "../../../../components/loto-number-board";
import { LotoBingoCard } from "../../../../components/loto-bingo-card";
import { LotoWinnerPopup } from "../../../../components/loto-winner-popup";
import { LotoNearWinPanel } from "../../../../components/loto-near-win-panel";

const MAX_QR_SIZE = 500_000;

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
        winnerQrImage,
        errorMessage,
        clearError
    } = useLotoStore();

    const [displayName, setDisplayName] = useState("");
    const [loading, setLoading] = useState(false);
    const [qrPreview, setQrPreview] = useState("");
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState("");
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);
    const [showMore, setShowMore] = useState(false);
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

    const onQrFileChange = (file: File | null) => {
        setQrError("");
        if (!file) {
            setQrPreview("");
            setQrLoading(false);
            return;
        }
        if (!file.type.startsWith("image/")) {
            setQrError("File không hợp lệ. Vui lòng chọn ảnh QR.");
            return;
        }
        if (file.size > MAX_QR_SIZE) {
            setQrError("Ảnh QR quá lớn. Tối đa 500KB.");
            return;
        }
        setQrLoading(true);
        const reader = new FileReader();
        reader.onload = () => {
            setQrPreview(typeof reader.result === "string" ? reader.result : "");
            setQrLoading(false);
        };
        reader.onerror = () => {
            setQrLoading(false);
            setQrError("Không đọc được file QR. Vui lòng thử lại.");
        };
        reader.readAsDataURL(file);
    };

    const handleJoin = async () => {
        setLoading(true);
        try {
            await joinRoom(roomCodeParam, displayName.trim() || "Người chơi", qrPreview || undefined);
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

    return (
        <main className="mx-auto min-h-screen max-w-7xl px-3 py-4 md:px-8 md:py-6">
            <LotoWinnerPopup
                open={showWinnerPopup}
                winnerName={winnerName}
                winnerQrImage={winnerQrImage}
                onClose={() => setShowWinnerPopup(false)}
            />
            <div className="space-y-3 md:space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-xl font-bold md:text-2xl">Lô tô - Phòng {roomCodeParam}</h1>
                    <Link href="/lo-to" className="text-xs text-slate-400 hover:text-cyan-300">
                        Quay lại
                    </Link>
                </div>

                {errorMessage && (
                    <div className="flex items-center justify-between rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                        <span>{errorMessage}</span>
                        <button onClick={clearError} className="ml-3 text-red-300 hover:text-red-100">Đóng</button>
                    </div>
                )}

                {!isJoined ? (
                    <section className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
                        <h2 className="mb-4 text-lg font-semibold">Tham gia phòng</h2>
                        <label className="mb-1 block text-sm text-slate-300">Tên người chơi</label>
                        <input
                            className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"
                            placeholder="Nhập tên của bạn"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                        />

                        <label className="mb-1 block text-sm text-slate-300">QR nhận thưởng (tuỳ chọn)</label>
                        <input
                            type="file"
                            accept="image/*"
                            className="mb-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-900"
                            onChange={(event) => onQrFileChange(event.target.files?.[0] ?? null)}
                        />
                        <p className="mb-2 text-xs text-slate-500">Dung lượng tối đa 500KB.</p>
                        {qrError && <p className="mb-2 text-xs text-red-300">{qrError}</p>}
                        {qrLoading && <p className="mb-2 text-xs text-cyan-300">Đang xử lý ảnh QR...</p>}
                        {qrPreview && <img src={qrPreview} alt="QR xem trước" className="mb-4 h-24 w-24 rounded bg-white object-contain p-1" />}

                        <button
                            className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
                            onClick={handleJoin}
                            disabled={loading || !connected || qrLoading}
                        >
                            {loading ? "Đang vào..." : "Vào phòng"}
                        </button>
                    </section>
                ) : (
                    <>
                        <div className="md:hidden">
                            <button
                                onClick={() => setShowMore((prev) => !prev)}
                                className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200"
                            >
                                {showMore ? "Thu gọn" : "Show more"}
                            </button>
                        </div>

                        <div className={`${showMore ? "block" : "hidden"} space-y-3 md:block`}>
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">Mã phòng:</span>
                                    <span className="rounded bg-cyan-500/20 px-3 py-1 font-mono text-base font-bold tracking-[0.15em] text-cyan-100 md:text-lg">
                                        {roomCode}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-400">
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

                            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                                <div className="mb-2 text-sm font-semibold text-slate-200">Người chơi trong phòng (sẵn sàng {readyCount}/{memberCount})</div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {members.map((member) => (
                                        <div key={member.userId} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm">
                                            <span className="truncate text-slate-200">{member.displayName}</span>
                                            <div className="flex items-center gap-2">
                                                {member.hasQrImage && <span className="text-[10px] text-cyan-300">Có QR</span>}
                                                <span className={`rounded-full px-2 py-0.5 text-xs ${member.ready ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                                                    {member.ready ? "Sẵn sàng" : "Chưa sẵn sàng"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                void toggleReady(!isReady);
                            }}
                            className={`w-full rounded-xl px-4 py-3 font-semibold transition ${isReady
                                ? "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                                : "bg-amber-400 text-slate-900 hover:bg-amber-300"
                                }`}
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
                                        />
                                    )}
                                </div>
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
    );
}

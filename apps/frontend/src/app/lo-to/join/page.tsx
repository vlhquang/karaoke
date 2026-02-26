"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLotoStore } from "../../../store/loto-store";

import { VIET_BANKS } from "../../../lib/banks";

export default function LotoJoinPage() {
    const router = useRouter();
    const { connect, connected, joinRoom, errorMessage, clearError } = useLotoStore();

    const [code, setCode] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [bankId, setBankId] = useState("");
    const [accountNo, setAccountNo] = useState("");
    const [loading, setLoading] = useState(false);

    const normalizedCode = code.trim().toUpperCase();

    useEffect(() => {
        connect();
    }, [connect]);

    const handleJoin = async () => {
        if (normalizedCode.length !== 6) return;
        setLoading(true);
        try {
            const bankingInfo = bankId && accountNo ? { bankId, accountNo } : undefined;
            const success = await joinRoom(normalizedCode, displayName.trim() || "Người chơi", bankingInfo);
            if (success) {
                router.push(`/lo-to/room/${normalizedCode}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4">
            <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
                <h1 className="mb-4 text-2xl font-bold">Vào phòng lô tô</h1>

                {errorMessage && (
                    <div className="mb-4 flex items-center justify-between rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                        <span>{errorMessage}</span>
                        <button onClick={clearError} className="ml-3 text-red-300 hover:text-red-100">Đóng</button>
                    </div>
                )}

                <label className="mb-1 block text-sm text-slate-300">Mã phòng</label>
                <input
                    className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-center uppercase tracking-[0.2em]"
                    placeholder="MÃ PHÒNG (6 KÝ TỰ)"
                    value={code}
                    onChange={(event) => {
                        const next = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                        setCode(next);
                    }}
                    maxLength={6}
                />

                <label className="mb-1 block text-sm text-slate-300">Tên người chơi</label>
                <input
                    className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"
                    placeholder="Nhập tên của bạn"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
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

                <button
                    className="mt-2 w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
                    onClick={handleJoin}
                    disabled={normalizedCode.length !== 6 || loading || !connected}
                >
                    {loading ? "Đang vào..." : "Vào phòng"}
                </button>
            </section>
        </main>
    );
}

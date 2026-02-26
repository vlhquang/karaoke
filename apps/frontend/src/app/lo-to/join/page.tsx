"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLotoStore } from "../../../store/loto-store";

const MAX_QR_SIZE = 500_000;

export default function LotoJoinPage() {
    const router = useRouter();
    const { connect, connected, joinRoom, errorMessage, clearError } = useLotoStore();

    const [code, setCode] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [qrPreview, setQrPreview] = useState("");
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState("");
    const [loading, setLoading] = useState(false);

    const normalizedCode = code.trim().toUpperCase();

    useEffect(() => {
        connect();
    }, [connect]);

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
        if (normalizedCode.length !== 6) return;
        setLoading(true);
        try {
            const success = await joinRoom(normalizedCode, displayName.trim() || "Người chơi", qrPreview || undefined);
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
                    className="mt-2 w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
                    onClick={handleJoin}
                    disabled={normalizedCode.length !== 6 || loading || !connected || qrLoading}
                >
                    {loading ? "Đang vào..." : "Vào phòng"}
                </button>
            </section>
        </main>
    );
}

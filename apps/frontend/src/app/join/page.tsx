"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const normalizedCode = code.trim().toUpperCase();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
        <h1 className="mb-4 text-2xl font-bold">Vào phòng Karaoke</h1>
        <input
          className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-center uppercase tracking-[0.2em]"
          placeholder="MÃ PHÒNG"
          value={code}
          onChange={(event) => {
            const next = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            setCode(next);
          }}
          maxLength={6}
        />
        <button
          className="w-full rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-900"
          onClick={() => router.push(`/room/${normalizedCode}`)}
          disabled={normalizedCode.length !== 6}
        >
          Tiếp tục
        </button>
        <p className="mt-3 text-xs text-slate-400">Nhập mã phòng 6 ký tự do chủ phòng cung cấp.</p>
        <Link
          href="/karaoke"
          className="mt-3 inline-block text-xs text-slate-400 hover:text-cyan-300"
        >
          ← Quay lại Karaoke
        </Link>
      </section>
    </main>
  );
}

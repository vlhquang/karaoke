"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const normalizedCode = code.trim().toUpperCase();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
        <h1 className="mb-4 text-2xl font-bold">Vao phong Karaoke</h1>
        <input
          className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-center uppercase tracking-[0.2em]"
          placeholder="ROOM CODE"
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
          Tiep tuc
        </button>
        <p className="mt-3 text-xs text-slate-400">Nhap ma phong 6 ky tu do chu phong cung cap.</p>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";

export default function BaoLiXiPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Bao Lì Xì</h1>
        <Link href="/" className="text-xs text-slate-400 hover:text-cyan-300">
          ← Quay lại Portal
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <iframe
          src="/lixi/index.html"
          className="h-[calc(100vh-120px)] w-full border-0"
          title="Bao Lì Xì"
        />
      </div>
    </main>
  );
}

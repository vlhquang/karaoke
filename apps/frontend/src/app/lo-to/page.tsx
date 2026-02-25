import Link from "next/link";

export default function LoToPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 md:px-8">
      <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Lô tô</p>
        <h1 className="mt-3 text-2xl font-bold md:text-4xl">Lô tô Online</h1>
        <p className="mt-2 text-sm text-slate-300 md:text-base">
          Chọn vai trò để tham gia trò chơi lô tô realtime.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/lo-to/host"
            className="rounded-xl bg-cyan-500 px-5 py-3 text-center font-semibold text-slate-900 transition hover:bg-cyan-400"
          >
            Tạo phòng (Chủ phòng)
          </Link>
          <Link
            href="/lo-to/join"
            className="rounded-xl border border-cyan-300/40 px-5 py-3 text-center font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-slate-800"
          >
            Vào phòng
          </Link>
        </div>
        <Link
          href="/"
          className="mt-5 inline-block text-xs text-slate-400 hover:text-cyan-300"
        >
          Quay lại Portal
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function KaraokePortalPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 md:px-8">
      <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-6 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Karaoke</p>
        <h1 className="mt-3 text-2xl font-bold md:text-4xl">Realtime Karaoke Room</h1>
        <p className="mt-2 text-sm text-slate-300 md:text-base">Chon vai tro de tiep tuc su dung tinh nang karaoke.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/host" className="rounded-xl bg-cyan-500 px-5 py-3 text-center font-semibold text-slate-900">
            Tao phong (Chu phong)
          </Link>
          <Link href="/join" className="rounded-xl border border-cyan-300/40 px-5 py-3 text-center font-semibold text-cyan-100">
            Vao phong
          </Link>
        </div>
      </div>
    </main>
  );
}

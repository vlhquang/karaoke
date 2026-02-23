import Link from "next/link";

export default function BaoLiXiPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 md:px-8">
      <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-bold">Bao li xi</h1>
        <p className="mt-2 text-slate-300">Tinh nang dang phat trien. Ban co the quay lai portal de chon ung dung khac.</p>
        <Link href="/" className="mt-5 inline-block rounded-lg border border-cyan-300/50 px-4 py-2 text-cyan-100">
          Quay lai Portal
        </Link>
      </section>
    </main>
  );
}

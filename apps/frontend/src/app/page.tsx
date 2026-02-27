import Link from "next/link";

export default function HomePage() {
  const appMenus = [
    {
      href: "/karaoke",
      title: "Karaoke",
      description: "Phòng hát realtime, tạo phòng và tham gia bằng mã phòng.",
      badge: "Live"
    },
    {
      href: "/bao-li-xi",
      title: "Bao Lì Xì",
      description: "Chia bao lì xì online, cào số may mắn.",
      badge: "Live"
    },
    {
      href: "/lo-to",
      title: "Lô Tô",
      description: "Game lô tô trên web — tạo phòng, gọi số và dò bảng.",
      badge: "Live"
    },
    {
      href: "/co-phieu/index.html",
      title: "Cổ Phiếu",
      description: "Quản lý giao dịch mua cổ phiếu cá nhân với Google Sheets.",
      badge: "New"
    }
  ];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-5 backdrop-blur md:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Portal</p>
        <h1 className="mt-3 text-2xl font-bold md:text-4xl">Trang chủ ứng dụng</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Chạy chung một server và điều hướng sang các ứng dụng con từ menu này.
        </p>
      </div>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-semibold md:text-xl">Danh sách ứng dụng</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {appMenus.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-slate-700 bg-slate-900/60 p-4 transition hover:border-cyan-300/50 hover:bg-slate-900"
            >
              <div className="mb-2 inline-flex rounded-full border border-cyan-300/40 px-2 py-1 text-xs text-cyan-200">
                {item.badge}
              </div>
              <p className="text-lg font-semibold text-slate-100 group-hover:text-cyan-100">{item.title}</p>
              <p className="mt-1 text-sm text-slate-400">{item.description}</p>
              <p className="mt-3 text-xs text-cyan-300">{item.href}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

export default function LearningPage() {
    const topics = [
        {
            href: "/hoc-tap/java-core",
            title: "Java Core",
            description: "Lộ trình học tập Java từ cơ bản đến nâng cao, được dịch từ trang web chính thức dev.java.",
            icon: "☕"
        },
        {
            href: "/hoc-tap/tieng-anh",
            title: "Học tiếng Anh",
            description: "Luyện phát âm cơ bản như trẻ tiểu học và nắm cấu trúc câu (danh từ, tính từ, động từ...).",
            icon: "🔤"
        }
    ];

    return (
        <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-10">
            <div className="mb-8">
                <Link
                    href="/"
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition flex items-center gap-2 mb-4"
                >
                    ← Quay lại trang chủ
                </Link>
                <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-5 backdrop-blur md:p-8">
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Learning</p>
                    <h1 className="mt-3 text-2xl font-bold md:text-4xl">Học tập & Tài liệu</h1>
                    <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
                        Tổng hợp các tài liệu học tập và lộ trình phát triển kỹ năng lập trình.
                    </p>
                </div>
            </div>

            <section>
                <h2 className="mb-4 text-lg font-semibold md:text-xl text-slate-100">Khóa học & Tài liệu</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    {topics.map((topic) => (
                        <Link
                            key={topic.href}
                            href={topic.href}
                            className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60 p-6 transition hover:border-cyan-300/50 hover:bg-slate-900"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-2xl">
                                    {topic.icon}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-100 group-hover:text-cyan-200">
                                        {topic.title}
                                    </h3>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                                        {topic.description}
                                    </p>
                                    <div className="mt-4 flex items-center gap-1 text-xs font-medium text-cyan-400">
                                        Bắt đầu học ngay
                                        <span className="transition-transform group-hover:translate-x-1">→</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    );
}

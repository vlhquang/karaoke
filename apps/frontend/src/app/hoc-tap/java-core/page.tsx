import Link from "next/link";

export default function JavaCorePage() {
    return (
        <main className="flex flex-col h-screen bg-slate-950 overflow-hidden">
            {/* Header / Navigation Bar */}
            <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-3 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Link
                        href="/hoc-tap"
                        className="flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-cyan-400 transition"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Quay lại
                    </Link>
                    <div className="h-4 w-px bg-slate-800" />
                    <h1 className="text-sm font-bold text-slate-200">Java Core - Hướng dẫn chính thức</h1>
                </div>

                <div className="hidden md:block">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">Document Viewer</p>
                </div>
            </header>

            {/* Content Area - Iframe */}
            <div className="relative flex-1 bg-white">
                <iframe
                    src="/java-core/index.html"
                    className="absolute inset-0 h-full w-full border-none"
                    title="Java Core Documentation"
                />
            </div>

            {/* Footer / Mobile Hint */}
            <footer className="shrink-0 border-t border-slate-800 bg-slate-900/80 px-4 py-2 md:hidden">
                <p className="text-center text-[10px] text-slate-500">
                    Mẹo: Vuốt để cuộn tài liệu bên trên
                </p>
            </footer>
        </main>
    );
}

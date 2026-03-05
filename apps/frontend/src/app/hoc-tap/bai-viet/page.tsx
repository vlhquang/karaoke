"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Article {
    id: string;
    title: string;
    contentType: "html" | "link";
    content: string;
    createdAt: string;
    updatedAt: string;
}

type SortOrder = "desc" | "asc";
type FormMode = "add" | "edit";

const PAGE_SIZE = 10;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArticlesPage() {
    const [accessCode, setAccessCode] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const [articles, setArticles] = useState<Article[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Detail popup
    const [viewArticle, setViewArticle] = useState<Article | null>(null);

    // Form (add / edit)
    const [showForm, setShowForm] = useState(false);
    const [formMode, setFormMode] = useState<FormMode>("add");
    const [formId, setFormId] = useState("");
    const [formTitle, setFormTitle] = useState("");
    const [formContentType, setFormContentType] = useState<"html" | "link">("html");
    const [formContent, setFormContent] = useState("");
    const [formError, setFormError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Notification
    const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);

    const searchRef = useRef<HTMLInputElement>(null);

    // ── Init ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        const saved = localStorage.getItem("articles_access_code");
        if (saved) {
            setAccessCode(saved);
            setIsLoggedIn(true);
            fetchArticles(saved);
        }
        setIsInitialized(true);
    }, []);

    // ── Notifications ─────────────────────────────────────────────────────────

    const showToast = (msg: string, type: "success" | "info" | "error" = "success") => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // ── API ───────────────────────────────────────────────────────────────────

    const callApi = async (payload: object) => {
        const res = await fetch("/api/articles", {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ ...payload, accessCode }),
        });
        return res.json() as Promise<{ ok: boolean; message?: string; data?: any }>;
    };

    const fetchArticles = async (code?: string) => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/articles", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "list", accessCode: code ?? accessCode }),
            });
            const data = await res.json();
            if (data.ok) {
                setArticles(data.data || []);
            } else {
                showToast(data.message || "Không thể tải bài viết", "error");
            }
        } catch {
            showToast("Lỗi kết nối server", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Login ─────────────────────────────────────────────────────────────────

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");
        setIsLoading(true);
        try {
            const res = await fetch("/api/articles", {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "login", accessCode }),
            });
            const data = await res.json();
            if (data.ok) {
                setIsLoggedIn(true);
                localStorage.setItem("articles_access_code", accessCode);
                fetchArticles(accessCode);
            } else {
                setLoginError(data.message || "Mã truy cập không hợp lệ");
            }
        } catch {
            setLoginError("Lỗi kết nối server");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Form helpers ──────────────────────────────────────────────────────────

    const openAddForm = () => {
        setFormMode("add");
        setFormId("");
        setFormTitle("");
        setFormContentType("html");
        setFormContent("");
        setFormError("");
        setShowForm(true);
    };

    const openEditForm = (article: Article) => {
        setFormMode("edit");
        setFormId(article.id);
        setFormTitle(article.title);
        setFormContentType(article.contentType);
        setFormContent(article.content);
        setFormError("");
        setViewArticle(null);
        setShowForm(true);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        if (!formTitle.trim()) { setFormError("Vui lòng nhập tiêu đề"); return; }
        if (!formContent.trim()) { setFormError("Vui lòng nhập nội dung"); return; }

        setIsSaving(true);
        try {
            const payload = formMode === "add"
                ? { action: "add", title: formTitle.trim(), contentType: formContentType, content: formContent.trim() }
                : { action: "update", id: formId, title: formTitle.trim(), contentType: formContentType, content: formContent.trim() };

            const data = await callApi(payload);
            if (data.ok) {
                if (formMode === "add") {
                    const newArticle: Article = {
                        id: data.data?.id || Date.now().toString(),
                        title: formTitle.trim(),
                        contentType: formContentType,
                        content: formContent.trim(),
                        createdAt: data.data?.createdAt || new Date().toISOString(),
                        updatedAt: data.data?.updatedAt || new Date().toISOString(),
                    };
                    setArticles(prev => [newArticle, ...prev]);
                    showToast("Đã thêm bài viết");
                } else {
                    setArticles(prev => prev.map(a => a.id === formId
                        ? { ...a, title: formTitle.trim(), contentType: formContentType, content: formContent.trim(), updatedAt: data.data?.updatedAt || a.updatedAt }
                        : a
                    ));
                    showToast("Đã cập nhật bài viết", "info");
                }
                setShowForm(false);
            } else {
                setFormError(data.message || "Thao tác thất bại");
            }
        } catch {
            setFormError("Lỗi kết nối server");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (article: Article) => {
        if (!confirm(`Xóa bài viết "${article.title}"?`)) return;
        setIsLoading(true);
        try {
            const data = await callApi({ action: "delete", id: article.id });
            if (data.ok) {
                setArticles(prev => prev.filter(a => a.id !== article.id));
                setViewArticle(null);
                showToast("Đã xóa bài viết");
            } else {
                showToast(data.message || "Xóa thất bại", "error");
            }
        } catch {
            showToast("Lỗi kết nối server", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Derived list ──────────────────────────────────────────────────────────

    const filteredArticles = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let list = q ? articles.filter(a => a.title.toLowerCase().includes(q)) : [...articles];
        list.sort((a, b) => {
            const diff = b.createdAt.localeCompare(a.createdAt);
            return sortOrder === "desc" ? diff : -diff;
        });
        return list;
    }, [articles, searchQuery, sortOrder]);

    const visibleArticles = filteredArticles.slice(0, visibleCount);
    const hasMore = visibleCount < filteredArticles.length;

    const formatDate = (iso: string) => {
        if (!iso) return "";
        try {
            return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
        } catch {
            return iso;
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (!isInitialized) return null;

    if (!isLoggedIn) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
                <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
                    <div className="mb-8 text-center">
                        <div className="mb-3 text-4xl">📝</div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Bài viết</h1>
                        <p className="mt-2 text-slate-400">Nhập mã truy cập để tiếp tục</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            placeholder="Mã truy cập"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-center text-lg outline-none transition focus:border-cyan-500/50"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-2xl bg-cyan-600 py-4 font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition"
                        >
                            {isLoading ? "Đang xác thực..." : "Đăng nhập"}
                        </button>
                    </form>
                    {loginError && <p className="mt-4 text-center text-sm text-red-400">{loginError}</p>}
                    <div className="mt-8 text-center">
                        <Link href="/hoc-tap" className="text-sm text-slate-500 hover:text-cyan-400 transition">
                            ← Học tập
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 p-4 font-sans text-slate-100 md:p-8">
            <div className="mx-auto max-w-3xl">

                {/* Header */}
                <header className="mb-6 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/hoc-tap" className="text-slate-500 hover:text-cyan-400 transition text-sm">← Học tập</Link>
                        <span className="text-slate-700">/</span>
                        <h1 className="text-xl font-black tracking-tight md:text-2xl">📝 Bài viết</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchArticles()}
                            disabled={isLoading}
                            className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs font-medium transition hover:bg-slate-800 disabled:opacity-30"
                        >
                            {isLoading ? "Đang tải..." : "Làm mới"}
                        </button>
                        <button
                            onClick={openAddForm}
                            className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-cyan-500"
                        >
                            + Thêm bài
                        </button>
                    </div>
                </header>

                {/* Search + Sort */}
                <div className="mb-4 flex items-center gap-2">
                    <div className="relative flex-1">
                        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
                            placeholder="Tìm theo tiêu đề..."
                            className="w-full rounded-xl border border-slate-700 bg-slate-800/40 pl-9 pr-4 py-2.5 text-sm outline-none focus:border-cyan-500 transition"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">✕</button>
                        )}
                    </div>
                    <button
                        onClick={() => { setSortOrder(o => o === "desc" ? "asc" : "desc"); setVisibleCount(PAGE_SIZE); }}
                        title={sortOrder === "desc" ? "Mới nhất trước" : "Cũ nhất trước"}
                        className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-xs font-medium transition hover:bg-slate-800 whitespace-nowrap"
                    >
                        {sortOrder === "desc" ? "↓ Mới nhất" : "↑ Cũ nhất"}
                    </button>
                </div>

                {/* Stats */}
                <p className="mb-3 text-[11px] text-slate-600">
                    {filteredArticles.length} bài viết{searchQuery ? ` khớp "${searchQuery}"` : ""}
                </p>

                {/* Articles List */}
                {filteredArticles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 py-20 text-center text-slate-600 text-sm">
                        {searchQuery ? "Không tìm thấy bài viết phù hợp." : "Chưa có bài viết nào. Nhấn \"+ Thêm bài\" để bắt đầu."}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {visibleArticles.map((article, idx) => (
                            <div
                                key={article.id}
                                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition hover:border-slate-700 hover:bg-slate-900/60"
                            >
                                <button
                                    onClick={() => setViewArticle(article)}
                                    className="flex-1 text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-600 font-mono tabular-nums w-5 shrink-0 text-right">
                                            {sortOrder === "desc" ? filteredArticles.length - idx : idx + 1}
                                        </span>
                                        <span className="text-sm font-medium text-slate-200 group-hover:text-white leading-snug line-clamp-2">
                                            {article.title}
                                        </span>
                                        <span className={`ml-1 shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${article.contentType === "link" ? "bg-violet-500/15 text-violet-400" : "bg-cyan-500/10 text-cyan-500"}`}>
                                            {article.contentType === "link" ? "LINK" : "HTML"}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 ml-7 text-[10px] text-slate-600">{formatDate(article.createdAt)}</p>
                                </button>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                    <button
                                        onClick={() => openEditForm(article)}
                                        className="rounded-lg p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition"
                                        title="Sửa"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(article)}
                                        className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                                        title="Xóa"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {hasMore && (
                            <button
                                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                className="mt-2 w-full rounded-xl border border-slate-800 py-3 text-sm text-slate-500 transition hover:border-slate-700 hover:text-slate-300 hover:bg-slate-900/30"
                            >
                                Xem thêm ({filteredArticles.length - visibleCount} bài còn lại)
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Detail Popup ───────────────────────────────────────────────────── */}
            {viewArticle && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6">
                    <div
                        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
                        onClick={() => setViewArticle(null)}
                    />
                    <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
                        {/* Popup header */}
                        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-800 shrink-0">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${viewArticle.contentType === "link" ? "bg-violet-500/15 text-violet-400" : "bg-cyan-500/10 text-cyan-500"}`}>
                                        {viewArticle.contentType === "link" ? "LINK" : "HTML"}
                                    </span>
                                    <span className="text-[10px] text-slate-500">{formatDate(viewArticle.updatedAt)}</span>
                                </div>
                                <h2 className="text-base font-bold text-white leading-snug line-clamp-2">{viewArticle.title}</h2>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    onClick={() => openEditForm(viewArticle)}
                                    className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-cyan-300 hover:border-cyan-700 transition"
                                >
                                    Sửa
                                </button>
                                <button
                                    onClick={() => handleDelete(viewArticle)}
                                    className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 hover:border-red-900 transition"
                                >
                                    Xóa
                                </button>
                                <button
                                    onClick={() => setViewArticle(null)}
                                    className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Popup body */}
                        <div className="flex-1 overflow-hidden">
                            {viewArticle.contentType === "link" ? (
                                <iframe
                                    src={viewArticle.content}
                                    className="w-full h-full"
                                    style={{ minHeight: "60vh" }}
                                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                                    title={viewArticle.title}
                                />
                            ) : (
                                <div
                                    className="h-full overflow-y-auto px-5 py-4 prose prose-invert prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: viewArticle.content }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add / Edit Form Popup ──────────────────────────────────────────── */}
            {showForm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        onClick={() => setShowForm(false)}
                    />
                    <div className="relative w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl flex flex-col max-h-[90vh]">
                        <h3 className="mb-5 text-xl font-bold text-white">
                            {formMode === "add" ? "Thêm bài viết mới" : "Sửa bài viết"}
                        </h3>

                        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 overflow-y-auto">
                            {/* Title */}
                            <div>
                                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Tiêu đề <span className="text-red-400">*</span>
                                </label>
                                <input
                                    autoFocus
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="Nhập tiêu đề bài viết..."
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm outline-none focus:border-cyan-500 transition"
                                    required
                                />
                            </div>

                            {/* Content type toggle */}
                            <div>
                                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Loại nội dung
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormContentType("html")}
                                        className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${formContentType === "html" ? "bg-cyan-600 text-white" : "border border-slate-700 text-slate-400 hover:border-slate-600"}`}
                                    >
                                        📄 Nội dung HTML
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormContentType("link")}
                                        className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${formContentType === "link" ? "bg-violet-600 text-white" : "border border-slate-700 text-slate-400 hover:border-slate-600"}`}
                                    >
                                        🔗 Đường dẫn URL
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex flex-col flex-1">
                                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {formContentType === "link" ? "URL bài viết" : "Nội dung HTML"}{" "}
                                    <span className="text-red-400">*</span>
                                </label>
                                {formContentType === "link" ? (
                                    <input
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        placeholder="https://..."
                                        type="url"
                                        className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-mono outline-none focus:border-violet-500 transition"
                                    />
                                ) : (
                                    <textarea
                                        value={formContent}
                                        onChange={(e) => setFormContent(e.target.value)}
                                        placeholder="<h2>Tiêu đề</h2><p>Nội dung...</p>"
                                        rows={10}
                                        className="w-full flex-1 rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-mono outline-none focus:border-cyan-500 transition resize-none"
                                    />
                                )}
                            </div>

                            {formError && (
                                <p className="text-xs text-red-400 text-center">{formError}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 rounded-2xl border border-slate-700 py-3 font-bold text-slate-400 transition hover:bg-slate-800"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`flex-1 rounded-2xl py-3 font-bold text-white transition disabled:opacity-50 ${formMode === "add" ? "bg-cyan-600 hover:bg-cyan-500" : "bg-violet-600 hover:bg-violet-500"}`}
                                >
                                    {isSaving ? "Đang lưu..." : (formMode === "add" ? "Thêm bài viết" : "Lưu thay đổi")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Toast ─────────────────────────────────────────────────────────── */}
            {notification && (
                <div className="fixed bottom-8 left-1/2 z-[120] -translate-x-1/2 animate-bounce">
                    <div className={`flex items-center gap-3 rounded-full border px-6 py-3 shadow-2xl backdrop-blur-xl ${notification.type === "error"
                            ? "border-red-500/50 bg-red-950/80 text-red-300"
                            : notification.type === "info"
                                ? "border-cyan-500/50 bg-cyan-950/80 text-cyan-300"
                                : "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                        }`}>
                        <span className="text-xs font-bold uppercase tracking-widest">{notification.msg}</span>
                    </div>
                </div>
            )}
        </main>
    );
}

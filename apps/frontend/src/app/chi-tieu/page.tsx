"use client";

import { useEffect, useRef, useState } from "react";
import { useChiTieuStore } from "../../store/chi-tieu-store";
import LoginCard from "../../chi-tieu/components/LoginCard";
import QuickEntryForm from "../../chi-tieu/components/QuickEntryForm";
import TransactionForm from "../../chi-tieu/components/TransactionForm";
import SummaryReport from "../../chi-tieu/components/SummaryReport";
import SettingsPanel from "../../chi-tieu/components/SettingsPanel";

type Tab = "quick" | "input" | "summary" | "settings";

export default function ChiTieuPage() {
  const initialized = useChiTieuStore((s) => s.initialized);
  const accessCode = useChiTieuStore((s) => s.accessCode);
  const loading = useChiTieuStore((s) => s.loading);
  const login = useChiTieuStore((s) => s.login);
  const loadAll = useChiTieuStore((s) => s.loadAll);
  const logout = useChiTieuStore((s) => s.logout);
  const [tab, setTab] = useState<Tab>("quick");

  // Khi session được restore từ localStorage (initialized = true ngay từ đầu),
  // login() không được gọi nên loadAll() cũng không chạy — refresh dữ liệu ở nền.
  const wasInitializedOnMount = useRef(initialized);
  useEffect(() => {
    if (wasInitializedOnMount.current) {
      void loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized && accessCode) {
      void login(accessCode);
    }
  }, [initialized, accessCode, login]);

  if (!initialized) {
    return <LoginCard />;
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-cyan-300/20 bg-slate-950/40 p-5 backdrop-blur md:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Mini-app</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-100 md:text-4xl">Quản lý Chi tiêu</h1>
          <p className="mt-2 text-sm text-slate-300">Theo dõi thu/chi cá nhân với Google Sheets.</p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-rose-400 hover:text-rose-200"
        >
          Đăng xuất
        </button>
      </div>

      <nav className="mt-5 flex flex-wrap gap-2">
        {([
          { key: "quick", label: "⚡ Nhanh" },
          { key: "input", label: "Nhập" },
          { key: "summary", label: "Tổng hợp" },
          { key: "settings", label: "Cài đặt" }
        ] as const).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              tab === item.key
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                : "border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="mt-5">
        {tab === "quick" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
            <QuickEntryForm onSuccess={() => setTab("summary")} />
          </div>
        )}
        {tab === "input" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
            <TransactionForm />
          </div>
        )}
        {tab === "summary" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
            <SummaryReport />
          </div>
        )}
        {tab === "settings" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 md:p-6">
            <SettingsPanel />
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useChiTieuStore } from "../../store/chi-tieu-store";

export default function LoginCard() {
  const login = useChiTieuStore((s) => s.login);
  const loading = useChiTieuStore((s) => s.loading);
  const errorMessage = useChiTieuStore((s) => s.errorMessage);
  const clearError = useChiTieuStore((s) => s.clearError);
  const [code, setCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(code.trim());
  };

  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-700 bg-slate-900/60 p-6 shadow">
      <h1 className="text-2xl font-bold text-slate-100">Quản lý Chi tiêu</h1>
      <p className="mt-2 text-sm text-slate-500">Nhập mã truy cập để sử dụng.</p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Mã truy cập"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      {errorMessage && <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>}
    </div>
  );
}

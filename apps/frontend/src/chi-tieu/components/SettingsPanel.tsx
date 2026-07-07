"use client";

import { useChiTieuStore } from "../../store/chi-tieu-store";

export default function SettingsPanel() {
  const settings = useChiTieuStore((s) => s.settings);
  const setSettings = useChiTieuStore((s) => s.setSettings);
  const loading = useChiTieuStore((s) => s.loading);
  const errorMessage = useChiTieuStore((s) => s.errorMessage);
  const clearError = useChiTieuStore((s) => s.clearError);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    const raw = Number(e.target.value);
    const value = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 28) : 5;
    setSettings({ salaryDay: value });
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-lg font-semibold text-slate-100">Cài đặt chu kỳ lương</h3>
      <label className="mb-1 block text-xs text-slate-400">Ngày nhận lương (1 - 28)</label>
      <input
        type="number"
        min={1}
        max={28}
        value={settings.salaryDay}
        onChange={handleChange}
        disabled={loading}
        className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 disabled:opacity-50"
      />
      {errorMessage && <p className="mt-2 text-xs text-red-300">{errorMessage}</p>}
    </div>
  );
}

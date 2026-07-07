"use client";

import { useState, useMemo } from "react";
import type { Loai, Transaction } from "../../store/chi-tieu-store";
import { useChiTieuStore } from "../../store/chi-tieu-store";
import CategorySelect from "./CategorySelect";
import { suggestAmounts } from "../lib/suggest";
import { formatMoney } from "../lib/format";

interface QuickEntryFormProps {
  onSuccess?: () => void;
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getHistorySuggestions(transactions: Transaction[], category: string, loai: Loai): number[] {
  if (!category.trim()) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const tx of transactions) {
    if (tx.category === category && tx.loai === loai && !seen.has(tx.soTien)) {
      seen.add(tx.soTien);
      result.push(tx.soTien);
      if (result.length === 3) break;
    }
  }
  return result;
}

export default function QuickEntryForm({ onSuccess }: QuickEntryFormProps) {
  const addTransaction = useChiTieuStore((s) => s.addTransaction);
  const transactions = useChiTieuStore((s) => s.transactions);
  const errorMessage = useChiTieuStore((s) => s.errorMessage);
  const clearError = useChiTieuStore((s) => s.clearError);

  const [date, setDate] = useState(() => toLocalDatetimeString(new Date()));
  const [rawDigits, setRawDigits] = useState("");
  const [loai, setLoai] = useState<Loai>("chi");
  const [category, setCategory] = useState("");

  const displayAmount = rawDigits ? Number(rawDigits).toLocaleString("vi-VN") : "";
  const amount = Number(rawDigits) || 0;
  const canSubmit = amount > 0 && category.trim().length > 0;

  const suggestions = useMemo(() => {
    const hist = getHistorySuggestions(transactions, category, loai);
    return hist.length > 0 ? hist : suggestAmounts(rawDigits);
  }, [transactions, category, loai, rawDigits]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawDigits(e.target.value.replace(/[^\d]/g, ""));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    clearError();
    const payload = { loai, category: category.trim(), soTien: amount, date };
    // Reset ngay để nhập giao dịch tiếp theo, không chờ API
    setRawDigits("");
    setCategory("");
    onSuccess?.();
    void addTransaction(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Ngày giờ + Thu/Chi */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value || toLocalDatetimeString(new Date()))}
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 [color-scheme:dark]"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setLoai("thu")}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              loai === "thu"
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                : "border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            Thu
          </button>
          <button
            type="button"
            onClick={() => setLoai("chi")}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              loai === "chi"
                ? "border-rose-400 bg-rose-500/20 text-rose-100"
                : "border-slate-700 text-slate-400 hover:border-slate-600"
            }`}
          >
            Chi
          </button>
        </div>
      </div>

      {/* Số tiền */}
      <div>
        <input
          type="text"
          inputMode="numeric"
          value={displayAmount}
          onChange={handleAmountChange}
          placeholder="Số tiền"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-lg text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400"
        />
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRawDigits(String(s))}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-cyan-400 hover:text-cyan-200"
              >
                {formatMoney(s)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loại giao dịch */}
      <CategorySelect loai={loai} value={category} onChange={setCategory} />

      {errorMessage && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        Lưu
      </button>
    </form>
  );
}

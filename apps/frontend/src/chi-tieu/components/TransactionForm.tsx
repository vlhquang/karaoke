"use client";

import { useState } from "react";
import type { Loai } from "../../store/chi-tieu-store";
import { useChiTieuStore } from "../../store/chi-tieu-store";
import AmountInput from "./AmountInput";
import CategorySelect from "./CategorySelect";

interface TransactionFormProps {
  onSuccess?: () => void;
}

export default function TransactionForm({ onSuccess }: TransactionFormProps) {
  const addTransaction = useChiTieuStore((s) => s.addTransaction);
  const loading = useChiTieuStore((s) => s.loading);
  const errorMessage = useChiTieuStore((s) => s.errorMessage);
  const clearError = useChiTieuStore((s) => s.clearError);

  const [loai, setLoai] = useState<Loai>("chi");
  const [amount, setAmount] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  const canSubmit = amount !== "" && Number(amount) > 0 && category.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    clearError();
    await addTransaction({
      loai,
      category: category.trim(),
      soTien: Number(amount),
      note: note.trim()
    });
    setAmount("");
    setCategory("");
    setNote("");
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setLoai("thu")}
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
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
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            loai === "chi"
              ? "border-rose-400 bg-rose-500/20 text-rose-100"
              : "border-slate-700 text-slate-400 hover:border-slate-600"
          }`}
        >
          Chi
        </button>
      </div>

      <AmountInput value={amount} onChange={setAmount} />

      <CategorySelect loai={loai} value={category} onChange={setCategory} />

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ghi chú (tuỳ chọn)"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
      />

      {errorMessage && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Đang lưu..." : "Lưu"}
      </button>
    </form>
  );
}

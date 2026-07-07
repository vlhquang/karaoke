"use client";

import { useMemo, useState } from "react";
import { useChiTieuStore, type Loai } from "../../store/chi-tieu-store";
import DateRangePicker from "./DateRangePicker";
import { formatMoney, formatDateVi, getSalaryCycle } from "../lib/format";

const LOAI_LABEL: Record<Loai, string> = {
  thu: "Thu",
  chi: "Chi"
};

export default function SummaryReport() {
  const transactions = useChiTieuStore((s) => s.transactions);
  const categories = useChiTieuStore((s) => s.categories);
  const settings = useChiTieuStore((s) => s.settings);
  const deleteTransaction = useChiTieuStore((s) => s.deleteTransaction);
  const loading = useChiTieuStore((s) => s.loading);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!from && !to) return transactions;
    return transactions.filter((tx) => {
      const ts = new Date(tx.createdAt).getTime();
      if (Number.isNaN(ts)) return false;
      const fromStamp = from ? new Date(from).getTime() : -Infinity;
      const toStamp = to ? new Date(to).getTime() + 86400000 : Infinity;
      return ts >= fromStamp && ts < toStamp;
    });
  }, [transactions, from, to]);

  const summary = useMemo(() => {
    const thu = filtered.filter((t) => t.loai === "thu").reduce((acc, t) => acc + t.soTien, 0);
    const chi = filtered.filter((t) => t.loai === "chi").reduce((acc, t) => acc + t.soTien, 0);
    return { thu, chi, delta: thu - chi };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, { loai: Loai; mau: string; total: number; count: number }>();
    filtered.forEach((tx) => {
      const key = tx.category;
      if (!map.has(key)) {
        map.set(key, {
          loai: tx.loai,
          mau: categories.find((c) => c.ten === key)?.mau ?? "#64748b",
          total: 0,
          count: 0
        });
      }
      const entry = map.get(key)!;
      entry.total += tx.soTien;
      entry.count += 1;
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => {
        if (a.loai === b.loai) {
          return b.total - a.total;
        }
        return a.loai === "chi" ? 1 : -1;
      });
  }, [filtered, categories]);

  const setSalaryCycle = () => {
    const { from: f, to: t } = getSalaryCycle(settings.salaryDay);
    setFrom(f.toISOString().slice(0, 10));
    setTo(t.toISOString().slice(0, 10));
  };

  const handleDelete = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteTransaction(id);
  };

  const thuWidth = summary.thu + summary.chi === 0 ? "0%" : `${(summary.thu / (summary.thu + summary.chi)) * 100}%`;
  const chiWidth = summary.thu + summary.chi === 0 ? "0%" : `${(summary.chi / (summary.thu + summary.chi)) * 100}%`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-100">Bộ lọc</h3>
        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
        <button
          type="button"
          onClick={setSalaryCycle}
          className="mt-3 rounded-lg border border-cyan-400/40 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/10"
        >
          Kỳ lương này (ngày {settings.salaryDay})
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs text-emerald-200">Tổng Thu</p>
          <p className="mt-1 text-2xl font-bold text-emerald-100">{formatMoney(summary.thu)}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-xs text-rose-200">Tổng Chi</p>
          <p className="mt-1 text-2xl font-bold text-rose-100">{formatMoney(summary.chi)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${summary.delta >= 0 ? "border-cyan-500/30 bg-cyan-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
          <p className="text-xs text-slate-300">Chênh lệch</p>
          <p className={`mt-1 text-2xl font-bold ${summary.delta >= 0 ? "text-cyan-100" : "text-amber-100"}`}>{formatMoney(summary.delta)}</p>
        </div>
      </div>

      <div className="flex h-3 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: thuWidth }} />
        <div className="h-full bg-rose-500 transition-all" style={{ width: chiWidth }} />
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-100">Theo mục lục</h3>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có giao dịch trong khoảng thời gian này.</p>
        ) : (
          <div className="space-y-2">
            {grouped.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.mau }} />
                  <span className="text-sm text-slate-200">{item.name}</span>
                  <span className="text-xs text-slate-500">({item.count})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{LOAI_LABEL[item.loai]}</span>
                  <span className="text-sm font-semibold text-slate-100">{formatMoney(item.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-lg font-semibold text-slate-100">Danh sách giao dịch</h3>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Không có giao dịch.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-700 text-left text-xs text-slate-400">
                <tr>
                  <th className="pb-2 pr-4">Ngày</th>
                  <th className="pb-2 pr-4">Loại</th>
                  <th className="pb-2 pr-4">Mục lục</th>
                  <th className="pb-2 pr-4 text-right">Số tiền</th>
                  <th className="pb-2 pr-4">Ghi chú</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="group">
                    <td className="py-2 pr-4 text-slate-300">{formatDateVi(tx.createdAt)}</td>
                    <td className="py-2 pr-4">
                      <span className={tx.loai === "thu" ? "text-emerald-300" : "text-rose-300"}>
                        {LOAI_LABEL[tx.loai]}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-200">{tx.category}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-slate-100">
                      {formatMoney(tx.soTien)}
                    </td>
                    <td className="py-2 pr-4 text-slate-400">{tx.note || "-"}</td>
                    <td className="py-2 text-right">
                      {confirmDeleteId === tx.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            onClick={() => void handleDelete(tx.id)}
                            disabled={loading}
                            className="rounded px-2 py-0.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                          >
                            Xoá
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-700"
                          >
                            Huỷ
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(tx.id)}
                          className="rounded p-1 text-slate-600 opacity-0 hover:bg-slate-700 hover:text-rose-300 group-hover:opacity-100"
                          title="Xoá giao dịch"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

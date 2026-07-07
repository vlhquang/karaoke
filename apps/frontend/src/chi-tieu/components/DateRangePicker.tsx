"use client";

import { useState } from "react";
import { formatDateVi, toIsoDateString, startOfMonth, endOfMonth } from "../lib/format";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export default function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const today = new Date();

  const setQuick = (label: "this_month" | "last_month" | string) => {
    if (label === "this_month") {
      const f = startOfMonth(today);
      const t = endOfMonth(today);
      onChange(toIsoDateString(f), toIsoDateString(t));
    } else if (label === "last_month") {
      const f = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      const t = endOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      onChange(toIsoDateString(f), toIsoDateString(t));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setQuick("this_month")}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400 hover:text-cyan-200"
        >
          Tháng này
        </button>
        <button
          type="button"
          onClick={() => setQuick("last_month")}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400 hover:text-cyan-200"
        >
          Tháng trước
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Từ ngày</label>
          <input
            type="date"
            value={from}
            max={to || toIsoDateString(today)}
            onChange={(e) => onChange(e.target.value, to)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Đến ngày</label>
          <input
            type="date"
            value={to}
            min={from}
            max={toIsoDateString(today)}
            onChange={(e) => onChange(from, e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
          />
        </div>
      </div>
      {(from || to) && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            {from ? formatDateVi(from) : "..."} - {to ? formatDateVi(to) : "..."}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange("", "");
              setQuick("this_month");
            }}
            className="text-cyan-300 hover:text-cyan-200"
          >
            Xóa
          </button>
        </div>
      )}
    </div>
  );
}

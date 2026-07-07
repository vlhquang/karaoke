"use client";

import { useState } from "react";
import { suggestAmounts } from "../lib/suggest";

interface AmountInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
}

export default function AmountInput({ value, onChange, placeholder = "Số tiền" }: AmountInputProps) {
  const [raw, setRaw] = useState(value === "" ? "" : String(value));

  const suggestions = suggestAmounts(raw);

  const handleChange = (next: string) => {
    const cleaned = next.replace(/[^\d]/g, "");
    setRaw(cleaned);
    if (!cleaned) {
      onChange("");
    } else {
      onChange(Number(cleaned));
    }
  };

  const applySuggestion = (amount: number) => {
    setRaw(String(amount));
    onChange(amount);
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => applySuggestion(amount)}
              className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10"
            >
              {amount.toLocaleString("vi-VN")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

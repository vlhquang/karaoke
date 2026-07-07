"use client";

import { useState, useEffect, useRef } from "react";
import type { Category, Loai } from "../../store/chi-tieu-store";
import { useChiTieuStore } from "../../store/chi-tieu-store";

interface CategorySelectProps {
  loai: Loai;
  value: string;
  onChange: (value: string) => void;
}

export default function CategorySelect({ loai, value, onChange }: CategorySelectProps) {
  const categories = useChiTieuStore((s) => s.categories);
  const upsertCategory = useChiTieuStore((s) => s.upsertCategory);
  const [query, setQuery] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const suggestions = categories.filter(
    (c) => c.loai === loai && c.ten.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
    onChange(next);
    setShowSuggestions(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (ten: string) => {
    setQuery(ten);
    onChange(ten);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleBlur = async () => {
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    if (query.trim() && !suggestions.some((c) => c.ten === query.trim())) {
      await upsertCategory(query.trim(), loai);
      onChange(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelect(suggestions[highlightedIndex].ten);
      } else {
        handleBlur();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-suggestion]");
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={`Chọn/nhập mục ${loai === "thu" ? "thu" : "chi"}`}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg"
        >
          {suggestions.map((cat, idx) => (
            <li
              key={cat.ten}
              data-suggestion
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(cat.ten);
              }}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                idx === highlightedIndex ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: cat.mau }}
              />
              {cat.ten}
            </li>
          ))}
        </ul>
      )}
      {showSuggestions && query.trim() && !suggestions.some((c) => c.ten === query.trim()) && (
        <p className="mt-1 text-xs text-slate-500">
          Nhấn Enter hoặc click ra ngoài để tạo mục mới
        </p>
      )}
    </div>
  );
}

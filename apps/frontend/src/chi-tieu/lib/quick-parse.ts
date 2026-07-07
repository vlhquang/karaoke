export interface QuickParseResult {
  amount: number;
  category: string;
  loai: "thu" | "chi";
  confidence: "high" | "low";
}

const THU_KEYWORDS = ["nhận", "lương", "thưởng", "hoàn", "được", "bán", "thu nhập"];

// Matches: 35  /  35.000  /  1.5  /  1,5  /  40k  /  1.5tr  /  2m
const AMOUNT_RE = /(\d+(?:[.,]\d+)*)\s*(tr|m|k|đ)?(?=\s|$)/i;

function parseAmountToken(numStr: string, unit: string): number {
  const normalized = numStr.replace(/,/g, ".");
  const parts = normalized.split(".");

  let base: number;
  if (unit) {
    // Dot/comma is decimal separator when unit is present: "1.5tr" → 1.5
    base = parseFloat(normalized);
  } else if (parts.length > 1 && parts[parts.length - 1].length === 3) {
    // Thousands-separator format: "35.000" → 35000, "1.500.000" → 1500000
    base = parseInt(parts.join(""), 10);
  } else {
    base = parseFloat(normalized);
  }

  if (!isFinite(base)) return 0;

  const u = unit.toLowerCase();
  if (u === "tr" || u === "m") return Math.round(base * 1_000_000);
  if (u === "k") return Math.round(base * 1_000);
  return Math.round(base);
}

export function parseQuickEntry(text: string): QuickParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { amount: 0, category: "", loai: "chi", confidence: "low" };

  const lower = trimmed.toLowerCase();
  const loai: "thu" | "chi" = THU_KEYWORDS.some((kw) => lower.includes(kw)) ? "thu" : "chi";

  const match = AMOUNT_RE.exec(trimmed);
  if (!match) {
    return { amount: 0, category: trimmed, loai, confidence: "low" };
  }

  const amount = parseAmountToken(match[1], match[2] ?? "");
  const category = (trimmed.slice(0, match.index) + trimmed.slice(match.index + match[0].length))
    .replace(/\s+/g, " ")
    .trim();

  return {
    amount,
    category: category || trimmed,
    loai,
    confidence: amount > 0 && category.length > 0 ? "high" : "low"
  };
}

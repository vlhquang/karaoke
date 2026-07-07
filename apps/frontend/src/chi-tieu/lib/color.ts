export const PALETTE = [
  "#0D9488",
  "#7C3AED",
  "#2563EB",
  "#DB2777",
  "#D97706",
  "#059669",
  "#DC2626",
  "#4F46E5",
  "#BE185D",
  "#0891B2",
  "#65A30D",
  "#A21CAF",
];

export function hashColor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}

export function textColorFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#f8fafc";
}

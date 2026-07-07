export function suggestAmounts(raw: string): number[] {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return [];
  return [2, 3, 4].map((z) => Number(digits + "0".repeat(z)));
}

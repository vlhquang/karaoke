export function suggestAmounts(raw: string): number[] {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return [];
  return [3, 4, 5].map((z) => Number(digits + "0".repeat(z)));
}

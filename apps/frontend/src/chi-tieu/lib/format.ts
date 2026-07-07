export function formatMoney(value: number | string | undefined | null): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "";
  return Math.round(number).toLocaleString("vi-VN");
}

export function parseMoney(raw: string | number | undefined | null): number {
  const cleaned = String(raw ?? "").replace(/[^\d]/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

export function formatDateVi(value: string | number | Date | undefined | null): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("vi-VN");
    }
  }

  const raw = String(value).trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("vi-VN");
  }

  return raw;
}

export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getSalaryCycle(salaryDay: number, from?: Date): { from: Date; to: Date } {
  const day = Math.min(Math.max(salaryDay, 1), 28);
  const now = from ?? new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisSalary = new Date(now.getFullYear(), now.getMonth(), day);
  const lastSalary = new Date(now.getFullYear(), now.getMonth() - 1, day);

  const safeSalaryDay = (d: Date, month: Date) => {
    const maxDay = endOfMonth(month).getDate();
    return new Date(d.getFullYear(), d.getMonth(), Math.min(d.getDate(), maxDay));
  };

  const fromDate = safeSalaryDay(lastSalary, lastMonth);
  const toDate = safeSalaryDay(thisSalary, thisMonth);

  return {
    from: fromDate,
    to: toDate >= now ? toDate : new Date(toDate.getFullYear(), toDate.getMonth() + 1, Math.min(day, endOfMonth(new Date(toDate.getFullYear(), toDate.getMonth() + 1, 1)).getDate()))
  };
}

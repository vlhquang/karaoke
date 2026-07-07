"use client";

import { create } from "zustand";
import { hashColor, textColorFor } from "../chi-tieu/lib/color";
import { formatMoney, formatDateVi } from "../chi-tieu/lib/format";

export type Loai = "thu" | "chi";

export interface Category {
  ten: string;
  loai: Loai;
  mau: string;
}

export interface Transaction {
  id: number;
  loai: Loai;
  category: string;
  soTien: number;
  note?: string;
  createdAt: string;
}

export interface Settings {
  salaryDay: number;
}

export interface ChiTieuState {
  accessCode: string;
  initialized: boolean;
  loading: boolean;
  errorMessage: string;
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
  post: (payload: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; message?: string }>;
  login: (accessCode: string) => Promise<void>;
  loadAll: () => Promise<void>;
  addTransaction: (input: {
    loai: Loai;
    category: string;
    soTien: number;
    note?: string;
  }) => Promise<void>;
  upsertCategory: (ten: string, loai: Loai) => Promise<void>;
  setSettings: (settings: Partial<Settings>) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const ACCESS_CODE_KEY = "chitieu_access_code";
const CACHE_KEY = "chitieu_cache_v1";

type SetFn = (fn: (state: ChiTieuState) => Partial<ChiTieuState>) => void;
type GetFn = () => ChiTieuState;

const saveAccessCode = (code: string) => {
  try {
    localStorage.setItem(ACCESS_CODE_KEY, code);
  } catch {}
};

const loadAccessCode = (): string => {
  try {
    return localStorage.getItem(ACCESS_CODE_KEY) || "";
  } catch {
    return "";
  }
};

const clearAccessCode = () => {
  try {
    localStorage.removeItem(ACCESS_CODE_KEY);
  } catch {}
};

const saveCache = (state: Pick<ChiTieuState, "transactions" | "categories" | "settings">) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        transactions: state.transactions,
        categories: state.categories,
        settings: state.settings
      })
    );
  } catch {}
};

const loadCache = (): Pick<ChiTieuState, "transactions" | "categories" | "settings"> => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { transactions: [], categories: [], settings: { salaryDay: 5 } };
    const parsed = JSON.parse(raw) as {
      transactions?: Transaction[];
      categories?: Category[];
      settings?: Settings;
    };
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      settings: parsed.settings ?? { salaryDay: 5 }
    };
  } catch {
    return { transactions: [], categories: [], settings: { salaryDay: 5 } };
  }
};

const postAction = async (
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; message?: string }> => {
  const response = await fetch("/api/chi-tieu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  let body: { ok: boolean; data?: unknown; message?: string } | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body?.message || "Khong goi duoc API";
    const details = body?.message ? "" : ` - ${response.statusText}`;
    throw new Error(`${message}${details}`);
  }
  if (!body) {
    throw new Error("Phan hoi khong hop le tu server");
  }
  return body;
};

export const useChiTieuStore = create<ChiTieuState>((set, get) => {
  const cache = loadCache();
  return {
    accessCode: loadAccessCode(),
    initialized: false,
    loading: false,
    errorMessage: "",
    transactions: cache.transactions,
    categories: cache.categories,
    settings: cache.settings,

    post: async (payload) => {
      const { accessCode } = get();
      const body = await postAction({ ...payload, accessCode });
      return body;
    },

    login: async (accessCode) => {
      set(() => ({ loading: true, errorMessage: "" }));
      try {
        const result = await get().post({ action: "login", accessCode });
        if (!result.ok) {
          throw new Error(result.message || "Sai ma truy cap");
        }
        saveAccessCode(accessCode);
        set(() => ({ accessCode, initialized: true }));
        await get().loadAll();
      } catch (error) {
        clearAccessCode();
        set(() => ({
          accessCode: "",
          initialized: false,
          errorMessage: error instanceof Error ? error.message : "Dang nhap that bai"
        }));
      } finally {
        set(() => ({ loading: false }));
      }
    },

    loadAll: async () => {
      set(() => ({ loading: true, errorMessage: "" }));
      try {
        const [txResult, catResult, cfgResult] = await Promise.all([
          get().post({ action: "list" }),
          get().post({ action: "list_categories" }),
          get().post({ action: "get_config" })
        ]);

        if (!txResult.ok) throw new Error((txResult as { ok: false; message?: string }).message || "Khong tai duoc giao dich");
        if (!catResult.ok) throw new Error((catResult as { ok: false; message?: string }).message || "Khong tai duoc muc luc");
        if (!cfgResult.ok) throw new Error((cfgResult as { ok: false; message?: string }).message || "Khong tai duoc cau hinh");

        const transactions = (txResult as { ok: true; data: Transaction[] }).data ?? [];
        const categories = (catResult as { ok: true; data: Category[] }).data ?? [];
        const config = (cfgResult as { ok: true; data: Record<string, unknown> }).data ?? {};
        const salaryDay = Number(config.SALARY_DAY ?? 5);
        const settings: Settings = { salaryDay: Number.isFinite(salaryDay) ? salaryDay : 5 };

        set(() => ({ transactions, categories, settings }));
        saveCache({ transactions, categories, settings });
      } catch (error) {
        set(() => ({
          errorMessage: error instanceof Error ? error.message : "Tai du lieu that bai"
        }));
      } finally {
        set(() => ({ loading: false }));
      }
    },

    addTransaction: async (input) => {
      set(() => ({ loading: true, errorMessage: "" }));
      try {
        const result = await get().post({
          action: "add",
          loai: input.loai,
          category: input.category,
          soTien: input.soTien,
          note: input.note || ""
        });
        if (!result.ok) {
          throw new Error((result as { ok: false; message?: string }).message || "Them giao dich that bai");
        }

        const data = (result as { ok: true; data: { id: number; category: Category } }).data;
        const category = data.category ?? {
          ten: input.category,
          loai: input.loai,
          mau: hashColor(input.category)
        };
        const transaction: Transaction = {
          id: data.id,
          loai: input.loai,
          category: input.category,
          soTien: input.soTien,
          note: input.note,
          createdAt: new Date().toISOString()
        };

        set((state) => {
          const exists = state.categories.some((c) => c.ten === category.ten);
          const categories = exists ? state.categories : [...state.categories, category];
          const transactions = [transaction, ...state.transactions];
          saveCache({ transactions, categories, settings: state.settings });
          return { transactions, categories };
        });
      } catch (error) {
        set(() => ({
          errorMessage: error instanceof Error ? error.message : "Them giao dich that bai"
        }));
      } finally {
        set(() => ({ loading: false }));
      }
    },

    upsertCategory: async (ten, loai) => {
      const result = await get().post({ action: "upsert_category", ten, loai });
      if (result.ok) {
        const mau = hashColor(ten);
        set((state) => {
          const exists = state.categories.some((c) => c.ten === ten);
          const categories = exists ? state.categories : [...state.categories, { ten, loai, mau }];
          saveCache({ transactions: state.transactions, categories, settings: state.settings });
          return { categories };
        });
      }
    },

    setSettings: async (settings) => {
      set(() => ({ loading: true, errorMessage: "" }));
      try {
        const result = await get().post({ action: "save_config", data: settings });
        if (!result.ok) {
          throw new Error((result as { ok: false; message?: string }).message || "Luu cau hinh that bai");
        }
        set((state) => {
          const next = { ...state.settings, ...settings };
          saveCache({ transactions: state.transactions, categories: state.categories, settings: next });
          return { settings: next };
        });
      } catch (error) {
        set(() => ({
          errorMessage: error instanceof Error ? error.message : "Luu cau hinh that bai"
        }));
      } finally {
        set(() => ({ loading: false }));
      }
    },

    logout: () => {
      clearAccessCode();
      set(() => ({
        accessCode: "",
        initialized: false,
        transactions: [],
        categories: [],
        settings: { salaryDay: 5 },
        errorMessage: ""
      }));
    },

    clearError: () => set(() => ({ errorMessage: "" }))
  };
});

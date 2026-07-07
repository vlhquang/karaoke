import { scrapeStockPrice } from "./stock-scraper";

const getScriptUrl = (): string => process.env.STOCK_APPS_SCRIPT_URL ?? "";
const getAccessCode = (): string => process.env.STOCK_ACCESS_CODE ?? "";

const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 120;
const DEFAULT_INTERVAL_MINUTES = clampNumber(
  Number(process.env.STOCK_AUTO_REFRESH_DEFAULT_MINUTES ?? 1),
  MIN_INTERVAL_MINUTES,
  MAX_INTERVAL_MINUTES
);
const CONFIG_POLL_MS = Math.max(15_000, Number(process.env.STOCK_AUTO_REFRESH_CONFIG_POLL_MS ?? 60_000));

type StockConfig = {
  intervalMinutes: number;
};

export type StockAutoRefreshStatus = {
  running: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: "idle" | "updated" | "skipped" | "error";
  lastMessage: string;
};

type MarketTimeInfo = {
  dayName: string;
  hour: number;
  minute: number;
  second: number;
};

export type StockAutoRefreshResult =
  | {
      ok: true;
      status: "skipped";
      reason: string;
      time?: MarketTimeInfo;
      config?: StockConfig;
    }
  | {
      ok: true;
      status: "updated";
      updatedCount: number;
      symbols: string[];
      details?: string;
      config?: StockConfig;
    };

type RunOptions = {
  skipMarketHourCheck?: boolean;
};

const status: StockAutoRefreshStatus = {
  running: false,
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  lastRunAt: null,
  nextRunAt: null,
  lastStatus: "idle",
  lastMessage: "Worker not started"
};

export async function runStockAutoRefreshOnce(options: RunOptions = {}): Promise<StockAutoRefreshResult> {
  const scriptUrl = getScriptUrl();
  const accessCode = getAccessCode();
  if (!scriptUrl || !accessCode) {
    throw new Error("Missing STOCK_APPS_SCRIPT_URL or STOCK_ACCESS_CODE");
  }

  const config = await getAutoRefreshConfig(scriptUrl, accessCode);

  const market = getMarketTimeInfo(new Date());
  const isMarketDay = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(market.dayName);
  const isMarketHour = isWithinTimeRange(market);

  if (!options.skipMarketHourCheck && (!isMarketDay || !isMarketHour)) {
    return {
      ok: true,
      status: "skipped",
      reason: "Outside market hours (Mon-Fri 09:00-15:00)",
      time: market,
      config
    };
  }

  const transactions = await fetchStockList(scriptUrl, accessCode);
  const uniqueSymbols = Array.from(
    new Set(transactions.filter((tx: any) => tx.status === "HOLD").map((tx: any) => String(tx.symbol ?? "").toUpperCase()))
  ).filter(Boolean);

  if (uniqueSymbols.length === 0) {
    return {
      ok: true,
      status: "skipped",
      reason: "No active stocks to update",
      config
    };
  }

  const priceResults: Record<string, any> = {};
  await Promise.allSettled(
    uniqueSymbols.map(async (symbol) => {
      const result = await scrapeStockPrice(symbol, true);
      if (!result) return;

      priceResults[symbol] = result;

      // Push each symbol immediately so UI can reflect incremental progress.
      await postAppsScript(
        {
          action: "update_prices",
          accessCode,
          prices: { [symbol]: result }
        },
        scriptUrl
      );
    })
  );

  const updateData = {
    message:
      Object.keys(priceResults).length > 0
        ? "Incremental updates completed"
        : "No symbols updated"
  };

  return {
    ok: true,
    status: "updated",
    updatedCount: Object.keys(priceResults).length,
    symbols: Object.keys(priceResults),
    details: String(updateData?.message ?? ""),
    config
  };
}

export function startStockAutoRefreshWorker() {
  const scriptUrl = getScriptUrl();
  const accessCode = getAccessCode();
  if (!scriptUrl || !accessCode) {
    console.warn("[Stock Auto Refresh] Skip worker: missing STOCK_APPS_SCRIPT_URL/STOCK_ACCESS_CODE.");
    status.lastStatus = "error";
    status.lastMessage = "Missing STOCK_APPS_SCRIPT_URL/STOCK_ACCESS_CODE";
    return;
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const schedule = (ms: number) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    status.nextRunAt = new Date(Date.now() + Math.max(ms, 0)).toISOString();
    timer = setTimeout(runCycle, ms);
  };

  const runCycle = async () => {
    if (stopped || running) return;
    running = true;
    status.running = true;
    status.lastRunAt = new Date().toISOString();
    status.nextRunAt = new Date(Date.now() + status.intervalMinutes * 60_000).toISOString();
    status.lastMessage = "Cron is running...";

    try {
      const cycleScriptUrl = getScriptUrl();
      const cycleAccessCode = getAccessCode();
      if (!cycleScriptUrl || !cycleAccessCode) {
        throw new Error("Missing STOCK_APPS_SCRIPT_URL or STOCK_ACCESS_CODE");
      }
      const config = await getAutoRefreshConfig(cycleScriptUrl, cycleAccessCode);
      status.intervalMinutes = config.intervalMinutes;
      const result = await runStockAutoRefreshOnce();
      if (result.status === "updated") {
        status.lastStatus = "updated";
        status.lastMessage = `Updated ${result.updatedCount} symbol(s)`;
        console.log(
          `[Stock Auto Refresh] Updated ${result.updatedCount} symbols (${result.symbols.join(", ") || "none"}). Next run in ${
            config.intervalMinutes
          } minute(s).`
        );
      } else {
        status.lastStatus = "skipped";
        status.lastMessage = result.reason;
        console.log(`[Stock Auto Refresh] ${result.reason}. Next run in ${config.intervalMinutes} minute(s).`);
      }
      schedule(getNextRunDelayMs(new Date(), config.intervalMinutes));
    } catch (error) {
      status.lastStatus = "error";
      status.lastMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[Stock Auto Refresh] Worker error:", error);
      schedule(CONFIG_POLL_MS);
    } finally {
      running = false;
      status.running = false;
    }
  };

  console.log("[Stock Auto Refresh] Worker started.");
  status.lastStatus = "idle";
  status.lastMessage = "Worker started";
  void runCycle();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log("[Stock Auto Refresh] Worker stopped.");
  };
}

export function getStockAutoRefreshStatus(): StockAutoRefreshStatus {
  return { ...status };
}

async function fetchStockList(scriptUrl: string, accessCode: string): Promise<any[]> {
  const listData = await postAppsScript({
    action: "list",
    accessCode
  }, scriptUrl);
  if (!listData?.ok) {
    throw new Error(`Failed to fetch stock list: ${String(listData?.message ?? "Unknown error")}`);
  }
  return Array.isArray(listData.data) ? listData.data : [];
}

async function getAutoRefreshConfig(scriptUrl: string, accessCode: string): Promise<StockConfig> {
  const configData = await postAppsScript({
    action: "get_config",
    accessCode
  }, scriptUrl);

  if (!configData?.ok) {
    throw new Error(`Failed to fetch stock config: ${String(configData?.message ?? "Unknown error")}`);
  }

  const config = configData?.data && typeof configData.data === "object" ? configData.data : {};
  const intervalMinutes = clampNumber(
    Number(config.AUTO_REFRESH_MINUTES ?? DEFAULT_INTERVAL_MINUTES),
    MIN_INTERVAL_MINUTES,
    MAX_INTERVAL_MINUTES
  );

  return { intervalMinutes };
}

async function postAppsScript(payload: Record<string, unknown>, scriptUrl: string) {
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Apps Script request failed (${response.status})`);
  }
  return data;
}

function getMarketTimeInfo(now: Date): MarketTimeInfo {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const dayName = parts.find((part) => part.type === "weekday")?.value || "";
  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value || "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value || "0", 10);
  const second = Number.parseInt(parts.find((part) => part.type === "second")?.value || "0", 10);

  return { dayName, hour, minute, second };
}

function getNextRunDelayMs(now: Date, intervalMinutes: number): number {
  const nextRunAt = computeNextRunAt(now, intervalMinutes);
  return Math.max(60_000, nextRunAt.getTime() - now.getTime());
}

function computeNextRunAt(now: Date, intervalMinutes: number): Date {
  const intervalMs = Math.max(1, intervalMinutes) * 60_000;
  if (isWithinMarketWindow(now)) {
    const candidate = new Date(now.getTime() + intervalMs);
    if (isWithinMarketWindow(candidate)) {
      return candidate;
    }
  }
  return nextMarketOpenAt(now);
}

function isWithinMarketWindow(date: Date): boolean {
  const market = getMarketTimeInfo(date);
  const isMarketDay = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(market.dayName);
  const isMarketHour = isWithinTimeRange(market);
  return isMarketDay && isMarketHour;
}

function nextMarketOpenAt(from: Date): Date {
  const tzOffsetMs = 7 * 60 * 60 * 1000;
  const local = new Date(from.getTime() + tzOffsetMs);
  const day = local.getUTCDay(); // 0=Sun..6=Sat
  const hour = local.getUTCHours();

  let addDays = 0;
  if (day >= 1 && day <= 5 && hour < 9) {
    addDays = 0;
  } else if (day === 6) {
    addDays = 2;
  } else if (day === 0) {
    addDays = 1;
  } else if (day === 5) {
    addDays = 3;
  } else {
    addDays = 1;
  }

  const nextOpenLocalUtcMs = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + addDays,
    9,
    0,
    0,
    0
  );

  return new Date(nextOpenLocalUtcMs - tzOffsetMs);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function isWithinTimeRange(time: Pick<MarketTimeInfo, "hour" | "minute" | "second">): boolean {
  const totalSeconds = time.hour * 3600 + time.minute * 60 + time.second;
  const openSeconds = 9 * 3600;
  const closeSeconds = 15 * 3600;
  return totalSeconds >= openSeconds && totalSeconds <= closeSeconds;
}

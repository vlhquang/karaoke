import { z } from "zod";

export const WALLET_KEY = "btc-monitor-paper-live-v2";
export const RULE_KEY = "btc-monitor-rule-v1";
export const SESSION_KEY = "btc-monitor-session-v1";
export const ruleSchema = z.object({
  mode: z.enum(["trend", "breakout", "reversion", "threshold"]),
  amount: z.number().finite().min(1).max(1000000),
  takeProfit: z.number().finite().min(0.1).max(100),
  stopLoss: z.number().finite().min(0.1).max(99),
  buy: z.number().finite().nonnegative().default(0),
  sell: z.number().finite().nonnegative().default(0)
}).refine(r => r.mode !== "threshold" || (r.buy > 0 && r.sell > r.buy), "Invalid price thresholds");
export type Rule = z.infer<typeof ruleSchema>;
export type Candle = { time: number; closeTime: number; close: number; high: number; low: number; open: number };
export type Trade = { time: string; side: "buy" | "sell"; price: number; quantity: number; amount: number; fee: number; origin: string; strategy?: string; reason?: string };
export type Wallet = { cash: number; btc: number; trades: Trade[] };
export type Session = { enabled: boolean; lastDecision: number; quantity: number; entryPrice: number; totalRuntimeMs: number };
export type Bot = { wallet: Wallet; rule: Rule | null; session: Session };
export type State = Record<string, string>;
const FEE = 0.001;
const walletSchema = z.object({ cash: z.number().finite().nonnegative(), btc: z.number().finite().nonnegative(), trades: z.array(z.object({
  time: z.string(), side: z.enum(["buy", "sell"]), price: z.number().finite().positive(), quantity: z.number().finite().positive(),
  amount: z.number().finite().positive(), fee: z.number().finite().nonnegative(), origin: z.string(), strategy: z.string().optional().nullable(), reason: z.string().optional()
})) });
const sessionSchema = z.object({ enabled: z.boolean().default(false), lastDecision: z.number().finite().nonnegative().default(0), quantity: z.number().finite().nonnegative().default(0), entryPrice: z.number().finite().nonnegative().default(0), totalRuntimeMs: z.number().finite().nonnegative().default(0) });

export function decodeState(state: State = {}): Bot {
  const wallet = state[WALLET_KEY] ? walletSchema.parse(JSON.parse(state[WALLET_KEY])) as Wallet : { cash: 10000, btc: 0, trades: [] };
  const savedRule = state[RULE_KEY] ? JSON.parse(state[RULE_KEY]) : null;
  const rule = savedRule ? ruleSchema.parse({ mode: "threshold", takeProfit: 2, stopLoss: 1, ...savedRule }) : null;
  const session = sessionSchema.parse(state[SESSION_KEY] ? JSON.parse(state[SESSION_KEY]) : {});
  session.quantity = Math.min(session.quantity, wallet.btc);
  if (session.quantity > 0 && session.entryPrice <= 0) throw new Error("Position has no entry price");
  if (!rule) session.enabled = false;
  return { wallet, rule, session };
}
export function encodeState(bot: Bot): State {
  return { [WALLET_KEY]: JSON.stringify(bot.wallet), [RULE_KEY]: JSON.stringify(bot.rule), [SESSION_KEY]: JSON.stringify(bot.session) };
}
export function signal(candles: Candle[], mode: Rule["mode"]): boolean {
  if (candles.length < 31) return false;
  const values = candles.map(c => c.close);
  const average = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
  if (mode === "trend") return average(values.slice(-10)) > average(values.slice(-30)) && average(values.slice(-11, -1)) <= average(values.slice(-31, -1));
  if (mode === "breakout") return values.at(-1)! > Math.max(...candles.slice(-21, -1).map(c => c.high));
  if (mode === "reversion") return values.at(-2)! < average(values.slice(-21, -1)) * 0.985 && values.at(-1)! > values.at(-2)!;
  return false;
}
export function tick(bot: Bot, price: number, candles: Candle[], now: number): string {
  const { wallet, rule, session } = bot;
  if (!session.enabled || !rule) return "stopped";
  if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid market price");
  const closed = candles.filter(c => c.closeTime < now);
  const last = closed.at(-1);
  let side: "buy" | "sell" | null = null;
  let reason = "waiting-signal";
  if (session.quantity > 0) {
    if (price <= session.entryPrice * (1 - rule.stopLoss / 100)) { side = "sell"; reason = "stop-loss"; }
    else if (price >= session.entryPrice * (1 + rule.takeProfit / 100)) { side = "sell"; reason = "take-profit"; }
    else if (rule.mode === "threshold" && price >= rule.sell) { side = "sell"; reason = "sell-threshold"; }
  } else if (rule.mode === "threshold") {
    if (price <= rule.buy) { side = "buy"; reason = "buy-threshold"; }
  } else if (last && now - last.closeTime < 960000 && last.time !== session.lastDecision) {
    session.lastDecision = last.time;
    if (signal(closed, rule.mode)) { side = "buy"; reason = rule.mode; }
  }
  if (!side) return reason;
  const quantity = side === "buy" ? rule.amount / price : session.quantity;
  const amount = side === "buy" ? rule.amount : quantity * price;
  const fee = amount * FEE;
  if (side === "buy" && wallet.cash < amount + fee) { session.enabled = false; return "insufficient-funds"; }
  wallet.cash += side === "buy" ? -(amount + fee) : amount - fee;
  wallet.btc = Math.max(0, wallet.btc + (side === "buy" ? quantity : -quantity));
  wallet.trades.push({ time: new Date(now).toISOString(), side, price, quantity, amount, fee, origin: "auto", strategy: rule.mode, reason });
  session.quantity = side === "buy" ? quantity : 0;
  if (side === "buy") session.entryPrice = price;
  else session.lastDecision = last?.time || session.lastDecision;
  return reason;
}

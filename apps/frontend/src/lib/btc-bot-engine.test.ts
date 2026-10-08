import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeState, encodeState, ruleSchema, signal, tick, SESSION_KEY, type Candle } from "./btc-bot-engine";

const config = { mode: "threshold" as const, amount: 100, buy: 100, sell: 110, takeProfit: 2, stopLoss: 1 };
function bot() {
  const value = decodeState(); value.rule = ruleSchema.parse(config); value.session.enabled = true; return value;
}
const now = 1800000000000;
const candles = (values: number[]): Candle[] => values.map((close, index) => ({ time: now - (values.length - index) * 900000, closeTime: now - (values.length - index - 1) * 900000 - 1, close, high: close + 1, low: close - 1, open: close }));

test("paper buy charges fees once; open position does not repeat buy", () => {
  const value = bot(); tick(value, 100, [], now); tick(value, 100, [], now + 5000);
  assert.equal(value.wallet.cash, 9899.9); assert.equal(value.wallet.btc, 1); assert.equal(value.wallet.trades.length, 1);
  assert.equal(value.wallet.trades[0].strategy, "threshold");
});
test("stop loss exits only the automatic position and records its reason", () => {
  const value = bot(); value.wallet.btc = 2; tick(value, 100, [], now); tick(value, 99, [], now + 5000);
  assert.equal(value.wallet.btc, 2); assert.equal(value.session.quantity, 0); assert.equal(value.wallet.trades[1].reason, "stop-loss");
});
test("take profit uses entry price and includes sell fees", () => {
  const value = bot(); tick(value, 100, [], now); tick(value, 102, [], now + 5000);
  assert.ok(Math.abs(value.wallet.cash - 10001.798) < 1e-8); assert.equal(value.wallet.trades[1].reason, "take-profit");
});
test("disabled strategy cannot trade even past the stop loss", () => {
  const value = bot(); tick(value, 100, [], now); value.session.enabled = false; tick(value, 90, [], now + 5000);
  assert.equal(value.wallet.trades.length, 1); assert.equal(value.wallet.btc, 1);
});
test("insufficient funds stops the bot without modifying the wallet", () => {
  const value = bot(); value.wallet.cash = 100; assert.equal(tick(value, 100, [], now), "insufficient-funds");
  assert.equal(value.session.enabled, false); assert.equal(value.wallet.cash, 100); assert.equal(value.wallet.trades.length, 0);
});
test("closed candles are required and a signal cannot buy twice in one candle", () => {
  const value = bot(); value.rule!.mode = "breakout";
  const data = candles([...Array(30).fill(100), 110]);
  assert.equal(signal(data, "breakout"), true);
  tick(value, 110, data, now); tick(value, 113, data, now + 5000); tick(value, 110, data, now + 10000);
  assert.equal(value.wallet.trades.length, 2);
  const freshValue = bot(); freshValue.rule!.mode = "breakout";
  data[data.length - 1].closeTime = now + 1000; tick(freshValue, 110, data, now);
  assert.equal(freshValue.wallet.trades.length, 0);
});
test("stale candles do not trigger an entry; direct stop loss still works", () => {
  const value = bot(); tick(value, 100, [], now); value.rule!.mode = "trend";
  tick(value, 98, [], now + 5000); assert.equal(value.wallet.trades.length, 2);
  const data = candles([...Array(30).fill(100), 110]).map(c => ({ ...c, time: c.time - 2000000, closeTime: c.closeTime - 2000000 }));
  tick(value, 110, data, now + 10000); assert.equal(value.wallet.trades.length, 2);
});
test("state roundtrip preserves runtime, strategy, position and running flag", () => {
  const value = bot(); tick(value, 100, [], now); value.session.totalRuntimeMs = 123456;
  assert.deepEqual(decodeState(encodeState(value)), value);
  assert.equal(decodeState({ [SESSION_KEY]: '{"enabled":true}' }).session.enabled, false);
});
test("invalid configurations and corrupted positions are rejected", () => {
  assert.throws(() => ruleSchema.parse({ ...config, sell: 90 }));
  assert.throws(() => ruleSchema.parse({ ...config, amount: -1 }));
  const value = bot(); tick(value, 100, [], now); value.session.entryPrice = 0;
  assert.throws(() => decodeState(encodeState(value)));
});

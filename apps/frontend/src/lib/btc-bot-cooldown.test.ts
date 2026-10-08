import test from "node:test";
import assert from "node:assert/strict";
import { marketRetryAt } from "./btc-bot-service";

test("market cooldown respects Retry-After and uses conservative fallbacks", () => {
  const now = 1700000000000;
  assert.equal(marketRetryAt("120", 418, now), now + 120000);
  assert.equal(marketRetryAt(new Date(now + 60000).toUTCString(), 429, now), now + 60000);
  assert.equal(marketRetryAt(null, 418, now), now + 86400000);
  assert.equal(marketRetryAt("invalid", 429, now), now + 60000);
});

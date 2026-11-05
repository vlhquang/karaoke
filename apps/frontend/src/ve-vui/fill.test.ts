import assert from "node:assert/strict";
import { test } from "node:test";
import { floodFillRuns, validFillRuns } from "./fill";

const pixels = (width: number, height: number) => new Uint8ClampedArray(width * height * 4).fill(255);
test("flood fill respects a closed boundary, antialiased edges and row runs", () => {
  const width = 7, height = 7, data = pixels(width, height);
  for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) if (x === 1 || x === 5 || y === 1 || y === 5) {
    const i = (y * width + x) * 4; data[i] = data[i + 1] = data[i + 2] = 40;
  }
  const runs = floodFillRuns(data, width, height, 3, 3, "#ee5353");
  assert.deepEqual(runs, [16, 3, 23, 3, 30, 3]);
  assert.ok(validFillRuns(runs, width, height));
  const original = new Uint8ClampedArray(data);
  data[(2 * width + 3) * 4] = 240;
  assert.deepEqual(floodFillRuns(data, width, height, 3, 3, "#ee5353"), runs);
  assert.notDeepEqual(data, original);
});
test("open regions fill outside, same-color fills are no-ops, and source pixels stay unchanged", () => {
  const data = pixels(10, 8), original = new Uint8ClampedArray(data);
  const runs = floodFillRuns(data, 10, 8, 99, -1, "#253447");
  assert.equal(runs.length, 16); assert.equal(runs.filter((_, i) => i % 2).reduce((sum, n) => sum + n, 0), 80);
  assert.deepEqual(data, original);
  assert.deepEqual(floodFillRuns(data, 10, 8, 4, 4, "#ffffff"), []);
  assert.deepEqual(floodFillRuns(data, 10, 8, NaN, 4, "#253447"), []);
});
test("fill validation rejects overlapping, out-of-bounds, cross-row and non-integer pixel runs", () => {
  for (const runs of [[], [0], [0, 0], [-1, 2], [9, 2], [0, 4, 2, 1], [79, 2], [.5, 1], [0, 1.5]]) assert.equal(validFillRuns(runs, 10, 8), false, JSON.stringify(runs));
  assert.ok(validFillRuns([0, 10, 10, 10, 79, 1], 10, 8));
});

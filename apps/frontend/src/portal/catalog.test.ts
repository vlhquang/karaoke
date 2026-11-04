import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORIES, FAVORITES_KEY, findCurrentApp, matchesApp, normalizeSearch, PORTAL_APPS, readAppIds } from "./catalog";

test("Vietnamese search handles accents, Đ, case, whitespace and all query words", () => {
  assert.equal(normalizeSearch("  ĐƯỜNG ĐUA  "), "duong dua");
  const drawing = PORTAL_APPS.find(app => app.id === "ve-vui")!;
  assert.ok(matchesApp(drawing, "VE   VUI"));
  assert.ok(matchesApp(drawing, "gia đình đoán"));
  assert.ok(matchesApp(drawing, ""));
  assert.equal(matchesApp(drawing, "vẽ cổ phiếu"), false);
});

test("catalog links and identifiers are unique and categories are valid", () => {
  assert.equal(new Set(PORTAL_APPS.map(app => app.id)).size, PORTAL_APPS.length);
  assert.equal(new Set(PORTAL_APPS.map(app => app.href)).size, PORTAL_APPS.length);
  for (const app of PORTAL_APPS) {
    assert.ok(app.href.startsWith("/") && !app.href.startsWith("//"));
    assert.ok(CATEGORIES.some(category => category.id === app.category));
  }
});

test("room routes retain their app and prefix collisions do not match", () => {
  assert.equal(findCurrentApp("/host")?.id, "karaoke");
  assert.equal(findCurrentApp("/room/ABC123")?.id, "karaoke");
  assert.equal(findCurrentApp("/lo-to/room/ABC123")?.id, "lo-to");
  assert.equal(findCurrentApp("/hud/remote")?.id, "hud");
  assert.equal(findCurrentApp("/hudson"), undefined);
  assert.equal(findCurrentApp("/"), undefined);
});

test("saved app IDs tolerate corrupt, stale, duplicated and unavailable storage", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let value = "";
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => value } });
  try {
    for (value of ["broken", "null", "{}", "42"]) assert.deepEqual(readAppIds(FAVORITES_KEY), []);
    value = JSON.stringify(["ve-vui", "removed-app", 12, "karaoke", "ve-vui"]);
    assert.deepEqual(readAppIds(FAVORITES_KEY), ["ve-vui", "karaoke"]);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage is disabled"); } });
    assert.deepEqual(readAppIds(FAVORITES_KEY), []);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createPlaceService, parsePlaceRequest, PlaceLookupError } from "./place-service";
import { readPlaces } from "./places";

const feature = {
  type: "Feature", geometry: { type: "Point", coordinates: [106.6980365, 10.7725301] },
  properties: { osm_type: "W", osm_id: 39514795, type: "house", name: "Chợ Bến Thành", street: "Công trường Quách Thị Trang", district: "Bến Thành", city: "Thành phố Hồ Chí Minh", country: "Việt Nam" },
};

test("place results keep Vietnamese names, compose addresses and convert longitude/latitude correctly", () => {
  const places = readPlaces({ features: [feature, feature, { ...feature, geometry: { type: "Point", coordinates: [106, 95] } }, {}] });
  assert.equal(places.length, 1);
  assert.deepEqual(places[0].point, [10.7725301, 106.6980365]);
  assert.equal(places[0].name, "Chợ Bến Thành");
  assert.equal(places[0].address, "Công trường Quách Thị Trang, Bến Thành, Thành phố Hồ Chí Minh, Việt Nam");
  assert.equal(places[0].zoom, 19);
  const city = readPlaces({ features: [{ ...feature, properties: { ...feature.properties, type: "city" } }] });
  assert.equal(city[0].zoom, 13);
  assert.deepEqual(readPlaces({ features: [] }), []);
  assert.throws(() => readPlaces({ error: "unavailable" }));
});

test("place lookup rejects missing coordinates, out-of-range values and invalid search terms", () => {
  assert.deepEqual(parsePlaceRequest(new URLSearchParams({ q: " Chợ   Bến Thành ", lat: "10.7", lng: "106.6" })), { query: "Chợ Bến Thành", center: [10.7, 106.6] });
  assert.deepEqual(parsePlaceRequest(new URLSearchParams({ lat: "10.7", lng: "106.6" })), { query: "", center: [10.7, 106.6] });
  const invalid: Record<string, string>[] = [{}, { q: "Chợ Bến Thành" }, { q: "x", lat: "10", lng: "106" }, { lat: "", lng: "106" }, { lat: "81", lng: "106" }, { lat: "10", lng: "Infinity" }, { q: "x".repeat(161), lat: "10", lng: "106" }];
  for (const params of invalid) {
    assert.throws(() => parsePlaceRequest(new URLSearchParams(params)), (error: unknown) => error instanceof PlaceLookupError && error.status === 400);
  }
});

test("search cache and concurrent identical requests share one upstream call", async () => {
  let calls = 0;
  let requestedUrl = "";
  const service = createPlaceService({ intervalMs: 0, fetcher: async url => { calls++; requestedUrl = String(url); await Promise.resolve(); return Response.json({ features: [feature] }); } });
  const request = { query: "Chợ Bến Thành", center: [10.77689, 106.70089] as [number, number] };
  const [a, b] = await Promise.all([service(request), service(request)]);
  assert.deepEqual(a, b); assert.equal(calls, 1);
  assert.deepEqual(await service(request), a); assert.equal(calls, 1);
  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/api/"); assert.equal(url.searchParams.get("q"), "Chợ Bến Thành");
  assert.equal(url.searchParams.get("lon"), "106.701");
});

test("reverse lookup uses a bounded radius and configured endpoint", async () => {
  let requestedUrl = "";
  const service = createPlaceService({ endpoint: "https://geocoder.example/base/", intervalMs: 0, fetcher: async url => { requestedUrl = String(url); return Response.json({ features: [feature] }); } });
  const places = await service({ query: "", center: [10.77689, 106.70089] });
  const url = new URL(requestedUrl);
  assert.equal(url.origin, "https://geocoder.example"); assert.equal(url.pathname, "/base/reverse");
  assert.equal(url.searchParams.get("radius"), "1"); assert.equal(url.searchParams.get("limit"), "1");
  assert.equal(places[0].name, "Chợ Bến Thành");
});

test("upstream failures do not poison the cache and expose a recoverable lookup error", async () => {
  let calls = 0;
  const service = createPlaceService({ intervalMs: 0, fetcher: async () => ++calls === 1 ? new Response("down", { status: 503 }) : Response.json({ features: [feature] }) });
  const request = { query: "Chợ Bến Thành", center: [10.77, 106.69] as [number, number] };
  await assert.rejects(service(request), (error: unknown) => error instanceof PlaceLookupError && error.status === 502);
  assert.equal((await service(request))[0].name, "Chợ Bến Thành"); assert.equal(calls, 2);
});

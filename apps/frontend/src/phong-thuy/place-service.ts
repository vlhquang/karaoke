import { parseCoordinates, type Point } from "./model";
import { readPlaces, type MapPlace } from "./places";

export class PlaceLookupError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function parsePlaceRequest(params: URLSearchParams): { query: string; center: Point } {
  const query = (params.get("q") ?? "").trim().replace(/\s+/g, " ");
  const lat = params.get("lat"), lng = params.get("lng");
  const center = lat !== null && lng !== null ? parseCoordinates(`${lat},${lng}`) : null;
  if (!center || (query && (query.length < 2 || query.length > 160))) throw new PlaceLookupError("Nhập tên địa điểm từ 2 đến 160 ký tự và toạ độ bản đồ hợp lệ.", 400);
  return { query, center };
}

export function createPlaceService(options: { endpoint?: string; fetcher?: typeof fetch; intervalMs?: number } = {}) {
  const endpoint = (options.endpoint || process.env.PHONG_THUY_GEOCODER_URL || "https://photon.komoot.io").replace(/\/+$/, "");
  const fetcher = options.fetcher ?? fetch;
  const interval = options.intervalMs ?? 1100;
  const cache = new Map<string, { expires: number; places: MapPlace[] }>();
  const pending = new Map<string, Promise<MapPlace[]>>();
  let nextRequestAt = 0;

  return async function lookup({ query, center }: { query: string; center: Point }): Promise<MapPlace[]> {
    const precision = query ? 3 : 4;
    const lat = center[0].toFixed(precision), lng = center[1].toFixed(precision);
    const key = `${query.toLocaleLowerCase("vi")}:${lat}:${lng}`;
    const saved = cache.get(key);
    if (saved && saved.expires > Date.now()) return saved.places;
    const existing = pending.get(key);
    if (existing) return existing;
    const wait = Math.max(0, nextRequestAt - Date.now());
    if (wait > 3300) throw new PlaceLookupError("Đang có nhiều lượt tìm kiếm. Vui lòng thử lại sau vài giây.", 429);
    nextRequestAt = Date.now() + wait + interval;
    const request = (async () => {
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      const url = new URL(`${endpoint}/${query ? "api/" : "reverse"}`);
      url.searchParams.set("lat", lat); url.searchParams.set("lon", lng);
      url.searchParams.set("limit", query ? "6" : "1");
      if (query) url.searchParams.set("q", query);
      else url.searchParams.set("radius", "1");
      try {
        const response = await fetcher(url, { headers: { "Accept": "application/json", "Accept-Language": "vi", "User-Agent": "NhaMinh-PhongThuy/1.0 (+https://karaoke-lqjm.onrender.com/phong-thuy)" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);
        const places = readPlaces(await response.json());
        if (cache.size >= 200) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: Date.now() + 600_000, places });
        return places;
      } catch { throw new PlaceLookupError("Chưa kết nối được dịch vụ địa điểm. Bạn có thể thử lại hoặc nhập vĩ độ, kinh độ.", 502); }
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  };
}

export const lookupPlaces = createPlaceService();

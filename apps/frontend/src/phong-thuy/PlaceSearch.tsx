"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, MapPin, Search, X } from "lucide-react";
import { distance, parseCoordinates, type Point } from "./model";
import type { MapPlace } from "./places";

export default function PlaceSearch({ center, ready, selectedPlace, onNavigate }: { center: Point; ready: boolean; selectedPlace: MapPlace | null; onNavigate: (point: Point, zoom: number, place: MapPlace | null) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapPlace[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nearby, setNearby] = useState<MapPlace | null>(null);
  const [areaState, setAreaState] = useState("Đang xác định địa điểm…");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<AbortController | null>(null);
  const lastArea = useRef<{ center: Point; place: MapPlace | null } | null>(null);
  const centerKey = `${center[0].toFixed(4)},${center[1].toFixed(4)}`;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); searchRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const point = parseCoordinates(centerKey)!;
    if (selectedPlace && distance(point, selectedPlace.point) < 30) {
      setNearby(selectedPlace); setAreaState(""); return;
    }
    if (lastArea.current && distance(point, lastArea.current.center) < 40) {
      setNearby(lastArea.current.place); setAreaState(lastArea.current.place ? "" : "Chưa có tên địa điểm tại tâm bản đồ"); return;
    }
    const controller = new AbortController();
    setNearby(null); setAreaState("Đang xác định địa điểm…");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/phong-thuy/places?lat=${point[0]}&lng=${point[1]}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Lookup failed");
        const data = await response.json() as { places: MapPlace[] };
        if (controller.signal.aborted) return;
        const place = data.places[0] ?? null;
        lastArea.current = { center: point, place };
        setNearby(place); setAreaState(place ? "" : "Chưa có tên địa điểm tại tâm bản đồ");
      } catch { if (!controller.signal.aborted) setAreaState("Chưa lấy được tên địa điểm · vẫn có thể nhập toạ độ"); }
    }, 1000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [centerKey, ready, selectedPlace]);

  async function search(e: FormEvent) {
    e.preventDefault(); searchRef.current?.abort();
    const point = parseCoordinates(query);
    if (point) { onNavigate(point, 20, null); setOpen(false); setBusy(false); setError(""); return; }
    const term = query.trim();
    if (term.length < 2) { setError("Nhập ít nhất 2 ký tự, ví dụ: Chợ Bến Thành hoặc tên đường, phường/xã."); setOpen(true); return; }
    const controller = new AbortController(); searchRef.current = controller;
    setBusy(true); setOpen(true); setError(""); setResults(null);
    try {
      const params = new URLSearchParams({ q: term, lat: String(center[0]), lng: String(center[1]) });
      const response = await fetch(`/api/phong-thuy/places?${params}`, { signal: controller.signal });
      const data = await response.json() as { places?: MapPlace[]; message?: string };
      if (!response.ok || !data.places) throw new Error(data.message || "Không tìm được địa điểm. Hãy thử lại.");
      if (!controller.signal.aborted) setResults(data.places);
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Không tìm được địa điểm."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }

  return <div className="pt-place-search" ref={rootRef}>
    <form className="pt-coordinate-search" onSubmit={search} role="search" aria-label="Tìm vị trí khu đất">
      <MapPin size={18} aria-hidden="true" />
      <input aria-label="Tìm địa điểm, địa chỉ hoặc toạ độ" aria-describedby="pt-place-search-hint" value={query} maxLength={160} onChange={e => { searchRef.current?.abort(); setQuery(e.target.value); setResults(null); setError(""); setBusy(false); }} onFocus={() => { if (results || error) setOpen(true); }} onKeyDown={e => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); } }} placeholder="Tìm địa điểm, địa chỉ hoặc toạ độ…" />
      {query && <button type="button" aria-label="Xoá tìm kiếm địa điểm" onClick={() => { searchRef.current?.abort(); setQuery(""); setResults(null); setError(""); setBusy(false); setOpen(false); }}><X size={15} /></button>}
      <button type="submit" aria-label="Tìm địa điểm" title="Tìm địa điểm" disabled={!ready || busy}>{busy ? <LoaderCircle className="pt-search-spinner" size={18} /> : <Search size={18} />}</button>
    </form>
    <span id="pt-place-search-hint" className="pt-sr-only">Nhập tên địa điểm hoặc địa chỉ rồi nhấn Enter, hoặc nhập vĩ độ, kinh độ.</span>
    {open && <div className="pt-place-results"><div className="pt-place-results-heading"><span>Kết quả tìm địa điểm</span><button type="button" aria-label="Đóng kết quả địa điểm" onClick={() => setOpen(false)}><X size={15} /></button></div><div role="status" className="pt-search-status">{busy ? "Đang tìm địa điểm…" : error || (results?.length === 0 ? "Chưa tìm thấy. Thử thêm tên đường, phường/xã hoặc tỉnh/thành phố." : "")}</div>{!!results?.length && <ul aria-label="Kết quả địa điểm">{results.map(place => <li key={place.id}><button type="button" onClick={() => { setQuery(place.name); onNavigate(place.point, place.zoom, place); setOpen(false); }}><MapPin size={17} aria-hidden="true" /><span><b>{place.name}</b><small>{place.address}</small></span></button></li>)}</ul>}<div className="pt-search-credit">Dữ liệu địa điểm: <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></div></div>}
    <div className="pt-current-place" role="status"><MapPin size={15} aria-hidden="true" /><span><small>KHU VỰC TẠI TÂM BẢN ĐỒ</small><b>{nearby ? `Gần ${nearby.name}` : areaState}</b>{nearby?.address && <span>{nearby.address}</span>}</span></div>
  </div>;
}

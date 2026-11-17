"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { Map as LeafletMap } from "leaflet";
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, Compass, Crosshair, DoorOpen, Eye, Flame, House, Layers, LocateFixed, LockKeyhole, MousePointer2, Pentagon, RectangleHorizontal, Redo2, Route, Save, Trash2, Undo2, UnlockKeyhole, X } from "lucide-react";
import { bearing, directionName, distance, emptyPlan, isSimplePolygon, KIND_COLOR, KIND_LABEL, moveObject, newId, normalizeAngle, objectCenter, objectPoints, parseCoordinates, pathLength, planSchema, polygonArea, rectangleFromPoints, sampleObjects, STORAGE_KEY, type ObjectKind, type Plan, type PlanObject, type Point, type Tool } from "./model";
import "./phong-thuy.css";
import PlaceSearch from "./PlaceSearch";
import type { MapPlace } from "./places";

const FengShuiMap = dynamic(() => import("./PhongThuyMap"), { ssr: false, loading: () => <div className="pt-map-loading"><Compass size={32} /><p>Đang mở bản đồ…</p></div> });
const ICONS: Record<ObjectKind, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = { compass: Compass, house: House, rectangle: RectangleHorizontal, outline: Pentagon, door: DoorOpen, kitchen: Flame, path: Route };
const TOOLS: { id: Tool; label: string; icon: typeof Compass }[] = [
  { id: "select", label: "Chọn / di chuyển", icon: MousePointer2 }, { id: "compass", label: "La bàn", icon: Compass },
  { id: "house", label: "Nhà", icon: House }, { id: "rectangle", label: "Chữ nhật", icon: RectangleHorizontal }, { id: "outline", label: "Vẽ nhà", icon: Pentagon },
  { id: "door", label: "Cửa chính", icon: DoorOpen }, { id: "kitchen", label: "Bếp", icon: Flame }, { id: "path", label: "Lối vào", icon: Route },
];
const HINTS: Record<Tool, string> = {
  select: "Chọn đối tượng để chỉnh sửa. Kéo tâm la bàn hoặc tay nắm để di chuyển.",
  compass: "Chạm vào khu đất để đặt la bàn. Có thể đặt thêm nhiều la bàn.",
  house: "Chạm để đặt tâm nhà, sau đó chỉnh chiều ngang, chiều sâu và hướng mặt tiền.",
  rectangle: "Chọn 2 đầu cạnh đầu tiên (ngang, dọc hoặc xéo), rồi chọn độ sâu để hoàn tất hình chữ nhật.",
  outline: "Chạm lần lượt các góc nhà, rồi nhấn Hoàn tất. Kéo các đỉnh để chỉnh lại.",
  door: "Chạm vị trí cửa, sau đó chạm phía ngoài nhà để xác định hướng nhìn ra.",
  kitchen: "Chạm vị trí bếp, sau đó chạm về phía lưng người đứng nấu.",
  path: "Chạm từ ngoài đường đến cửa nhà để vẽ lối vào, rồi nhấn Hoàn tất.",
};

function NumberField({ label, value, min, max, step = 0.1, live = false, onChange }: { label: string; value: number; min: number; max: number; step?: number; live?: boolean; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(Number(value.toFixed(6))));
  useEffect(() => setText(current => live && current.trim() && Number(current) === Number(value.toFixed(6)) ? current : String(Number(value.toFixed(6)))), [value, live]);
  return <label className="pt-field"><span>{label}</span><input type={live ? "text" : "number"} inputMode="decimal" min={min} max={max} step={step} value={text} onChange={e => { const raw = e.target.value; setText(raw); const next = raw.trim() ? Number(raw) : NaN; if (live && Number.isFinite(next) && next >= min && next <= max && next !== value) onChange(next); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} onBlur={() => {
    const next = text.trim() ? Number(text) : NaN;
    if (Number.isFinite(next)) { const clamped = Math.max(min, Math.min(max, next)); setText(String(clamped)); if (clamped !== Number(value.toFixed(6))) onChange(clamped); }
    else setText(String(Number(value.toFixed(6))));
  }} /></label>;
}

export default function PhongThuyApp() {
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Đang mở bản vẽ…");
  const [cacheCleared, setCacheCleared] = useState(true);
  const [tool, setTool] = useState<Tool>("select");
  const [draft, setDraft] = useState<Point[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<PlanObject[][]>([]);
  const [future, setFuture] = useState<PlanObject[][]>([]);
  const [message, setMessage] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const clearCacheDialogRef = useRef<HTMLDialogElement>(null);
  const latestWorkspace = useRef({ plan, tool, draft, loaded, cacheCleared });
  latestWorkspace.current = { plan, tool, draft, loaded, cacheCleared };
  const selected = plan.objects.find(o => o.id === selectedId);
  const compassCount = plan.objects.filter(o => o.kind === "compass").length;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = planSchema.safeParse(JSON.parse(saved));
        if (parsed.success) {
          setPlan(parsed.data); setTool(parsed.data.draft.tool); setDraft(parsed.data.draft.points); setCacheCleared(false);
          if (parsed.data.objects.length || parsed.data.draft.points.length) setHasNavigated(true);
        }
        else setMessage("Bản lưu cũ không hợp lệ. Bạn có thể nhập lại tệp bản vẽ đã xuất.");
      }
    } catch { setMessage("Không đọc được bản lưu trên thiết bị. Bạn vẫn có thể vẽ và xuất tệp."); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (cacheCleared) { setSaveStatus("Chưa có dữ liệu lưu"); return; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...plan, draft: { tool, points: draft } })); setSaveStatus("Đã lưu trên trình duyệt"); }
    catch { setSaveStatus("Chưa lưu được · hãy xuất tệp"); }
  }, [plan, loaded, tool, draft, cacheCleared]);

  useEffect(() => {
    const flush = () => {
      const workspace = latestWorkspace.current;
      if (!workspace.loaded || workspace.cacheCleared) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...workspace.plan, draft: { tool: workspace.tool, points: workspace.draft } })); } catch { /* The save status already offers file export when storage is unavailable. */ }
    };
    window.addEventListener("pagehide", flush);
    return () => { flush(); window.removeEventListener("pagehide", flush); };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (clearCacheDialogRef.current?.open) return;
      if (e.key === "Escape") { setTool("select"); setDraft([]); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onMapReady = useCallback((map: LeafletMap) => { mapRef.current = map; setMapReady(true); }, []);
  const onViewChange = useCallback((center: Point, zoom: number) => setPlan(p => ({ ...p, center, zoom })), []);
  const onTileError = useCallback((error: boolean) => setTileError(error), []);
  const navigateToPlace = useCallback((point: Point, zoom: number, place: MapPlace | null) => {
    setSelectedPlace(place); setHasNavigated(true); mapRef.current?.setView(point, zoom);
  }, []);

  function commit(objects: PlanObject[]): boolean {
    const parsed = planSchema.safeParse({ ...plan, objects });
    if (!parsed.success) { setMessage("Không thể lưu thay đổi: kiểm tra các cạnh nhà, độ dài và số lượng đối tượng (tối đa 300)."); return false; }
    setCacheCleared(false);
    setPast(p => [...p.slice(-39), plan.objects]);
    setFuture([]);
    setPlan(p => ({ ...p, objects: parsed.data.objects }));
    return true;
  }
  function updateObject(id: string, patch: Partial<PlanObject>) {
    commit(plan.objects.map(o => o.id === id && !o.locked ? { ...o, ...patch } as PlanObject : o));
  }
  function addObject(object: PlanObject, keepTool = false) {
    if (!commit([...plan.objects, object])) return;
    setSelectedId(object.id); setDraft([]); setMessage("");
    if (!keepTool) setTool("select");
  }
  function chooseTool(next: Tool) { setCacheCleared(false); setTool(next); setDraft([]); setMessage(""); }
  function clearBrowserCache() {
    try { localStorage.removeItem(STORAGE_KEY); }
    catch { setMessage("Trình duyệt không cho phép xoá dữ liệu lưu. Hãy kiểm tra quyền lưu trữ của trang."); clearCacheDialogRef.current?.close(); return; }
    setCacheCleared(true);
    setPlan({ ...emptyPlan(), center: plan.center, zoom: plan.zoom, basemap: plan.basemap });
    setTool("select"); setDraft([]); setPast([]); setFuture([]); setSelectedId(null); setSelectedPlace(null); setHasNavigated(true);
    clearCacheDialogRef.current?.close(); setMessage("Đã xoá toàn bộ bản vẽ và nét đang vẽ trong bộ nhớ trình duyệt.");
  }
  function onMapClick(point: Point) {
    const base = { id: newId(), locked: false };
    const number = plan.objects.filter(o => o.kind === tool).length + 1;
    if (tool === "select") { setSelectedId(null); return; }
    if (tool === "compass") addObject({ ...base, kind: "compass", name: `La bàn ${number}`, center: point, radius: 15, heading: 0, opacity: 0.7, showOppositeArrow: false }, true);
    else if (tool === "house") addObject({ ...base, kind: "house", name: `Nhà ${number}`, center: point, width: 8, depth: 16, heading: selected && "heading" in selected ? selected.heading : 0 });
    else if (tool === "rectangle") {
      if (!draft.length) setDraft([point]);
      else if (draft.length === 1) {
        const width = distance(draft[0], point);
        if (width < 0.2 || width > 1000) { setMessage("Cạnh đầu tiên cần dài từ 0,2 đến 1.000 m."); return; }
        setMessage(""); setDraft([draft[0], point]);
      } else {
        const shape = rectangleFromPoints(draft[0], draft[1], point);
        if (!shape) { setMessage("Chọn điểm lệch khỏi cạnh đầu để độ sâu từ 0,2 đến 1.000 m."); return; }
        addObject({ ...base, kind: "rectangle", name: `Chữ nhật ${number}`, ...shape });
      }
    }
    else if (tool === "door" || tool === "kitchen") {
      if (!draft.length) setDraft([point]);
      else {
        const length = distance(draft[0], point);
        if (length < 0.2 || length > 1000) { setMessage("Chọn điểm hướng cách vị trí đầu từ 0,2 đến 1.000 m."); return; }
        addObject({ ...base, kind: tool, name: `${KIND_LABEL[tool]} ${number}`, center: draft[0], heading: bearing(draft[0], point), length });
      }
    } else {
      if (draft.length >= 100) { setMessage("Tối đa 100 điểm. Hãy hoàn tất nét vẽ này."); return; }
      if (!draft.length || distance(draft[draft.length - 1], point) > 0.1) setDraft(p => [...p, point]);
    }
  }
  function finishDrawing() {
    if (tool !== "outline" && tool !== "path") return;
    if (tool === "outline" && !isSimplePolygon(draft)) { setMessage("Các góc nhà cần tạo thành hình khép kín, có diện tích và các cạnh không cắt nhau."); return; }
    const number = plan.objects.filter(o => o.kind === tool).length + 1;
    addObject({ id: newId(), locked: false, kind: tool, name: `${KIND_LABEL[tool]} ${number}`, points: draft });
  }
  function undo() {
    if (draft.length) { setDraft(d => d.slice(0, -1)); return; }
    const previous = past[past.length - 1]; if (!previous) return;
    setFuture(f => [plan.objects, ...f]); setPast(p => p.slice(0, -1)); setPlan(p => ({ ...p, objects: previous }));
  }
  function redo() {
    const next = future[0]; if (!next) return;
    setPast(p => [...p.slice(-39), plan.objects]); setFuture(f => f.slice(1)); setPlan(p => ({ ...p, objects: next }));
  }
  function locate() {
    if (!navigator.geolocation) { setMessage("Trình duyệt chưa hỗ trợ định vị. Hãy nhập toạ độ khu đất."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setLocating(false);
      const point: Point = [position.coords.latitude, position.coords.longitude];
      if (!parseCoordinates(point.join(","))) { setMessage("Vị trí nằm ngoài vùng bản đồ hỗ trợ (vĩ độ −80 đến 80)."); return; }
      navigateToPlace(point, 20, { id: "my-location", name: "Vị trí của bạn", address: `Sai số GPS khoảng ${Math.round(position.coords.accuracy)} m`, point, zoom: 20 });
      setMessage(`Đã đến vị trí của bạn. Sai số GPS khoảng ${Math.round(position.coords.accuracy)} m.`);
    }, () => { setLocating(false); setMessage("Không lấy được vị trí. Hãy cấp quyền định vị hoặc nhập toạ độ khu đất."); }, { enableHighAccuracy: true, timeout: 12000 });
  }
  function fitObjects(objects = plan.objects) {
    const points = objects.flatMap(objectPoints);
    if (points.length) mapRef.current?.fitBounds(points, { padding: [60, 60], maxZoom: 21 });
  }
  function exportPlan() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...plan, draft: { tool, points: draft } }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "ban-ve-phong-thuy.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("Đã xuất bản vẽ. Dùng Nhập tệp để mở trên thiết bị khác.");
  }
  async function importPlan(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error("file too large");
      const next = planSchema.parse(JSON.parse(await file.text()));
      // Imported plans are merged, so an open drawing is never silently replaced.
      const objects = next.objects.map(o => ({ ...o, id: newId() }));
      if (!commit([...plan.objects, ...objects])) return;
      if (!plan.objects.length) setPlan(p => ({ ...p, title: next.title, basemap: next.basemap, showMapLabels: next.showMapLabels, showDrawingLabels: next.showDrawingLabels }));
      chooseTool("select"); setSelectedId(null); mapRef.current?.setView(next.center, next.zoom);
      if (!plan.objects.length && !draft.length) { setTool(next.draft.tool); setDraft(next.draft.points); }
      setMessage(`Đã thêm ${objects.length} đối tượng từ tệp vào bản vẽ.`);
    } catch { setMessage("Không đọc được tệp. Chọn tệp JSON được xuất từ ứng dụng này, tối đa 2 MB."); }
    finally { if (importRef.current) importRef.current.value = ""; }
  }
  function moveSelected(point: Point) {
    if (!selected || selected.locked) return;
    const next = moveObject(selected, point); updateObject(selected.id, next);
  }
  const canFinish = (tool === "outline" && draft.length >= 3) || (tool === "path" && draft.length >= 2);
  const selectedCenter = selected && objectCenter(selected);

  return <main className="pt-app">
    <header className="pt-heading">
      <div className="pt-heading-copy"><span className="pt-eyebrow"><Compass size={15} /> KHÔNG GIAN SỐNG CỦA BẠN</span><h1>Bản đồ phong thuỷ</h1><p>Đặt la bàn. Phác thảo ngôi nhà. Nhìn rõ từng hướng.</p></div>
      <div className="pt-file-actions"><span className="pt-save-status" role="status"><Save size={14} />{saveStatus}</span><div><button type="button" onClick={() => importRef.current?.click()} disabled={!loaded}><ArrowUpFromLine size={16} />Nhập tệp</button><button type="button" onClick={exportPlan} disabled={!loaded}><ArrowDownToLine size={16} />Xuất bản vẽ</button></div><input ref={importRef} type="file" accept=".json,application/json" hidden onChange={e => void importPlan(e.target.files?.[0])} /></div>
    </header>

    <div className="pt-workbench">
      <div className="pt-toolbar"><div className="pt-tools" role="group" aria-label="Công cụ bản đồ">{TOOLS.map(item => <button type="button" key={item.id} aria-pressed={tool === item.id} className={tool === item.id ? "is-active" : ""} onClick={() => chooseTool(item.id)} disabled={!mapReady}><item.icon size={18} /><span>{item.label}</span></button>)}</div><div className="pt-history"><button type="button" onClick={undo} disabled={!past.length && !draft.length} aria-label="Hoàn tác" title="Hoàn tác"><Undo2 size={18} /></button><button type="button" onClick={redo} disabled={!future.length || !!draft.length} aria-label="Làm lại" title="Làm lại"><Redo2 size={18} /></button></div></div>
      <div className="pt-workspace">
        <section className="pt-map-pane" aria-label="Bản đồ và bản phác thảo">
          {loaded && <FengShuiMap plan={plan} tool={tool} draft={draft} selectedId={selectedId} selectedPlace={selectedPlace} onReady={onMapReady} onViewChange={onViewChange} onClick={onMapClick} onSelect={setSelectedId} onUpdate={updateObject} onTileError={onTileError} />}
          <div className="pt-map-top"><PlaceSearch center={plan.center} ready={mapReady} selectedPlace={selectedPlace} onNavigate={navigateToPlace} /><div className="pt-basemap" role="group" aria-label="Nền bản đồ"><button type="button" aria-pressed={plan.basemap === "street"} onClick={() => { setCacheCleared(false); setTileError(false); setPlan(p => ({ ...p, basemap: "street" })); }}>Bản đồ</button><button type="button" aria-pressed={plan.basemap === "satellite"} onClick={() => { setCacheCleared(false); setTileError(false); setPlan(p => ({ ...p, basemap: "satellite" })); }}>Vệ tinh</button></div></div>
          <div className="pt-map-controls"><span className="pt-north" title="Bắc địa lý">B<span>↑</span></span><button type="button" onClick={locate} disabled={locating || !mapReady} aria-label="Đến vị trí của tôi" title="Vị trí của tôi"><LocateFixed size={20} /></button><button type="button" onClick={() => fitObjects()} disabled={!plan.objects.length || !mapReady} aria-label="Xem toàn bộ bản vẽ" title="Xem toàn bộ bản vẽ"><Layers size={19} /></button><button type="button" onClick={() => mapRef.current?.zoomIn()} disabled={!mapReady} aria-label="Phóng to">+</button><button type="button" onClick={() => mapRef.current?.zoomOut()} disabled={!mapReady} aria-label="Thu nhỏ">−</button></div>
          {!plan.objects.length && !hasNavigated && tool === "select" && <div className="pt-empty-map"><span><Compass size={30} /></span><h2>Bắt đầu từ khu đất của bạn</h2><p>Tìm địa điểm hoặc địa chỉ phía trên,<br />rồi đặt la bàn đầu tiên.</p><button type="button" className="pt-primary" onClick={() => chooseTool("compass")} disabled={!mapReady}><Compass size={17} />Đặt la bàn</button><button type="button" className="pt-text-button" disabled={!mapReady} onClick={() => { const center = mapRef.current?.getCenter(); if (!center) return; const objects = sampleObjects([center.lat, center.lng]); if (commit(objects)) { setSelectedId(objects[0].id); fitObjects(objects); } }}>Thử với bản vẽ mẫu</button></div>}
          {tileError && <div className="pt-map-error" role="status">Chưa tải được nền bản đồ. Kiểm tra kết nối hoặc đổi nền; bạn vẫn có thể chỉnh bản vẽ.</div>}
          <div className="pt-instruction"><div><span className={`pt-tool-dot pt-dot-${tool}`} /><p>{HINTS[tool]}{draft.length > 0 && <b> Đã chọn {draft.length} điểm.</b>}</p></div>{tool !== "select" && <div className="pt-draft-actions">{(tool === "outline" || tool === "path") && <button type="button" className="pt-primary" disabled={!canFinish} onClick={finishDrawing}><Check size={16} />Hoàn tất</button>}<button type="button" onClick={() => chooseTool("select")}><X size={16} />{draft.length ? "Huỷ" : "Xong"}</button></div>}</div>
        </section>

        <aside className="pt-sidebar" aria-label="Thuộc tính bản vẽ">
          <section className="pt-panel pt-project"><div className="pt-panel-heading"><h2>Bản vẽ của bạn</h2><span className="pt-small-badge">{plan.objects.length} đối tượng</span></div><label className="pt-field"><span>Tên bản vẽ</span><input value={plan.title} maxLength={100} onChange={e => { setCacheCleared(false); setPlan(p => ({ ...p, title: e.target.value || "Bản vẽ của tôi" })); }} /></label><p className="pt-project-stats"><Compass size={14} />{compassCount} la bàn<span>·</span><House size={14} />{plan.objects.filter(o => o.kind === "house" || o.kind === "outline").length} phác thảo nhà</p><div className="pt-label-settings"><span><Eye size={14} />Hiển thị nhãn</span><label><input type="checkbox" checked={plan.showMapLabels} onChange={e => { setCacheCleared(false); setPlan(p => ({ ...p, showMapLabels: e.target.checked })); }} /><span>Nhãn đường / địa danh (vệ tinh)</span></label><label><input type="checkbox" checked={plan.showDrawingLabels} onChange={e => { setCacheCleared(false); setPlan(p => ({ ...p, showDrawingLabels: e.target.checked })); }} /><span>Nhãn đối tượng / kích thước</span></label></div></section>
          {selected ? <section className="pt-panel pt-inspector"><div className="pt-panel-heading"><h2>{KIND_LABEL[selected.kind]}</h2><button type="button" aria-label="Bỏ chọn đối tượng" onClick={() => setSelectedId(null)}><X size={17} /></button></div>
            <label className="pt-field"><span>Tên đối tượng</span><input key={`${selected.id}-${selected.name}-${selected.locked}`} defaultValue={selected.name} maxLength={80} disabled={selected.locked} onBlur={e => { const name = e.target.value.trim(); if (name && name !== selected.name) updateObject(selected.id, { name }); else e.target.value = selected.name; }} /></label>
            <div className="pt-object-actions"><button type="button" onClick={() => commit(plan.objects.map(o => o.id === selected.id ? { ...o, locked: !o.locked } : o))}>{selected.locked ? <LockKeyhole size={15} /> : <UnlockKeyhole size={15} />}{selected.locked ? "Mở khoá" : "Khoá vị trí"}</button><button type="button" onClick={() => fitObjects([selected])}><Crosshair size={15} />Tìm trên bản đồ</button></div>
            <fieldset key={selected.id} disabled={selected.locked} className="pt-properties"><legend className="pt-sr-only">Thuộc tính đối tượng</legend>
              {"heading" in selected && selected.kind !== "rectangle" && <><div className="pt-bearing"><Compass size={29} style={{ transform: `rotate(${selected.heading}deg)` }} /><div><b>{directionName(selected.heading)}</b><span>{selected.heading.toFixed(1)}° từ Bắc</span></div></div><NumberField label={selected.kind === "house" ? "Hướng mặt tiền (°)" : selected.kind === "compass" ? "Hướng tham chiếu (°)" : selected.kind === "door" ? "Hướng nhìn ra ngoài (°)" : "Hướng lưng người nấu (°)"} value={selected.heading} min={0} max={359.9} live={selected.kind === "compass"} onChange={heading => updateObject(selected.id, { heading: normalizeAngle(heading) })} /><div className="pt-direction-buttons">{[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => <button type="button" key={a} aria-label={`${directionName(a)} ${a} độ`} onClick={() => updateObject(selected.id, { heading: a })} aria-pressed={Math.abs(selected.heading - a) < 0.1}>{["B", "ĐB", "Đ", "ĐN", "N", "TN", "T", "TB"][i]}</button>)}</div></>}
              {selected.kind === "rectangle" && <><NumberField label="Góc xoay (°)" value={selected.heading} min={0} max={360} live onChange={heading => updateObject(selected.id, { heading: normalizeAngle(heading) })} /><div className="pt-rectangle-presets" role="group" aria-label="Hướng hình chữ nhật">{[{ label: "Ngang", angle: 0 }, { label: "Dọc", angle: 90 }, { label: "Xéo 45°", angle: 45 }].map(preset => <button type="button" key={preset.angle} aria-pressed={Math.min(Math.abs(selected.heading % 180 - preset.angle), 180 - Math.abs(selected.heading % 180 - preset.angle)) < 0.1} onClick={() => updateObject(selected.id, { heading: preset.angle })}>{preset.label}</button>)}</div><p className="pt-muted">0° nằm ngang; góc tăng theo chiều kim đồng hồ. Có thể nhập góc xéo bất kỳ.</p><div className="pt-field-row"><NumberField label="Ngang (m)" value={selected.width} min={0.2} max={1000} onChange={width => updateObject(selected.id, { width })} /><NumberField label="Sâu (m)" value={selected.depth} min={0.2} max={1000} onChange={depth => updateObject(selected.id, { depth })} /></div><div className="pt-measurement">Diện tích <b>{(selected.width * selected.depth).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} m²</b></div></>}
              {selected.kind === "compass" && <><div className="pt-label-settings pt-opposite-setting"><label><input type="checkbox" checked={selected.showOppositeArrow} onChange={e => updateObject(selected.id, { showOppositeArrow: e.target.checked })} /><span>Hiện mũi tên đối hướng (180°)</span></label>{selected.showOppositeArrow && <p className="pt-opposite-reading">Đối hướng: <b>{directionName(normalizeAngle(selected.heading + 180))} · {normalizeAngle(selected.heading + 180).toFixed(1)}°</b></p>}</div><NumberField label="Bán kính la bàn (m)" value={selected.radius} min={2} max={200} onChange={radius => updateObject(selected.id, { radius })} /><NumberField label="Độ rõ (%)" value={Math.round(selected.opacity * 100)} min={15} max={100} step={1} onChange={opacity => updateObject(selected.id, { opacity: opacity / 100 })} /></>}
              {selected.kind === "house" && <><div className="pt-field-row"><NumberField label="Ngang (m)" value={selected.width} min={0.2} max={1000} onChange={width => updateObject(selected.id, { width })} /><NumberField label="Sâu (m)" value={selected.depth} min={0.2} max={1000} onChange={depth => updateObject(selected.id, { depth })} /></div><div className="pt-measurement">Diện tích phác thảo <b>{(selected.width * selected.depth).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} m²</b></div><button type="button" className="pt-full-button" disabled={!plan.objects.some(o => o.kind === "compass")} onClick={() => { const nearest = plan.objects.filter((o): o is Extract<PlanObject, { kind: "compass" }> => o.kind === "compass").sort((a, b) => distance(a.center, selected.center) - distance(b.center, selected.center))[0]; if (nearest) updateObject(selected.id, { heading: nearest.heading }); }}><Compass size={15} />Theo hướng la bàn gần nhất</button></>}
              {selected.kind === "outline" && <div className="pt-measurement">Diện tích phác thảo <b>{polygonArea(selected.points).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} m²</b></div>}
              {(selected.kind === "door" || selected.kind === "kitchen") && <NumberField label="Độ dài mũi tên (m)" value={selected.length} min={0.2} max={1000} onChange={length => updateObject(selected.id, { length })} />}
              {selected.kind === "path" && <><div className="pt-measurement">Tổng chiều dài <b>{pathLength(selected.points).toFixed(1)} m</b></div><div className="pt-segments">{selected.points.slice(1).map((p, i) => <div key={i}><span>Đoạn {i + 1}</span><b>{directionName(bearing(selected.points[i], p))} · {bearing(selected.points[i], p).toFixed(1)}°</b><small>{distance(selected.points[i], p).toFixed(1)} m</small></div>)}</div></>}
              {selectedCenter && <details className="pt-position"><summary>Toạ độ & di chuyển chính xác<ChevronDown size={14} /></summary><NumberField label="Vĩ độ tâm" value={selectedCenter[0]} min={-80} max={80} step={0.000001} onChange={lat => moveSelected([lat, selectedCenter[1]])} /><NumberField label="Kinh độ tâm" value={selectedCenter[1]} min={-180} max={180} step={0.000001} onChange={lng => moveSelected([selectedCenter[0], lng])} /><button type="button" className="pt-full-button" onClick={() => { const c = mapRef.current?.getCenter(); if (c) moveSelected([c.lat, c.lng]); }}><Crosshair size={15} />Đưa đến tâm bản đồ</button>{"points" in selected && <div className="pt-vertex-fields">{selected.points.map((point, i) => <details key={i}><summary>Điểm {i + 1}<ChevronDown size={14} /></summary><NumberField label={`Vĩ độ điểm ${i + 1}`} value={point[0]} min={-80} max={80} step={0.000001} onChange={lat => updateObject(selected.id, { points: selected.points.map((p, j) => j === i ? [lat, p[1]] : p) })} /><NumberField label={`Kinh độ điểm ${i + 1}`} value={point[1]} min={-180} max={180} step={0.000001} onChange={lng => updateObject(selected.id, { points: selected.points.map((p, j) => j === i ? [p[0], lng] : p) })} /></details>)}</div>}</details>}
            </fieldset>
            {selected.locked && <p className="pt-muted">Đã khoá. Mở khoá để di chuyển hoặc chỉnh sửa.</p>}
            <button type="button" className="pt-delete" disabled={selected.locked} onClick={() => { if (commit(plan.objects.filter(o => o.id !== selected.id))) setSelectedId(null); }}><Trash2 size={15} />Xoá đối tượng</button>
          </section> : <section className="pt-panel pt-quick-guide"><span className="pt-guide-icon"><MousePointer2 size={21} /></span><h2>Mỗi vị trí, một góc nhìn</h2><p>Chọn công cụ phía trên để thêm đối tượng. Chọn một đối tượng trên bản đồ hoặc danh sách để xem hướng và kích thước.</p><div><span>01</span><p>Đặt la bàn vào tâm khu đất</p></div><div><span>02</span><p>Vẽ nhà theo tỉ lệ thực tế</p></div><div><span>03</span><p>Đánh dấu cửa, bếp và lối vào</p></div></section>}
          <section className="pt-panel"><div className="pt-panel-heading"><h2>Các lớp bản vẽ</h2><Layers size={16} /></div>{!plan.objects.length ? <p className="pt-muted">Các la bàn và nét vẽ sẽ xuất hiện ở đây.</p> : <div className="pt-object-list">{plan.objects.map(o => { const Icon = ICONS[o.kind]; return <button type="button" className={selectedId === o.id ? "is-selected" : ""} key={o.id} onClick={() => { chooseTool("select"); setSelectedId(o.id); }}><span className="pt-layer-icon" style={{ color: KIND_COLOR[o.kind] }}><Icon size={18} aria-hidden /></span><span><b>{o.name}</b><small>{o.kind === "rectangle" ? `${o.width.toFixed(1)} × ${o.depth.toFixed(1)} m · ${o.heading.toFixed(1)}°` : "heading" in o ? `${directionName(o.heading)} · ${o.heading.toFixed(1)}°` : `${o.points.length} điểm`}</small></span>{o.locked && <LockKeyhole size={14} />}</button>; })}</div>}</section>
          <section className="pt-panel pt-storage"><div className="pt-panel-heading"><h2>Bộ nhớ trình duyệt</h2><Save size={16} /></div><p className="pt-muted">Tự lưu các đối tượng, nét đang vẽ và lựa chọn nhãn. Dữ liệu được giữ khi tải lại hoặc đóng trình duyệt, đến khi bạn xoá dữ liệu trang hoặc dùng nút bên dưới.</p><button type="button" className="pt-delete" disabled={!loaded || cacheCleared} onClick={() => clearCacheDialogRef.current?.showModal()}><Trash2 size={15} />Xoá bộ nhớ bản vẽ</button></section><details className="pt-panel pt-help"><summary>Đọc hướng trên bản đồ<ChevronDown size={16} /></summary><p>0° là Bắc, 90° Đông, 180° Nam, 270° Tây. La bàn dùng Bắc địa lý của bản đồ; số đo la bàn từ tính ngoài thực địa có thể lệch.</p><p><b>Cửa chính:</b> mũi tên từ cửa nhìn ra ngoài nhà. <b>Bếp:</b> mũi tên theo hướng lưng người đứng nấu. <b>Lối vào:</b> vẽ từ đường đến nhà; hướng từng đoạn hiển thị khi chọn lối đi.</p><p>Kích thước dùng mét, giữ theo vị trí địa lý khi zoom. Bản phác thảo giúp xem bố trí và hướng; ứng dụng chưa luận cát hung theo tuổi hoặc mệnh.</p><p>Kéo la bàn để dời vị trí. Với nhà và lối đi, kéo tay nắm tâm hoặc từng đỉnh khi được chọn. Có thể nhập toạ độ tâm thay cho kéo thả. Chọn Hoàn tác để khôi phục đối tượng vừa xoá.</p><p>Nền bản đồ cần Internet; bản vẽ lưu trong trình duyệt này. Xuất tệp để giữ một bản sao.</p><p>Nguồn bản đồ: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>, <a href="https://doc.arcgis.com/en/data-appliance/2025/maps/world-imagery.htm" target="_blank" rel="noreferrer">Esri World Imagery</a>.</p></details>
        </aside>
      </div>
      <footer className="pt-bottom-bar"><span><span className="pt-live-dot" />Bắc địa lý · Kích thước theo mét</span><span>{plan.center[0].toFixed(5)}, {plan.center[1].toFixed(5)}<span className="pt-zoom-label">Thu phóng {plan.zoom}</span></span></footer>
    </div>
    <dialog ref={clearCacheDialogRef} className="pt-clear-dialog" aria-labelledby="pt-clear-title" aria-describedby="pt-clear-description"><h2 id="pt-clear-title">Xoá bộ nhớ bản vẽ?</h2><p id="pt-clear-description">Xoá toàn bộ la bàn, nhà, hình chữ nhật, cửa, bếp, lối vào và nét đang vẽ đã lưu trên trình duyệt này. Thao tác này không thể hoàn tác.</p><div><button type="button" autoFocus onClick={() => clearCacheDialogRef.current?.close()}>Huỷ</button><button type="button" className="pt-clear-confirm" onClick={clearBrowserCache}><Trash2 size={16} />Xoá toàn bộ bản vẽ</button></div></dialog>
    {message && <div className="pt-notice" role="status"><span>{message}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setMessage("")}><X size={17} /></button></div>}
  </main>;
}

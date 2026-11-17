"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Pane, Polygon, Polyline, ScaleControl, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { bearing, centroid, destination, DIRECTION_SHORT, directionName, distance, KIND_COLOR, moveObject, normalizeAngle, objectCenter, rectangle, rectangleFromPoints, type Plan, type PlanObject, type Point, type Tool } from "./model";
import "leaflet/dist/leaflet.css";
import type { MapPlace } from "./places";

interface Props {
  plan: Plan; tool: Tool; draft: Point[]; selectedId: string | null; selectedPlace: MapPlace | null;
  onReady: (map: L.Map) => void;
  onViewChange: (center: Point, zoom: number) => void;
  onClick: (point: Point) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PlanObject>) => void;
  onTileError: (error: boolean) => void;
}

function compassSvg(heading: number, opacity: number, selected: boolean, size: number, showOppositeArrow: boolean): string {
  const xy = (angle: number, radius: number) => { const rad = (angle - 90) * Math.PI / 180; return `${200 + Math.cos(rad) * radius},${200 + Math.sin(rad) * radius}`; };
  const sectors = Array.from({ length: 8 }, (_, i) => `<path d="M200 200 L${xy(i * 45 - 22.5, 174)} A174 174 0 0 1 ${xy(i * 45 + 22.5, 174)} Z" fill="${i % 2 ? "#dbe8e3" : "#f5f0e5"}" fill-opacity=".38"/>`).join("");
  const ticks = Array.from({ length: 72 }, (_, i) => `<line x1="200" y1="25" x2="200" y2="${i % 9 === 0 ? 44 : i % 3 === 0 ? 37 : 32}" transform="rotate(${i * 5} 200 200)" stroke="#4c4b5c" stroke-width="${i % 9 === 0 ? 2 : 1}"/>`).join("");
  const labelSize = Math.max(18, Math.min(42, 11 * 400 / size));
  const labels = DIRECTION_SHORT.map((label, i) => { const [x, y] = xy(i * 45, 143).split(","); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${i === 0 ? labelSize * 1.15 : labelSize}" font-weight="700" fill="${i === 0 ? "#ac384e" : "#3f4156"}">${label}</text>`; }).join("");
  const degreeLabels = size < 180 ? "" : Array.from({ length: 8 }, (_, i) => { const [x, y] = xy(i * 45, 186).split(","); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${Math.max(11, 8 * 400 / size)}" fill="#4c4b5c">${i * 45}°</text>`; }).join("");
  const oppositeArrow = showOppositeArrow ? `<g class="pt-opposite-arrow" data-heading="${normalizeAngle(heading + 180)}" transform="rotate(${normalizeAngle(heading + 180)} 200 200)"><path d="M200 62 L192 85 L208 85 Z" fill="#b35e23"/><line x1="200" y1="80" x2="200" y2="200" stroke="#b35e23" stroke-width="3" stroke-dasharray="6 5"/></g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><g opacity="${opacity}"><circle class="pt-compass-ring" cx="200" cy="200" r="195" fill="#fffcf5" fill-opacity=".33" stroke="${selected ? "#6654b5" : "#5d6172"}" stroke-width="${selected ? 3 : 1.5}"/>${sectors}<circle cx="200" cy="200" r="174" fill="none" stroke="#6c6b78" stroke-width="1"/><circle cx="200" cy="200" r="110" fill="none" stroke="#6c6b78" stroke-dasharray="3 6" stroke-width=".8"/>${ticks}${labels}${degreeLabels}<line x1="200" y1="65" x2="200" y2="335" stroke="#5c6270" stroke-opacity=".4"/><line x1="65" y1="200" x2="335" y2="200" stroke="#5c6270" stroke-opacity=".4"/><path d="M200 93 L194 110 L206 110 Z" fill="#ac384e"/><g class="pt-reference-arrow" data-heading="${heading}" transform="rotate(${heading} 200 200)"><path d="M200 62 L192 85 L208 85 Z" fill="#6654b5"/><line x1="200" y1="80" x2="200" y2="200" stroke="#6654b5" stroke-width="3" stroke-dasharray="6 5"/></g>${oppositeArrow}</g><circle class="pt-compass-hit" cx="200" cy="200" r="${Math.max(13, 22 * 400 / size)}" fill="transparent"/><circle class="pt-compass-center" cx="200" cy="200" r="13" fill="white" stroke="#6654b5" stroke-width="2"/><path d="M194 200h12M200 194v12" stroke="#6654b5" stroke-width="1.6"/></svg>`;
}

function handleIcon(color: string, center = false): L.DivIcon {
  return L.divIcon({ className: `pt-map-handle${center ? " pt-map-center-handle" : ""}`, html: `<span style="--handle-color:${color}">${center ? "+" : ""}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
}
const CENTER_ICON = handleIcon("#386aa5", true);
const VERTEX_ICON = handleIcon("#386aa5");
function directionIcon(kind: "door" | "kitchen"): L.DivIcon {
  const color = KIND_COLOR[kind];
  const path = kind === "door" ? '<path d="M7 20V4h10v16M4 20h16M13 12h1"/>' : '<path d="M13 3c1 5-3 5-2 8-2-1-2-3-2-3-5 5-4 12 3 13 8-1 8-9 4-12 0 4-3 4-3 4s3-6 0-10Z"/>';
  return L.divIcon({ className: "pt-direction-marker", html: `<span style="background:${color}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
}

function CompassLayer({ object, active, enabled, showLabels, onSelect, onUpdate }: { object: Extract<PlanObject, { kind: "compass" }>; active: boolean; enabled: boolean; showLabels: boolean; onSelect: () => void; onUpdate: Props["onUpdate"] }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const icon = useMemo(() => {
    const north = destination(object.center, object.radius, 0);
    const radius = Math.abs(map.project(north, zoom).y - map.project(object.center, zoom).y);
    const size = Math.max(4, radius * 2 * 200 / 195);
    return L.divIcon({ className: `pt-compass-marker${active ? " is-selected" : ""}${object.locked ? " is-locked" : ""}`, html: compassSvg(object.heading, object.opacity, active, size, object.showOppositeArrow), iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }, [object.center, object.radius, object.heading, object.opacity, object.locked, object.showOppositeArrow, active, map, zoom]);
  return <Marker key={String(enabled)} position={object.center} icon={icon} draggable={enabled && !object.locked} interactive={enabled} keyboard={enabled} title={object.name} alt={object.name} zIndexOffset={active ? 20 : -100} eventHandlers={{
    click: e => { L.DomEvent.stopPropagation(e); onSelect(); },
    dragend: e => { const marker = e.target as L.Marker; const p = marker.getLatLng(); marker.setLatLng(object.center); onUpdate(object.id, { center: [p.lat, p.lng] }); },
  }}>{showLabels && <Tooltip direction="bottom" offset={[0, 20]}>{object.name} · {directionName(object.heading)} {object.heading.toFixed(1)}°</Tooltip>}</Marker>;
}

function Arrow({ start, end, color, selected = false, enabled, onSelect, label }: { start: Point; end: Point; color: string; selected?: boolean; enabled: boolean; onSelect?: () => void; label?: string }) {
  const heading = bearing(start, end);
  const length = distance(start, end);
  const arrowSize = Math.min(length * 0.28, 2);
  const head = [end, destination(end, arrowSize, heading + 155), destination(end, arrowSize, heading - 155)];
  const events = { click: (e: L.LeafletMouseEvent) => { L.DomEvent.stopPropagation(e); onSelect?.(); } };
  return <><Polyline positions={[start, end]} interactive={enabled} bubblingMouseEvents={false} pathOptions={{ color, weight: selected ? 5 : 3, opacity: 0.95 }} eventHandlers={events}>{label && <Tooltip permanent={selected} direction="center" className="pt-map-label">{label}</Tooltip>}</Polyline><Polygon positions={head} interactive={enabled} bubblingMouseEvents={false} pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 1 }} eventHandlers={events} /></>;
}

function ObjectLayer({ object, active, enabled, showLabels, onSelect, onUpdate }: { object: PlanObject; active: boolean; enabled: boolean; showLabels: boolean; onSelect: () => void; onUpdate: Props["onUpdate"] }) {
  const color = KIND_COLOR[object.kind];
  if (object.kind === "compass") return <CompassLayer object={object} active={active} enabled={enabled} showLabels={showLabels} onSelect={onSelect} onUpdate={onUpdate} />;
  const points = (object.kind === "house" || object.kind === "rectangle") ? rectangle(object.center, object.width, object.depth, object.heading) : "points" in object ? object.points : [object.center, destination(object.center, object.length, object.heading)];
  const center = objectCenter(object);
  const isHouse = object.kind === "house" || object.kind === "outline" || object.kind === "rectangle";
  const canEdit = active && enabled && !object.locked;
  const click = (e: L.LeafletMouseEvent) => { L.DomEvent.stopPropagation(e); onSelect(); };
  return <>
    {isHouse && <><Polygon key={`shape-${enabled}`} positions={points} interactive={enabled} bubblingMouseEvents={false} pathOptions={{ color, weight: active ? 3 : 2, fillColor: object.kind === "rectangle" ? "#e7c27e" : "#a3c9e9", fillOpacity: 0.23 }} eventHandlers={{ click }}>{showLabels && <Tooltip permanent direction="center" className="pt-map-label">{object.name}</Tooltip>}</Polygon>{active && showLabels && points.map((p, i) => {
      const next = points[(i + 1) % points.length];
      return <Polyline key={`edge-${i}`} positions={[p, next]} interactive={false} pathOptions={{ weight: 0, opacity: 0 }}><Tooltip permanent direction="center" className="pt-edge-label">{distance(p, next).toFixed(1)} m</Tooltip></Polyline>;
    })}</>}
    {object.kind === "house" && <Arrow start={centroid([points[0], points[1]])} end={destination(centroid([points[0], points[1]]), Math.min(4, object.depth / 3), object.heading)} color={color} enabled={enabled} onSelect={onSelect} label={showLabels ? `Mặt tiền · ${directionName(object.heading)}` : undefined} />}
    {(object.kind === "door" || object.kind === "kitchen") && <><Arrow start={points[0]} end={points[1]} color={color} selected={active} enabled={enabled} onSelect={onSelect} label={showLabels ? `${object.name} · ${directionName(object.heading)} ${object.heading.toFixed(1)}°` : undefined} /><Marker key={`dir-${enabled}`} position={center} icon={directionIcon(object.kind)} interactive={enabled} keyboard={enabled} draggable={enabled && !object.locked} bubblingMouseEvents={false} title={object.name} eventHandlers={{ click, dragend: e => { const marker = e.target as L.Marker; const p = marker.getLatLng(); marker.setLatLng(center); onUpdate(object.id, { center: [p.lat, p.lng] }); } }}>{showLabels && <Tooltip>{object.name}</Tooltip>}</Marker></>}
    {object.kind === "path" && points.slice(1).map((p, i) => <Arrow key={`segment-${i}`} start={points[i]} end={p} color={color} selected={active} enabled={enabled} onSelect={onSelect} label={showLabels ? `${object.name} · ${distance(points[i], p).toFixed(1)} m · ${directionName(bearing(points[i], p))}` : undefined} />)}
    {canEdit && isHouse && <Marker position={center} icon={object.kind === "rectangle" ? handleIcon(color, true) : CENTER_ICON} draggable title={object.kind === "rectangle" ? "Di chuyển hình chữ nhật" : "Di chuyển cả ngôi nhà"} eventHandlers={{ click, dragend: e => { const marker = e.target as L.Marker; const p = marker.getLatLng(); marker.setLatLng(center); onUpdate(object.id, moveObject(object, [p.lat, p.lng])); } }} />}
    {canEdit && object.kind === "path" && <Marker position={center} icon={handleIcon(color, true)} draggable title="Di chuyển cả lối đi" eventHandlers={{ click, dragend: e => { const marker = e.target as L.Marker; const p = marker.getLatLng(); marker.setLatLng(center); onUpdate(object.id, moveObject(object, [p.lat, p.lng])); } }} />}
    {canEdit && (object.kind === "outline" || object.kind === "path") && points.map((point, i) => <Marker position={point} key={`vertex-${i}`} icon={VERTEX_ICON} draggable title={`Kéo điểm ${i + 1}`} eventHandlers={{ click, dragend: e => { const marker = e.target as L.Marker; const p = marker.getLatLng(); marker.setLatLng(point); onUpdate(object.id, { points: points.map((v, j) => j === i ? [p.lat, p.lng] : v) }); } }} />)}
    {canEdit && (object.kind === "door" || object.kind === "kitchen") && <Marker position={points[1]} icon={handleIcon(color)} draggable title="Kéo để đổi hướng và độ dài" eventHandlers={{ click, dragend: e => { const marker = e.target as L.Marker; const p = marker.getLatLng(); marker.setLatLng(points[1]); const end: Point = [p.lat, p.lng]; onUpdate(object.id, { heading: bearing(center, end), length: distance(center, end) }); } }} />}
  </>;
}

function MapBehavior(props: Props) {
  const [hover, setHover] = useState<Point | null>(null);
  const map = useMapEvents({
    click: e => props.onClick([e.latlng.lat, e.latlng.lng]),
    mousemove: e => { if (props.draft.length) setHover([e.latlng.lat, e.latlng.lng]); },
    mouseout: () => setHover(null),
    moveend: () => { const c = map.getCenter(); props.onViewChange([Math.max(-80, Math.min(80, c.lat)), normalizeAngle(c.lng + 180) - 180], map.getZoom()); },
  });
  useEffect(() => { props.onReady(map); }, [map, props.onReady]);
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false })); observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => { setHover(null); map.getContainer().classList.toggle("pt-is-drawing", props.tool !== "select"); }, [map, props.tool, props.draft.length]);
  const rectanglePreview = props.tool === "rectangle" && props.draft.length === 2 && hover ? rectangleFromPoints(props.draft[0], props.draft[1], hover) : null;
  const preview = props.draft.length ? [...props.draft, ...(hover && !(props.tool === "rectangle" && props.draft.length === 2) ? [hover] : [])] : [];
  return <>{rectanglePreview && <Polygon positions={rectangle(rectanglePreview.center, rectanglePreview.width, rectanglePreview.depth, rectanglePreview.heading)} interactive={false} pathOptions={{ color: KIND_COLOR.rectangle, weight: 2, dashArray: "6 6", fillColor: "#e7c27e", fillOpacity: 0.2 }}>{props.plan.showDrawingLabels && <Tooltip permanent direction="center" className="pt-map-label">{rectanglePreview.width.toFixed(1)} × {rectanglePreview.depth.toFixed(1)} m</Tooltip>}</Polygon>}{preview.length > 1 && <Polyline positions={preview} interactive={false} pathOptions={{ color: KIND_COLOR[props.tool as keyof typeof KIND_COLOR] ?? "#6654b5", weight: 2, dashArray: "6 6" }} />}{props.draft.map((p, i) => <CircleMarker key={i} center={p} radius={5} interactive={false} pathOptions={{ color: "#6654b5", fillColor: "white", fillOpacity: 1, weight: 2 }} />)}</>;
}

export default function PhongThuyMap(props: Props) {
  const { plan, tool, selectedId, onSelect, onUpdate } = props;
  const [errors, setErrors] = useState(0);
  useEffect(() => { setErrors(0); }, [plan.basemap]);
  return <MapContainer className="pt-leaflet-map" center={plan.center} zoom={plan.zoom} minZoom={3} maxZoom={23} maxBounds={[[-80, -180], [80, 180]]} maxBoundsViscosity={1} zoomControl={false} doubleClickZoom={false} attributionControl keyboard>
    <TileLayer key={plan.basemap} url={plan.basemap === "satellite" ? "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"} maxNativeZoom={19} maxZoom={23} attribution={plan.basemap === "satellite" ? '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, GIS User Community' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} eventHandlers={{ tileerror: () => { setErrors(e => e + 1); if (errors >= 2) props.onTileError(true); }, tileload: () => props.onTileError(false) }} />
    {plan.basemap === "satellite" && plan.showMapLabels && <Pane name="place-labels" style={{ zIndex: 350, pointerEvents: "none" }}><TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={23} attribution="Roads &amp; labels: Esri, HERE, Garmin" /><TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxNativeZoom={19} maxZoom={23} /></Pane>}
    {props.selectedPlace && <CircleMarker center={props.selectedPlace.point} radius={7} interactive={false} pathOptions={{ color: "white", weight: 3, fillColor: "#bd3d59", fillOpacity: 1 }}>{plan.showMapLabels && <Tooltip permanent direction="top" offset={[0, -9]} className="pt-place-pin-label">{props.selectedPlace.name}</Tooltip>}</CircleMarker>}
    <ScaleControl position="bottomleft" imperial={false} />
    <MapBehavior {...props} />
    {plan.objects.filter(o => o.kind === "compass").map(o => <ObjectLayer key={o.id} object={o} active={selectedId === o.id} enabled={tool === "select"} showLabels={plan.showDrawingLabels} onSelect={() => onSelect(o.id)} onUpdate={onUpdate} />)}
    {plan.objects.filter(o => o.kind !== "compass").map(o => <Fragment key={o.id}><ObjectLayer object={o} active={selectedId === o.id} enabled={tool === "select"} showLabels={plan.showDrawingLabels} onSelect={() => onSelect(o.id)} onUpdate={onUpdate} /></Fragment>)}
  </MapContainer>;
}

"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { SpeedZonePrediction } from "@karaoke/shared";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface HudMiniMapProps {
  coords: { lat: number; lng: number } | null;
  heading: number;
  predictions: SpeedZonePrediction[];
  carMode?: boolean;
}

function MapUpdater({ coords }: { coords: { lat: number; lng: number } | null }) {
  const map = useMap();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!coords) return;
    const size = map.getSize();
    // GPS dot tại 80% chiều cao từ trên
    const offsetY = size.y * 0.3;
    const targetPoint = map.project([coords.lat, coords.lng], 19);
    const newCenter = map.unproject(L.point(targetPoint.x, targetPoint.y - offsetY), 19);

    if (!initializedRef.current) {
      map.setView(newCenter, 19, { animate: false });
      initializedRef.current = true;
    } else {
      map.panTo(newCenter, { animate: true, duration: 0.4 });
    }
  }, [coords, map]);

  return null;
}

// Car mode: larger icons + white core glow for windshield visibility
function createSignIcon(speed: number, isNearest: boolean, carMode = false) {
  const size = carMode ? (isNearest ? 54 : 44) : (isNearest ? 42 : 34);
  const border = carMode ? (isNearest ? 6 : 5) : (isNearest ? 5 : 4);
  const fontSize = carMode ? (isNearest ? 21 : 17) : (isNearest ? 16 : 13);
  const redAlpha = carMode ? (isNearest ? 0.9 : 0.65) : (isNearest ? 0.6 : 0.3);
  const glowPx = carMode ? (isNearest ? "32px" : "18px") : (isNearest ? "20px" : "8px");
  const coreShadow = carMode ? `0 0 5px rgba(255,255,255,0.95), ` : "";
  return L.divIcon({
    html: `<div style="background:white;width:${size}px;height:${size}px;border-radius:50%;border:${border}px solid #dc2626;display:flex;align-items:center;justify-content:center;color:black;font-family:sans-serif;font-weight:900;font-size:${fontSize}px;box-shadow:${coreShadow}0 2px 10px rgba(220,38,38,${redAlpha}),0 0 ${glowPx} rgba(220,38,38,${redAlpha});">${speed}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createPositionIcon(heading: number) {
  return L.divIcon({
    html: `
      <div style="width:52px;height:52px;border-radius:50%;background:rgba(0,0,0,0.75);border:2px solid rgba(74,222,128,0.7);display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(74,222,128,0.4);">
        <div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:24px solid #4ade80;transform:rotate(${heading}deg);filter:drop-shadow(0 0 6px rgba(74,222,128,0.9));transform-origin:center;"></div>
      </div>`,
    className: "",
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
}

// Car/HUD mode: small green dot — clean anchor without directional clutter
function createPositionIconCar() {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px rgba(74,222,128,1),0 0 18px rgba(74,222,128,0.5);"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function HudMiniMap({ coords, heading, predictions, carMode = false }: HudMiniMapProps) {
  if (!coords) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-slate-500 text-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="uppercase tracking-widest text-[10px]">Đang đợi GPS...</span>
        </div>
      </div>
    );
  }

  if (carMode) {
    // ── CAR / HUD MODE ──
    // Nền đen tuyệt đối = trong suốt hoàn toàn trên kính xe
    // Chỉ hiển thị biển báo tốc độ (trắng-đỏ, glow mạnh) và dot vị trí
    return (
      <div className="w-full h-full relative z-0 overflow-hidden">
        <MapContainer
          center={[coords.lat, coords.lng]}
          zoom={19}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
          style={{ background: "#000000" }}
        >
          <MapUpdater coords={coords} />

          {/* Dot vị trí nhỏ — anchor cho không gian tọa độ */}
          <Marker
            position={[coords.lat, coords.lng]}
            icon={createPositionIconCar()}
            zIndexOffset={100}
          />

          {/* Biển báo tốc độ phía trước — to hơn + glow mạnh hơn cho windshield */}
          {predictions.map((pred, idx) =>
            pred.lat && pred.lng ? (
              <Marker
                key={`pred-${idx}-${pred.lat}-${pred.lng}`}
                position={[pred.lat, pred.lng]}
                icon={createSignIcon(pred.nextMaxSpeed, idx === 0, true)}
                zIndexOffset={90 - idx}
              />
            ) : null
          )}
        </MapContainer>
      </div>
    );
  }

  // ── NORMAL MODE ──
  return (
    <div className="w-full h-full relative z-0 overflow-hidden">

      {/* Compass rose */}
      <div className="absolute top-[72px] right-2 z-[1000] pointer-events-none flex flex-col items-center">
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "rgba(0,0,0,0.65)", border: "1px solid rgba(34,211,238,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)", position: "relative",
        }}>
          <div style={{ position: "absolute", top: 2, fontSize: 9, fontWeight: 900, color: "#f87171", letterSpacing: 1 }}>N</div>
          <div style={{
            width: 0, height: 0,
            borderLeft: "7px solid transparent", borderRight: "7px solid transparent",
            borderBottom: "18px solid #22d3ee",
            transform: `rotate(${heading}deg)`,
            filter: "drop-shadow(0 0 4px rgba(34,211,238,0.8))",
            transition: "transform 0.4s ease-out",
          }} />
        </div>
        <span style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{Math.round(heading)}°</span>
      </div>

      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={19}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "#0a0a0a" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <MapUpdater coords={coords} />

        <Marker
          position={[coords.lat, coords.lng]}
          icon={createPositionIcon(heading)}
          zIndexOffset={100}
        />

        {predictions.map((pred, idx) =>
          pred.lat && pred.lng ? (
            <Marker
              key={`pred-${idx}-${pred.lat}-${pred.lng}`}
              position={[pred.lat, pred.lng]}
              icon={createSignIcon(pred.nextMaxSpeed, idx === 0)}
              zIndexOffset={90 - idx}
            />
          ) : null
        )}
      </MapContainer>
    </div>
  );
}

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

function createSignIcon(speed: number, isNearest: boolean) {
  const size = isNearest ? 42 : 34;
  const borderWidth = isNearest ? 5 : 4;
  const fontSize = isNearest ? 16 : 13;
  const glow = isNearest ? "rgba(220,38,38,0.6)" : "rgba(220,38,38,0.3)";
  return L.divIcon({
    html: `<div style="background:white;width:${size}px;height:${size}px;border-radius:50%;border:${borderWidth}px solid #dc2626;display:flex;align-items:center;justify-content:center;color:black;font-family:sans-serif;font-weight:900;font-size:${fontSize}px;box-shadow:0 2px 10px ${glow},0 0 ${isNearest ? "20px" : "8px"} ${glow};">${speed}</div>`,
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

export default function HudMiniMap({ coords, heading, predictions }: HudMiniMapProps) {
  if (!coords) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e] text-slate-500 text-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="uppercase tracking-widest text-[10px]">Đang đợi GPS...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative z-0 overflow-hidden">

      {/* Compass rose — góc phải, dưới biển báo limit */}
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

      {/* Mũi tên cố định — dưới giữa màn hình, anchor cho GPS dot */}
      <div className="absolute z-[1000] pointer-events-none" style={{ bottom: "16%", left: "50%", transform: "translateX(-50%)" }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: "20px solid transparent", borderRight: "20px solid transparent",
          borderBottom: "44px solid #22d3ee",
          filter: "drop-shadow(0px 0px 14px rgba(34,211,238,0.9)) drop-shadow(0px 0px 28px rgba(34,211,238,0.5))",
        }} />
        <div style={{
          position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
          width: 12, height: 12, borderRadius: "50%",
          backgroundColor: "#22d3ee", boxShadow: "0 0 10px rgba(34,211,238,0.8)",
        }} />
      </div>

      {/* Bản đồ north-up — không rotate DOM */}
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

        {/* Marker vị trí hiện tại — mũi tên xoay theo heading */}
        <Marker
          position={[coords.lat, coords.lng]}
          icon={createPositionIcon(heading)}
          zIndexOffset={100}
        />

        {/* Biển báo tốc độ phía trước */}
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

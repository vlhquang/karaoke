"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { SpeedZonePrediction } from "@karaoke/shared";

// Fix default icon
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

/**
 * Offsets the map so the current position sits at the bottom ~80% of the viewport,
 * not at the center. This way the arrow at the bottom aligns with the GPS position.
 */
function MapUpdater({ coords }: { coords: { lat: number; lng: number } | null }) {
  const map = useMap();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!coords) return;

    const size = map.getSize();
    // We want the GPS dot to appear at 80% height from top (bottom 20%)
    // Leaflet centers at 50%, so we need to offset by 30% of height upward in pixels
    const offsetY = size.y * 0.3;

    const targetPoint = map.project([coords.lat, coords.lng], 19);
    // Shift the center UP so the GPS position ends up near the bottom
    const newCenter = map.unproject(
      L.point(targetPoint.x, targetPoint.y - offsetY),
      19
    );

    if (!initializedRef.current) {
      map.setView(newCenter, 19, { animate: false });
      initializedRef.current = true;
    } else {
      map.panTo(newCenter, { animate: true, duration: 0.4 });
    }
  }, [coords, map]);

  return null;
}

export default function HudMiniMap({ coords, heading, predictions }: HudMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!coords) return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e] text-slate-500 text-xs">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="uppercase tracking-widest text-[10px]">Đang đợi GPS...</span>
      </div>
    </div>
  );

  const createSignIcon = (speed: number, isNearest: boolean) => {
    const size = isNearest ? 42 : 34;
    const borderWidth = isNearest ? 5 : 4;
    const fontSize = isNearest ? 16 : 13;
    const glowColor = isNearest ? "rgba(220,38,38,0.6)" : "rgba(220,38,38,0.3)";

    return L.divIcon({
      html: `
        <div style="
          background-color: white;
          width: ${size}px; height: ${size}px;
          border-radius: 50%;
          border: ${borderWidth}px solid #dc2626;
          display: flex; align-items: center; justify-content: center;
          color: black; font-family: sans-serif; font-weight: 900; font-size: ${fontSize}px;
          box-shadow: 0 2px 10px ${glowColor}, 0 0 ${isNearest ? '20px' : '8px'} ${glowColor};
        ">
          ${speed}
        </div>
      `,
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  const createInvisibleIcon = () => {
    return L.divIcon({
      html: `<div style="width:0;height:0;"></div>`,
      className: "",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative z-0 overflow-hidden">

      {/* ── Fixed navigation arrow at BOTTOM CENTER ── */}
      <div
        className="absolute z-[1000] pointer-events-none"
        style={{
          bottom: "16%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        {/* Arrow triangle pointing UP */}
        <div style={{
          width: 0,
          height: 0,
          borderLeft: "20px solid transparent",
          borderRight: "20px solid transparent",
          borderBottom: "44px solid #22d3ee",
          filter: "drop-shadow(0px 0px 14px rgba(34,211,238,0.9)) drop-shadow(0px 0px 28px rgba(34,211,238,0.5))",
        }}></div>
        {/* Base dot */}
        <div style={{
          position: "absolute",
          bottom: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          backgroundColor: "#22d3ee",
          boxShadow: "0 0 10px rgba(34,211,238,0.8)",
        }}></div>
      </div>

      {/* ── Map container — oversized, rotated around the bottom anchor point ── */}
      {/*
        The map container is 200%×200%, positioned so the arrow's bottom-center
        position (50% x, 80% y) maps to the CSS transform-origin.
        When rotated, the map spins around the arrow position = the GPS location.
      */}
      <div
        style={{
          width: "200%",
          height: "200%",
          position: "absolute",
          /* Center the oversized map so the 50%,80% point of the
             original viewport lands at the arrow position */
          top: "-120%",
          left: "-50%",
          transform: `rotate(${-heading}deg)`,
          transformOrigin: "50% 90%",
          transition: "transform 0.5s ease-out",
        }}
      >
        <MapContainer
          center={[coords.lat, coords.lng]}
          zoom={19}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
          style={{ background: "#e8e4d8" }}
        >
          <TileLayer
            url="https://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}"
          />
          <MapUpdater coords={coords} />

          {/* Invisible position marker (for panning) */}
          <Marker
            position={[coords.lat, coords.lng]}
            icon={createInvisibleIcon()}
            zIndexOffset={100}
          />

          {/* Predicted zone markers — up to 3 */}
          {predictions.map((pred, idx) => (
            pred.lat && pred.lng ? (
              <Marker
                key={`pred-${idx}-${pred.lat}-${pred.lng}`}
                position={[pred.lat, pred.lng]}
                icon={createSignIcon(pred.nextMaxSpeed, idx === 0)}
                zIndexOffset={90 - idx}
              />
            ) : null
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

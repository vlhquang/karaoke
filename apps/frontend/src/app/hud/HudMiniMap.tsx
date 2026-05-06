"use client";

import { useEffect, useRef } from "react";
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
  prediction: SpeedZonePrediction | null;
}

function MapUpdater({ coords, heading }: { coords: { lat: number; lng: number } | null; heading: number }) {
  const map = useMap();
  const initializedRef = useRef(false);
  
  useEffect(() => {
    if (coords) {
      if (!initializedRef.current) {
        map.setView([coords.lat, coords.lng], 17);
        initializedRef.current = true;
      } else {
        map.panTo([coords.lat, coords.lng], { animate: true, duration: 0.5 });
      }
    }
  }, [coords, map]);

  return null;
}

export default function HudMiniMap({ coords, heading, prediction }: HudMiniMapProps) {
  if (!coords) return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e] text-slate-500 text-xs">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="uppercase tracking-widest text-[10px]">Đang đợi GPS...</span>
      </div>
    </div>
  );

  const createSignIcon = (speed: number) => {
    return L.divIcon({
      html: `
        <div style="
          background-color: white;
          width: 36px; height: 36px;
          border-radius: 50%;
          border: 4px solid #dc2626;
          display: flex; align-items: center; justify-content: center;
          color: black; font-family: sans-serif; font-weight: 900; font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ">
          ${speed}
        </div>
      `,
      className: "",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  const createCarIcon = (h: number) => {
    return L.divIcon({
      html: `
        <div style="
          position: relative;
          width: 24px; height: 24px;
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="
            width: 0; 
            height: 0; 
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-bottom: 22px solid #22d3ee;
            transform: rotate(${h}deg);
            transform-origin: center;
            filter: drop-shadow(0px 0px 6px rgba(34,211,238,0.8));
          "></div>
        </div>
      `,
      className: "",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[coords.lat, coords.lng]} 
        zoom={17} 
        className="w-full h-full"
        zoomControl={false}
        attributionControl={true}
        style={{ background: "#e8e4d8" }}
      >
        {/* Google Maps Standard style (light) */}
        <TileLayer
          url="https://mt0.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}"
        />
        <MapUpdater coords={coords} heading={heading} />
        
        {/* Car Marker */}
        <Marker 
          position={[coords.lat, coords.lng]} 
          icon={createCarIcon(heading)} 
          zIndexOffset={100}
        />

        {/* Predicted zone marker */}
        {prediction && prediction.lat && prediction.lng && (
          <Marker 
            position={[prediction.lat, prediction.lng]} 
            icon={createSignIcon(prediction.nextMaxSpeed)} 
          />
        )}
      </MapContainer>
    </div>
  );
}

"use client";

import { useEffect } from "react";
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

function MapUpdater({ coords }: { coords: { lat: number; lng: number } | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (coords) {
      map.setView([coords.lat, coords.lng], 16);
    }
  }, [coords, map]);

  return null;
}

export default function HudMiniMap({ coords, heading, prediction }: HudMiniMapProps) {
  if (!coords) return (
    <div className="w-full h-full flex items-center justify-center bg-[#1c1c1e] text-slate-500 text-xs">
      Đang đợi GPS...
    </div>
  );

  const createSignIcon = (speed: number) => {
    return L.divIcon({
      html: `
        <div style="
          background-color: white;
          width: 30px; height: 30px;
          border-radius: 50%;
          border: 3px solid red;
          display: flex; align-items: center; justify-content: center;
          color: black; font-family: sans-serif; font-weight: bold; font-size: 14px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
        ">
          ${speed}
        </div>
      `,
      className: "",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  };

  const createCarIcon = (heading: number) => {
    return L.divIcon({
      html: `
        <div style="
          width: 0; 
          height: 0; 
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 20px solid #B5FF00;
          transform: rotate(${heading}deg);
          transform-origin: center;
          filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));
        "></div>
      `,
      className: "",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[coords.lat, coords.lng]} 
        zoom={16} 
        className="w-full h-full rounded-2xl"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="http://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}"
        />
        <MapUpdater coords={coords} />
        
        <Marker 
          position={[coords.lat, coords.lng]} 
          icon={createCarIcon(heading)} 
          zIndexOffset={100}
        />

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

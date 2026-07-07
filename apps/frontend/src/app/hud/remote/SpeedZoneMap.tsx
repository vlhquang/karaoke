"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import type { SpeedZoneRecord } from "@karaoke/shared";

// Fix missing default icon in Leaflet when using Webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface SpeedZoneMapProps {
  zones: SpeedZoneRecord[];
  onToggleStatus: (id: string, newStatus: "active" | "inactive") => void;
  onDelete: (id: string) => void;
  onUpdatePosition: (id: string, lat: number, lng: number) => void;
  /** Optional: current user heading for showing movement direction */
  currentHeading?: number;
  /** Optional: current user position */
  currentPosition?: { lat: number; lng: number } | null;
}

// Component to dynamically change map view
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function SpeedZoneMap({ zones, onToggleStatus, onDelete, onUpdatePosition, currentHeading, currentPosition }: SpeedZoneMapProps) {
  // Find map center based on current position, most recently added zone, or HCM center
  let defaultCenter: [number, number] = [10.762622, 106.660172];
  if (currentPosition) {
    defaultCenter = [currentPosition.lat, currentPosition.lng];
  } else if (zones.length > 0) {
    const lastZone = zones[zones.length - 1];
    defaultCenter = [lastZone.lat, lastZone.lng];
  }

  // Create a custom icon with speed limit number + heading arrow
  const createCustomIcon = (zone: SpeedZoneRecord) => {
    const isInactive = zone.status === "inactive";
    const bgColor = isInactive ? "#475569" : (zone.zone === "residential" ? "#f97316" : "#22c55e");
    const headingDeg = zone.heading || 0;
    const laneText = zone.laneCount ? `${zone.laneCount}L` : "";
    
    const html = `
      <div style="
        position: relative;
        display: flex; flex-direction: column; align-items: center;
      ">
        <!-- Heading arrow -->
        <div style="
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 12px solid ${bgColor};
          transform: rotate(${headingDeg}deg);
          transform-origin: center bottom;
          margin-bottom: -3px;
          opacity: ${isInactive ? 0.4 : 0.9};
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        "></div>
        <!-- Speed circle -->
        <div style="
          background-color: ${bgColor};
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          color: white; font-family: sans-serif; font-weight: bold; font-size: 13px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          opacity: ${isInactive ? 0.5 : 1};
          position: relative;
        ">
          ${zone.maxSpeed}
          ${laneText ? `<span style="position:absolute;bottom:-8px;font-size:8px;background:${bgColor};color:white;padding:0 3px;border-radius:3px;border:1px solid white;">${laneText}</span>` : ""}
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: "",
      iconSize: [32, 46],
      iconAnchor: [16, 46],
      popupAnchor: [0, -46],
    });
  };

  // Current position marker with heading arrow
  const createCurrentPosIcon = (h: number) => {
    return L.divIcon({
      html: `
        <div style="
          position: relative;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="
            width: 0; height: 0;
            border-left: 12px solid transparent;
            border-right: 12px solid transparent;
            border-bottom: 26px solid #22d3ee;
            transform: rotate(${h}deg);
            transform-origin: center;
            filter: drop-shadow(0px 0px 8px rgba(34,211,238,0.8));
          "></div>
        </div>
      `,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  return (
    <div className="w-full h-[40dvh] min-h-[240px] max-h-[500px] rounded-xl overflow-hidden border border-slate-700 mt-3 relative z-0">
      <MapContainer center={defaultCenter} zoom={13} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={defaultCenter} />

        {/* Current position marker */}
        {currentPosition && (
          <Marker 
            position={[currentPosition.lat, currentPosition.lng]}
            icon={createCurrentPosIcon(currentHeading || 0)}
            zIndexOffset={200}
          />
        )}

        {zones.map((z) => (
          <Marker 
            key={z.id} 
            position={[z.lat, z.lng]}
            icon={createCustomIcon(z)}
            draggable={true}
            eventHandlers={{
              dragend: (e: any) => {
                const marker = e.target;
                const position = marker.getLatLng();
                if (z.id) {
                  onUpdatePosition(z.id, position.lat, position.lng);
                }
              },
            }}
          >
            <Popup>
              <div className="p-0.5 min-w-[200px]">
                <div className="font-bold text-slate-800 text-base flex items-center justify-between border-b pb-2 mb-2">
                  <span>{z.maxSpeed} km/h</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${z.status === "inactive" ? "bg-slate-200 text-slate-500" : "bg-green-100 text-green-700"}`}>
                    {z.status === "inactive" ? "Inactive" : "Active"}
                  </span>
                </div>
                
                <div className="text-sm text-slate-600 mb-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vùng:</span> 
                    <b>{z.zone === "residential" ? "KDC" : "Ngoài KDC"}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hướng:</span> 
                    <b>{Math.round(z.heading)}°</b>
                  </div>
                  {z.laneCount && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số làn:</span> 
                      <b>{z.laneCount} làn</b>
                    </div>
                  )}
                  {z.label && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ghi chú:</span> 
                      <b>{z.label}</b>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 text-center pt-1 italic">
                    (Có thể kéo thả chấm tròn để sửa vị trí)
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => z.id && onToggleStatus(z.id, z.status === "inactive" ? "active" : "inactive")}
                    className={`flex-1 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition ${z.status === "inactive" ? "bg-green-500 hover:bg-green-600 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-700"}`}
                  >
                    {z.status === "inactive" ? <><Eye size={14} /> Bật</> : <><EyeOff size={14} /> Tắt</>}
                  </button>
                  <button
                    onClick={() => z.id && onDelete(z.id)}
                    className="flex-1 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Trash2 size={14} /> Xoá
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

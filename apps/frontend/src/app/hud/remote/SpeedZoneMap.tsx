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
}

// Component to dynamically change map view
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function SpeedZoneMap({ zones, onToggleStatus, onDelete, onUpdatePosition }: SpeedZoneMapProps) {
  // Find map center based on the most recently added zone, fallback to HCM center
  let defaultCenter: [number, number] = [10.762622, 106.660172];
  if (zones.length > 0) {
    const lastZone = zones[zones.length - 1];
    defaultCenter = [lastZone.lat, lastZone.lng];
  }

  // Create a custom icon with speed limit number inside
  const createCustomIcon = (zone: SpeedZoneRecord) => {
    const isInactive = zone.status === "inactive";
    const bgColor = isInactive ? "#475569" : (zone.zone === "residential" ? "#f97316" : "#22c55e");
    
    const html = `
      <div style="
        background-color: ${bgColor};
        width: 32px; height: 32px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex; align-items: center; justify-content: center;
        color: white; font-family: sans-serif; font-weight: bold; font-size: 13px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.4);
        opacity: ${isInactive ? 0.5 : 1};
      ">
        ${zone.maxSpeed}
      </div>
    `;

    return L.divIcon({
      html,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  };

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden border border-slate-700 mt-3 relative z-0">
      <MapContainer center={defaultCenter} zoom={13} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={defaultCenter} />

        {zones.map((z) => (
          <Marker 
            key={z.id} 
            position={[z.lat, z.lng]}
            icon={createCustomIcon(z)}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
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
                    onClick={() => {
                      if (confirm("Xoá vĩnh viễn biển báo này?")) {
                        z.id && onDelete(z.id);
                      }
                    }}
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

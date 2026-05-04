"use client";

import { create } from "zustand";
import type { SpeedZoneRecord, SpeedZonePrediction, HudZone, HudRoadType } from "@karaoke/shared";

// ── Geo utilities ──

/** Haversine distance in meters */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bearing from point1 to point2 in degrees (0-360) */
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Calculate GPS heading from two consecutive positions */
export function calcHeading(prevLat: number, prevLng: number, curLat: number, curLng: number): number {
  return bearing(prevLat, prevLng, curLat, curLng);
}

/** Check if a zone is "ahead" (within ±90° of current heading) */
function isAhead(currentHeading: number, bearingToTarget: number): boolean {
  let diff = bearingToTarget - currentHeading;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return Math.abs(diff) <= 90;
}

// ── Store ──

interface SpeedZoneState {
  zones: SpeedZoneRecord[];
  prediction: SpeedZonePrediction | null;
  loading: boolean;
  error: string;
  lastSyncTime: number | null;

  // Pending zone (chờ xác nhận trước khi lưu)
  pendingZone: SpeedZoneRecord | null;

  loadZones: () => Promise<void>;
  recordZone: (record: SpeedZoneRecord) => Promise<boolean>;
  deleteZone: (id: string) => Promise<boolean>;
  updatePrediction: (lat: number, lng: number, heading: number, currentMaxSpeed: number) => void;
  setPendingZone: (zone: SpeedZoneRecord | null) => void;
  confirmPendingZone: () => Promise<boolean>;
  toggleZoneStatus: (id: string, newStatus: "active" | "inactive") => Promise<boolean>;
  clearError: () => void;
}

export const useSpeedZoneStore = create<SpeedZoneState>((set, get) => ({
  zones: [],
  prediction: null,
  loading: false,
  error: "",
  lastSyncTime: null,
  pendingZone: null,

  loadZones: async () => {
    set({ loading: true, error: "" });
    try {
      const res = await fetch("/api/hud-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_zones" }),
      });
      const data = await res.json();
      if (data.ok) {
        set({ zones: data.zones || [], lastSyncTime: Date.now() });
      } else {
        set({ error: data.message || "Lỗi tải zones" });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Lỗi kết nối" });
    } finally {
      set({ loading: false });
    }
  },

  recordZone: async (record: SpeedZoneRecord) => {
    try {
      const res = await fetch("/api/hud-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_zone", data: record }),
      });
      const data = await res.json();
      if (data.ok) {
        // Thêm vào local store luôn
        set((s) => ({ zones: [...s.zones, { ...record, id: data.id || record.id }] }));
        return true;
      } else {
        set({ error: data.message || "Lỗi ghi zone" });
        return false;
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Lỗi kết nối" });
      return false;
    }
  },

  deleteZone: async (id: string) => {
    try {
      const res = await fetch("/api/hud-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_zone", id }),
      });
      const data = await res.json();
      if (data.ok) {
        set((s) => ({ zones: s.zones.filter((z) => z.id !== id) }));
        return true;
      } else {
        set({ error: data.message || "Lỗi xoá zone" });
        return false;
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Lỗi kết nối" });
      return false;
    }
  },

  updatePrediction: (lat: number, lng: number, heading: number, currentMaxSpeed: number) => {
    const { zones } = get();
    if (zones.length === 0) {
      set({ prediction: null });
      return;
    }

    // Tìm zone phía trước gần nhất có maxSpeed khác currentMaxSpeed
    let bestZone: SpeedZoneRecord | null = null;
    let bestDist = Infinity;

    for (const zone of zones) {
      if (zone.status === "inactive") continue;
      
      const dist = haversineDistance(lat, lng, zone.lat, zone.lng);
      // Chỉ quan tâm zones trong bán kính 5km
      if (dist > 5000) continue;
      // Chỉ lấy zone phía trước
      const bearingToZone = bearing(lat, lng, zone.lat, zone.lng);
      if (!isAhead(heading, bearingToZone)) continue;
      // Chỉ cảnh báo khi tốc độ tối đa sắp thay đổi
      if (zone.maxSpeed === currentMaxSpeed) continue;
      // Gần nhất
      if (dist < bestDist) {
        bestDist = dist;
        bestZone = zone;
      }
    }

    if (bestZone) {
      set({
        prediction: {
          nextMaxSpeed: bestZone.maxSpeed,
          distanceMeters: Math.round(bestDist),
          zone: bestZone.zone,
          roadType: bestZone.roadType,
          label: bestZone.label,
        },
      });
    } else {
      set({ prediction: null });
    }
  },

  setPendingZone: (zone: SpeedZoneRecord | null) => {
    set({ pendingZone: zone });
  },

  confirmPendingZone: async () => {
    const { pendingZone, recordZone } = get();
    if (!pendingZone) return false;
    const ok = await recordZone(pendingZone);
    if (ok) set({ pendingZone: null });
    return ok;
  },

  toggleZoneStatus: async (id: string, newStatus: "active" | "inactive") => {
    try {
      const res = await fetch("/api/hud-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_status", id, status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        set((s) => ({
          zones: s.zones.map((z) => (z.id === id ? { ...z, status: newStatus } : z)),
        }));
        return true;
      } else {
        set({ error: data.message || "Lỗi cập nhật trạng thái" });
        return false;
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Lỗi kết nối" });
      return false;
    }
  },

  clearError: () => set({ error: "" }),
}));

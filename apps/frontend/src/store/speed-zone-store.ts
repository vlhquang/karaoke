"use client";

import { create } from "zustand";
import type { SpeedZoneRecord, SpeedZonePrediction, HudZone, HudRoadType } from "@karaoke/shared";

// ── Configurable thresholds (env vars, đơn vị mét) ──

/** Bán kính scan biển báo phía trước (mét). Mặc định 2000m. */
const SCAN_RADIUS_M = Number(process.env.NEXT_PUBLIC_HUD_SCAN_RADIUS_M) || 2000;

/** Ngưỡng "đã tới" biển báo để auto-update tốc độ (mét). Mặc định 30m. */
const ARRIVE_THRESHOLD_M = Number(process.env.NEXT_PUBLIC_HUD_ARRIVE_THRESHOLD_M) || 30;

/** Số biển báo tiếp theo tối đa hiển thị */
const MAX_PREDICTIONS = 3;

// ── Geo utilities ──

/** Haversine distance in meters */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
  /** Tối đa 3 biển báo phía trước, sorted by distance asc */
  predictions: SpeedZonePrediction[];
  /** Backward-compat alias: biển báo gần nhất (predictions[0] or null) */
  prediction: SpeedZonePrediction | null;
  loading: boolean;
  error: string;
  lastSyncTime: number | null;

  // Pending zone (chờ xác nhận trước khi lưu)
  pendingZone: SpeedZoneRecord | null;

  // Track zones đã đi qua để tránh re-trigger auto-update
  passedZoneIds: Set<string>;

  loadZones: () => Promise<void>;
  recordZone: (record: SpeedZoneRecord) => Promise<boolean>;
  deleteZone: (id: string) => Promise<boolean>;
  /**
   * Cập nhật predictions (tối đa 3 biển phía trước).
   * Returns zone id nếu vừa arrive (≤ threshold), null otherwise.
   */
  updatePrediction: (lat: number, lng: number, heading: number, currentMaxSpeed: number) => { arrivedZone: SpeedZoneRecord | null };
  setPendingZone: (zone: SpeedZoneRecord | null) => void;
  confirmPendingZone: () => Promise<boolean>;
  toggleZoneStatus: (id: string, newStatus: "active" | "inactive") => Promise<boolean>;
  updateZonePosition: (id: string, lat: number, lng: number) => Promise<boolean>;
  clearError: () => void;
  resetPassedZones: () => void;
}

export const useSpeedZoneStore = create<SpeedZoneState>((set, get) => ({
  zones: [],
  predictions: [],
  prediction: null,
  loading: false,
  error: "",
  lastSyncTime: null,
  pendingZone: null,
  passedZoneIds: new Set(),

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

  updatePrediction: (lat: number, lng: number, heading: number, _currentMaxSpeed: number) => {
    const { zones, passedZoneIds } = get();

    if (zones.length === 0) {
      set({ predictions: [], prediction: null });
      return { arrivedZone: null };
    }

    // Collect all candidate zones ahead
    const candidates: { zone: SpeedZoneRecord; dist: number }[] = [];

    for (const zone of zones) {
      if (zone.status === "inactive") continue;
      if (!zone.id) continue;

      const dist = haversineDistance(lat, lng, zone.lat, zone.lng);
      // Chỉ quan tâm zones trong bán kính scan
      if (dist > SCAN_RADIUS_M) continue;
      // Chỉ lấy zone phía trước
      const bearingToZone = bearing(lat, lng, zone.lat, zone.lng);
      if (!isAhead(heading, bearingToZone)) continue;

      // Chỉ lấy zone cùng chiều di chuyển (lệch tối đa 60 độ)
      const angleDiff = Math.abs(heading - zone.heading);
      const normalizedAngleDiff = Math.min(angleDiff, 360 - angleDiff);
      if (normalizedAngleDiff > 60) continue;

      candidates.push({ zone, dist });
    }

    // Sort by distance ascending, take top MAX_PREDICTIONS
    candidates.sort((a, b) => a.dist - b.dist);
    const topCandidates = candidates.slice(0, MAX_PREDICTIONS);

    const predictions: SpeedZonePrediction[] = topCandidates.map(({ zone, dist }) => ({
      nextMaxSpeed: zone.maxSpeed,
      distanceMeters: Math.round(dist),
      zone: zone.zone,
      roadType: zone.roadType,
      label: zone.label,
      lat: zone.lat,
      lng: zone.lng,
    }));

    // Check arrival: biển báo gần nhất ≤ threshold & chưa passed
    let arrivedZone: SpeedZoneRecord | null = null;
    if (topCandidates.length > 0) {
      const nearest = topCandidates[0];
      if (nearest.dist <= ARRIVE_THRESHOLD_M && nearest.zone.id && !passedZoneIds.has(nearest.zone.id)) {
        arrivedZone = nearest.zone;
        // Mark as passed
        const newPassed = new Set(passedZoneIds);
        newPassed.add(nearest.zone.id);
        set({ passedZoneIds: newPassed });
      }
    }

    set({
      predictions,
      prediction: predictions.length > 0 ? predictions[0] : null,
    });

    return { arrivedZone };
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

  updateZonePosition: async (id: string, lat: number, lng: number) => {
    try {
      const res = await fetch("/api/hud-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_position", id, lat, lng }),
      });
      const data = await res.json();
      if (data.ok) {
        set((s) => ({
          zones: s.zones.map((z) => (z.id === id ? { ...z, lat, lng } : z)),
        }));
        return true;
      } else {
        set({ error: data.message || "Lỗi cập nhật vị trí" });
        return false;
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Lỗi kết nối" });
      return false;
    }
  },

  clearError: () => set({ error: "" }),

  resetPassedZones: () => set({ passedZoneIds: new Set() }),
}));

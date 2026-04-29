"use client";

import { create } from "zustand";
import type { HudState } from "@karaoke/shared";
import { getSocket } from "../lib/socket";

export type HudRemoteRole = "host" | "remote" | null;

interface HudStore {
  // Kết nối
  connected: boolean;
  roomCode: string;
  role: HudRemoteRole;
  error: string;
  initialized: boolean;

  // Trạng thái cấu hình (được đồng bộ giữa 2 thiết bị)
  state: HudState;

  // Actions
  connect: () => void;
  createRoom: () => Promise<{ roomCode: string } | null>;
  joinRoom: (roomCode: string) => Promise<boolean>;
  updateState: (patch: Partial<HudState>) => Promise<void>;
  leaveRoom: () => Promise<void>;
  clearError: () => void;
}

const DEFAULT_STATE: HudState = {
  roadType: "1_lane",
  zone: "residential",
  manualMax: 60,
  offset: 0,
  mode: "moto",
};

export const useHudStore = create<HudStore>((set, get) => ({
  connected: false,
  roomCode: "",
  role: null,
  error: "",
  initialized: false,
  state: { ...DEFAULT_STATE },

  connect: () => {
    if (get().initialized) return;

    void (async () => {
      let socket;
      try {
        socket = await getSocket();
      } catch {
        set(() => ({ error: "Không thể kết nối server" }));
        return;
      }

      socket.on("connect", () => set(() => ({ connected: true })));
      socket.on("disconnect", () => set(() => ({ connected: false })));

      // Lắng nghe cập nhật từ remote controller hoặc HUD
      (socket as any).on("hud_state_updated", (payload: { state: HudState }) => {
        set(() => ({ state: { ...payload.state } }));
      });

      if (socket.connected) {
        set(() => ({ connected: true }));
      } else {
        socket.connect();
      }

      set(() => ({ initialized: true }));
    })();
  },

  createRoom: async () => {
    const socket = await getSocket();
    return new Promise((resolve) => {
      (socket as any).emit("hud_create_room", (response: { ok: true; roomCode: string; state: HudState } | { ok: false; message: string }) => {
        if (!response.ok) {
          set(() => ({ error: response.message }));
          resolve(null);
          return;
        }
        set(() => ({
          roomCode: response.roomCode,
          role: "host",
          state: response.state,
          error: "",
        }));
        resolve({ roomCode: response.roomCode });
      });
    });
  },

  joinRoom: async (roomCode: string) => {
    const socket = await getSocket();
    return new Promise((resolve) => {
      (socket as any).emit("hud_join_room", { roomCode: roomCode.toUpperCase() }, (response: { ok: true; state: HudState } | { ok: false; message: string }) => {
        if (!response.ok) {
          set(() => ({ error: response.message }));
          resolve(false);
          return;
        }
        set(() => ({
          roomCode: roomCode.toUpperCase(),
          role: "remote",
          state: response.state,
          error: "",
        }));
        resolve(true);
      });
    });
  },

  updateState: async (patch: Partial<HudState>) => {
    const { roomCode, state } = get();

    // Optimistic update trên local ngay lập tức
    const newState = { ...state, ...patch };
    set(() => ({ state: newState }));

    if (!roomCode) return; // Chỉ sync khi đang trong phòng

    const socket = await getSocket();
    (socket as any).emit("hud_update_state", { roomCode, state: patch }, () => {
      // Không cần xử lý ack ở đây vì đã update optimistic
    });
  },

  leaveRoom: async () => {
    const { roomCode } = get();
    if (!roomCode) return;

    const socket = await getSocket();
    (socket as any).emit("hud_leave_room", { roomCode }, () => {});
    set(() => ({ roomCode: "", role: null }));
  },

  clearError: () => set(() => ({ error: "" })),
}));

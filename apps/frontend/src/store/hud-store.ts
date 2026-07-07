"use client";

import { create } from "zustand";
import type { HudState } from "@karaoke/shared";
import { getSocket } from "../lib/socket";

export type HudRemoteRole = "host" | "remote" | null;

interface HudStore {
  connected: boolean;
  roomCode: string;
  role: HudRemoteRole;
  error: string;
  initialized: boolean;
  state: HudState;

  connect: () => Promise<void>;
  createRoom: () => Promise<{ roomCode: string } | null>;
  joinRoom: (roomCode: string) => Promise<boolean>;
  updateState: (patch: Partial<HudState>) => Promise<void>;
  syncState: (newState: HudState) => void;
  leaveRoom: () => Promise<void>;
  clearError: () => void;
}

const DEFAULT_STATE: HudState = {
  roadType: "manual",
  zone: "residential",
  manualMax: 60,
  offset: 0,
  mode: "moto",
};

// Chờ socket connected với timeout
const waitConnected = (socket: any, timeoutMs = 5000): Promise<void> => {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket connection timeout")), timeoutMs);
    const onConnect = () => { clearTimeout(timeout); cleanup(); resolve(); };
    const onError = (err: Error) => { clearTimeout(timeout); cleanup(); reject(err); };
    const cleanup = () => { socket.off("connect", onConnect); socket.off("connect_error", onError); };
    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
    socket.connect();
  });
};

export const useHudStore = create<HudStore>((set, get) => ({
  connected: false,
  roomCode: "",
  role: null,
  error: "",
  initialized: false,
  state: { ...DEFAULT_STATE },

  connect: async () => {
    if (get().initialized) return;
    set(() => ({ initialized: true }));

    let socket: any;
    try {
      socket = await getSocket();
    } catch {
      set(() => ({ error: "Không thể tải Socket.IO client", initialized: false }));
      return;
    }

    let wasConnected = false;
    socket.on("connect", () => {
      const { roomCode, role } = get();
      set(() => ({ connected: true }));
      // Auto-rejoin khi reconnect (không phải lần connect đầu tiên)
      if (wasConnected && roomCode && role === "remote") {
        socket.emit(
          "hud_join_room",
          { roomCode },
          (response: { ok: boolean; state?: HudState; message?: string }) => {
            if (!response.ok) {
              set(() => ({ roomCode: "", role: null, error: "Phòng đã hết hạn. Vui lòng kết nối lại." }));
            }
          }
        );
      }
      wasConnected = true;
    });
    socket.on("disconnect", () => set(() => ({ connected: false })));

    // Nhận cập nhật từ remote controller
    socket.on("hud_state_updated", (payload: { state: HudState }) => {
      set(() => ({ state: { ...payload.state } }));
    });

    if (socket.connected) {
      set(() => ({ connected: true }));
    } else {
      socket.connect();
    }
  },

  createRoom: async () => {
    let socket: any;
    try {
      socket = await getSocket();
      await waitConnected(socket);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể kết nối server";
      set(() => ({ error: msg }));
      return null;
    }

    return new Promise((resolve) => {
      socket.emit(
        "hud_create_room",
        (response: { ok: true; roomCode: string; state: HudState } | { ok: false; message: string }) => {
          if (!response.ok) {
            set(() => ({ error: response.message }));
            resolve(null);
            return;
          }
          set(() => ({
            roomCode: response.roomCode,
            role: "host" as HudRemoteRole,
            state: response.state,
            error: "",
          }));
          resolve({ roomCode: response.roomCode });
        }
      );
    });
  },

  joinRoom: async (roomCode: string) => {
    let socket: any;
    try {
      socket = await getSocket();
      await waitConnected(socket);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể kết nối server";
      set(() => ({ error: msg }));
      return false;
    }

    return new Promise((resolve) => {
      socket.emit(
        "hud_join_room",
        { roomCode: roomCode.toUpperCase() },
        (response: { ok: true; state: HudState } | { ok: false; message: string }) => {
          if (!response.ok) {
            set(() => ({ error: response.message }));
            resolve(false);
            return;
          }
          set(() => ({
            roomCode: roomCode.toUpperCase(),
            role: "remote" as HudRemoteRole,
            state: response.state,
            error: "",
          }));
          resolve(true);
        }
      );
    });
  },

  updateState: async (patch: Partial<HudState>) => {
    const { roomCode, state } = get();
    // Optimistic update
    const newState = { ...state, ...patch };
    set({ state: newState });
    
    if (!roomCode) return;
    try {
      const socket = await getSocket();
      socket.emit("hud_update_state", { roomCode, state: patch }, () => {});
    } catch {
      // ignore
    }
  },

  // Dùng để sync state từ localStorage hoặc nguồn khác vào store mà không emit
  syncState: (newState: HudState) => {
    set({ state: newState });
  },

  leaveRoom: async () => {
    const { roomCode } = get();
    if (roomCode) {
      try {
        const socket = await getSocket();
        socket.emit("hud_leave_room", { roomCode }, () => {});
      } catch { /* ignore */ }
    }
    set(() => ({ roomCode: "", role: null }));
  },

  clearError: () => set(() => ({ error: "" })),
}));

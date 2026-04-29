import type { HudState, HudRoom } from "@karaoke/shared";

const DEFAULT_HUD_STATE: HudState = {
  roadType: "1_lane",
  zone: "residential",
  manualMax: 60,
  offset: 0,
  mode: "moto",
};

const generateRoomCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export class HudService {
  private readonly rooms = new Map<string, HudRoom>();

  createRoom(): { roomCode: string; state: HudState } {
    let roomCode: string;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      attempts++;
      if (attempts > 100) throw new Error("Cannot generate unique HUD room code");
    } while (this.rooms.has(roomCode));

    const room: HudRoom = {
      roomCode,
      state: { ...DEFAULT_HUD_STATE },
      createdAt: new Date().toISOString(),
    };
    this.rooms.set(roomCode, room);

    // Auto-cleanup after 12 hours
    setTimeout(() => {
      this.rooms.delete(roomCode);
    }, 12 * 60 * 60 * 1000);

    return { roomCode, state: { ...room.state } };
  }

  getRoom(roomCode: string): HudRoom | null {
    return this.rooms.get(roomCode.toUpperCase()) ?? null;
  }

  updateState(roomCode: string, patch: Partial<HudState>): HudState | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return null;

    room.state = { ...room.state, ...patch };
    return { ...room.state };
  }

  deleteRoom(roomCode: string): void {
    this.rooms.delete(roomCode.toUpperCase());
  }
}

export const hudService = new HudService();

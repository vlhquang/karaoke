export type RoomStatus = "waiting" | "playing" | "finished";

export type GameType = "reaction" | "memory" | "rps" | "number" | "shake" | "color";

export interface Player {
  playerId: string;
  name: string;
  socketId: string;
  score: number;
  latency: number;
  isOnline: boolean;
  lastActionAt: number;
}

export interface Room {
  roomId: string;
  hostId: string;
  players: Map<string, Player>;
  currentGame: GameType | null;
  gameState: unknown | null;
  status: RoomStatus;
  createdAt: number;
}

export interface SocketContext {
  roomId: string;
  playerId: string;
  isHost: boolean;
}

export interface StartGameOptions {
  memory?: {
    boardLength?: number;
  };
}

export interface GameEngine {
  initGame: (room: Room, options?: StartGameOptions) => object;
  handleAction: (room: Room, payload: Record<string, unknown>, now: number) => object;
  calculateResult: (room: Room) => object;
}

export type RoomStatus = "waiting" | "countdown" | "playing" | "finished";

export type GameType = "reaction" | "memory" | "rps" | "number" | "shake" | "color";
export type MemoryTheme = "sports" | "animals" | "fruits" | "vehicles";

export interface Player {
  playerId: string;
  name: string;
  socketId: string;
  score: number;
  latency: number;
  isOnline: boolean;
  lastActionAt: number;
  ready: boolean;
  victoryImageDataUrl?: string;
}

export interface Room {
  roomId: string;
  hostId: string;
  players: Map<string, Player>;
  selectedGame: GameType | null;
  selectedGameOptions: StartGameOptions | null;
  countdownEndsAt: number | null;
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
    theme?: MemoryTheme;
  };
  rps?: {
    mode?: "BO1" | "BO3" | "BO5" | "BO7" | "BO11";
  };
}

export interface GameEngine {
  initGame: (room: Room, options?: StartGameOptions) => object;
  handleAction: (room: Room, payload: Record<string, unknown>, now: number) => object;
  calculateResult: (room: Room) => object;
}

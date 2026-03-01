import type { GameEngine, Room } from "../types";

interface ColorState {
  targetColor: string;
  winnerId: string | null;
}

const colors = ["red", "green", "blue", "yellow", "purple", "orange"];

export const colorGame: GameEngine = {
  initGame: (): ColorState => ({
    targetColor: colors[Math.floor(Math.random() * colors.length)],
    winnerId: null
  }),

  handleAction: (room: Room, payload: Record<string, unknown>): ColorState => {
    const state = room.gameState as ColorState;
    if (state.winnerId) {
      return state;
    }
    const playerId = String(payload.playerId ?? "");
    const color = String(payload.color ?? "").toLowerCase();
    if (playerId && color === state.targetColor) {
      state.winnerId = playerId;
    }
    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as ColorState;
    return {
      targetColor: state.targetColor,
      winnerId: state.winnerId
    };
  }
};

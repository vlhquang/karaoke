import type { GameEngine, Room } from "../types";

interface NumberState {
  grid: number[];
  targetNumber: number;
  winnerId: string | null;
  winnerAt: number;
}

export const numberGame: GameEngine = {
  initGame: (): NumberState => {
    const grid = Array.from({ length: 25 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    return {
      grid,
      targetNumber: grid[Math.floor(Math.random() * grid.length)],
      winnerId: null,
      winnerAt: 0
    };
  },

  handleAction: (room: Room, payload: Record<string, unknown>, now: number): NumberState => {
    const state = room.gameState as NumberState;
    if (state.winnerId) {
      return state;
    }
    const playerId = String(payload.playerId ?? "");
    const tappedNumber = Number(payload.number ?? -1);
    if (playerId && tappedNumber === state.targetNumber) {
      state.winnerId = playerId;
      state.winnerAt = now;
    }
    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as NumberState;
    return {
      targetNumber: state.targetNumber,
      winnerId: state.winnerId
    };
  }
};

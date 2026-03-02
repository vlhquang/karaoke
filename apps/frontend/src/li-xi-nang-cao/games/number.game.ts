import type { GameEngine, Room } from "../types";

interface NumberPlayerState {
  reflexPoints: number;
  lockUntil: number;
}

interface NumberState {
  grid: number[];
  targetNumber: number;
  winnerId: string | null;
  winnerAt: number;
  playerStates: Record<string, NumberPlayerState>;
  done: boolean;
}

export const numberGame: GameEngine = {
  initGame: (room: Room): NumberState => {
    // Generate 25 unique random numbers between 1 and 99
    const allNumbers = Array.from({ length: 99 }, (_, i) => i + 1);
    const grid = allNumbers.sort(() => Math.random() - 0.5).slice(0, 25);

    const playerStates: Record<string, NumberPlayerState> = {};
    [...room.players.keys()].forEach((pid) => {
      playerStates[pid] = { reflexPoints: 0, lockUntil: 0 };
    });

    return {
      grid,
      targetNumber: grid[Math.floor(Math.random() * grid.length)],
      winnerId: null,
      winnerAt: 0,
      playerStates,
      done: false
    };
  },

  handleAction: (room: Room, payload: Record<string, unknown>, now: number): NumberState => {
    const state = room.gameState as NumberState;
    if (state.done || state.winnerId) {
      return state;
    }

    const playerId = String(payload.playerId ?? "");
    if (!playerId || !state.playerStates[playerId]) {
      return state;
    }

    const pState = state.playerStates[playerId];

    // Check lockout
    if (now < pState.lockUntil) {
      return state;
    }

    const tappedNumber = Number(payload.number ?? -1);

    if (tappedNumber === state.targetNumber) {
      // Correct!
      state.winnerId = playerId;
      state.winnerAt = now;
      state.done = true;
    } else {
      // Incorrect penalty
      pState.reflexPoints -= 1;
      pState.lockUntil = now + 1000; // 1s lockout
    }

    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as NumberState;
    return {
      ...state,
      targetNumber: state.targetNumber,
      winnerId: state.winnerId,
      done: state.done
    };
  }
};

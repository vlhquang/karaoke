import { liXiConfig } from "../config/env";
import type { GameEngine, Room } from "../types";

interface ShakeState {
  startAt: number;
  endAt: number;
  scores: Record<string, number>;
}

export const shakeGame: GameEngine = {
  initGame: (): ShakeState => {
    const startAt = Date.now();
    return { startAt, endAt: startAt + 5000, scores: {} };
  },

  handleAction: (room: Room, payload: Record<string, unknown>): ShakeState => {
    const state = room.gameState as ShakeState;
    const playerId = String(payload.playerId ?? "");
    const score = Number(payload.shakeScore ?? 0);
    if (!playerId || !Number.isFinite(score)) {
      return state;
    }
    if (score >= liXiConfig.maxShakeThreshold) {
      return state;
    }
    state.scores[playerId] = Math.max(0, score);
    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as ShakeState;
    const ranking = Object.entries(state.scores).sort((a, b) => b[1] - a[1]);
    return {
      ranking,
      winnerId: ranking[0]?.[0] ?? null
    };
  }
};

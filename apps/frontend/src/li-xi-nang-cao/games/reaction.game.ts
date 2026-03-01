import type { GameEngine, Room } from "../types";

interface ReactionState {
  signalTime: number;
  taps: Record<string, { tappedAt: number; valid: boolean; reactionMs: number }>;
  winnerId: string | null;
}

const randomDelay = (): number => Math.floor(Math.random() * 3001) + 1000;

export const reactionGame: GameEngine = {
  initGame: (room: Room): ReactionState => {
    const now = Date.now();
    return {
      signalTime: now + randomDelay(),
      taps: Object.fromEntries([...room.players.keys()].map((id) => [id, { tappedAt: 0, valid: false, reactionMs: -1 }])),
      winnerId: null
    };
  },

  handleAction: (room: Room, payload: Record<string, unknown>, now: number): ReactionState => {
    const state = room.gameState as ReactionState;
    const playerId = String(payload.playerId ?? "");
    if (!playerId || !state.taps[playerId] || state.taps[playerId].tappedAt > 0) {
      return state;
    }

    const valid = now >= state.signalTime;
    const reactionMs = valid ? now - state.signalTime : Number.MAX_SAFE_INTEGER;
    state.taps[playerId] = { tappedAt: now, valid, reactionMs };

    const onlinePlayers = [...room.players.values()].filter((p) => p.isOnline).map((p) => p.playerId);
    const allTapped = onlinePlayers.every((id) => state.taps[id]?.tappedAt > 0);
    if (allTapped) {
      const result = reactionGame.calculateResult(room) as ReactionState;
      state.winnerId = result.winnerId;
    }

    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as ReactionState;
    const ranking = Object.entries(state.taps)
      .filter(([, tap]) => tap.tappedAt > 0)
      .sort((a, b) => a[1].reactionMs - b[1].reactionMs);

    const winnerId = ranking.find(([, tap]) => tap.valid)?.[0] ?? null;
    return {
      signalTime: state.signalTime,
      taps: state.taps,
      ranking,
      winnerId
    };
  }
};

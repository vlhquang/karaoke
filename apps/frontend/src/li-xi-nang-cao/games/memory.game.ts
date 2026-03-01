import type { GameEngine, Room, StartGameOptions } from "../types";

interface MemoryState {
  seed: number;
  board: number[];
  startTime: number | null;
  pairCount: number;
  requiredPlayers: number;
  phase: "syncing" | "running" | "finished";
  readyPlayers: Record<string, true>;
  completes: Record<string, { durationMs: number; moves: number }>;
}

const createSeededRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const seededShuffle = (items: number[], seed: number): number[] => {
  const arr = [...items];
  const rand = createSeededRng(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const memoryGame: GameEngine = {
  initGame: (room: Room, options?: StartGameOptions): MemoryState => {
    const seed = Math.floor(Math.random() * 1_000_000);
    const requestedLength = options?.memory?.boardLength;
    const normalizedLength =
      Number.isInteger(requestedLength) && requestedLength && requestedLength >= 4 && requestedLength <= 64 && requestedLength % 2 === 0
        ? requestedLength
        : 12;
    const pairCount = normalizedLength / 2;
    const base = Array.from({ length: pairCount * 2 }, (_, i) => i % pairCount);
    const board = seededShuffle(base, seed);
    const onlinePlayers = [...room.players.values()].filter((player) => player.isOnline).length;
    const requiredPlayers = Math.max(1, onlinePlayers);
    return {
      seed,
      board,
      startTime: null,
      pairCount,
      requiredPlayers,
      phase: "syncing",
      readyPlayers: {},
      completes: {}
    };
  },

  handleAction: (room: Room, payload: Record<string, unknown>, now: number): MemoryState => {
    const state = room.gameState as MemoryState;
    const eventName = String(payload._event ?? "");
    const playerId = String(payload.playerId ?? "");
    const moves = Number(payload.moves ?? 0);
    if (!playerId) {
      return state;
    }

    if (eventName === "memory:ready") {
      state.readyPlayers[playerId] = true;
      if (state.phase === "syncing" && Object.keys(state.readyPlayers).length >= state.requiredPlayers) {
        state.phase = "running";
        state.startTime = now;
      }
      room.gameState = state;
      return state;
    }

    if (eventName !== "memory:complete") {
      return state;
    }

    if (state.phase !== "running" || state.startTime === null) {
      return state;
    }

    if (state.completes[playerId] || !Number.isFinite(moves) || moves <= 0) {
      return state;
    }
    state.completes[playerId] = {
      durationMs: Math.max(0, now - state.startTime),
      moves
    };
    if (Object.keys(state.completes).length >= state.requiredPlayers) {
      state.phase = "finished";
    }
    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as MemoryState;
    const ranking = Object.entries(state.completes).sort((a, b) => {
      if (a[1].durationMs !== b[1].durationMs) return a[1].durationMs - b[1].durationMs;
      return a[1].moves - b[1].moves;
    });
    const winnerId = ranking.length >= state.requiredPlayers ? ranking[0]?.[0] ?? null : null;
    return {
      seed: state.seed,
      board: state.board,
      pairCount: state.pairCount,
      startTime: state.startTime,
      phase: state.phase,
      requiredPlayers: state.requiredPlayers,
      readyCount: Object.keys(state.readyPlayers).length,
      completes: state.completes,
      ranking,
      winnerId,
      done: state.phase === "finished" && ranking.length >= state.requiredPlayers
    };
  }
};

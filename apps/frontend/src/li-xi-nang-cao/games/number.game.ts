import type { GameEngine, Room, StartGameOptions } from "../types";

interface NumberPlayerState {
  foundCount: number;
  totalTimeMs: number;
  roundFinished: boolean;
  lastActionAt: number;
}

interface NumberState {
  targetCountToWin: number;
  winCondition: "unique" | "ranking";
  targetNumber: number;
  roundSeed: number;
  round: number;
  phase: "PREP" | "WAIT" | "HIGHLIGHT" | "PLAYING";
  phaseEndsAt: number;
  playerStates: Record<string, NumberPlayerState>;
  itemLifetimeMs: number;
  done: boolean;
  winnerId: string | null;
}

export const numberGame: GameEngine = {
  initGame: (room: Room, options?: StartGameOptions): NumberState => {
    const targetCountToWin = options?.number?.targetCount ?? 10;
    const itemLifetimeMs = options?.number?.itemLifetimeMs ?? 2000;
    const winCondition = options?.number?.winCondition ?? "unique";
    const playerStates: Record<string, NumberPlayerState> = {};
    [...room.players.keys()].forEach((pid) => {
      playerStates[pid] = { foundCount: 0, totalTimeMs: 0, roundFinished: false, lastActionAt: 0 };
    });

    return {
      targetCountToWin,
      winCondition,
      targetNumber: Math.floor(Math.random() * 99) + 1,
      roundSeed: Math.floor(Math.random() * 1_000_000),
      round: 1,
      phase: "PREP",
      phaseEndsAt: Date.now() + 5000, // 5s Prep
      playerStates,
      itemLifetimeMs,
      done: false,
      winnerId: null
    };
  },

  handleAction: (room: Room, payload: Record<string, unknown>, now: number): NumberState => {
    const state = room.gameState as NumberState;
    if (state.done) return state;

    const playerId = String(payload.playerId ?? "");
    const event = String(payload._event ?? "");

    if (!playerId || !state.playerStates[playerId]) return state;
    const pState = state.playerStates[playerId];

    if (event === "number:found") {
      if (state.phase !== "PLAYING" || pState.roundFinished) return state;

      const duration = Number(payload.durationMs ?? 0);
      pState.foundCount += 1;
      pState.totalTimeMs += duration;
      pState.roundFinished = true;
      pState.lastActionAt = now;

      // In UNIQUE mode, if one player reaches target, we can technically check here,
      // but it's fairer to let the current round finish in case someone else gets it with better time.
    }

    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as NumberState;
    const now = Date.now();

    // Ticker logic: Phase transitions
    if (!state.done && now >= state.phaseEndsAt && state.phaseEndsAt > 0) {
      if (state.phase === "PREP") {
        state.phase = "WAIT";
        state.targetNumber = Math.floor(Math.random() * 99) + 1;
        const randomWait = 1000 + Math.floor(Math.random() * 4000);
        state.phaseEndsAt = now + randomWait;
      } else if (state.phase === "WAIT") {
        state.phase = "HIGHLIGHT";
        state.phaseEndsAt = now + 1000;
      } else if (state.phase === "HIGHLIGHT") {
        state.phase = "PLAYING";
        state.phaseEndsAt = 0;
      }
    }

    // Check if everyone finished the current round
    const participants = Object.keys(state.playerStates).filter(id => room.players.get(id)?.isOnline);
    const allFinished = participants.every((pid) => state.playerStates[pid].roundFinished);

    if (!state.done && state.phase === "PLAYING" && allFinished) {
      if (state.winCondition === "unique") {
        // Find anyone who reached targetCount
        const potentialWinners = Object.entries(state.playerStates)
          .filter(([pid, ps]) => ps.foundCount >= state.targetCountToWin && participants.includes(pid))
          .sort((a, b) => a[1].totalTimeMs - b[1].totalTimeMs);

        if (potentialWinners.length > 0) {
          state.winnerId = potentialWinners[0][0];
          state.done = true;
        }
      } else {
        // RANKING mode: Game ends when ALL participants reach targetCount
        const allReachedTarget = participants.every(pid => state.playerStates[pid].foundCount >= state.targetCountToWin);
        if (allReachedTarget) {
          const ranking = Object.entries(state.playerStates)
            .filter(([pid]) => participants.includes(pid))
            .sort((a, b) => {
              // Primary: Rounds (implicit in total rounds, but we need to check how many rounds it took)
              // Actually, since everyone finishes every round, rounds are the same.
              // Wait, if someone reaches targetCount in round 5 and another in round 6.
              // We need to track which round each player finished.
              // Let's stick to the user's logic: "ai săn được số lượng cấu hình trước sẽ giành chiến thắng"
              // In ranking mode, we'll sort by foundCount (desc) then totalTimeMs (asc)
              if (b[1].foundCount !== a[1].foundCount) return b[1].foundCount - a[1].foundCount;
              return a[1].totalTimeMs - b[1].totalTimeMs;
            });
          state.winnerId = ranking[0][0];
          state.done = true;
        }
      }

      if (!state.done) {
        // Move to next round
        state.round += 1;
        state.roundSeed = Math.floor(Math.random() * 1_000_000);
        state.phase = "PREP";
        state.phaseEndsAt = now + 5000;
        Object.values(state.playerStates).forEach((ps) => {
          ps.roundFinished = false;
        });
      }
    }

    const ranking = Object.entries(state.playerStates)
      .filter(([pid]) => participants.includes(pid))
      .sort((a, b) => {
        if (b[1].foundCount !== a[1].foundCount) return b[1].foundCount - a[1].foundCount;
        return a[1].totalTimeMs - b[1].totalTimeMs;
      });

    return {
      ...state,
      ranking,
      done: state.done,
      winnerId: state.winnerId
    };
  }
};

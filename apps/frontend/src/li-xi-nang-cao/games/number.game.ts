import type { GameEngine, Room, StartGameOptions } from "../types";

interface NumberPlayerState {
  foundCount: number;
  totalTimeMs: number;
  roundFinished: boolean;
  lastActionAt: number;
}

interface NumberState {
  targetCountToWin: number;
  targetNumber: number;
  round: number;
  phase: "PREP" | "WAIT" | "HIGHLIGHT" | "PLAYING";
  phaseEndsAt: number;
  playerStates: Record<string, NumberPlayerState>;
  done: boolean;
  winnerId: string | null;
}

export const numberGame: GameEngine = {
  initGame: (room: Room, options?: StartGameOptions): NumberState => {
    const targetCountToWin = options?.number?.targetCount ?? 10;
    const playerStates: Record<string, NumberPlayerState> = {};
    [...room.players.keys()].forEach((pid) => {
      playerStates[pid] = { foundCount: 0, totalTimeMs: 0, roundFinished: false, lastActionAt: 0 };
    });

    return {
      targetCountToWin,
      targetNumber: Math.floor(Math.random() * 99) + 1,
      round: 1,
      phase: "PREP",
      phaseEndsAt: Date.now() + 5000, // 5s Prep
      playerStates,
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

      // Check if this player reached the target count
      if (pState.foundCount >= state.targetCountToWin && !state.winnerId) {
        // We don't end the game immediately if we want to wait for others or show the round end
        // But the user said "Ai săn đủ số lượng trước thì giành chiến thắng"
        // Let's mark the winner but maybe let the round finish? 
        // Actually, let's keep it simple: first to reach count wins if others haven't.
        // But if someone else reaches it in the same round with better time?
        // Let's wait for the round to end for everyone.
      }
    }

    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as NumberState;
    const now = Date.now();

    // Ticker logic: Phase transitions
    if (!state.done && now >= state.phaseEndsAt) {
      if (state.phase === "PREP") {
        state.phase = "WAIT";
        // Server random wait 1-5s
        const randomWait = 1000 + Math.floor(Math.random() * 4000);
        state.phaseEndsAt = now + randomWait;
      } else if (state.phase === "WAIT") {
        state.phase = "HIGHLIGHT";
        state.targetNumber = Math.floor(Math.random() * 99) + 1;
        state.phaseEndsAt = now + 1000; // 1s Highlight
      } else if (state.phase === "HIGHLIGHT") {
        state.phase = "PLAYING";
        state.phaseEndsAt = 0; // Playing ends when everyone is finished
      }
    }

    // Check if everyone finished the current round
    const allFinished = Object.values(state.playerStates).every((ps) => ps.roundFinished);
    if (!state.done && state.phase === "PLAYING" && allFinished) {
      // Check if any winners
      const potentialWinners = Object.entries(state.playerStates)
        .filter(([_, ps]) => ps.foundCount >= state.targetCountToWin)
        .sort((a, b) => a[1].totalTimeMs - b[1].totalTimeMs);

      if (potentialWinners.length > 0) {
        state.winnerId = potentialWinners[0][0];
        state.done = true;
      } else {
        // Move to next round
        state.round += 1;
        state.phase = "PREP";
        state.phaseEndsAt = now + 5000;
        Object.values(state.playerStates).forEach((ps) => {
          ps.roundFinished = false;
        });
      }
    }

    return {
      ...state,
      targetNumber: state.targetNumber,
      done: state.done,
      winnerId: state.winnerId
    };
  }
};

import type { GameEngine, Room } from "../types";

export interface RacingPlayerState {
    progress: number; // 0 to 100 (percentage of track completed)
    tapsInWindow: number;
    windowStartMs: number;
    finishedAt: number | null; // timestamp when player crossed finish line
    rank: number | null;
}

export interface RacingState {
    playerStates: Record<string, RacingPlayerState>;
    startedAt: number;
    finishOrder: string[]; // ordered list of playerIds who finished
    done: boolean;
    winnerId: string | null;
}

const TAP_SPEED_INCREMENT = 3.5; // % per valid tap
const TAP_WINDOW_MS = 500; // spam protection window
const TAP_LIMIT_PER_WINDOW = 10; // max effective taps per window

export const racingGame: GameEngine = {
    initGame: (room: Room): RacingState => {
        const playerStates: Record<string, RacingPlayerState> = {};
        room.players.forEach((player) => {
            playerStates[player.playerId] = {
                progress: 0,
                tapsInWindow: 0,
                windowStartMs: Date.now(),
                finishedAt: null,
                rank: null,
            };
        });

        return {
            playerStates,
            startedAt: Date.now(),
            finishOrder: [],
            done: false,
            winnerId: null,
        };
    },

    handleAction: (room: Room, payload: Record<string, unknown>, now: number): RacingState => {
        const state = room.gameState as RacingState;
        if (!state || state.done) return state;

        const playerId = String(payload.playerId ?? "");
        if (!playerId) return state;

        let pState = state.playerStates[playerId];
        if (!pState) {
            // Initialize if missing (late join)
            pState = {
                progress: 0,
                tapsInWindow: 0,
                windowStartMs: now,
                finishedAt: null,
                rank: null,
            };
            state.playerStates[playerId] = pState;
        }

        if (pState.finishedAt !== null) return state; // already finished

        // Spam protection window
        if (now - pState.windowStartMs > TAP_WINDOW_MS) {
            pState.tapsInWindow = 0;
            pState.windowStartMs = now;
        }

        if (pState.tapsInWindow >= TAP_LIMIT_PER_WINDOW) {
            // Still counts window, no progress
            pState.tapsInWindow++;
            return state;
        }

        pState.tapsInWindow++;
        pState.progress = Math.min(100, pState.progress + TAP_SPEED_INCREMENT);

        if (pState.progress >= 100) {
            pState.finishedAt = now;
            state.finishOrder.push(playerId);
            pState.rank = state.finishOrder.length;

            // First finisher wins
            if (!state.winnerId) {
                state.winnerId = playerId;
                state.done = true;
            }
        }

        room.gameState = state;
        return state;
    },

    calculateResult: (room: Room): Record<string, unknown> => {
        const state = room.gameState as RacingState;
        if (!state) return { done: false };

        // Build ranking sorted by finishedAt (nulls last), then by progress
        const ranking = Object.entries(state.playerStates)
            .map(([id, ps]) => ({ playerId: id, ...ps }))
            .sort((a, b) => {
                if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
                if (a.finishedAt !== null) return -1;
                if (b.finishedAt !== null) return 1;
                return b.progress - a.progress;
            });

        return {
            playerStates: state.playerStates,
            startedAt: state.startedAt,
            finishOrder: state.finishOrder,
            done: state.done,
            winnerId: state.winnerId,
            ranking,
        };
    },
};

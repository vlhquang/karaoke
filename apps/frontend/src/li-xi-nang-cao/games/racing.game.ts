import type { GameEngine, Room, StartGameOptions } from "../types";

export interface RacingPlayerState {
    playerId: string;
    lane: number;
    distance: number;
    speed: number;
    status: "normal" | "stopped" | "spinning" | "penalized" | "rewarded";
    statusEndsAt: number;
    finishTime?: number;
}

export interface Obstacle {
    distance: number;
    lane: number;
    type: "stone" | "oil" | "question";
}

export interface RacingState {
    seed: string;
    laneCount: number;
    finishDistance: number;
    phase: "WAITING" | "COUNTDOWN" | "RACING" | "QUESTION" | "FINISHED";
    phaseEndsAt: number;
    playerStates: Record<string, RacingPlayerState>;
    obstacles: Obstacle[];
    currentQuestion?: {
        id: string;
        question: string;
        answers: string[];
        correctIndex: number;
        startTime: number;
        responses: Record<string, { answerIndex: number; time: number }>;
    };
    done: boolean;
    winnerId: string | null;
}

// Simple LCG for deterministic generation
function getSeedRandom(seed: string, modifier: number) {
    let h = 0;
    const str = seed + modifier;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    const x = Math.sin(h) * 10000;
    return x - Math.floor(x);
}

export const racingGame: GameEngine = {
    initGame: (room: Room, options?: StartGameOptions): RacingState => {
        const seed = Math.random().toString(36).substring(7);
        const playerStates: Record<string, RacingPlayerState> = {};
        [...room.players.keys()].forEach((pid) => {
            playerStates[pid] = {
                playerId: pid,
                lane: 1, // Start in middle lane (0, 1, 2)
                distance: 0,
                speed: 10,
                status: "normal",
                statusEndsAt: 0
            };
        });

        const laneCount = 3;
        const finishDistance = options?.racing?.trackLength ?? 5000;
        const obstacles: Obstacle[] = [];

        // Generate obstacles deterministically based on seed
        for (let d = 500; d < finishDistance - 200; d += 300) {
            const modifier = d;
            const rand = getSeedRandom(seed, modifier);
            const lane = Math.floor(rand * laneCount);
            const typeRand = getSeedRandom(seed, modifier + 1);
            let type: "stone" | "oil" | "question" = "stone";
            if (typeRand > 0.8) type = "question";
            else if (typeRand > 0.5) type = "oil";

            obstacles.push({ distance: d, lane, type });
        }

        return {
            seed,
            laneCount,
            finishDistance,
            phase: "COUNTDOWN",
            phaseEndsAt: Date.now() + 3000,
            playerStates,
            obstacles,
            done: false,
            winnerId: null
        };
    },

    handleAction: (room: Room, payload: Record<string, unknown>, now: number): RacingState => {
        const state = room.gameState as RacingState;
        if (state.done) return state;

        const playerId = String(payload.playerId ?? "");
        const event = String(payload._event ?? "");

        if (!playerId || !state.playerStates[playerId]) return state;
        const pState = state.playerStates[playerId];

        if (event === "racing:lane_change") {
            const direction = String(payload.direction);
            if (direction === "left" && pState.lane > 0) pState.lane--;
            if (direction === "right" && pState.lane < state.laneCount - 1) pState.lane++;
        }

        if (event === "racing:collision") {
            const obsIdx = Number(payload.obstacleIndex);
            const obstacle = state.obstacles[obsIdx];
            if (obstacle && pState.status === "normal") {
                if (obstacle.type === "stone") {
                    pState.status = "stopped";
                    pState.statusEndsAt = now + 1500;
                    pState.speed = 0;
                } else if (obstacle.type === "oil") {
                    pState.status = "spinning";
                    pState.statusEndsAt = now + 1000;
                    pState.speed = 5;
                } else if (obstacle.type === "question") {
                    state.phase = "QUESTION";
                    state.phaseEndsAt = now + 10000; // 10s for question
                    state.currentQuestion = {
                        id: `q_${now}`,
                        question: "12 + 15 = ?", // Example, should be randomized
                        answers: ["25", "27", "30", "22"],
                        correctIndex: 1,
                        startTime: now,
                        responses: {}
                    };
                }
            }
        }

        if (event === "racing:answer") {
            if (state.phase === "QUESTION" && state.currentQuestion) {
                const answerIndex = Number(payload.answerIndex);
                state.currentQuestion.responses[playerId] = {
                    answerIndex,
                    time: now
                };
            }
        }

        return state;
    },

    calculateResult: (room: Room): RacingState => {
        const state = room.gameState as RacingState;
        const now = Date.now();

        if (state.done) return state;

        if (state.phase === "COUNTDOWN" && now >= state.phaseEndsAt) {
            state.phase = "RACING";
            state.phaseEndsAt = 0;
        }

        if (state.phase === "RACING") {
            Object.values(state.playerStates).forEach((ps) => {
                if (ps.finishTime) return;

                // Reset status if expired
                if (ps.status !== "normal" && now >= ps.statusEndsAt) {
                    ps.status = "normal";
                    ps.speed = 10;
                }

                // Update distance (rough estimation for backend sync)
                if (ps.status !== "stopped") {
                    ps.distance += ps.speed * 1.5; // Scale factor
                }

                if (ps.distance >= state.finishDistance) {
                    ps.distance = state.finishDistance;
                    ps.finishTime = now;
                    if (!state.winnerId) {
                        state.winnerId = ps.playerId;
                    }
                }
            });

            const allFinished = Object.values(state.playerStates).every(ps => !!ps.finishTime);
            if (allFinished) {
                state.phase = "FINISHED";
                state.done = true;
            }
        }

        if (state.phase === "QUESTION" && now >= state.phaseEndsAt) {
            // Resolve question
            if (state.currentQuestion) {
                Object.entries(state.playerStates).forEach(([pid, ps]) => {
                    const resp = state.currentQuestion!.responses[pid];
                    if (resp && resp.answerIndex === state.currentQuestion!.correctIndex) {
                        ps.status = "rewarded";
                        ps.speed = 20;
                        ps.statusEndsAt = now + 3000;
                    } else {
                        ps.status = "penalized";
                        ps.speed = 5;
                        ps.statusEndsAt = now + 3000;
                    }
                });
            }
            state.phase = "RACING";
            state.phaseEndsAt = 0;
            delete state.currentQuestion;
        }

        return state;
    }
};

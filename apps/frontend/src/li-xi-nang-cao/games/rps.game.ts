import type { GameEngine, Room } from "../types";

interface RpsState {
  submissions: Record<string, "rock" | "paper" | "scissors">;
  deadlineAt: number;
}

const options: Array<"rock" | "paper" | "scissors"> = ["rock", "paper", "scissors"];

const win = (a: "rock" | "paper" | "scissors", b: "rock" | "paper" | "scissors"): boolean =>
  (a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper");

export const rpsGame: GameEngine = {
  initGame: (): RpsState => ({ submissions: {}, deadlineAt: Date.now() + 3000 }),

  handleAction: (room: Room, payload: Record<string, unknown>): RpsState => {
    const state = room.gameState as RpsState;
    const playerId = String(payload.playerId ?? "");
    const choice = String(payload.choice ?? "") as "rock" | "paper" | "scissors";
    if (!options.includes(choice) || !playerId) {
      return state;
    }
    state.submissions[playerId] = choice;
    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as RpsState;
    const players = [...room.players.values()].map((p) => p.playerId).slice(0, 2);
    for (const playerId of players) {
      if (!state.submissions[playerId]) {
        state.submissions[playerId] = options[Math.floor(Math.random() * options.length)];
      }
    }

    const [p1, p2] = players;
    const c1 = state.submissions[p1];
    const c2 = state.submissions[p2];
    let winnerId: string | null = null;
    if (c1 !== c2) {
      winnerId = win(c1, c2) ? p1 : p2;
    }
    return { submissions: state.submissions, winnerId };
  }
};

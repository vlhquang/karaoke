import type { GameEngine, Room, StartGameOptions } from "../types";

type Choice = "rock" | "paper" | "scissors";

interface RpsRound {
  submissions: Record<string, Choice>;
  winnerId: string | null;
  revealed: boolean;
}

interface RpsState {
  mode: "BO1" | "BO3" | "BO5" | "BO7" | "BO11";
  rounds: RpsRound[];
  currentRoundIndex: number;
  scores: Record<string, number>;
  deadlineAt: number;
  winnerId: string | null;
  done: boolean;
  requiredWins: number;
  [key: string]: any;
}

const CHOICES: Choice[] = ["rock", "paper", "scissors"];

const getWinner = (a: Choice, b: Choice): number => {
  if (a === b) return 0;
  if ((a === "rock" && b === "scissors") || (a === "paper" && b === "rock") || (a === "scissors" && b === "paper")) {
    return 1;
  }
  return 2;
};

const createRound = (deadlineMs: number): RpsRound => ({
  submissions: {},
  winnerId: null,
  revealed: false
});

export const rpsGame: GameEngine = {
  initGame: (room: Room, options?: StartGameOptions): RpsState => {
    const mode = options?.rps?.mode || "BO1";
    let requiredWins = 1;
    if (mode.startsWith("BO")) {
      const num = parseInt(mode.replace("BO", ""), 10);
      if (!isNaN(num)) {
        requiredWins = Math.ceil(num / 2);
      }
    }
    const players = [...room.players.values()].filter((p) => p.isOnline);
    const scores: Record<string, number> = {};
    players.forEach((p) => {
      scores[p.playerId] = 0;
    });

    return {
      mode,
      rounds: [createRound(3000)],
      currentRoundIndex: 0,
      scores,
      deadlineAt: Date.now() + 3000,
      winnerId: null,
      done: false,
      requiredWins
    };
  },

  handleAction: (room: Room, payload: Record<string, unknown>, now: number): RpsState => {
    const state = room.gameState as RpsState;
    const playerId = String(payload.playerId ?? "");
    const choice = String(payload.choice ?? "") as Choice;

    if (!CHOICES.includes(choice) || !playerId) {
      return state;
    }

    if (now > state.deadlineAt || state.done) {
      return state;
    }

    const currentRound = state.rounds[state.currentRoundIndex];
    if (currentRound.revealed) {
      return state;
    }

    currentRound.submissions[playerId] = choice;

    // Check if both players submitted
    const players = [...room.players.values()].filter((p) => p.isOnline).map((p) => p.playerId);
    const submittedCount = players.filter((id) => currentRound.submissions[id]).length;

    if (submittedCount >= 2) {
      // Both submitted, we can reveal early or just wait for calculateResult
      // For speed, let's let calculateResult handle it
    }

    room.gameState = state;
    return state as any;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as RpsState;
    if (state.done) return state as any;

    const now = Date.now();
    const currentRound = state.rounds[state.currentRoundIndex];
    const players = [...room.players.values()].filter((p) => p.isOnline).map((p) => p.playerId).slice(0, 2);

    if (players.length < 2) {
      // Not enough players, can't continue or just end
      return state as any;
    }

    const [p1, p2] = players;
    const bothSubmitted = currentRound.submissions[p1] && currentRound.submissions[p2];
    const timeUp = now >= state.deadlineAt;

    if ((bothSubmitted || timeUp) && !currentRound.revealed) {
      // Reveal round
      currentRound.revealed = true;

      // Auto-random for missing choices
      players.forEach((pid) => {
        if (!currentRound.submissions[pid]) {
          currentRound.submissions[pid] = CHOICES[Math.floor(Math.random() * CHOICES.length)];
        }
      });

      const c1 = currentRound.submissions[p1];
      const c2 = currentRound.submissions[p2];
      const result = getWinner(c1, c2);

      if (result === 1) {
        currentRound.winnerId = p1;
        state.scores[p1] = (state.scores[p1] || 0) + 1;
      } else if (result === 2) {
        currentRound.winnerId = p2;
        state.scores[p2] = (state.scores[p2] || 0) + 1;
      }

      // Check if someone won the game
      if (state.scores[p1] >= state.requiredWins) {
        state.winnerId = p1;
        state.done = true;
      } else if (state.scores[p2] >= state.requiredWins) {
        state.winnerId = p2;
        state.done = true;
      } else {
        // Prepare next round if not done
        // We might want a short delay before next round, but for now let's just create it
        // The frontend will handle the "revealed" state display before moving on?
        // Actually, if we create next round here, the frontend might instantly jump.
        // Let's add a `nextRoundAt` to allow frontend to show result.
      }
    }

    // Logic to move to next round if current one revealed and some time passed
    if (currentRound.revealed && !state.done && now > state.deadlineAt + 2000) {
      state.currentRoundIndex += 1;
      state.rounds.push(createRound(3000));
      state.deadlineAt = now + 3000;
    }

    room.gameState = state;
    return {
      ...state,
      winnerId: state.winnerId // Return winnerId if game is totally done
    } as any;
  }
};

import type { GameEngine, Room, StartGameOptions } from "../types";
import { grade1Questions } from "../data/math-grade1-questions";
import type { MathQ } from "../data/math-grade1-questions";

type Grade = "1" | "2" | "3" | "4" | "5";

interface MathQuestion {
  prompt: string;
  options: number[];
  correctIndex: number;
  level: number;
}

interface MathAnswer {
  selectedIndex: number;
  answeredAt: number;
  correct: boolean;
}

interface MathKingState {
  grade: Grade;
  targetScore: 5 | 10 | 15 | 20;
  answerTimeMs: number;
  phase: "answer" | "finished";
  phaseEndsAt: number;
  questionIndex: number;          // 1-based display index
  deckIndex: number;              // current position in shuffled deck
  deck: MathQ[];                  // shuffled question bank for this game
  currentQuestion: MathQuestion;
  answers: Record<string, MathAnswer>;
  firstCorrectPlayerId: string | null;
  scores: Record<string, number>;
  winnerId: string | null;
  done: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle — returns a new shuffled array */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Also shuffle the options within one question, updating correctIndex */
function shuffleOptions(raw: MathQ): MathQuestion {
  const opts = shuffle(raw.options);
  return {
    prompt: raw.prompt,
    options: opts,
    correctIndex: opts.indexOf(raw.answer),
    level: 1
  };
}

const normalizeTargetScore = (value: unknown): 5 | 10 | 15 | 20 => {
  if (value === 5 || value === 10 || value === 15 || value === 20) return value;
  return 10;
};

const normalizeAnswerTimeSec = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isInteger(num)) return 15;
  if (num < 5) return 5;
  if (num > 60) return 60;
  return num;
};

/** Get the question bank for a given grade (extensible later) */
function getBankForGrade(_grade: Grade): readonly MathQ[] {
  // For now all grades use grade1 bank; add more banks here when built
  return grade1Questions;
}

const onlinePlayerIds = (room: Room): string[] =>
  [...room.players.values()].filter((p) => p.isOnline).map((p) => p.playerId);

const toPublicState = (state: MathKingState): Record<string, unknown> => {
  const isReveal = state.phase === "finished";
  return {
    grade: state.grade,
    targetScore: state.targetScore,
    answerTimeSec: Math.round(state.answerTimeMs / 1000),
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    questionIndex: state.questionIndex,
    currentQuestion: {
      prompt: state.currentQuestion.prompt,
      options: state.currentQuestion.options,
      level: state.currentQuestion.level,
      ...(isReveal ? { correctIndex: state.currentQuestion.correctIndex } : {})
    },
    answers: state.answers,
    firstCorrectPlayerId: state.firstCorrectPlayerId,
    scores: state.scores,
    winnerId: state.winnerId,
    done: state.done
  };
};

// ── Game Engine ───────────────────────────────────────────────────────────────

export const mathKingGame: GameEngine = {
  initGame: (room: Room, options?: StartGameOptions): MathKingState => {
    const grade = options?.mathking?.grade ?? "1";
    const targetScore = normalizeTargetScore(options?.mathking?.targetScore);
    const answerTimeMs = normalizeAnswerTimeSec(options?.mathking?.answerTimeSec) * 1000;
    const ids = onlinePlayerIds(room);
    const scores = Object.fromEntries(ids.map((id) => [id, 0]));

    // Shuffle the question bank once for this game — no repeats within the game
    const deck = shuffle(getBankForGrade(grade));
    const currentQuestion = shuffleOptions(deck[0]);

    return {
      grade,
      targetScore,
      answerTimeMs,
      phase: "answer",
      phaseEndsAt: Date.now() + answerTimeMs,
      questionIndex: 1,
      deckIndex: 0,
      deck,
      currentQuestion,
      answers: {},
      firstCorrectPlayerId: null,
      scores,
      winnerId: null,
      done: false
    };
  },

  handleAction: (room: Room, payload: Record<string, unknown>, now: number): MathKingState => {
    const state = room.gameState as MathKingState;
    const eventName = String(payload._event ?? "");
    const playerId = String(payload.playerId ?? "");
    if (eventName !== "math:answer" || !playerId || state.done || state.phase !== "answer") {
      return state;
    }
    if (state.answers[playerId]) return state;

    const selectedIndex = Number(payload.selectedIndex);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= state.currentQuestion.options.length) {
      return state;
    }

    const correct = selectedIndex === state.currentQuestion.correctIndex;
    state.answers[playerId] = { selectedIndex, answeredAt: now, correct };

    if (correct && !state.firstCorrectPlayerId) {
      state.firstCorrectPlayerId = playerId;
      state.scores[playerId] = (state.scores[playerId] ?? 0) + 1;
      if (state.scores[playerId] >= state.targetScore) {
        state.winnerId = playerId;
      }
    }

    room.gameState = state;
    return state;
  },

  calculateResult: (room: Room): Record<string, unknown> => {
    const state = room.gameState as MathKingState;
    if (state.done) return toPublicState(state);

    const now = Date.now();
    const ids = onlinePlayerIds(room);
    const allAnswered = ids.length > 0 && ids.every((id) => Boolean(state.answers[id]));

    if (state.phase === "answer" && (now >= state.phaseEndsAt || allAnswered)) {
      if (state.winnerId) {
        state.phase = "finished";
        state.done = true;
      } else {
        // Advance to next question in the shuffled deck (wrap around if exhausted)
        const nextDeckIndex = (state.deckIndex + 1) % state.deck.length;
        state.deckIndex = nextDeckIndex;
        state.questionIndex += 1;
        state.currentQuestion = shuffleOptions(state.deck[nextDeckIndex]);
        state.phase = "answer";
        state.phaseEndsAt = now + state.answerTimeMs;
        state.answers = {};
        state.firstCorrectPlayerId = null;
      }
    }

    room.gameState = state;
    return toPublicState(state);
  }
};

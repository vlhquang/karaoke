import type { GameEngine, Room, StartGameOptions } from "../types";

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
  phase: "answer" | "reveal" | "finished";
  phaseEndsAt: number;
  questionIndex: number;
  currentQuestion: MathQuestion;
  answers: Record<string, MathAnswer>;
  firstCorrectPlayerId: string | null;
  scores: Record<string, number>;
  winnerId: string | null;
  done: boolean;
}

const REVEAL_MS = 2_000;

const randInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

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

const buildQuestionGrade1 = (index: number): MathQuestion => {
  const level = Math.max(1, Math.floor(index / 3) + 1);
  const maxBase = level <= 2 ? 10 : level <= 4 ? 20 : 30;
  const usePlus = Math.random() < 0.6;
  let a = randInt(0, maxBase);
  let b = randInt(0, maxBase);

  if (!usePlus && b > a) {
    [a, b] = [b, a];
  }

  const answer = usePlus ? a + b : a - b;
  const prompt = usePlus ? `${a} + ${b} = ?` : `${a} - ${b} = ?`;
  const candidates = new Set<number>([answer]);
  while (candidates.size < 4) {
    const delta = randInt(1, Math.max(3, Math.floor(maxBase / 3)));
    const sign = Math.random() < 0.5 ? -1 : 1;
    const value = Math.max(0, answer + sign * delta);
    candidates.add(value);
  }
  const options = [...candidates].sort(() => Math.random() - 0.5);
  const correctIndex = options.findIndex((v) => v === answer);
  return { prompt, options, correctIndex, level };
};

const buildQuestion = (grade: Grade, questionIndex: number): MathQuestion => {
  if (grade === "1") {
    return buildQuestionGrade1(questionIndex);
  }
  // Placeholder for grade 2-5 in future iterations.
  return buildQuestionGrade1(questionIndex);
};

const onlinePlayerIds = (room: Room): string[] =>
  [...room.players.values()].filter((p) => p.isOnline).map((p) => p.playerId);

const toPublicState = (state: MathKingState): Record<string, unknown> => {
  const isReveal = state.phase === "reveal" || state.phase === "finished";
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

export const mathKingGame: GameEngine = {
  initGame: (room: Room, options?: StartGameOptions): MathKingState => {
    const grade = options?.mathking?.grade ?? "1";
    const targetScore = normalizeTargetScore(options?.mathking?.targetScore);
    const answerTimeMs = normalizeAnswerTimeSec(options?.mathking?.answerTimeSec) * 1000;
    const ids = onlinePlayerIds(room);
    const scores = Object.fromEntries(ids.map((id) => [id, 0]));
    const currentQuestion = buildQuestion(grade, 1);

    return {
      grade,
      targetScore,
      answerTimeMs,
      phase: "answer",
      phaseEndsAt: Date.now() + answerTimeMs,
      questionIndex: 1,
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

    if (state.answers[playerId]) {
      return state;
    }

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
    if (state.done) {
      return toPublicState(state);
    }

    const now = Date.now();
    const ids = onlinePlayerIds(room);
    const allAnswered = ids.length > 0 && ids.every((id) => Boolean(state.answers[id]));

    if (state.phase === "answer" && (now >= state.phaseEndsAt || allAnswered)) {
      state.phase = "reveal";
      state.phaseEndsAt = now + REVEAL_MS;
    } else if (state.phase === "reveal" && now >= state.phaseEndsAt) {
      if (state.winnerId) {
        state.phase = "finished";
        state.done = true;
      } else {
        const nextIndex = state.questionIndex + 1;
        state.questionIndex = nextIndex;
        state.currentQuestion = buildQuestion(state.grade, nextIndex);
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

import type { GameEngine, GameType } from "../types";
import { reactionGame } from "./reaction.game";
import { memoryGame } from "./memory.game";
import { rpsGame } from "./rps.game";
import { numberGame } from "./number.game";
import { shakeGame } from "./shake.game";
import { colorGame } from "./color.game";

export const gameEngines: Record<GameType, GameEngine> = {
  reaction: reactionGame,
  memory: memoryGame,
  rps: rpsGame,
  number: numberGame,
  shake: shakeGame,
  color: colorGame
};

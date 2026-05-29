export type GameCategory = "competitive" | "coop" | "party";

export type GameId =
  | "mini-brawler-3d"
  | "sport-action-3d"
  | "arena-shooter-3d"
  | "duo-puzzle-3d"
  | "chaos-kitchen-3d"
  | "tower-defense-3d"
  | "racing-casual-3d"
  | "mini-games-3d"
  | "candy-ball-3d"
  | "bubble-arena-3d"
  | "island-box-push-3d"
  | "hopper-race-3d"
  | "ring-toss-3d"
  | "toy-robot-duel-3d"
  | "teddy-rescue-3d"
  | "bridge-builder-3d"
  | "fire-rescue-3d"
  | "whack-mole-3d"
  | "falling-dodge-3d"
  | "star-maze-3d"
  | "rock-paper-magic-3d"
  | "tic-tac-toe-3d"
  | "memory-match-3d"
  | "color-catch-3d"
  | "treasure-hunt-3d";

export interface GameDefinition {
  id: GameId;
  title: string;
  shortTitle: string;
  subtitle: string;
  category: GameCategory;
  modeLabel: string;
  durationLabel: string;
  difficulty: "Dễ" | "Vừa" | "Khó";
  accent: string;
  secondaryAccent: string;
  objective: string;
  mechanics: string[];
  kidTheme: string;
}

export interface RuntimeStats {
  p1Score: number;
  p2Score: number;
  p1Health: number;
  p2Health: number;
  sharedScore: number;
  timeLeft: number;
  resource: number;
  status: "ready" | "playing" | "paused" | "finished";
  message: string;
}

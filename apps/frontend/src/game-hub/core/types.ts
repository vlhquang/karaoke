export type GameCategory = "competitive" | "coop" | "party";

export type GameRuntimeKind = "legacy-three" | "r3f-ghost" | "camera-dodge";

export type GamePlatform = "desktop" | "tv" | "mobile" | "camera";

export interface GameHelpContent {
  goal: string;
  controls: string[];
  tips: string[];
}

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
  | "treasure-hunt-3d"
  | "ghost-hunters-3d";

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
  runtime?: GameRuntimeKind;
  supportedPlayers?: number[];
  defaultPlayers?: number;
  requiresCamera?: boolean;
  supportedPlatforms?: GamePlatform[];
  help?: GameHelpContent;
}

export interface PlayableGameDefinition extends Omit<GameDefinition, "id"> {
  id: GameId | "camera-dodge";
  runtime: GameRuntimeKind;
  supportedPlayers: number[];
  defaultPlayers: number;
  requiresCamera: boolean;
  supportedPlatforms: GamePlatform[];
  help: GameHelpContent;
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

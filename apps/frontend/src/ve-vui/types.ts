export type Phase = "lobby" | "preparing" | "drawing" | "review" | "result" | "finished";
export type Category = "Đồ dùng" | "Đồ ăn" | "Động vật" | "Phương tiện" | "Trong nhà" | "Ngoài trời";
export const CATEGORIES: Category[] = ["Đồ dùng", "Đồ ăn", "Động vật", "Phương tiện", "Trong nhà", "Ngoài trời"];
export interface Settings {
  rounds: number;
  duration: 60 | 90 | 120;
  preparation: 0 | 3 | 5 | 10 | 15;
  voiceEnabled: boolean;
  difficulty: "easy" | "medium" | "mixed";
  category: Category | "all";
  judging: "hybrid" | "manual";
  hints: boolean;
}
export const DEFAULT_SETTINGS: Settings = { rounds: 2, duration: 90, preparation: 5, voiceEnabled: false, difficulty: "easy", category: "all", judging: "hybrid", hints: true };
export interface Prompt {
  id: string;
  answer: string;
  aliases: string[];
  category: Category;
  difficulty: "easy" | "medium";
}
export interface Point { x: number; y: number }
// A fill stores canonical pixel runs [offset, length, ...], so every device paints
// the same region rather than flood-filling its own antialiased canvas.
export interface Stroke { id: string; color: string; width: number; points: Point[]; fill?: number[] }
export interface PlayerView {
  id: string; name: string; connected: boolean; ready: boolean; score: number; activeFromRound: number;
  voiceId: string | null; voiceMuted: boolean;
}
export interface Similarity { percent: number; label: string; explanation: string; source: "rules" | "local" | "ai" }
export interface GuessView {
  id: string; playerId: string; text: string | null; status: "pending" | "accepted" | "rejected";
  sentAt: number; similarity?: Similarity;
  attempt: number;
}
export interface TurnResult {
  id: string; drawerId: string; answer: string; strokes: Stroke[]; cancelled: boolean;
  awards: Record<string, number>; accepted: { playerId: string; text: string; points: number }[];
}
export interface RoomView {
  code: string; ownId: string; hostId: string; phase: Phase; settings: Settings; players: PlayerView[];
  round: number; order: string[]; turnIndex: number; drawerId: string | null;
  deadline: number; serverNow: number; paused: boolean; pauseReason: string | null; pauseDeadline: number | null;
  answer: string | null; canReroll: boolean; wordCount: number; hintCategory: string | null; hintLetter: string | null;
  strokes: Stroke[]; guesses: GuessView[]; eligibleIds: string[]; results: TurnResult[];
  currentResult: TurnResult | null; pauseAfterTurn: boolean;
  turnId: string; canvasRevision: number;
}
export interface Session { code: string; playerId: string; token: string }
export interface VoiceIceServer { urls: string | string[]; username?: string; credential?: string }
export interface VoiceSignal {
  fromId: string; fromVoiceId: string; targetVoiceId: string;
  exchangeId?: string; restart?: true; manual?: boolean;
  description?: { type: "offer" | "answer"; sdp: string };
  candidate?: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null };
}
export interface Reply { ok: boolean; error?: string; session?: Session; canvasRevision?: number; turnId?: string; voice?: { id: string; iceServers: VoiceIceServer[]; relayConfigured?: boolean } }
export const attemptMultiplier = (attempt: number) => Math.max(50, 100 - (Math.max(1, attempt) - 1) * 10);

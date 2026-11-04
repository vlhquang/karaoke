import { randomInt, randomUUID } from "node:crypto";
import { PROMPTS } from "./prompts";
import { localSimilarity, matchesAnswer, normalizeAnswer } from "./matching";
import { DEFAULT_SETTINGS, type GuessView, type Phase, type PlayerView, type Prompt, type RoomView, type Settings, type Similarity, type Stroke, type TurnResult } from "./types";

export interface Player extends PlayerView { token: string; socketId: string | null; lastGuessAt: number; kicked?: boolean }
interface Guess extends GuessView { text: string; similarity: Similarity; elapsedAtSend: number }
export class DrawingRoom {
  readonly code: string;
  players: Player[] = [];
  hostId = "";
  settings: Settings = { ...DEFAULT_SETTINGS };
  phase: Phase = "lobby";
  round = 0;
  order: string[] = [];
  turnIndex = 0;
  drawerId: string | null = null;
  prompt: Prompt | null = null;
  deadline = 0;
  drawingStartedAt = 0;
  drawingElapsed = 0;
  strokes: Stroke[] = [];
  guesses: Guess[] = [];
  eligibleIds: string[] = [];
  results: TurnResult[] = [];
  used = new Set<string>();
  rerolled = false;
  paused = false;
  pauseReason: "drawer" | "waiting" | "host" | null = null;
  pauseDeadline: number | null = null;
  pauseAfterTurn = false;
  private pauseStartedAt = 0;
  emptySince: number | null = null;
  private pointCount = 0;
  private turnId = "";
  private lastHintStage = 0;

  constructor(code: string, readonly now: () => number = Date.now) { this.code = code; }

  addPlayer(name: string, socketId: string): Player {
    if (this.players.filter(p => !p.kicked).length >= 8) throw new Error("Phòng đã đủ 8 người.");
    const activeFromRound = this.phase === "lobby" || this.phase === "finished" ? 1 : this.round + 1;
    if (this.phase !== "lobby" && this.phase !== "finished" && this.availablePrompts().length < this.remainingTurns() + Math.max(0, this.settings.rounds - this.round)) {
      throw new Error("Kho đề của trận này không đủ cho thêm người. Hãy tham gia ở trận tiếp theo nhé.");
    }
    const player: Player = { id: randomUUID(), token: randomUUID(), socketId, name, connected: true, ready: false, score: 0, activeFromRound, lastGuessAt: -Infinity };
    this.players.push(player);
    if (!this.hostId) this.hostId = player.id;
    this.emptySince = null;
    this.checkConnections();
    return player;
  }

  restore(playerId: string, token: string, socketId: string): Player {
    const player = this.players.find(p => p.id === playerId && p.token === token && !p.kicked);
    if (!player) throw new Error("Phiên chơi không còn hợp lệ. Hãy vào lại phòng.");
    player.socketId = socketId;
    player.connected = true;
    this.emptySince = null;
    if (!this.players.some(p => p.id === this.hostId && p.connected)) this.hostId = player.id;
    this.checkConnections();
    return player;
  }

  disconnect(id: string, leave = false): void {
    const player = this.players.find(p => p.id === id);
    if (!player) return;
    player.connected = false;
    player.socketId = null;
    player.ready = false;
    if (leave) player.kicked = true;
    const connected = this.players.filter(p => p.connected && !p.kicked);
    if (!connected.some(p => p.id === this.hostId)) this.hostId = connected[0]?.id ?? this.hostId;
    if (!connected.length && this.emptySince === null) this.emptySince = this.now();
    if (leave && this.phase === "lobby") this.players = this.players.filter(p => p.id !== id);
    this.checkConnections();
  }

  requireHost(id: string): void { if (id !== this.hostId) throw new Error("Chỉ chủ phòng được thực hiện thao tác này."); }
  requireDrawer(id: string): void { if (id !== this.drawerId) throw new Error("Chỉ người đang vẽ được thực hiện thao tác này."); }

  configure(id: string, settings: Settings): void {
    this.requireHost(id);
    if (this.phase !== "lobby") throw new Error("Chỉ chỉnh cài đặt trong phòng chờ.");
    this.settings = settings;
    this.players.forEach(p => { p.ready = false; });
  }

  ready(id: string): void {
    if (this.phase !== "lobby") throw new Error("Trận đã bắt đầu.");
    const player = this.players.find(p => p.id === id)!;
    player.ready = !player.ready;
  }

  start(id: string): void {
    this.requireHost(id);
    if (this.phase !== "lobby") throw new Error("Trận đã bắt đầu.");
    const players = this.players.filter(p => p.connected && !p.kicked);
    if (players.length < 2 || players.some(p => !p.ready)) throw new Error("Cần ít nhất 2 người và tất cả đều sẵn sàng.");
    if (new Set(this.pool().map(p => normalizeAnswer(p.answer))).size < players.length * this.settings.rounds) throw new Error("Kho đề cho cài đặt này chưa đủ. Chọn tất cả chủ đề, độ khó hỗn hợp hoặc giảm số vòng.");
    this.players = players;
    this.players.forEach(p => { p.score = 0; p.activeFromRound = 1; });
    this.order = this.shuffle(players.map(p => p.id));
    this.round = 1;
    this.turnIndex = -1;
    this.results = [];
    this.used.clear();
    this.pauseAfterTurn = false;
    this.advance();
  }

  rematch(id: string): void {
    this.requireHost(id);
    if (this.phase !== "finished") throw new Error("Trận chưa kết thúc.");
    this.players = this.players.filter(p => p.connected && !p.kicked);
    this.players.forEach(p => { p.score = 0; p.ready = false; p.activeFromRound = 1; });
    this.phase = "lobby";
    this.round = 0;
    this.order = [];
    this.drawerId = null;
    this.prompt = null;
    this.strokes = [];
    this.guesses = [];
    this.results = [];
    this.clearPause();
  }

  reroll(id: string): void {
    this.requireDrawer(id);
    if (this.phase !== "preparing" || this.paused || this.rerolled) throw new Error("Mỗi lượt chỉ được đổi đề một lần khi chuẩn bị.");
    const remainingTurns = this.remainingTurns();
    const available = this.availablePrompts();
    if (available.length <= remainingTurns) throw new Error("Cần giữ đề còn lại cho các lượt sau. Bạn hãy vẽ đề hiện tại.");
    this.prompt = this.pickPrompt();
    this.rerolled = true;
  }

  addStroke(id: string, stroke: Stroke): void {
    this.requireDrawer(id);
    if (this.phase !== "drawing" || this.paused) throw new Error("Bảng vẽ hiện đang khóa.");
    if (this.pointCount + stroke.points.length > 35000) throw new Error("Bảng vẽ đã đầy. Hoàn tác hoặc xóa bảng để vẽ tiếp.");
    const last = this.strokes[this.strokes.length - 1];
    if (last?.id === stroke.id && last.color === stroke.color && last.width === stroke.width) last.points.push(...stroke.points);
    else {
      if (this.strokes.length >= 1500 || this.strokes.some(s => s.id === stroke.id)) throw new Error("Nét vẽ không hợp lệ hoặc đã vượt giới hạn.");
      this.strokes.push({ ...stroke, points: [...stroke.points] });
    }
    this.pointCount += stroke.points.length;
  }

  editCanvas(id: string, action: "undo" | "clear"): void {
    this.requireDrawer(id);
    if (this.phase !== "drawing" || this.paused) throw new Error("Bảng vẽ hiện đang khóa.");
    if (action === "clear") this.strokes = [];
    else this.strokes.pop();
    this.pointCount = this.strokes.reduce((sum, s) => sum + s.points.length, 0);
  }

  submitGuess(id: string, text: string): Guess {
    if (this.phase !== "drawing" || this.paused || !this.eligibleIds.includes(id)) throw new Error("Bạn chưa thể đoán trong lượt này.");
    if (this.guesses.some(g => g.playerId === id && g.status === "accepted")) throw new Error("Bạn đã đoán đúng rồi!");
    const player = this.players.find(p => p.id === id)!;
    if (this.now() - player.lastGuessAt < 2000) throw new Error("Chờ 2 giây giữa hai lần đoán nhé.");
    if (this.guesses.some(g => g.playerId === id && g.status === "pending" && normalizeAnswer(g.text) === normalizeAnswer(text))) throw new Error("Câu này đang chờ người vẽ duyệt.");
    const exact = matchesAnswer(text, this.prompt!);
    const guess: Guess = { id: randomUUID(), playerId: id, text, sentAt: this.now(), elapsedAtSend: this.now() - this.drawingStartedAt, status: exact && this.settings.judging === "hybrid" ? "accepted" : "pending", similarity: localSimilarity(text, this.prompt!) };
    player.lastGuessAt = this.now();
    this.guesses.push(guess);
    this.finishIfAllCorrect();
    return guess;
  }

  applySimilarity(guessId: string, similarity: Similarity): boolean {
    const guess = this.guesses.find(g => g.id === guessId);
    if (!guess || guess.status !== "pending" || !["drawing", "review"].includes(this.phase)) return false;
    guess.similarity = similarity;
    return true;
  }

  judge(id: string, guessId: string, accepted: boolean): void {
    this.requireDrawer(id);
    if (!["drawing", "review", "result"].includes(this.phase) || this.paused) throw new Error("Chưa thể duyệt ở thời điểm này.");
    if (this.currentResult()?.cancelled) throw new Error("Lượt này đã hủy.");
    const guess = this.guesses.find(g => g.id === guessId);
    if (!guess) throw new Error("Không tìm thấy dự đoán.");
    if (accepted) this.guesses.filter(g => g.playerId === guess.playerId && g.id !== guess.id && g.status === "accepted").forEach(g => { g.status = "rejected"; });
    guess.status = accepted ? "accepted" : "rejected";
    if (this.phase === "result") this.saveResult();
    else {
      this.finishIfAllCorrect();
      if (this.phase === "review" && !this.guesses.some(g => g.status === "pending")) this.endTurn();
    }
  }

  togglePause(id: string): void {
    this.requireHost(id);
    if (this.phase === "lobby" || this.phase === "finished") throw new Error("Chưa có trận đang chơi.");
    if (this.paused && this.pauseReason === "host") {
      this.pauseAfterTurn = false;
      this.resume();
      return;
    }
    this.pauseAfterTurn = !this.pauseAfterTurn;
    if (this.phase === "result" && this.pauseAfterTurn && !this.paused) this.pause("host");
  }

  nextTurn(id: string, resultId: string): void {
    this.requireHost(id);
    if (this.phase !== "result" || this.currentResult()?.id !== resultId) throw new Error("Chỉ chuyển lượt khi đang xem kết quả lượt hiện tại.");
    if (this.paused) throw new Error("Hãy tiếp tục trận trước khi chuyển lượt.");
    this.advance();
  }

  finish(id: string): void {
    this.requireHost(id);
    if (this.phase === "lobby" || this.phase === "finished") throw new Error("Chưa có trận đang chơi.");
    // In-progress turn is cancelled; only completed turns contribute to the scoreboard.
    if (["drawing", "preparing", "review"].includes(this.phase)) this.endTurn(true);
    this.phase = "finished";
    this.deadline = 0;
    this.clearPause();
  }

  tick(): boolean {
    const before = `${this.phase}:${this.round}:${this.turnIndex}:${this.paused}:${this.hintStage()}`;
    if (this.paused) {
      if (this.pauseReason === "drawer" && this.pauseDeadline !== null && this.now() >= this.pauseDeadline) {
        this.clearPause();
        this.endTurn(true);
        this.checkConnections();
      }
      return before !== `${this.phase}:${this.round}:${this.turnIndex}:${this.paused}:${this.hintStage()}`;
    }
    if (!this.deadline || this.now() < this.deadline) {
      const stage = this.hintStage();
      if (stage !== this.lastHintStage) { this.lastHintStage = stage; return true; }
      return false;
    }
    if (this.phase === "preparing") {
      this.phase = "drawing";
      this.drawingStartedAt = this.now();
      this.deadline = this.now() + this.settings.duration * 1000;
    } else if (this.phase === "drawing") {
      this.drawingElapsed = this.settings.duration * 1000;
      if (this.guesses.some(g => g.status === "pending")) { this.phase = "review"; this.deadline = this.now() + 10000; }
      else this.endTurn();
    } else if (this.phase === "review") this.endTurn();
    return before !== `${this.phase}:${this.round}:${this.turnIndex}:${this.paused}:${this.hintStage()}`;
  }

  view(id: string): RoomView {
    const reveal = this.phase === "result" || this.phase === "finished";
    const drawer = id === this.drawerId;
    const hintStage = this.hintStage();
    return {
      code: this.code, ownId: id, hostId: this.hostId, phase: this.phase, settings: { ...this.settings },
      players: this.players.filter(p => !p.kicked || p.score > 0 || this.order.includes(p.id)).map(({ id: playerId, name, connected, ready, score, activeFromRound }) => ({ id: playerId, name, connected, ready, score, activeFromRound })),
      round: this.round, order: [...this.order], turnIndex: this.turnIndex, drawerId: this.drawerId,
      deadline: this.deadline && this.paused ? this.deadline + this.now() - this.pauseStartedAt : this.deadline,
      serverNow: this.now(), paused: this.paused, pauseReason: this.pauseReason, pauseDeadline: this.pauseDeadline,
      answer: drawer || reveal ? this.prompt?.answer ?? null : null, canReroll: drawer && this.phase === "preparing" && !this.rerolled && !this.paused,
      wordCount: this.prompt?.answer.split(/\s+/).length ?? 0,
      hintCategory: this.settings.hints && hintStage >= 1 ? this.prompt?.category ?? null : null,
      hintLetter: this.settings.hints && hintStage >= 2 ? this.prompt?.answer.charAt(0).toLocaleUpperCase("vi") ?? null : null,
      strokes: this.strokes, eligibleIds: [...this.eligibleIds],
      guesses: this.guesses.map(g => ({ id: g.id, playerId: g.playerId, sentAt: g.sentAt, status: g.status,
        text: drawer || reveal || g.playerId === id || g.status === "rejected" ? g.text : null,
        ...(drawer ? { similarity: g.similarity } : {}),
      })),
      results: this.phase === "finished" ? this.results : this.results.map(result => ({ ...result, strokes: [] })),
      currentResult: this.currentResult() ? { ...this.currentResult()!, strokes: [] } : null, pauseAfterTurn: this.pauseAfterTurn,
    };
  }

  private pool(): Prompt[] {
    return PROMPTS.filter(p => (this.settings.category === "all" || p.category === this.settings.category) && (this.settings.difficulty === "mixed" || p.difficulty === this.settings.difficulty));
  }
  private availablePrompts(): Prompt[] { return this.pool().filter(p => !this.used.has(normalizeAnswer(p.answer))); }
  private remainingTurns(): number {
    return (this.settings.rounds - this.round) * this.players.filter(p => !p.kicked).length + Math.max(0, this.order.length - this.turnIndex - 1);
  }
  private pickPrompt(): Prompt | null {
    const available = this.availablePrompts();
    if (!available.length) return null;
    const prompt = available[randomInt(available.length)];
    this.used.add(normalizeAnswer(prompt.answer));
    return prompt;
  }
  private shuffle(ids: string[]): string[] {
    const result = [...ids];
    for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  private advance(): void {
    for (let attempts = 0; attempts < 48; attempts++) {
      this.turnIndex++;
      if (this.turnIndex >= this.order.length) {
        this.round++;
        if (this.round > this.settings.rounds) { this.phase = "finished"; this.deadline = 0; return; }
        const newcomers = this.players.filter(p => !p.kicked && !this.order.includes(p.id) && p.activeFromRound <= this.round);
        this.order.push(...this.shuffle(newcomers.map(p => p.id)));
        this.turnIndex = 0;
      }
      const drawer = this.players.find(p => p.id === this.order[this.turnIndex]);
      if (!drawer?.connected || drawer.kicked) continue;
      this.drawerId = drawer.id;
      this.prompt = this.pickPrompt();
      if (!this.prompt) { this.phase = "finished"; this.deadline = 0; return; }
      this.turnId = randomUUID();
      this.eligibleIds = this.players.filter(p => p.id !== drawer.id && !p.kicked && p.connected && p.activeFromRound <= this.round).map(p => p.id);
      this.strokes = [];
      this.pointCount = 0;
      this.guesses = [];
      this.rerolled = false;
      this.drawingElapsed = 0;
      this.drawingStartedAt = 0;
      this.lastHintStage = 0;
      this.phase = "preparing";
      this.deadline = this.now() + 10000;
      this.players.forEach(p => { p.lastGuessAt = -Infinity; });
      this.checkConnections();
      return;
    }
    this.phase = "finished";
    this.deadline = 0;
  }
  private finishIfAllCorrect(): void {
    if (this.eligibleIds.length && this.eligibleIds.every(id => this.guesses.some(g => g.playerId === id && g.status === "accepted"))) this.endTurn();
  }
  private currentResult(): TurnResult | null { return this.results.find(r => r.id === this.turnId) ?? null; }
  private saveResult(cancelled = false): void {
    const awards: Record<string, number> = {};
    const accepted = cancelled ? [] : this.eligibleIds.flatMap(id => {
      const guess = this.guesses.find(g => g.playerId === id && g.status === "accepted");
      if (!guess) return [];
      const points = 100 + Math.round(50 * Math.max(0, Math.min(1, 1 - guess.elapsedAtSend / (this.settings.duration * 1000))));
      awards[id] = points;
      return [{ playerId: id, text: guess.text, points }];
    });
    if (this.drawerId && !cancelled) awards[this.drawerId] = this.eligibleIds.length ? Math.round(150 * accepted.length / this.eligibleIds.length) : 0;
    const result: TurnResult = { id: this.turnId, drawerId: this.drawerId!, answer: this.prompt!.answer, strokes: this.strokes, cancelled, awards, accepted };
    const index = this.results.findIndex(r => r.id === this.turnId);
    if (index === -1) this.results.push(result); else this.results[index] = result;
    this.players.forEach(p => { p.score = this.results.reduce((score, r) => score + (r.awards[p.id] ?? 0), 0); });
  }
  private endTurn(cancelled = false): void {
    this.guesses.filter(guess => guess.status === "pending").forEach(guess => { guess.status = "rejected"; });
    this.saveResult(cancelled);
    this.phase = "result";
    this.deadline = 0;
    if (this.pauseAfterTurn && !this.paused) this.pause("host");
  }
  private hintStage(): number {
    if (!this.drawingStartedAt) return 0;
    const elapsed = this.phase === "drawing" ? (this.paused ? this.pauseStartedAt : this.now()) - this.drawingStartedAt : this.drawingElapsed;
    return elapsed >= this.settings.duration * 1000 * (65 / 90) ? 2 : elapsed >= this.settings.duration * 500 ? 1 : 0;
  }
  private pause(reason: "drawer" | "waiting" | "host"): void {
    if (!this.paused) this.pauseStartedAt = this.now();
    this.paused = true;
    this.pauseReason = reason;
    this.pauseDeadline = reason === "drawer" ? this.now() + 20000 : null;
  }
  private clearPause(): void { this.paused = false; this.pauseReason = null; this.pauseDeadline = null; }
  private resume(): void {
    const duration = this.now() - this.pauseStartedAt;
    if (this.deadline) this.deadline += duration;
    if (this.phase === "drawing") {
      this.drawingStartedAt += duration;
    }
    this.clearPause();
  }
  private checkConnections(): void {
    if (this.phase === "lobby" || this.phase === "finished") return;
    const active = this.players.filter(p => p.connected && !p.kicked && p.activeFromRound <= this.round);
    const missingDrawer = ["preparing", "drawing", "review"].includes(this.phase) && !active.some(p => p.id === this.drawerId);
    if (missingDrawer) {
      if (this.pauseReason !== "drawer") this.pause("drawer");
    } else if (active.length < 2) {
      if (this.pauseReason !== "waiting") this.pause("waiting");
    } else if (this.paused && this.pauseReason !== "host") this.resume();
  }
}

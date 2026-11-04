import assert from "node:assert/strict";
import { test } from "node:test";
import { DrawingRoom } from "./engine";
import { matchesAnswer, normalizeAnswer } from "./matching";
import { PROMPTS } from "./prompts";
import type { Stroke } from "./types";

function setup(count = 3, rounds = 1) {
  let now = 100000;
  const room = new DrawingRoom("ABC234", () => now);
  const players = Array.from({ length: count }, (_, i) => room.addPlayer(`Người ${i}`, `socket-${i}`));
  room.settings.rounds = rounds;
  for (const p of players) room.ready(p.id);
  room.start(players[0].id);
  const advance = (ms: number) => { now += ms; room.tick(); };
  const draw = () => advance(10000);
  return { room, players, advance, draw, setNow: (value: number) => { now = value; } };
}

test("Vietnamese normalization and curated aliases never accept another vehicle", () => {
  const bike = PROMPTS.find(p => p.answer === "xe đạp")!;
  for (const value of ["Xe đạp", "xe dap", "  chiếc XE ĐẠP!! "]) assert.equal(matchesAnswer(value, bike), true);
  for (const value of ["xe đappp", "xe hai bánh", "xe máy", "đạp"]) assert.equal(matchesAnswer(value, bike), false);
  const umbrella = PROMPTS.find(p => p.answer === "cái ô")!;
  assert.equal(matchesAnswer("ô", umbrella), true);
  assert.equal(matchesAnswer("cay du", umbrella), true);
  assert.equal(normalizeAnswer("ĐỒNG HỒ!"), "dong ho");
  assert.ok(PROMPTS.length >= 200);
});

test("only drawer sees answer, similarities, and pending or accepted text", () => {
  const { room, draw } = setup();
  draw();
  const [guesser, observer] = room.eligibleIds;
  const pending = room.submitGuess(guesser, "một đáp án khác");
  assert.equal(room.view(guesser).answer, null);
  assert.equal(room.view(observer).guesses[0].text, null);
  assert.equal(room.view(observer).guesses[0].similarity, undefined);
  assert.equal(room.view(guesser).guesses[0].text, pending.text);
  assert.ok(room.view(room.drawerId!).guesses[0].similarity);
  room.judge(room.drawerId!, pending.id, true);
  assert.equal(room.view(observer).guesses[0].text, null);
  assert.equal(room.view(guesser).guesses[0].text, pending.text);
  assert.throws(() => room.judge(guesser, pending.id, true), /Chỉ người/);
  assert.throws(() => room.reroll(guesser), /Chỉ người/);
});

test("delayed approval uses submission time; review closes and result corrections recalculate scores", () => {
  const { room, advance, draw } = setup();
  draw();
  advance(18000);
  const guesser = room.eligibleIds[0];
  const guess = room.submitGuess(guesser, "đoán thử");
  advance(72000);
  assert.equal(room.phase, "review");
  assert.throws(() => room.submitGuess(guesser, "lần nữa"), /chưa thể/);
  room.judge(room.drawerId!, guess.id, true);
  assert.equal(room.phase, "result");
  assert.equal(room.view(guesser).currentResult!.awards[guesser], 140);
  assert.equal(room.view(guesser).currentResult!.awards[room.drawerId!], 75);
  room.judge(room.drawerId!, guess.id, false);
  assert.equal(room.players.find(p => p.id === guesser)!.score, 0);
  room.judge(room.drawerId!, guess.id, true);
  assert.equal(room.players.find(p => p.id === guesser)!.score, 140);
});

test("all correct skips review; repeated acceptance never awards twice", () => {
  const { room, draw } = setup(2);
  draw();
  const guesser = room.eligibleIds[0];
  const guess = room.submitGuess(guesser, room.prompt!.answer);
  assert.equal(room.phase, "result");
  assert.equal(room.players.find(p => p.id === guesser)!.score, 150);
  for (let i = 0; i < 3; i++) room.judge(room.drawerId!, guess.id, true);
  assert.equal(room.players.find(p => p.id === guesser)!.score, 150);
  assert.equal(room.players.find(p => p.id === room.drawerId)!.score, 150);
});

test("manual mode requires accepting exact answers and times out pending guesses", () => {
  const { room, advance, draw } = setup(2);
  room.settings.judging = "manual";
  draw();
  room.submitGuess(room.eligibleIds[0], room.prompt!.answer);
  assert.equal(room.phase, "drawing");
  advance(90000);
  assert.equal(room.phase, "review");
  advance(10000);
  assert.equal(room.phase, "result");
  assert.equal(room.players.find(p => p.id === room.eligibleIds[0])!.score, 0);
});

test("restoring drawer resumes remaining time, keeps identity, drawing and speed bonuses", () => {
  const { room, players, draw, advance } = setup();
  draw();
  advance(18000);
  const guesser = room.eligibleIds[0];
  const guess = room.submitGuess(guesser, "đoán thử");
  const stroke: Stroke = { id: "stroke", color: "#253447", width: 10, points: [{ x: 10, y: 20 }] };
  room.addStroke(room.drawerId!, stroke);
  const drawer = players.find(p => p.id === room.drawerId)!;
  const deadline = room.deadline;
  const sentAt = guess.sentAt;
  room.disconnect(drawer.id);
  assert.equal(room.pauseReason, "drawer");
  const paused = room.view(drawer.id);
  advance(12000);
  const stillPaused = room.view(drawer.id);
  assert.equal(stillPaused.deadline - stillPaused.serverNow, paused.deadline - paused.serverNow);
  room.restore(drawer.id, drawer.token, "reconnected");
  assert.equal(room.paused, false);
  assert.equal(room.deadline, deadline + 12000);
  assert.equal(room.players.length, 3);
  assert.deepEqual(room.view(drawer.id).strokes, [stroke]);
  assert.equal(guess.sentAt, sentAt);
  room.judge(drawer.id, guess.id, true);
  advance(72000);
  assert.equal(room.view(guesser).currentResult!.awards[guesser], 140);
  assert.throws(() => room.restore(drawer.id, "wrong-token", "intruder"), /không còn hợp lệ/);
});

test("drawer absent beyond 20s cancels turn and rolls back all provisional points", () => {
  const { room, advance, draw } = setup();
  draw();
  room.submitGuess(room.eligibleIds[0], room.prompt!.answer);
  room.disconnect(room.drawerId!);
  advance(20000);
  assert.equal(room.phase, "result");
  assert.equal(room.view(room.eligibleIds[0]).currentResult!.cancelled, true);
  assert.ok(room.players.every(p => p.score === 0));
  advance(7000);
  assert.equal(room.phase, "result");
  room.nextTurn(room.hostId, room.results.at(-1)!.id);
  assert.equal(room.phase, "preparing");
});

test("one active person pauses, reconnecting restores play and host transfers", () => {
  const { room, players, draw } = setup(2);
  draw();
  const host = players[0];
  const other = players[1];
  room.disconnect(host.id);
  assert.equal(room.hostId, other.id);
  assert.equal(room.paused, true);
  room.restore(host.id, host.token, "restored-host");
  assert.equal(room.paused, false);
  assert.equal(room.hostId, other.id);
});

test("late joiners spectate then enter the next round; turns and prompts do not repeat", () => {
  const { room, advance } = setup(2, 2);
  const late = room.addPlayer("Người mới", "new-socket");
  assert.equal(late.activeFromRound, 2);
  const answers: string[] = [];
  const drawers: string[] = [];
  while (room.phase !== "finished") {
    if (room.phase === "preparing") {
      answers.push(room.prompt!.answer); drawers.push(room.drawerId!);
      if (room.round === 1) assert.equal(room.eligibleIds.includes(late.id), false);
      advance(10000);
    } else if (room.phase === "drawing") advance(90000);
    else if (room.phase === "review") advance(10000);
    else room.nextTurn(room.hostId, room.results.at(-1)!.id);
  }
  assert.equal(answers.length, 5);
  assert.equal(new Set(answers).size, 5);
  assert.equal(drawers.filter(id => id === late.id).length, 1);
});

test("rate limiting, duplicate pending guesses, and accepted-player lock", () => {
  const { room, draw, advance } = setup();
  draw();
  const guesser = room.eligibleIds[0];
  const guess = room.submitGuess(guesser, "một vật thể");
  assert.throws(() => room.submitGuess(guesser, "vật khác"), /2 giây/);
  advance(2000);
  assert.throws(() => room.submitGuess(guesser, "Một vật thể!"), /đang chờ/);
  room.judge(room.drawerId!, guess.id, true);
  assert.throws(() => room.submitGuess(guesser, "vật khác"), /đoán đúng rồi/);
  assert.equal(room.applySimilarity(guess.id, { percent: 1, label: "Xa", explanation: "AI trễ", source: "ai" }), false);
});

test("canvas permissions, undo and clear, and hints at scaled time boundaries", () => {
  const { room, draw, advance } = setup();
  room.settings.duration = 60;
  const stroke: Stroke = { id: "stroke", color: "#253447", width: 10, points: [{ x: 10, y: 20 }] };
  assert.throws(() => room.addStroke(room.drawerId!, stroke), /khóa/);
  draw();
  assert.throws(() => room.addStroke(room.eligibleIds[0], stroke), /Chỉ người/);
  room.addStroke(room.drawerId!, stroke);
  room.editCanvas(room.drawerId!, "undo");
  assert.equal(room.strokes.length, 0);
  room.addStroke(room.drawerId!, stroke);
  room.editCanvas(room.drawerId!, "clear");
  assert.equal(room.strokes.length, 0);
  assert.equal(room.view(room.eligibleIds[0]).hintCategory, null);
  advance(30000);
  assert.equal(room.view(room.eligibleIds[0]).hintCategory, room.prompt!.category);
  advance(14000);
  assert.equal(room.view(room.eligibleIds[0]).hintLetter, room.prompt!.answer[0].toLocaleUpperCase("vi"));
  room.settings.hints = false;
  assert.equal(room.view(room.eligibleIds[0]).hintLetter, null);
});

test("host can pause between turns, finish early, and open a fresh lobby", () => {
  const { room, players, draw, advance } = setup(2);
  const host = players[0].id;
  assert.throws(() => room.togglePause(players[1].id), /Chỉ chủ/);
  room.togglePause(host);
  draw();
  room.submitGuess(room.eligibleIds[0], room.prompt!.answer);
  advance(7000);
  assert.equal(room.pauseReason, "host");
  const resultId = room.results.at(-1)!.id;
  assert.equal(room.deadline, 0);
  assert.throws(() => room.nextTurn(host, resultId), /tiếp tục trận/);
  room.togglePause(host);
  assert.equal(room.phase, "result");
  assert.equal(room.deadline, 0);
  room.nextTurn(host, resultId);
  assert.equal(room.phase, "preparing");
  const scores = room.players.map(p => p.score);
  room.finish(host);
  assert.equal(room.phase, "finished");
  assert.deepEqual(room.players.map(p => p.score), scores);
  room.rematch(host);
  assert.equal(room.phase, "lobby");
  assert.ok(room.players.every(p => p.score === 0 && !p.ready));
  assert.equal(room.settings.rounds, 1);
});

test("results wait indefinitely for the host, allow corrections, and reject stale or repeated next-turn requests", () => {
  const { room, players, draw, advance } = setup(2);
  const host = players[0].id;
  assert.throws(() => room.nextTurn(host, "not-a-result"), /kết quả lượt hiện tại/);
  draw();
  const guesser = room.eligibleIds[0];
  const guess = room.submitGuess(guesser, room.prompt!.answer);
  const resultId = room.results.at(-1)!.id;
  const turnIndex = room.turnIndex;
  assert.equal(room.deadline, 0);
  advance(120000);
  assert.equal(room.phase, "result");
  assert.equal(room.turnIndex, turnIndex);
  room.judge(room.drawerId!, guess.id, false);
  assert.equal(room.players.find(player => player.id === guesser)!.score, 0);
  room.judge(room.drawerId!, guess.id, true);
  assert.throws(() => room.nextTurn(players[1].id, resultId), /Chỉ chủ/);
  assert.throws(() => room.nextTurn(host, "old-result"), /kết quả lượt hiện tại/);
  room.nextTurn(host, resultId);
  assert.equal(room.phase, "preparing");
  assert.equal(room.turnIndex, turnIndex + 1);
  assert.throws(() => room.nextTurn(host, resultId), /kết quả lượt hiện tại/);
  draw();
  room.submitGuess(room.eligibleIds[0], room.prompt!.answer);
  advance(120000);
  assert.equal(room.phase, "result");
  assert.throws(() => room.nextTurn(host, resultId), /kết quả lượt hiện tại/);
  room.nextTurn(host, room.results.at(-1)!.id);
  assert.equal(room.phase, "finished");
});

test("lobbies enforce capacity, readiness reset and sufficient non-repeating prompts", () => {
  const room = new DrawingRoom("ABC234");
  const players = Array.from({ length: 8 }, (_, index) => room.addPlayer(`Người ${index}`, `socket-${index}`));
  assert.throws(() => room.addPlayer("Người thứ chín", "socket-9"), /đủ 8 người/);
  players.forEach(player => room.ready(player.id));
  room.configure(players[0].id, { ...room.settings, rounds: 5, category: "Phương tiện", difficulty: "medium" });
  assert.ok(players.every(player => !player.ready));
  players.forEach(player => room.ready(player.id));
  assert.throws(() => room.start(players[0].id), /Kho đề/);
  room.configure(players[0].id, { ...room.settings, category: "all", difficulty: "mixed" });
  players.forEach(player => room.ready(player.id));
  room.start(players[0].id);
  const original = room.prompt!.answer;
  room.reroll(room.drawerId!);
  assert.notEqual(room.prompt!.answer, original);
  assert.throws(() => room.reroll(room.drawerId!), /một lần/);
});

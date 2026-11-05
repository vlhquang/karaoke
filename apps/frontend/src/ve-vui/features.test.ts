import assert from "node:assert/strict";
import { test } from "node:test";
import { DrawingRoom } from "./engine";
import { attemptMultiplier, DEFAULT_SETTINGS } from "./types";
import { hasVoiceRelay, voiceIceServers } from "./voice-config";
import { createHmac } from "node:crypto";

function setup(preparation: 0 | 3 | 5 | 10 | 15 = 5) {
  let now = 100000; const room = new DrawingRoom("ABC234", () => now);
  const host = room.addPlayer("Mẹ", "host"); room.addPlayer("Bé", "guest");
  room.configure(host.id, { ...DEFAULT_SETTINGS, rounds: 1, preparation });
  room.players.forEach(player => room.ready(player.id)); room.start(host.id);
  const advance = (ms: number) => { now += ms; room.tick(); };
  return { room, advance };
}
test("preparation defaults to five seconds; configured countdowns, instant start and drawer-only early start", () => {
  assert.equal(DEFAULT_SETTINGS.preparation, 5);
  for (const duration of [3, 5, 10, 15] as const) {
    const { room, advance } = setup(duration);
    assert.equal(room.deadline - room.now(), duration * 1000);
    advance(duration * 1000 - 1); assert.equal(room.phase, "preparing");
    advance(1); assert.equal(room.phase, "drawing"); assert.equal(room.deadline - room.now(), 90000);
  }
  const { room } = setup(0); assert.equal(room.phase, "drawing"); assert.equal(room.deadline - room.now(), 90000);
  const early = setup(); const turn = early.room.view(early.room.drawerId!).turnId;
  assert.throws(() => early.room.beginDrawing(early.room.eligibleIds[0], turn), /Chỉ người/);
  assert.throws(() => early.room.beginDrawing(early.room.drawerId!, "old-turn"), /Chưa thể/);
  early.room.togglePause(early.room.hostId); // schedules a pause after the turn; doesn't pause preparation
  early.room.beginDrawing(early.room.drawerId!, turn); assert.equal(early.room.phase, "drawing");
  assert.throws(() => early.room.beginDrawing(early.room.drawerId!, turn), /Chưa thể/);
});
test("fill operations share the drawing history, require current board revisions and restore after reconnect", () => {
  const { room } = setup(0), drawer = room.players.find(player => player.id === room.drawerId)!;
  const fill = { id: "fill-1", color: "#ee5353", spans: [0, 1000, 1000, 1000], revision: 0, turnId: room.view(drawer.id).turnId };
  assert.throws(() => room.addFill(room.eligibleIds[0], fill), /Chỉ người/);
  assert.throws(() => room.addFill(drawer.id, { ...fill, spans: [999, 2] }), /không hợp lệ/);
  room.addStroke(drawer.id, { id: "line", color: "#253447", width: 10, points: [{ x: 10, y: 20 }] });
  assert.throws(() => room.addFill(drawer.id, fill), /vừa thay đổi/);
  room.addFill(drawer.id, { ...fill, revision: room.canvasRevision });
  assert.equal(room.strokes.length, 2); assert.deepEqual(room.strokes[1].fill, fill.spans);
  const revision = room.canvasRevision;
  room.disconnect(drawer.id); room.restore(drawer.id, drawer.token, "back");
  assert.deepEqual(room.view(drawer.id).strokes[1].fill, fill.spans);
  room.editCanvas(drawer.id, "undo"); assert.equal(room.strokes.length, 1); assert.equal(room.canvasRevision, revision + 1);
  assert.throws(() => room.addFill(drawer.id, { ...fill, revision: room.canvasRevision, turnId: "old-turn" }), /vừa thay đổi/);
  room.editCanvas(drawer.id, "clear"); assert.equal(room.strokes.length, 0);
});
test("attempt penalty uses the accepted submission's ordinal and time, ignores duplicates and caps at fifty percent", () => {
  const { room, advance } = setup(0), guesser = room.eligibleIds[0];
  const first = room.submitGuess(guesser, "đoán khác"); advance(2000);
  room.judge(room.drawerId!, first.id, false);
  assert.throws(() => room.submitGuess(guesser, "Đoán khác!"), /đã gửi/);
  assert.equal(room.guesses.length, 1);
  room.submitGuess(guesser, "đoán thêm"); advance(16000);
  const correct = room.submitGuess(guesser, room.prompt!.answer);
  assert.equal(correct.attempt, 3); assert.equal(room.results[0].awards[guesser], 112);
  room.judge(room.drawerId!, correct.id, false); room.judge(room.drawerId!, correct.id, true);
  assert.equal(room.results[0].awards[guesser], 112);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 20].map(attemptMultiplier), [100, 90, 80, 70, 60, 50, 50]);
});
test("late manual approval uses the accepted answer's attempt rather than later guesses", () => {
  const { room, advance } = setup(0); room.settings.judging = "manual";
  const guesser = room.eligibleIds[0], first = room.submitGuess(guesser, room.prompt!.answer);
  for (let n = 0; n < 5; n++) { advance(2000); room.submitGuess(guesser, `lần thử khác ${n}`); }
  advance(80000); assert.equal(room.phase, "review");
  room.judge(room.drawerId!, first.id, true);
  assert.equal(room.results[0].awards[guesser], 150);
});
test("TURN credentials are bounded, generated on the server, and configuration errors hide secrets", () => {
  const env = { DRAWING_VOICE_STUN_URLS: "", DRAWING_VOICE_TURN_URLS: "turn:relay.example:3478,turns:relay.example:5349", DRAWING_VOICE_TURN_SECRET: "private-secret" };
  const [config] = voiceIceServers("player", env, 1000000);
  assert.equal(config.username, "4600:player");
  assert.equal(config.credential, createHmac("sha1", env.DRAWING_VOICE_TURN_SECRET).update("4600:player").digest("base64"));
  assert.throws(() => voiceIceServers("id", { DRAWING_VOICE_ICE_SERVERS: "secret malformed JSON" }), /Cấu hình âm thanh/);
  assert.throws(() => voiceIceServers("id", { DRAWING_VOICE_TURN_URLS: "turn:relay.example" }), /Cấu hình âm thanh/);
  assert.deepEqual(voiceIceServers("id", { DRAWING_VOICE_STUN_URLS: "" }), []);
});
test("relay readiness distinguishes STUN from authenticated TURN and rejects incomplete JSON credentials", () => {
  assert.equal(hasVoiceRelay(voiceIceServers("id", {})), false);
  assert.equal(hasVoiceRelay(voiceIceServers("id", { DRAWING_VOICE_ICE_SERVERS: JSON.stringify([{ urls: ["stun:stun.test", "turns:relay.test:5349"], username: "user", credential: "password" }]) })), true);
  assert.throws(() => voiceIceServers("id", { DRAWING_VOICE_ICE_SERVERS: '[{"urls":"turn:relay.test"}]' }), /Cấu hình âm thanh/);
});

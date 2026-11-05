import assert from "node:assert/strict";
import { test } from "node:test";
import { VoiceNetwork, type VoiceConnection } from "./voice-network";
import type { PlayerView, VoiceSignal } from "./types";

class FakePeer {
  connectionState = "new"; iceConnectionState = "new"; signalingState = "stable";
  localDescription: RTCSessionDescriptionInit | null = null; remoteDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange: (() => void) | null = null; oniceconnectionstatechange: (() => void) | null = null;
  onicecandidate = null; ontrack = null;
  offers: RTCOfferOptions[] = []; candidates: RTCIceCandidateInit[] = [];
  sender = { track: null as MediaStreamTrack | null, replaceTrack: async (track: MediaStreamTrack | null) => { this.sender.track = track; } };
  slots: { sender: { track: MediaStreamTrack | null; replaceTrack: (track: MediaStreamTrack | null) => Promise<void> }; receiver: { track: { kind: string } }; direction: string }[] = [];
  constructor(public config: RTCConfiguration) {}
  addTransceiver() { const slot = { sender: this.sender, receiver: { track: { kind: "audio" } }, direction: "sendrecv" }; this.slots.push(slot); return slot; }
  getTransceivers() { return this.slots; }
  getConfiguration() { return this.config; }
  setConfiguration(config: RTCConfiguration) { this.config = config; }
  async createOffer(options: RTCOfferOptions) { this.offers.push(options); return { type: "offer" as const, sdp: "offer" }; }
  async createAnswer() { return { type: "answer" as const, sdp: "answer" }; }
  async setLocalDescription(description: RTCSessionDescriptionInit) { this.localDescription = description; this.signalingState = description.type === "offer" ? "have-local-offer" : "stable"; }
  async setRemoteDescription(description: RTCSessionDescriptionInit) { this.remoteDescription = description; this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable"; if (!this.slots.length) this.addTransceiver(); }
  async addIceCandidate(candidate: RTCIceCandidateInit) { this.candidates.push(candidate); }
  change(state: string, ice = state) { this.connectionState = state; this.iceConnectionState = ice; this.onconnectionstatechange?.(); this.oniceconnectionstatechange?.(); }
  close() { this.connectionState = "closed"; }
}
const member = (id: string, voiceId = "voice-remote"): PlayerView => ({ id, voiceId, name: id, connected: true, ready: false, score: 0, activeFromRound: 1, voiceMuted: true });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition: () => boolean) { for (let n = 0; n < 300; n++) { if (condition()) return; await sleep(2); } assert.fail("Voice operation timed out"); }
function setup(ownId = "a", otherId = "b", timeoutMs = 1000) {
  const pcs: FakePeer[] = [], sent: any[] = [], states = new Map<string, VoiceConnection>(); let refreshes = 0;
  const network = new VoiceNetwork({ ownId, voiceId: "voice-own", iceServers: [], timeoutMs, disconnectGraceMs: 8,
    createPeer: config => { const peer = new FakePeer(config); pcs.push(peer); return peer as unknown as RTCPeerConnection; },
    send: async signal => { sent.push(signal); return { ok: true }; },
    refreshIce: async () => { refreshes++; return [{ urls: "turn:relay.test", username: "renewed", credential: "credential" }]; },
    onState: (id, state) => { if (state) states.set(id, state); else states.delete(id); }, onRemove: () => {}, onStream: () => {},
  });
  network.sync([member(otherId)]);
  const receive = (body: Partial<VoiceSignal>) => network.receive({ fromId: otherId, fromVoiceId: "voice-remote", targetVoiceId: "voice-own", ...body });
  return { network, pcs, sent, states, receive, get refreshes() { return refreshes; } };
}
test("voice membership is separate from transport readiness; stable recovery preserves the microphone track", async () => {
  const s = setup(); try {
    await until(() => s.sent.length > 0); assert.equal(s.states.get("b")?.state, "connecting");
    const track = { kind: "audio" } as MediaStreamTrack; await s.network.setTrack(track);
    s.pcs[0].change("connected"); assert.equal(s.states.get("b")?.state, "connected");
    s.pcs[0].change("failed"); await until(() => s.pcs[0].offers.some(offer => offer.iceRestart));
    assert.equal(s.states.get("b")?.state, "reconnecting"); assert.equal(s.refreshes, 1);
    assert.equal(s.pcs[0].config.iceServers![0].username, "renewed");
    s.pcs[0].change("connected"); assert.equal(s.states.get("b")?.state, "connected"); assert.equal(s.pcs[0].sender.track, track);
  } finally { s.network.close(); }
});
test("ICE restart on an unchanged working route restores readiness after SDP, without a state event", async () => {
  const s = setup(); try {
    await until(() => s.sent.length > 0); s.pcs[0].change("connected");
    const pc = s.pcs[0]; pc.iceConnectionState = "failed"; pc.oniceconnectionstatechange?.(); pc.iceConnectionState = "connected";
    await until(() => s.sent.length > 1); assert.equal(s.states.get("b")?.state, "reconnecting");
    await s.receive({ exchangeId: s.sent.at(-1).exchangeId, description: { type: "answer", sdp: "restart-answer" } });
    assert.equal(s.states.get("b")?.state, "connected");
  } finally { s.network.close(); }
});
test("short network interruptions recover without restarting; persistent failures stop after three attempts", async () => {
  const s = setup("a", "b", 15); try {
    await until(() => s.sent.length > 0); s.pcs[0].change("connected"); s.pcs[0].change("disconnected"); s.pcs[0].change("connected");
    await sleep(12); assert.equal(s.refreshes, 0);
    s.pcs[0].change("failed"); await until(() => s.states.get("b")?.state === "disconnected");
    assert.equal(s.pcs[0].offers.filter(offer => offer.iceRestart).length, 3);
    const before = s.sent.length; await sleep(25); assert.equal(s.sent.length, before);
    s.network.retry(); await until(() => s.sent.length > before); assert.equal(s.states.get("b")?.attempt, 1);
  } finally { s.network.close(); }
});
test("the answerer asks the sole offerer to restart, including an explicit retry after exhaustion", async () => {
  const s = setup("z", "a", 12); try {
    s.pcs[0].change("failed"); await until(() => s.states.get("a")?.state === "disconnected");
    assert.equal(s.sent.filter(signal => signal.restart).length, 3); assert.equal(s.pcs[0].offers.length, 0);
    s.network.retry(); await until(() => s.sent.some(signal => signal.manual === true));
  } finally { s.network.close(); }
  const offerer = setup("a", "z", 12); try {
    await until(() => offerer.states.get("z")?.state === "disconnected");
    const before = offerer.pcs[0].offers.length;
    await offerer.receive({ restart: true, manual: true }); await until(() => offerer.pcs[0].offers.length > before);
  } finally { offerer.network.close(); }
});
test("stale voice sessions and negotiation replies cannot replace a new audio connection", async () => {
  const s = setup(); try {
    await until(() => s.sent.length > 0); const oldExchange = s.sent[0].exchangeId;
    s.pcs[0].change("failed"); await until(() => s.sent.length > 1);
    const currentExchange = s.sent.at(-1).exchangeId; assert.notEqual(oldExchange, currentExchange);
    await s.receive({ exchangeId: oldExchange, description: { type: "answer", sdp: "stale" } }); assert.equal(s.pcs[0].remoteDescription, null);
    await s.receive({ exchangeId: currentExchange, description: { type: "answer", sdp: "current" } }); assert.equal((s.pcs[0].remoteDescription as RTCSessionDescriptionInit | null)?.sdp, "current");
    await s.receive({ targetVoiceId: "old-session", candidate: { candidate: "stale" } }); assert.equal(s.pcs[0].candidates.length, 0);
    s.network.sync([member("b", "new-session")]); assert.equal(s.pcs[0].connectionState, "closed"); assert.equal(s.pcs.length, 2);
  } finally { s.network.close(); }
});
test("answering uses the offered audio slot, flushes early candidates, and sends the current mic", async () => {
  const s = setup("z", "a"); try {
    const track = { kind: "audio" } as MediaStreamTrack; await s.network.setTrack(track);
    await s.receive({ exchangeId: "exchange", candidate: { candidate: "early" } });
    await s.receive({ exchangeId: "exchange", description: { type: "offer", sdp: "offer" } });
    assert.equal(s.pcs[0].slots.length, 1); assert.equal(s.pcs[0].sender.track, track);
    assert.equal(s.pcs[0].candidates[0].candidate, "early"); assert.equal(s.sent[0].description.type, "answer");
  } finally { s.network.close(); }
});
test("leaving cancels retries and an ICE refresh in progress cannot send late signals", async () => {
  let release!: (value: []) => void;
  const sent: unknown[] = [], pcs: FakePeer[] = [];
  const network = new VoiceNetwork({ ownId: "a", voiceId: "own", iceServers: [], timeoutMs: 10,
    createPeer: config => { const peer = new FakePeer(config); pcs.push(peer); return peer as unknown as RTCPeerConnection; },
    send: async signal => { sent.push(signal); return { ok: true }; }, refreshIce: () => new Promise(resolve => { release = resolve; }), onState: () => {}, onStream: () => {}, onRemove: () => {},
  });
  network.sync([member("b")]); await until(() => sent.length === 1);
  pcs[0].change("failed"); await until(() => !!release); network.close(); release([]); await sleep(25);
  assert.equal(sent.length, 1); assert.equal(pcs[0].connectionState, "closed");
});

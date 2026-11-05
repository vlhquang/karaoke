import type { PlayerView, Reply, VoiceIceServer, VoiceSignal } from "./types";

export type VoiceConnection = { state: "connecting" | "connected" | "reconnecting" | "disconnected"; attempt: number };
type Outgoing = Omit<VoiceSignal, "fromId" | "fromVoiceId" | "targetVoiceId">;
type Peer = {
  id: string; voiceId: string; pc: RTCPeerConnection; sender: RTCRtpSender | null;
  candidates: { candidate: RTCIceCandidateInit; exchangeId?: string }[];
  exchangeId?: string; remoteExchangeId?: string; queue: Promise<void>;
  timer?: ReturnType<typeof setTimeout>; stableTimer?: ReturnType<typeof setTimeout>;
  attempt: number; recovering: boolean; status: VoiceConnection["state"];
};
type Options = {
  ownId: string; voiceId: string; iceServers: VoiceIceServer[];
  send: (signal: Outgoing & { targetId: string; targetVoiceId: string; fromVoiceId: string }) => Promise<Reply>;
  refreshIce: () => Promise<VoiceIceServer[]>;
  onState: (id: string, state: VoiceConnection | null) => void;
  onStream: (id: string, stream: MediaStream) => void;
  onRemove: (id: string) => void;
  createPeer?: (config: RTCConfiguration) => RTCPeerConnection;
  // Tests can advance timers without waiting for real network timeouts.
  timeoutMs?: number; disconnectGraceMs?: number;
};

/** One voice session. Only the lower player ID offers, including ICE restarts. */
export class VoiceNetwork {
  private peers = new Map<string, Peer>();
  private track: MediaStreamTrack | null = null;
  private closed = false;
  private ice: VoiceIceServer[];
  private refreshing: Promise<VoiceIceServer[]> | null = null;
  private refreshedAt = 0;
  constructor(private readonly options: Options) { this.ice = options.iceServers; }

  private active(peer: Peer) { return !this.closed && this.peers.get(peer.id) === peer; }
  private emit(peer: Peer, signal: Outgoing) {
    if (!this.active(peer)) return Promise.resolve({ ok: false } as Reply);
    return this.options.send({ ...signal, targetId: peer.id, targetVoiceId: peer.voiceId, fromVoiceId: this.options.voiceId });
  }
  private state(peer: Peer, state: VoiceConnection["state"]) {
    if (!this.active(peer)) return;
    peer.status = state; this.options.onState(peer.id, { state, attempt: peer.attempt });
  }
  private later(peer: Peer, delay: number, callback: () => void) {
    clearTimeout(peer.timer);
    peer.timer = setTimeout(() => { peer.timer = undefined; if (this.active(peer)) callback(); }, delay);
  }
  private watchdog(peer: Peer) { this.later(peer, this.options.timeoutMs ?? 12000, () => this.recover(peer)); }
  private enqueue(peer: Peer, operation: () => Promise<void>) {
    peer.queue = peer.queue.then(async () => { if (this.active(peer)) await operation(); }).catch(() => {
      if (this.active(peer)) this.watchdog(peer);
    });
    return peer.queue;
  }
  private async offer(peer: Peer, restart: boolean) {
    if (peer.pc.signalingState === "have-local-offer") await peer.pc.setLocalDescription({ type: "rollback" });
    if (!this.active(peer)) return;
    peer.exchangeId = crypto.randomUUID();
    const description = await peer.pc.createOffer({ iceRestart: restart });
    if (!this.active(peer)) return;
    await peer.pc.setLocalDescription(description);
    if (!this.active(peer)) return;
    const reply = await this.emit(peer, { description: { type: "offer", sdp: peer.pc.localDescription!.sdp }, exchangeId: peer.exchangeId });
    if (!reply.ok) throw new Error("Voice offer rejected");
  }
  private refresh() {
    if (!this.refreshing && Date.now() - this.refreshedAt > 2000) {
      this.refreshing = this.options.refreshIce().then(servers => { this.ice = servers; this.refreshedAt = Date.now(); return servers; }).finally(() => { this.refreshing = null; });
    }
    return this.refreshing ?? Promise.resolve(this.ice);
  }
  private recover(peer: Peer, manual = false) {
    if (!this.active(peer) || peer.recovering || peer.status === "disconnected") return;
    clearTimeout(peer.stableTimer);
    if (peer.attempt >= 3) { clearTimeout(peer.timer); this.state(peer, "disconnected"); return; }
    peer.attempt++; peer.recovering = true; this.state(peer, "reconnecting");
    void this.enqueue(peer, async () => {
      const iceServers = await this.refresh();
      if (!this.active(peer)) return;
      peer.pc.setConfiguration({ ...peer.pc.getConfiguration(), iceServers });
      if (this.options.ownId < peer.id) await this.offer(peer, true);
      else {
        const reply = await this.emit(peer, { restart: true, ...(manual ? { manual: true } : {}) });
        if (!reply.ok) throw new Error("Voice restart rejected");
      }
    }).finally(() => {
      peer.recovering = false;
      if (this.active(peer) && peer.status !== "connected") this.watchdog(peer);
    });
  }
  private connectionChanged(peer: Peer) {
    if (!this.active(peer)) return;
    if (peer.pc.connectionState === "connected" && ["connected", "completed"].includes(peer.pc.iceConnectionState)) {
      clearTimeout(peer.timer); clearTimeout(peer.stableTimer); this.state(peer, "connected");
      peer.stableTimer = setTimeout(() => { if (this.active(peer) && peer.status === "connected") peer.attempt = 0; }, 5000);
    } else if (peer.pc.connectionState === "failed" || peer.pc.iceConnectionState === "failed") {
      this.recover(peer);
    } else if (peer.pc.connectionState === "disconnected" || peer.pc.iceConnectionState === "disconnected") {
      clearTimeout(peer.stableTimer);
      if (peer.status !== "disconnected" && !peer.recovering && !peer.timer) {
        this.state(peer, "reconnecting"); this.later(peer, this.options.disconnectGraceMs ?? 1500, () => this.recover(peer));
      }
    }
  }
  private remove(id: string) {
    const peer = this.peers.get(id); if (!peer) return;
    this.peers.delete(id); clearTimeout(peer.timer); clearTimeout(peer.stableTimer);
    peer.pc.onicecandidate = null; peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null; peer.pc.oniceconnectionstatechange = null;
    peer.pc.close(); this.options.onRemove(id); this.options.onState(id, null);
  }
  sync(members: PlayerView[]) {
    if (this.closed) return;
    const active = members.filter(member => member.id !== this.options.ownId && member.voiceId && member.connected);
    for (const [id, peer] of this.peers) if (!active.some(member => member.id === id && member.voiceId === peer.voiceId)) this.remove(id);
    for (const member of active) {
      if (this.peers.has(member.id)) continue;
      const pc = this.options.createPeer?.({ iceServers: this.ice }) ?? new RTCPeerConnection({ iceServers: this.ice });
      const sender = this.options.ownId < member.id ? pc.addTransceiver("audio", { direction: "sendrecv" }).sender : null;
      const peer: Peer = { id: member.id, voiceId: member.voiceId!, pc, sender, candidates: [], queue: Promise.resolve(), attempt: 0, recovering: false, status: "connecting" };
      this.peers.set(member.id, peer); this.state(peer, "connecting"); this.watchdog(peer);
      pc.onicecandidate = event => {
        if (event.candidate && this.active(peer)) void this.emit(peer, { candidate: { ...event.candidate.toJSON(), candidate: event.candidate.candidate }, exchangeId: peer.exchangeId }).then(reply => { if (!reply.ok && this.active(peer) && peer.status !== "connected") this.watchdog(peer); });
      };
      pc.ontrack = event => { if (this.active(peer) && event.track.kind === "audio") this.options.onStream(member.id, new MediaStream([event.track])); };
      pc.onconnectionstatechange = () => this.connectionChanged(peer);
      pc.oniceconnectionstatechange = () => this.connectionChanged(peer);
      if (this.options.ownId < member.id) void this.enqueue(peer, async () => {
        if (this.track) await sender!.replaceTrack(this.track);
        if (this.active(peer)) await this.offer(peer, false);
      });
    }
  }
  receive(signal: VoiceSignal) {
    const peer = this.peers.get(signal.fromId);
    if (!peer || !this.active(peer) || signal.targetVoiceId !== this.options.voiceId || signal.fromVoiceId !== peer.voiceId) return Promise.resolve();
    if (signal.restart) {
      if (signal.manual && !peer.recovering) { peer.attempt = 0; this.state(peer, "connecting"); }
      if (this.options.ownId < peer.id && !peer.recovering && peer.status !== "reconnecting" && peer.status !== "disconnected") this.recover(peer);
      return Promise.resolve();
    }
    return this.enqueue(peer, async () => {
      if (signal.description) {
        const offer = signal.description.type === "offer";
        if (offer && this.options.ownId < peer.id) return;
        if (!offer && (peer.pc.signalingState !== "have-local-offer" || signal.exchangeId !== peer.exchangeId)) return;
        if (offer) peer.exchangeId = signal.exchangeId;
        await peer.pc.setRemoteDescription(signal.description);
        if (!this.active(peer)) return;
        peer.remoteExchangeId = signal.exchangeId;
        if (offer) {
          const slot = peer.pc.getTransceivers().find(item => item.receiver.track.kind === "audio");
          if (!slot) throw new Error("Missing audio channel");
          slot.direction = "sendrecv"; peer.sender = slot.sender;
          if (this.track) await peer.sender.replaceTrack(this.track);
        }
        for (const item of peer.candidates.splice(0)) {
          if (item.exchangeId === peer.remoteExchangeId) await peer.pc.addIceCandidate(item.candidate);
        }
        if (offer && this.active(peer)) {
          await peer.pc.setLocalDescription(await peer.pc.createAnswer());
          if (!this.active(peer)) return;
          const reply = await this.emit(peer, { description: { type: "answer", sdp: peer.pc.localDescription!.sdp }, exchangeId: peer.exchangeId });
          if (!reply.ok) throw new Error("Voice answer rejected");
          // An incoming restart is allowed even after local retries ran out.
          if (peer.status === "disconnected") { peer.attempt = 0; this.state(peer, "reconnecting"); }
          if (peer.status !== "connected") this.watchdog(peer);
        }
        // Reusing a working ICE path may complete a restart without a new
        // connectionstatechange event. Reconcile after the SDP exchange too.
        this.connectionChanged(peer);
      } else if (signal.candidate) {
        if (peer.pc.remoteDescription && signal.exchangeId === peer.remoteExchangeId) await peer.pc.addIceCandidate(signal.candidate);
        else if (peer.candidates.length < 128) peer.candidates.push({ candidate: signal.candidate, exchangeId: signal.exchangeId });
      }
    });
  }
  async setTrack(track: MediaStreamTrack | null) {
    this.track = track;
    await Promise.all([...this.peers.values()].map(peer => this.enqueue(peer, async () => { if (peer.sender) await peer.sender.replaceTrack(this.track); })));
  }
  retry() {
    for (const peer of this.peers.values()) {
      if (peer.status !== "disconnected") continue;
      peer.attempt = 0; this.state(peer, "reconnecting"); this.recover(peer, true);
    }
  }
  resume() {
    for (const peer of this.peers.values()) if (peer.status === "reconnecting" || peer.status === "connecting") this.recover(peer);
  }
  close() { this.closed = true; for (const id of this.peers.keys()) this.remove(id); this.track = null; }
}

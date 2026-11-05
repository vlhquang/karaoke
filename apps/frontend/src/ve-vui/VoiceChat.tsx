"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, LogOut, Mic, MicOff, Users, Volume2, VolumeX, RefreshCw } from "lucide-react";
import type { Socket } from "socket.io-client";
import type { Reply, RoomView, VoiceSignal } from "./types";
import { VoiceNetwork, type VoiceConnection } from "./voice-network";
type Meter = { source: MediaStreamAudioSourceNode; analyser: AnalyserNode; sink: GainNode; data: Uint8Array<ArrayBuffer> };

export function VoiceChat({ room, connected, socket }: { room: RoomView; connected: boolean; socket: Socket | null }) {
  const latest = useRef(room); latest.current = room;
  const joinedId = useRef<string | null>(null);
  const network = useRef<VoiceNetwork | null>(null);
  const audios = useRef(new Map<string, HTMLAudioElement>());
  const joining = useRef(false);
  const micRequest = useRef(0);
  const micAllowed = useRef(false);
  const meters = useRef(new Map<string, Meter>());
  const context = useRef<AudioContext | null>(null);
  const local = useRef<MediaStream | null>(null);
  const audioContainer = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const deafenedRef = useRef(false);
  const [connections, setConnections] = useState<Record<string, VoiceConnection>>({});
  const [secure, setSecure] = useState(true);
  const [relayConfigured, setRelayConfigured] = useState(true);
  useEffect(() => { setSecure(window.isSecureContext); }, []);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [error, setError] = useState("");
  const [deafened, setDeafened] = useState(false);
  const [needsPlayback, setNeedsPlayback] = useState(false);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(room.phase === "lobby");
  const inLobby = room.phase === "lobby";
  useEffect(() => { setExpanded(inLobby); }, [inLobby]);
  const own = room.players.find(player => player.id === room.ownId);
  const muted = !own?.voiceId || own.voiceMuted;
  const participants = room.players.filter(player => player.connected && player.voiceId);
  const others = participants.filter(player => player.id !== room.ownId);
  const linked = others.filter(player => connections[player.id]?.state === "connected").length;
  const interrupted = others.some(player => ["reconnecting", "disconnected"].includes(connections[player.id]?.state));
  const connectionText = (id: string) => {
    const state = connections[id];
    return state?.state === "connected" ? "Đã kết nối" : state?.state === "disconnected" ? "Mất kết nối" : state?.state === "reconnecting" ? `Đang nối lại (${state.attempt}/3)` : "Đang kết nối";
  };
  const summary = !joined ? "Vào nghe, bật micro khi bạn muốn nói" : !others.length ? "Đang chờ người khác tham gia" : `Đã kết nối ${linked}/${others.length} người`;

  const request = (event: string, payload: unknown = {}): Promise<Reply> => new Promise(resolve => {
    if (!socket?.connected) { resolve({ ok: false, error: "Đang kết nối lại. Chờ một chút nhé." }); return; }
    socket.timeout(8000).emit(event, payload, (failure: Error | null, response: Reply) => resolve(failure ? { ok: false, error: "Chưa kết nối được phòng thoại. Thử lại nhé." } : response));
  });
  const removeMeter = (id: string) => { const meter = meters.current.get(id); meter?.source.disconnect(); meter?.analyser.disconnect(); meter?.sink.disconnect(); meters.current.delete(id); };
  const removeAudio = (id: string) => {
    const audio = audios.current.get(id);
    if (audio) { audio.pause(); audio.srcObject = null; audio.remove(); audios.current.delete(id); }
    removeMeter(id);
  };
  const dispose = () => {
    generation.current++; micRequest.current++; micAllowed.current = false; joinedId.current = null; joining.current = false;
    local.current?.getTracks().forEach(track => track.stop()); local.current = null;
    network.current?.close(); network.current = null;
    [...audios.current.keys()].forEach(removeAudio); [...meters.current.keys()].forEach(removeMeter);
    if (context.current) void context.current.close().catch(() => {}); context.current = null;
  };
  const addMeter = (id: string, stream: MediaStream) => {
    if (!context.current || !stream.getAudioTracks().length) return;
    removeMeter(id);
    const source = context.current.createMediaStreamSource(stream), analyser = context.current.createAnalyser();
    // Keep the meter graph active without playing a second copy or monitoring
    // the local microphone through the speakers.
    const sink = context.current.createGain(); sink.gain.value = 0;
    analyser.fftSize = 256; source.connect(analyser); analyser.connect(sink); sink.connect(context.current.destination);
    meters.current.set(id, { source, analyser, sink, data: new Uint8Array(analyser.fftSize) });
  };
  const play = (audio: HTMLAudioElement) => { void audio.play().catch(() => { if (joinedId.current) setNeedsPlayback(true); }); };
  useEffect(() => {
    if (!socket) return;
    const receive = (signal: VoiceSignal) => { void network.current?.receive(signal); };
    const resume = () => { if (document.visibilityState === "visible") { network.current?.resume(); void context.current?.resume().catch(() => {}); } };
    const online = () => network.current?.resume();
    document.addEventListener("visibilitychange", resume); window.addEventListener("online", online);
    const pageHide = () => { const id = joinedId.current; if (id) socket.emit("voice:leave", { voiceId: id }); dispose(); setJoined(false); setBusy(false); setMicBusy(false); setConnections({}); setSpeaking([]); };
    socket.on("voice:signal", receive); window.addEventListener("pagehide", pageHide);
    return () => { const id = joinedId.current; if (id && socket.connected) socket.emit("voice:leave", { voiceId: id }); socket.off("voice:signal", receive); window.removeEventListener("pagehide", pageHide); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", online); dispose(); };
    // Connection callbacks use refs so changing room snapshots never reopens a microphone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    if (!connected || !room.settings.voiceEnabled || (joined && own?.voiceId !== joinedId.current)) {
      dispose(); setJoined(false); setBusy(false); setMicBusy(false); setSpeaking([]); setConnections({}); setNeedsPlayback(false); return;
    }
    if (!joined || !joinedId.current) return;
    if (own?.voiceMuted) micAllowed.current = false;
    local.current?.getAudioTracks().forEach(track => { track.enabled = micAllowed.current && !own?.voiceMuted; });
    network.current?.sync(room.players);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, connected, joined]);

  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(() => {
      const active: string[] = [];
      for (const [id, meter] of meters.current) {
        if (latest.current.players.find(member => member.id === id)?.voiceMuted) continue;
        meter.analyser.getByteTimeDomainData(meter.data);
        const rms = Math.sqrt(meter.data.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / meter.data.length);
        if (rms > .025) active.push(id);
      }
      setSpeaking(previous => previous.join(",") === active.join(",") ? previous : active);
    }, 250);
    return () => clearInterval(timer);
  }, [joined]);

  const join = async () => {
    if (joining.current || joinedId.current) return;
    if (typeof RTCPeerConnection === "undefined") { setError("Trình duyệt này chưa hỗ trợ phòng thoại. Dùng Safari hoặc Chrome mới hơn nhé."); return; }
    const epoch = generation.current; joining.current = true; setBusy(true); setError("");
    try {
      const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Audio) { context.current = new Audio(); void context.current.resume().catch(() => {}); }
      const response = await request("voice:join");
      if (generation.current !== epoch || !latest.current.settings.voiceEnabled) {
        if (response.voice) void request("voice:leave", { voiceId: response.voice.id }); return;
      }
      if (!response.ok || !response.voice) { dispose(); setBusy(false); setError(response.error ?? "Chưa vào được phòng thoại."); return; }
      const voiceId = response.voice.id;
      joinedId.current = voiceId; setRelayConfigured(response.voice.relayConfigured ?? false);
      network.current = new VoiceNetwork({
        ownId: latest.current.ownId, voiceId, iceServers: response.voice.iceServers,
        send: signal => request("voice:signal", signal),
        refreshIce: async () => {
          const reply = await request("voice:ice", { voiceId });
          if (!reply.ok || !reply.voice || reply.voice.id !== joinedId.current) throw new Error("Voice session ended");
          setRelayConfigured(reply.voice.relayConfigured ?? false); return reply.voice.iceServers;
        },
        onState: (id, state) => {
          if (joinedId.current !== voiceId) return;
          setConnections(previous => { const next = { ...previous }; if (state) next[id] = state; else delete next[id]; return next; });
        },
        onStream: (id, stream) => {
          if (joinedId.current !== voiceId) return;
          removeAudio(id);
          const audio = document.createElement("audio"); audio.autoplay = true; audio.setAttribute("playsinline", ""); audio.muted = deafenedRef.current;
          audio.srcObject = stream; audioContainer.current?.append(audio); audios.current.set(id, audio); addMeter(id, stream); play(audio);
        },
        onRemove: removeAudio,
      });
      network.current.sync(latest.current.players); setJoined(true);
    } catch { if (epoch === generation.current) { dispose(); setBusy(false); setError("Chưa mở được phòng thoại. Thử tham gia lại nhé."); } }
    finally { if (epoch === generation.current) { joining.current = false; setBusy(false); } }

  };
  const leave = async () => {
    const id = joinedId.current; dispose(); setJoined(false); setBusy(false); setMicBusy(false); setConnections({}); setSpeaking([]); setNeedsPlayback(false); setError("");
    if (id) await request("voice:leave", { voiceId: id });
  };
  const toggleMic = async () => {
    const id = joinedId.current; if (!id || micBusy) return;
    setMicBusy(true); setError(""); const epoch = generation.current, operation = ++micRequest.current;
    try {
      if (!muted) {
        micAllowed.current = false;
        local.current?.getAudioTracks().forEach(track => { track.enabled = false; });
        const response = await request("voice:state", { voiceId: id, muted: true }); if (!response.ok) setError(response.error ?? "Chưa tắt được micro.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) { setError("Micro cần kết nối HTTPS và trình duyệt hỗ trợ thu âm."); return; }
      if (!local.current || local.current.getAudioTracks().every(track => track.readyState === "ended")) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        if (epoch !== generation.current || joinedId.current !== id || operation !== micRequest.current) { stream.getTracks().forEach(track => track.stop()); return; }
        stream.getTracks().forEach(track => { track.enabled = false; }); local.current = stream;
        addMeter(latest.current.ownId, stream);
        stream.getAudioTracks()[0].onended = () => { if (joinedId.current === id) void request("voice:state", { voiceId: id, muted: true }); };
      }
      // Reattach on every retry, including after a sender was renegotiated.
      await network.current?.setTrack(local.current!.getAudioTracks()[0]);
      if (epoch !== generation.current || joinedId.current !== id || operation !== micRequest.current) return;
      const response = await request("voice:state", { voiceId: id, muted: false });
      if (epoch !== generation.current || joinedId.current !== id || operation !== micRequest.current) return;
      if (response.ok) { micAllowed.current = true; local.current?.getAudioTracks().forEach(track => { track.enabled = !latest.current.players.find(player => player.id === latest.current.ownId)?.voiceMuted; }); }
      else setError(response.error ?? "Chưa bật được micro.");
    } catch (failure) {
      if (epoch !== generation.current || operation !== micRequest.current) return;
      setError(failure instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(failure.name) ? "Micro chưa được cấp quyền. Mở quyền micro trong trình duyệt rồi thử lại nhé." : "Không mở được micro. Kiểm tra thiết bị hoặc ứng dụng đang dùng micro rồi thử lại.");
    } finally { if (operation === micRequest.current) setMicBusy(false); }
  };
  const enablePlayback = () => { void context.current?.resume().catch(() => {}); setNeedsPlayback(false); audios.current.forEach(play); };
  const toggleListening = () => { const next = !deafened; deafenedRef.current = next; setDeafened(next); audios.current.forEach(audio => { audio.muted = next; }); if (!next) enablePlayback(); };
  const cancelMic = () => {
    micRequest.current++; micAllowed.current = false; setMicBusy(false);
    local.current?.getAudioTracks().forEach(track => { track.enabled = false; });
    if (joinedId.current) void request("voice:state", { voiceId: joinedId.current, muted: true });
  };

  if (!room.settings.voiceEnabled) return null;
  return <section className={`vv-voice${joined ? " vv-voice-joined" : ""}`} aria-label="Trò chuyện bằng micro">
    <div className={`vv-voice-heading${speaking.length ? " is-speaking" : ""}`}><Headphones size={20} /><div><b>{inLobby || room.phase === "finished" ? "Trò chuyện cùng nhà" : "Thoại"}</b><small className="vv-voice-summary" role="status" aria-atomic="true">{summary}</small></div></div>
    <div className="vv-voice-actions">{joined ? <>
      <button type="button" disabled={micBusy || !connected || !secure} onClick={toggleMic} aria-label={muted ? "Bật micro" : "Tắt micro"} aria-pressed={!muted} className={!muted ? "is-on" : ""}>{muted ? <MicOff size={18} /> : <Mic size={18} />}<span className="vv-mic-label">{micBusy ? "Đang mở…" : muted ? "Mic tắt" : "Mic bật"}</span></button>
      <button type="button" onClick={toggleListening} aria-label={deafened ? "Bật tiếng nghe" : "Tắt tiếng nghe"} aria-pressed={!deafened}>{deafened ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      <button type="button" onClick={() => setExpanded(value => !value)} aria-label="Danh sách người trong phòng thoại" aria-expanded={expanded} aria-controls="vv-voice-people"><Users size={18} /></button>
      <button type="button" onClick={leave} aria-label="Rời phòng thoại"><LogOut size={18} /></button>
    </> : <button type="button" onClick={join} disabled={busy || !connected}>{busy ? "Đang kết nối…" : "Tham gia trò chuyện"}</button>}</div>
    {joined && expanded && <div id="vv-voice-people" className="vv-voice-people">{participants.map(member => <span key={member.id} data-connection={member.id === room.ownId ? "self" : connections[member.id]?.state ?? "connecting"} className={speaking.includes(member.id) ? "is-speaking" : ""}>{member.voiceMuted ? <MicOff size={15} /> : <Mic size={15} />}<b>{member.name}{member.id === room.ownId ? " (Bạn)" : ""}</b><small>{member.id !== room.ownId && <em>{connectionText(member.id)} · </em>}{speaking.includes(member.id) ? "Đang nói" : member.voiceMuted ? "Mic tắt" : "Mic bật"}</small></span>)}</div>}
    {joined && interrupted && <div className="vv-voice-recovery" role="status"><span>{others.some(player => connections[player.id]?.state === "disconnected") ? "Có kết nối âm thanh chưa phục hồi được." : "Âm thanh gián đoạn, đang thử kết nối lại…"}</span><button type="button" onClick={() => network.current?.retry()} disabled={!others.some(player => connections[player.id]?.state === "disconnected")}><RefreshCw size={16} />Kết nối lại</button></div>}
    {micBusy && <div className="vv-voice-help" role="status"><span>Chọn cho phép micro trong thông báo của trình duyệt.</span><button type="button" className="vv-text-btn" onClick={cancelMic}>Hủy mở micro</button></div>}
    {!secure && <p className="vv-voice-error" role="alert">Mở game bằng liên kết HTTPS để bật micro trên điện thoại.</p>}
    {needsPlayback && <button type="button" className="vv-text-btn" onClick={enablePlayback}>Chạm để bật âm thanh trò chuyện</button>}
    {error && <p className="vv-voice-error" role="alert">{error}</p>}
    {joined && expanded && room.hostId === room.ownId && <div className="vv-voice-help">{!relayConfigured && <p>Âm thanh có thể bị hạn chế khi các thành viên dùng những mạng khác nhau.</p>}{participants.length > 1 && <><button type="button" className="vv-text-btn vv-voice-mute-all" onClick={async () => { const response = await request("voice:mute-all"); if (!response.ok) setError(response.error ?? "Chưa tắt được micro cả phòng."); }}>Tắt micro cả phòng</button><small>Mọi người có thể tự bật lại micro.</small></>}</div>}
    <div ref={audioContainer} className="vv-voice-audio" aria-hidden="true" />
  </section>;
}

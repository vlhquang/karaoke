"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Copy, Crown, Download, Eraser, Heart, House, LogOut, Pencil, Play, QrCode, RotateCcw, Send, Settings2, ShieldCheck, Sparkles, Trash2, Trophy, Undo2, Users, Wifi, WifiOff, X } from "lucide-react";
import { CATEGORIES, DEFAULT_SETTINGS, type Reply, type RoomView, type Session, type Settings, type Stroke, type TurnResult } from "./types";
import { DrawingBoard, paintStrokes } from "./DrawingBoard";
import { RoomInvite } from "./RoomInvite";
import { useMobileControls } from "./use-mobile-controls";

const SESSION_KEY = "ve-vui.session.v1";
const COLORS = ["#253447", "#737985", "#ee5353", "#f68b42", "#f4c742", "#6dbd69", "#24886d", "#43b8c7", "#4a7be8", "#8f67c2", "#ea85b3", "#9b6746"];
const COLOR_NAMES = ["Mực đậm", "Xám", "Đỏ", "Cam", "Vàng", "Xanh lá", "Xanh rêu", "Xanh ngọc", "Xanh dương", "Tím", "Hồng", "Nâu"];
const AVATAR_COLORS = ["#e7c6aa", "#c6dbaf", "#bfcff0", "#ead4a2", "#dabcea", "#a9dcd5", "#f1bdc3", "#c5d4de"];
const phaseLabels = { lobby: "Phòng chờ", preparing: "Chuẩn bị", drawing: "Đang vẽ", review: "Duyệt cuối lượt", result: "Kết quả lượt", finished: "Cả nhà về đích!" };

function Doodle({ compact = false }: { compact?: boolean }) {
  return <svg viewBox="0 0 620 400" fill="none" aria-hidden="true" className={compact ? "vv-doodle compact" : "vv-doodle"}>
    <path d="M58 333c95-14 163-9 235-5 104 6 151-6 265 4" stroke="#7fb583" strokeWidth="4" strokeLinecap="round" />
    <path d="M179 221v105h211V219" fill="#fff7df" stroke="#384650" strokeWidth="5" strokeLinejoin="round" />
    <path d="m150 225 135-117 134 114-269 3Z" fill="#e8a480" stroke="#384650" strokeWidth="5" strokeLinejoin="round" />
    <path d="m343 157 1-48 27 1 1 68" fill="#f0c9a7" stroke="#384650" strokeWidth="5" strokeLinejoin="round" />
    <path d="M267 326v-74h43v75" fill="#bdd4c6" stroke="#384650" strokeWidth="4" />
    <rect x="204" y="246" width="38" height="37" rx="2" fill="#d8edf2" stroke="#384650" strokeWidth="4" /><path d="M223 248v34m-18-17h36" stroke="#384650" strokeWidth="3" />
    <rect x="333" y="246" width="36" height="37" rx="2" fill="#d8edf2" stroke="#384650" strokeWidth="4" /><path d="M351 248v34m-17-17h34" stroke="#384650" strokeWidth="3" />
    <circle cx="302" cy="291" r="3" fill="#384650" />
    <circle cx="480" cy="93" r="30" fill="#f7d164" /><path d="m478 47 1-15m34 30 13-11m-1 41 17 1m-31 33 12 12m-45 1-1 16m-33-31-13 12m2-45-16-1m28-32-11-12" stroke="#e9bd48" strokeWidth="4" strokeLinecap="round" />
    <path d="M74 123c-23-7-21-31-3-35 0-28 39-34 50-11 26-3 35 30 13 37-18 5-44 6-60 9Z" fill="#e1eff0" />
    <path d="M450 328v-63m0 22c-37-27-29-49-9-35 14 9 9 35 9 35Zm2 13c41-27 40-51 17-36-16 10-17 36-17 36Z" stroke="#6e9f76" strokeWidth="4" fill="#c4d7b4" strokeLinejoin="round" />
    <path d="M123 328v-35m-1 11c-22-16-20-33-7-23 9 6 7 23 7 23Zm3 9c24-13 27-28 11-22-10 5-11 22-11 22Z" stroke="#6e9f76" strokeWidth="3" fill="#c4d7b4" />
    <circle cx="123" cy="278" r="12" fill="#e9a1a8" /><circle cx="123" cy="278" r="5" fill="#f6d272" />
    <path d="m252 365 33-11 36 10" stroke="#d5cbb4" strokeWidth="3" strokeLinecap="round" />
    <path d="m404 60 4-9 4 9 10 4-10 4-4 9-4-9-9-4 9-4Z" fill="#aac5a5" />
    <path d="m99 210 13-13m-17 4 20 6" stroke="#d4bc91" strokeWidth="3" strokeLinecap="round" />
    <path d="M277 181c-11-15-24-3-17 7l17 16 18-18c7-12-9-19-18-5Z" fill="#dd8c87" />
  </svg>;
}

function SettingsFields({ value, onChange, disabled = false }: { value: Settings; onChange: (value: Settings) => void; disabled?: boolean }) {
  const set = <K extends keyof Settings>(key: K, next: Settings[K]) => onChange({ ...value, [key]: next });
  return <div className="vv-settings">
    <label>Số vòng<select disabled={disabled} value={value.rounds} onChange={e => set("rounds", Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} vòng</option>)}</select></label>
    <label>Thời gian mỗi lượt<select disabled={disabled} value={value.duration} onChange={e => set("duration", Number(e.target.value) as Settings["duration"])}>{[60, 90, 120].map(n => <option key={n} value={n}>{n} giây</option>)}</select></label>
    <label>Độ khó<select disabled={disabled} value={value.difficulty} onChange={e => set("difficulty", e.target.value as Settings["difficulty"])}><option value="easy">Dễ, ai cũng vẽ được</option><option value="medium">Vừa, thử tài một chút</option><option value="mixed">Hỗn hợp</option></select></label>
    <label>Chủ đề<select disabled={disabled} value={value.category} onChange={e => set("category", e.target.value as Settings["category"])}><option value="all">Tất cả chủ đề</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Cách chấm đáp án<select disabled={disabled} value={value.judging} onChange={e => set("judging", e.target.value as Settings["judging"])}><option value="hybrid">Kết hợp: máy + người vẽ</option><option value="manual">Người vẽ duyệt tất cả</option></select></label>
    <label>Gợi ý tự động<select disabled={disabled} value={value.hints ? "on" : "off"} onChange={e => set("hints", e.target.value === "on")}><option value="on">Bật gợi ý</option><option value="off">Tắt gợi ý</option></select></label>
  </div>;
}

function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return <span className="vv-avatar" style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>{name.slice(0, 1).toLocaleUpperCase("vi")}</span>;
}

function GalleryPicture({ result, name }: { result: TurnResult; name: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) paintStrokes(ref.current, result.strokes); }, [result]);
  const download = () => {
    if (!ref.current) return;
    const link = document.createElement("a"); link.download = `ve-vui-${result.answer}.png`; link.href = ref.current.toDataURL("image/png"); link.click();
  };
  return <article className="vv-gallery-picture"><canvas ref={ref} width={1000} height={650} aria-label={`Tranh ${result.answer} của ${name}`} /><div><span><b>{result.answer}</b><small>{name}{result.cancelled ? " · Lượt đã hủy" : ""}</small></span><button type="button" className="vv-icon-btn" aria-label={`Tải tranh ${result.answer}`} onClick={download}><Download size={18} /></button></div></article>;
}

export function DrawingGame() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [entryMode, setEntryMode] = useState<"create" | "join">("create");
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [connected, setConnected] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [guess, setGuess] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(10);
  const [eraser, setEraser] = useState(false);
  const [time, setTime] = useState(Date.now());
  const [clockOffset, setClockOffset] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const appRef = useRef<HTMLElement>(null);
  useMobileControls(appRef);

  const request = useCallback((event: string, payload: unknown = {}): Promise<Reply> => new Promise(resolve => {
    const socket = socketRef.current;
    if (!socket?.connected) { resolve({ ok: false, error: "Đang kết nối lại. Chờ một chút nhé." }); return; }
    socket.timeout(8000).emit(event, payload, (failure: Error | null, response: Reply) => resolve(failure ? { ok: false, error: "Máy chủ chưa phản hồi. Hãy thử lại." } : response));
  }), []);

  useEffect(() => {
    let mounted = true;
    const invite = new URLSearchParams(window.location.search).get("phong")?.toUpperCase() ?? "";
    if (invite) { setCode(invite); setEntryMode("join"); }
    setName(localStorage.getItem("ve-vui.name") ?? "");
    const socket = io("/ve-vui", { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", async () => {
      setConnected(true);
      let saved: Session | null = null;
      try { saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null; } catch { localStorage.removeItem(SESSION_KEY); }
      if (saved && (!invite || saved.code === invite)) {
        setRestoring(true);
        const response = await request("room:restore", saved);
        if (!mounted) return;
        if (!response.ok) { localStorage.removeItem(SESSION_KEY); setRoom(null); setError(response.error ?? "Không khôi phục được phiên chơi."); }
      }
      setRestoring(false);
    });
    socket.on("room:state", (snapshot: RoomView) => { setRoom(snapshot); setClockOffset(snapshot.serverNow - Date.now()); });
    socket.on("draw:stroke", (stroke: Stroke) => {
      setRoom(previous => previous ? { ...previous, strokes: appendStroke(previous.strokes, stroke) } : previous);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => { setConnected(false); setRestoring(false); setError("Chưa kết nối được máy chủ. Hệ thống đang thử lại."); });
    socket.on("session:ended", (message: string) => {
      if (!message.includes("cửa sổ khác")) localStorage.removeItem(SESSION_KEY);
      setRoom(null); setError(message);
    });
    return () => { mounted = false; socket.disconnect(); socketRef.current = null; };
  }, [request]);
  useEffect(() => { const timer = setInterval(() => setTime(Date.now()), 200); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 4000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { setGuess(""); setEraser(false); }, [room?.drawerId, room?.round]);

  const action = async (event: string, payload: unknown = {}) => {
    setError("");
    const response = await request(event, payload);
    if (!response.ok) setError(response.error ?? "Chưa thể thực hiện thao tác.");
    return response;
  };
  const enter = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    if (!socketRef.current?.connected) socketRef.current?.connect();
    const response = await action(entryMode === "create" ? "room:create" : "room:join", entryMode === "create" ? { name, settings } : { name, code });
    if (response.ok && response.session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(response.session));
      localStorage.setItem("ve-vui.name", name.trim());
      window.history.replaceState({}, "", `/ve-vui?phong=${response.session.code}`);
    }
    setBusy(false);
  };
  const leave = async () => {
    if (room && room.phase !== "lobby" && room.phase !== "finished" && !window.confirm("Rời trận đang chơi? Bạn sẽ cần vào lại như người chơi mới.")) return;
    if (connected) { const response = await action("room:leave"); if (!response.ok) return; }
    localStorage.removeItem(SESSION_KEY); setRoom(null); setCode(""); window.history.replaceState({}, "", "/ve-vui");
  };
  const sendStroke = (stroke: Stroke) => {
    setRoom(previous => previous ? { ...previous, strokes: appendStroke(previous.strokes, stroke) } : previous);
    void request("draw:stroke", stroke).then(response => {
      if (!response.ok) { setError(response.error ?? "Không gửi được nét vẽ."); void request("room:sync"); }
    });
  };
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/ve-vui?phong=${room!.code}`); setNotice("Đã sao chép liên kết. Gửi cho cả nhà nhé!"); }
    catch { setInviteOpen(true); }
  };
  const sendGuess = async (event: FormEvent) => {
    event.preventDefault(); if (!guess.trim()) return;
    const response = await action("guess:send", { text: guess });
    if (response.ok) { setGuess(""); setCooldown(Date.now() + 2000); }
  };
  const nextTurn = async () => {
    if (!room?.currentResult || advancing) return;
    setAdvancing(true);
    try { await action("turn:next", { resultId: room.currentResult.id }); }
    finally { setAdvancing(false); }
  };

  const own = room?.players.find(p => p.id === room.ownId);
  const isHost = room?.hostId === room?.ownId;
  const isDrawer = !!room && room.drawerId === room.ownId;
  const drawerName = room?.players.find(p => p.id === room.drawerId)?.name ?? "Người vẽ";
  const accepted = room?.guesses.some(g => g.playerId === room.ownId && g.status === "accepted");
  const canDraw = connected && isDrawer && room?.phase === "drawing" && !room.paused;
  const canGuess = connected && room?.phase === "drawing" && !room.paused && !accepted && room.eligibleIds.includes(room.ownId);
  const seconds = room ? Math.max(0, Math.ceil((room.deadline - (room.paused ? room.serverNow : time + clockOffset)) / 1000)) : 0;
  const playerName = (id: string) => room?.players.find(p => p.id === id)?.name ?? "Người chơi";
  const ranked = room ? [...room.players].sort((a, b) => b.score - a.score) : [];
  const mobileGuessBar = !!room && !isDrawer && room.eligibleIds.includes(room.ownId) && ["preparing", "drawing"].includes(room.phase);
  const isLastTurn = !!room && room.round >= room.settings.rounds && !room.order.slice(room.turnIndex + 1).some(id => room.players.some(player => player.id === id && player.connected));

  return <main ref={appRef} className={`vv-app${room ? " vv-in-room" : ""}${room && room.phase !== "lobby" && room.phase !== "finished" ? " vv-in-game" : ""}${mobileGuessBar ? " vv-mobile-guess" : ""}`}>
    <div className="vv-container">
      <header className="vv-header">
        <Link href="/ve-vui" className="vv-brand" onClick={event => { if (room) event.preventDefault(); }}><span className="vv-brand-icon"><Pencil size={24} strokeWidth={2.4} /></span><span>vẽ vui<span className="vv-brand-sub">cùng nhà</span></span></Link>
        <div className="vv-nav">{room ? <><span className={`vv-connection${connected ? " online" : ""}`}>{connected ? <Wifi size={15} /> : <WifiOff size={15} />}{connected ? "Đã kết nối" : "Đang kết nối lại"}</span><button type="button" className="vv-text-btn vv-share-trigger" aria-label="Mời người chơi bằng liên kết hoặc mã QR" onClick={() => setInviteOpen(true)}><QrCode size={19} /><span>Mời người chơi</span></button><button type="button" className="vv-text-btn" onClick={leave}><LogOut size={17} /><span>Rời phòng</span></button></> : <><span className="vv-header-note"><Heart size={15} />Thêm một chút vui, gần nhau một chút.</span><Link href="/" className="vv-text-btn"><ArrowLeft size={16} />Portal</Link></>}</div>
      </header>
      {notice && <div role="status" className="vv-toast"><Check size={18} />{notice}</div>}
      {error && <div role="alert" className="vv-error"><span>{error}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setError("")}><X size={18} /></button></div>}

      {!room ? <>
        <section className="vv-landing">
          <div className="vv-intro"><span className="vv-pill"><span className="vv-dot" />Một trò chơi, cả nhà cùng vui</span><h1>Nét vẽ hơi vụng.<br />Tiếng cười thật to.</h1><p>Không cần vẽ đẹp. Chỉ cần có nhau.<br />Một người vẽ, cả nhà thi nhau đoán!</p><div className="vv-feature-row"><span><Users size={18} />2–8 người</span><span><ShieldCheck size={18} />Không cần tài khoản</span><span><House size={18} />Chơi ở bất cứ đâu</span></div>
            <div className="vv-entry-card">
              <div className="vv-tabs" role="tablist" aria-label="Cách vào chơi"><button type="button" role="tab" aria-selected={entryMode === "create"} className={entryMode === "create" ? "active" : ""} onClick={() => setEntryMode("create")}><Pencil size={18} />Tạo phòng mới</button><button type="button" role="tab" aria-selected={entryMode === "join"} className={entryMode === "join" ? "active" : ""} onClick={() => setEntryMode("join")}><Users size={18} />Vào phòng cùng nhà</button></div>
              <form onSubmit={enter} className="vv-entry-form"><label htmlFor="vv-name">Cả nhà gọi bạn là gì?</label><input id="vv-name" value={name} onChange={e => setName(e.target.value)} maxLength={30} autoComplete="nickname" placeholder="Ví dụ: Mẹ, Bố, Bé Bông..." required />
                {entryMode === "join" && <><label htmlFor="vv-code">Mã phòng được mời</label><input id="vv-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} minLength={6} maxLength={6} autoCapitalize="characters" autoComplete="off" placeholder="Nhập mã 6 ký tự" required /></>}
                {entryMode === "create" && <details className="vv-advanced"><summary><Settings2 size={16} />Tùy chỉnh cuộc vui <span>{settings.rounds} vòng · {settings.duration} giây</span><ChevronDown size={15} /></summary><SettingsFields value={settings} onChange={setSettings} /></details>}
                <button type="submit" className="vv-btn vv-primary" disabled={busy || restoring || !connected}>{busy ? "Đang mở phòng..." : restoring ? "Đang khôi phục phiên..." : !connected ? "Đang kết nối..." : entryMode === "create" ? "Tạo phòng, rủ cả nhà" : "Vào phòng chơi"}<ArrowRight size={19} /></button><small className="vv-form-note">Miễn phí. Mở trên điện thoại là chơi được ngay.</small>
              </form>
            </div>
          </div>
          <div className="vv-hero-art"><div className="vv-art-note">Hôm nay, nhà mình vẽ gì?</div><div className="vv-paper"><div className="vv-paper-top"><span><span /><span /><span /></span><span>Bảng vẽ của cả nhà</span><Pencil size={16} /></div><Doodle /><div className="vv-paper-bottom"><span className="vv-demo-colors">{COLORS.slice(2, 8).map(c => <i key={c} style={{ background: c }} />)}</span><span>Vẽ bằng cả niềm vui</span></div></div><div className="vv-floating-message"><span className="vv-mini-avatar">B</span><span>Bé Bông <b>Ngôi nhà!</b></span><span className="vv-success-check"><Check size={17} /></span></div><div className="vv-art-caption"><Heart size={19} />Tranh có thể chưa đẹp. Kỷ niệm thì có.</div></div>
        </section>
        <section className="vv-how"><div><span className="vv-how-number">1</span><span><b>Tạo một phòng</b><small>Gửi mã mời vào nhóm gia đình.</small></span></div><div><span className="vv-how-number">2</span><span><b>Vẽ theo cách của bạn</b><small>Nhận đề bí mật, trổ tài trong 90 giây.</small></span></div><div><span className="vv-how-number">3</span><span><b>Cả nhà cùng đoán</b><small>Đoán đúng, nhận điểm, đổi người vẽ!</small></span></div></section>
        <footer className="vv-footer"><span>Làm một điều vui, cùng những người thương.</span><span><Pencil size={14} />Vẽ vui cùng nhà</span></footer>
      </> : room.phase === "lobby" ? <section className="vv-lobby">
        <div className="vv-section-heading"><div><span className="vv-pill">Phòng của cả nhà</span><h1>Đủ mặt là vui!</h1><p>Mời mọi người vào phòng, bấm sẵn sàng rồi cùng vẽ nhé.</p></div><div className="vv-room-code"><small>Mã phòng</small><strong>{room.code}</strong><div className="vv-room-actions"><button type="button" className="vv-text-btn" onClick={copyInvite}><Copy size={16} />Sao chép lời mời</button><button type="button" className="vv-icon-btn" aria-label="Mở mã QR mời vào phòng" onClick={() => setInviteOpen(true)}><QrCode size={20} /></button></div></div></div>
        <div className="vv-lobby-grid"><section className="vv-panel vv-members"><div className="vv-panel-title"><h2><Users size={21} />Cả nhà đã tới</h2><span>{room.players.filter(p => p.connected).length}/8 người</span></div><div className="vv-member-list">{room.players.map((p, index) => <div className="vv-member" key={p.id}><Avatar name={p.name} index={index} /><span><b>{p.name}{p.id === room.ownId ? " (Bạn)" : ""}</b><small>{p.id === room.hostId ? <><Crown size={12} /> Chủ phòng</> : p.connected ? "Đã vào phòng" : "Đang mất kết nối"}</small></span><span className={`vv-ready-status${p.ready ? " ready" : ""}`}>{p.ready ? <><Check size={14} />Sẵn sàng</> : "Đang chuẩn bị"}</span>{isHost && p.id !== room.ownId && <button type="button" className="vv-icon-btn" aria-label={`Mời ${p.name} rời phòng`} onClick={() => { if (window.confirm(`Mời ${p.name} rời phòng?`)) void action("room:kick", { playerId: p.id }); }}><X size={16} /></button>}</div>)}</div><div className="vv-invite-tip"><Heart size={23} /><p>Phòng còn chỗ cho những người thương.<br /><button type="button" onClick={copyInvite}>Gửi liên kết mời cả nhà</button></p></div><button type="button" className={`vv-btn ${own?.ready ? "vv-secondary" : "vv-primary"}`} disabled={!connected} onClick={() => action("room:ready")}><Check size={19} />{own?.ready ? "Đã sẵn sàng · Bấm để hủy" : "Mình đã sẵn sàng"}</button>{isHost && <button type="button" className="vv-btn vv-dark" disabled={!connected || room.players.filter(p => p.connected).length < 2 || room.players.some(p => p.connected && !p.ready)} onClick={() => action("room:start")}><Play size={18} />Bắt đầu cuộc vui</button>}<p className="vv-small-note">Cần ít nhất 2 người và tất cả đều sẵn sàng.</p></section>
          <section className="vv-panel"><div className="vv-panel-title"><h2><Settings2 size={21} />Luật chơi nhà mình</h2></div><SettingsFields value={room.settings} disabled={!isHost || !connected} onChange={next => action("room:settings", next)} /><p className="vv-small-note">{isHost ? "Đổi cài đặt sẽ đặt lại trạng thái sẵn sàng của cả nhà." : "Chủ phòng chọn cài đặt trước khi bắt đầu."}</p><div className="vv-rules"><Pencil size={22} /><div><b>Vẽ thôi, đừng viết đáp án nhé!</b><p>Không viết chữ, số hoặc nói đáp án. Người vẽ có quyền quyết định câu nào được tính đúng.</p></div></div></section></div>
      </section> : room.phase === "finished" ? <section className="vv-finished"><div className="vv-finish-heading"><span className="vv-trophy"><Trophy size={40} /></span><h1>Cả nhà vẽ giỏi quá!</h1><p>Một bộ tranh độc nhất, một buổi chơi thật vui.</p></div><div className="vv-finish-grid"><section className="vv-panel"><h2>Bảng điểm nhà mình</h2>{ranked.map((p, index) => <div key={p.id} className={`vv-ranking${index === 0 ? " winner" : ""}`}><span className="vv-rank-number">{index === 0 ? <Crown size={21} /> : index + 1}</span><Avatar name={p.name} index={room.players.indexOf(p)} /><span><b>{p.name}</b><small>{p.score === ranked[0].score ? "Ngôi sao của cả nhà" : room.results.filter(r => r.accepted.some(a => a.playerId === p.id)).length >= 2 ? "Thám tử tinh mắt" : room.results.some(r => r.drawerId === p.id && !r.cancelled) ? "Họa sĩ đầy cảm hứng" : "Người bạn đồng hành"}</small></span><strong>{p.score}<small>điểm</small></strong></div>)}{isHost ? <button type="button" className="vv-btn vv-primary" onClick={() => action("room:rematch")}><RotateCcw size={18} />Chơi tiếp, giữ cả nhà</button> : <p className="vv-small-note">Chờ chủ phòng mở trận tiếp theo nhé.</p>}</section><section><div className="vv-panel-title"><h2><Pencil size={21} />Triển lãm của cả nhà</h2><span>{room.results.length} bức tranh</span></div><div className="vv-gallery">{room.results.map(result => <GalleryPicture key={result.id} result={result} name={playerName(result.drawerId)} />)}</div>{!room.results.length && <p>Chưa có tranh. Cùng chơi một trận nữa nhé!</p>}</section></div></section> : <>
        <section className="vv-game-heading"><div><span className="vv-round">Vòng {room.round}/{room.settings.rounds}</span><h1>{room.phase === "result" ? "Một bức tranh, bao tiếng cười!" : isDrawer ? "Đến lượt bạn làm họa sĩ!" : `${drawerName} đang ${room.phase === "preparing" ? "nhận đề" : "vẽ"}`}</h1><p>{isDrawer ? "Cứ tự tin vẽ. Cả nhà đang chờ tài năng của bạn." : "Nhìn thật kỹ, đoán thật nhanh. Biết đâu bạn đúng đầu tiên!"}</p></div><div className="vv-game-room"><span>Phòng <b>{room.code}</b></span><button type="button" className="vv-icon-btn" aria-label="Sao chép liên kết mời" onClick={copyInvite}><Copy size={18} /></button></div></section>
        {!connected && <div role="status" className="vv-banner">Đang kết nối lại. Nét vẽ, điểm và danh tính của bạn sẽ được khôi phục.</div>}
        {room.paused && <div role="status" className="vv-banner">{room.pauseReason === "drawer" ? `Đợi ${drawerName} kết nối lại, tối đa 20 giây. Lượt đang tạm dừng.` : room.pauseReason === "host" ? "Cả nhà nghỉ một chút. Chủ phòng bấm Tiếp tục để chơi." : "Chờ ít nhất hai người của vòng này kết nối lại."}</div>}
        {own && own.activeFromRound > room.round && <div className="vv-banner">Bạn đang xem trận và sẽ tham gia từ vòng {own.activeFromRound}.</div>}
        <div className="vv-game-grid"><section className="vv-drawing-area">
          {room.phase === "result" && <div className="vv-result-controls">{isHost ? <button type="button" className="vv-btn vv-primary" disabled={!connected || room.paused || advancing} onClick={nextTurn}>{advancing ? "Đang chuyển lượt..." : isLastTurn ? "Xem kết quả trận" : "Chuyển sang người tiếp theo"}<ArrowRight size={19} /></button> : <p>Chờ chủ phòng bấm tiếp tục khi cả nhà đã xem xong kết quả.</p>}</div>}
          <div className="vv-board-top"><div><span className={`vv-phase-dot ${room.phase}`} />{phaseLabels[room.phase]}</div>{room.phase === "result" ? <span className="vv-result-waiting">Chờ chuyển lượt</span> : <div className={`vv-timer${seconds <= 15 ? " urgent" : ""}`} aria-label={`Còn ${seconds} giây`}><Clock3 size={18} /><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong></div>}</div>
          <div className="vv-word-bar">{room.answer ? <><span>{room.phase === "result" ? "Đáp án là" : "Đề bí mật của bạn"}</span><strong>{room.answer}</strong>{room.canReroll && <button type="button" className="vv-text-btn" onClick={() => action("turn:reroll")}><RotateCcw size={15} />Đổi đề (1 lần)</button>}</> : <><span>{room.phase === "preparing" ? "Họa sĩ đang chuẩn bị..." : `${room.wordCount} từ`}</span><strong className="vv-secret">{Array.from({ length: room.wordCount }, (_, i) => <span key={i}>___</span>)}</strong>{room.hintCategory && <span className="vv-hint">{room.hintCategory}{room.hintLetter ? ` · Bắt đầu bằng “${room.hintLetter}”` : ""}</span>}</>}</div>
          <div className="vv-canvas-wrap"><DrawingBoard strokes={room.strokes} enabled={canDraw} color={eraser ? "#ffffff" : color} width={eraser ? 32 : width} onStroke={sendStroke} />{room.phase === "preparing" && <div className="vv-canvas-overlay"><div className="vv-preparing-icon"><Pencil size={38} /></div><h2>{isDrawer ? "Bạn sẽ vẽ gì nào?" : "Đợi một chút, sắp có tranh rồi!"}</h2><p>{isDrawer ? "Đọc đề ở trên. Bảng vẽ sẽ mở khi đếm ngược kết thúc." : "Đề chỉ hiện với người vẽ. Chuẩn bị tinh thần đoán nhé!"}</p><strong>{seconds}</strong></div>}{room.phase === "result" && <div className="vv-result-stamp">{room.currentResult?.cancelled ? "Lượt đã hủy · Không tính điểm" : `${room.currentResult?.accepted.length ?? 0}/${room.eligibleIds.length} người đoán đúng`}</div>}</div>
          {isDrawer && room.phase === "drawing" ? <div className="vv-toolbar"><div className="vv-palette" role="group" aria-label="Chọn màu bút">{COLORS.map((c, index) => <button key={c} type="button" aria-label={COLOR_NAMES[index]} aria-pressed={!eraser && color === c} className={!eraser && color === c ? "selected" : ""} style={{ backgroundColor: c }} disabled={!canDraw} onClick={() => { setColor(c); setEraser(false); }} />)}</div><div className="vv-tools"><div className="vv-pen-widths" role="group" aria-label="Cỡ nét">{[4, 10, 20].map((w, i) => <button key={w} type="button" aria-label={`Nét ${["nhỏ", "vừa", "lớn"][i]}`} aria-pressed={width === w && !eraser} className={width === w && !eraser ? "active" : ""} onClick={() => { setWidth(w); setEraser(false); }}><span style={{ width: 5 + i * 4, height: 5 + i * 4 }} /></button>)}</div><button type="button" className={`vv-icon-btn${eraser ? " active" : ""}`} aria-label="Tẩy" aria-pressed={eraser} onClick={() => setEraser(!eraser)}><Eraser size={19} /></button><button type="button" className="vv-icon-btn" aria-label="Hoàn tác nét vừa vẽ" disabled={!canDraw || !room.strokes.length} onClick={() => action("draw:edit", { action: "undo" })}><Undo2 size={19} /></button><button type="button" className="vv-icon-btn" aria-label="Xóa toàn bộ bảng vẽ" disabled={!canDraw || !room.strokes.length} onClick={() => { if (window.confirm("Xóa toàn bộ bức tranh đang vẽ?")) void action("draw:edit", { action: "clear" }); }}><Trash2 size={18} /></button></div></div> : <div className="vv-board-caption"><Pencil size={16} />{room.phase === "review" ? "Hết giờ vẽ. Người vẽ có thêm 10 giây duyệt câu trả lời." : room.phase === "result" ? "Điểm đã cập nhật. Cả nhà xem kết quả rồi chủ phòng bấm chuyển lượt nhé." : "Một chút tưởng tượng, thật nhiều niềm vui."}</div>}
          {room.phase === "result" && <div className="vv-turn-awards">{room.currentResult?.accepted.map(a => <span key={a.playerId}><Check size={16} /><b>{playerName(a.playerId)}</b> “{a.text}” <strong>+{a.points}</strong></span>)}{room.currentResult && !room.currentResult.cancelled && <span><Pencil size={16} />{drawerName} nhận <strong>+{room.currentResult.awards[room.drawerId!] ?? 0}</strong> điểm vẽ</span>}</div>}
        </section><aside className="vv-game-sidebar"><section className="vv-panel vv-guesses"><div className="vv-panel-title"><h2>{isDrawer ? <><ShieldCheck size={20} />Cả nhà đang đoán</> : <><Sparkles size={20} />Bạn đoán là gì?</>}</h2><span>{room.guesses.filter(g => g.status === "accepted").length}/{room.eligibleIds.length}</span></div><p className="vv-guess-help">{isDrawer ? "Gợi ý chỉ để tham khảo. Bạn quyết định câu nào đúng." : accepted ? "Bạn đã đoán đúng! Cổ vũ cho cả nhà nhé." : "Gửi ý tưởng của bạn. Đoán sai cũng không mất điểm."}</p>
          <div className="vv-guess-list" aria-live="polite" aria-relevant="additions text">{!room.guesses.length && <div className="vv-guess-empty"><Send size={28} /><span>{isDrawer ? "Chưa có dự đoán nào. Vẽ nét đầu tiên nào!" : "Bạn sẽ là người đoán đúng đầu tiên chứ?"}</span></div>}{room.guesses.map(g => <article key={g.id} className={`vv-guess ${g.status}${isDrawer && (g.similarity?.percent ?? 0) >= 80 ? " close" : ""}`}><div className="vv-guess-author"><b>{playerName(g.playerId)}{g.playerId === room.ownId ? " (Bạn)" : ""}</b><small>{g.status === "accepted" ? <><Check size={13} />Đoán đúng!</> : g.status === "pending" ? "Chờ duyệt" : "Chưa đúng"}</small></div><p>{g.text ?? (g.status === "accepted" ? "Đã đoán đúng đáp án!" : "Có một dự đoán đang chờ duyệt.")}</p>{isDrawer && g.similarity && <div className="vv-similarity"><span>{g.similarity.percent === 100 ? "Khớp đáp án" : `${g.similarity.percent}% · ${g.similarity.label}`}</span><small>{g.similarity.explanation}</small></div>}{isDrawer && ["drawing", "review", "result"].includes(room.phase) && !room.currentResult?.cancelled && <div className="vv-judge-actions"><button type="button" disabled={!connected || room.paused || g.status === "accepted"} onClick={() => action("guess:judge", { guessId: g.id, accepted: true })}><Check size={15} />{g.status === "accepted" ? "Đã nhận" : "Chấp nhận"}</button><button type="button" disabled={!connected || room.paused || g.status === "rejected"} onClick={() => action("guess:judge", { guessId: g.id, accepted: false })}><X size={15} />Chưa đúng</button></div>}</article>)}</div>
          {!isDrawer && <form className="vv-guess-form" onSubmit={sendGuess}><label htmlFor="vv-guess">Dự đoán của bạn</label><div><input id="vv-guess" maxLength={80} value={guess} onChange={e => setGuess(e.target.value)} placeholder={accepted ? "Bạn đã đoán đúng!" : "Mình nghĩ là..."} autoComplete="off" autoCorrect="off" enterKeyHint="send" disabled={!canGuess} /><button type="submit" className="vv-send" aria-label="Gửi dự đoán" disabled={!canGuess || !guess.trim() || time < cooldown}><Send size={19} /></button></div><small>{time < cooldown ? "Chờ một chút trước khi đoán tiếp nhé." : accepted ? "Lượt này bạn có thể tiếp tục xem tranh." : "Mỗi 2 giây gửi một dự đoán."}</small></form>}
        </section><section className="vv-panel vv-scoreboard"><div className="vv-panel-title"><h2><Trophy size={19} />Bảng điểm</h2><span>{room.players.length} người</span></div>{ranked.map((p, index) => <div key={p.id} className={`vv-score-row${p.id === room.ownId ? " own" : ""}`}><span>{index + 1}</span><Avatar name={p.name} index={room.players.indexOf(p)} /><span><b>{p.name}{p.id === room.ownId ? " (Bạn)" : ""}</b><small>{p.id === room.drawerId ? "Đang vẽ" : !p.connected ? "Mất kết nối" : p.activeFromRound > room.round ? "Chờ vòng sau" : room.guesses.some(g => g.playerId === p.id && g.status === "accepted") ? "Đã đoán đúng" : "Đang đoán"}</small></span><strong>{p.score}</strong>{isHost && p.id !== room.ownId && <button type="button" className="vv-icon-btn" aria-label={`Mời ${p.name} rời phòng`} onClick={() => { if (window.confirm(`Mời ${p.name} rời phòng?`)) void action("room:kick", { playerId: p.id }); }}><X size={13} /></button>}</div>)}</section>{isHost && <div className="vv-host-controls"><button type="button" className="vv-text-btn" onClick={() => action("room:pause")}>{room.paused && room.pauseReason === "host" ? "Tiếp tục chơi" : room.phase === "result" ? "Tạm dừng" : room.pauseAfterTurn ? "Hủy nghỉ sau lượt này" : "Nghỉ sau lượt này"}</button><button type="button" className="vv-text-btn danger" onClick={() => { if (window.confirm("Kết thúc trận sớm? Lượt chưa hoàn thành sẽ không tính điểm.")) void action("room:finish"); }}>Kết thúc trận</button></div>}</aside>
          <section className="vv-turn-order"><h2>Hôm nay ai cũng là họa sĩ</h2><div>{room.order.map((id, index) => <span key={id} className={index === room.turnIndex ? "current" : index < room.turnIndex ? "done" : ""}><Avatar name={playerName(id)} index={room.players.findIndex(p => p.id === id)} /><span>{playerName(id)}<small>{index === room.turnIndex ? "Đang vẽ" : index < room.turnIndex ? "Đã vẽ" : "Sắp đến lượt"}</small></span></span>)}</div></section>
        </div>
      </>}
      {room && <RoomInvite code={room.code} open={inviteOpen} onClose={() => setInviteOpen(false)} />}
    </div>
  </main>;
}

function appendStroke(strokes: Stroke[], chunk: Stroke): Stroke[] {
  const last = strokes[strokes.length - 1];
  if (last?.id === chunk.id) return [...strokes.slice(0, -1), { ...last, points: [...last.points, ...chunk.points] }];
  return [...strokes, { ...chunk, points: [...chunk.points] }];
}

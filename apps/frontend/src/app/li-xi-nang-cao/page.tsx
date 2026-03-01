"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GamePanelSwitch, type LiXiGameType } from "../../components/lixi";
import { getLiXiSocket } from "../../lib/lixi-socket";

type PlayerView = {
  playerId: string;
  name: string;
  score: number;
  latency: number;
  isOnline: boolean;
};

type RoomView = {
  roomId: string;
  hostId: string;
  status: "waiting" | "playing" | "finished";
  currentGame: LiXiGameType | null;
  players: PlayerView[];
};

type AckResponse = { ok?: boolean; roomId?: string; playerId?: string; message?: string };

const games: Array<{ type: LiXiGameType; title: string; desc: string; color: string }> = [
  { type: "reaction", title: "Phản xạ", desc: "Bấm nhanh sau tín hiệu.", color: "bg-cyan-500/20 border-cyan-400/50" },
  { type: "memory", title: "Ghi nhớ", desc: "Hoàn thành bàn nhanh nhất.", color: "bg-emerald-500/20 border-emerald-400/50" },
  { type: "rps", title: "Kéo búa bao", desc: "Đấu BO1 ngay lập tức.", color: "bg-amber-500/20 border-amber-400/50" },
  { type: "number", title: "Săn số", desc: "Chạm đúng số mục tiêu trước.", color: "bg-violet-500/20 border-violet-400/50" },
  { type: "shake", title: "Lắc máy", desc: "Lắc mạnh trong 5 giây.", color: "bg-fuchsia-500/20 border-fuchsia-400/50" },
  { type: "color", title: "Chạm màu", desc: "Chạm đúng màu mục tiêu.", color: "bg-rose-500/20 border-rose-400/50" }
];

const pretty = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const roomFromPayload = (payload: unknown): RoomView | null => {
  const data = payload as { room?: RoomView };
  return data.room ?? null;
};

export default function LiXiNangCaoPage() {
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("Chủ phòng");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [selectedGame, setSelectedGame] = useState<LiXiGameType>("reaction");
  const [memoryBoardLength, setMemoryBoardLength] = useState(12);

  const [gameState, setGameState] = useState<unknown>(null);
  const [resultState, setResultState] = useState<unknown>(null);
  const [errorText, setErrorText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const roomId = room?.roomId ?? "";
  const isHost = room?.hostId === playerId;
  const canPlay = Boolean(roomId && playerId);
  const currentGame = room?.currentGame ?? selectedGame;

  const addLog = (message: string): void => {
    const line = `${new Date().toLocaleTimeString()} ${message}`;
    setLogs((prev) => [line, ...prev].slice(0, 40));
  };

  useEffect(() => {
    let mounted = true;
    const setup = async (): Promise<void> => {
      try {
        const socket = await getLiXiSocket();

        socket.on("connect", () => {
          if (!mounted) return;
          setConnected(true);
          addLog("Kết nối realtime /lixi thành công");
        });

        socket.on("disconnect", () => {
          if (!mounted) return;
          setConnected(false);
          addLog("Mất kết nối realtime");
        });

        socket.on("room:created", (payload: unknown) => {
          if (!mounted) return;
          const data = payload as { room?: RoomView; playerId?: string };
          setRoom(data.room ?? null);
          setRoomIdInput(data.room?.roomId ?? "");
          setPlayerId(String(data.playerId ?? ""));
          setErrorText("");
          addLog("Đã tạo phòng thành công");
        });

        socket.on("room:joined", (payload: unknown) => {
          if (!mounted) return;
          const data = payload as { room?: RoomView; playerId?: string };
          setRoom(data.room ?? null);
          setRoomIdInput(data.room?.roomId ?? "");
          setPlayerId(String(data.playerId ?? ""));
          setErrorText("");
          addLog("Đã tham gia phòng");
        });

        socket.on("game:started", (payload: unknown) => {
          if (!mounted) return;
          setGameState(payload);
          const nextRoom = roomFromPayload(payload);
          if (nextRoom) setRoom(nextRoom);
          setResultState(null);
          addLog("Trò chơi đã bắt đầu");
        });

        socket.on("game:update", (payload: unknown) => {
          if (!mounted) return;
          setGameState(payload);
          const nextRoom = roomFromPayload(payload);
          if (nextRoom) setRoom(nextRoom);
        });

        socket.on("game:result", (payload: unknown) => {
          if (!mounted) return;
          setResultState(payload);
          const nextRoom = roomFromPayload(payload);
          if (nextRoom) setRoom(nextRoom);
          addLog("Trò chơi đã có kết quả");
        });

        socket.on("error", (payload: unknown) => {
          if (!mounted) return;
          const message = String((payload as { message?: string }).message ?? "Lỗi không xác định");
          setErrorText(message);
          addLog(`Lỗi: ${message}`);
        });

        socket.connect();
      } catch (error) {
        if (!mounted) return;
        setErrorText(error instanceof Error ? error.message : "Không thể khởi tạo socket");
      }
    };

    void setup();

    return () => {
      mounted = false;
    };
  }, []);

  const emitWithAck = async (event: string, payload: Record<string, unknown>): Promise<AckResponse> => {
    const socket = await getLiXiSocket();
    return await new Promise<AckResponse>((resolve) => {
      socket.emit(event, payload, (response: unknown) => {
        resolve((response as AckResponse) ?? {});
      });
    });
  };

  const createRoom = async (): Promise<void> => {
    setErrorText("");
    const res = await emitWithAck("host:createRoom", { name: name.trim() || "Chủ phòng" });
    if (!res.ok) setErrorText(res.message ?? "Tạo phòng thất bại");
  };

  const joinRoom = async (): Promise<void> => {
    setErrorText("");
    const res = await emitWithAck("player:joinRoom", { roomId: roomIdInput.trim().toUpperCase(), name: name.trim() || "Người chơi" });
    if (!res.ok) setErrorText(res.message ?? "Vào phòng thất bại");
  };

  const startGame = async (): Promise<void> => {
    if (!roomId) return;
    setErrorText("");
    const options = selectedGame === "memory" ? { memory: { boardLength: memoryBoardLength } } : undefined;
    const res = await emitWithAck("host:startGame", { roomId, gameType: selectedGame, options });
    if (!res.ok) setErrorText(res.message ?? "Không thể bắt đầu trò chơi");
  };

  const endGame = async (): Promise<void> => {
    if (!roomId) return;
    setErrorText("");
    const res = await emitWithAck("host:endGame", { roomId });
    if (!res.ok) setErrorText(res.message ?? "Không thể kết thúc trò chơi");
  };

  const emitAction = (event: string, payload: Record<string, unknown>): void => {
    void (async () => {
      const socket = await getLiXiSocket();
      socket.emit(event, payload);
      addLog(`Đã gửi sự kiện ${event}`);
    })();
  };

  const reactionSignal = useMemo(() => {
    const state = (gameState as { gameState?: { signalTime?: number } })?.gameState;
    if (!state?.signalTime) return "Chưa có tín hiệu";
    const ms = Math.max(0, state.signalTime - Date.now());
    return ms > 0 ? `Tín hiệu sau ~${Math.ceil(ms / 100) / 10}s` : "ĐÃ CÓ TÍN HIỆU";
  }, [gameState]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lì xì nâng cao</h1>
        <Link href="/" className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
          Về Portal
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">Trạng thái kết nối: {connected ? "Đang kết nối" : "Mất kết nối"}</p>

          <div className="mt-4 space-y-3">
            <input className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn" />
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => void createRoom()} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-900">Tạo phòng (Host)</button>
              <div className="flex gap-2">
                <input className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 uppercase" value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())} placeholder="Mã phòng" />
                <button onClick={() => void joinRoom()} className="rounded-lg border border-cyan-300/60 px-4 py-2 font-semibold text-cyan-200">Vào</button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
            <p>Phòng: <span className="font-mono text-cyan-200">{roomId || "-"}</span></p>
            <p>Vai trò: <span className="font-semibold">{isHost ? "Chủ phòng" : canPlay ? "Người chơi" : "-"}</span></p>
            <p>Trạng thái: <span className="font-semibold">{room?.status ?? "-"}</span></p>
            <p>Game hiện tại: <span className="font-semibold">{room?.currentGame ?? "-"}</span></p>
          </div>

          {errorText && <div className="mt-3 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{errorText}</div>}

          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Danh sách người chơi</h2>
            <div className="space-y-2">
              {room?.players?.length ? room.players.map((p) => (
                <div key={p.playerId} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{p.name}</p>
                    <p className="text-xs text-slate-400">Độ trễ: {p.latency}ms</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${p.isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>{p.isOnline ? "Trực tuyến" : "Ngoại tuyến"}</span>
                </div>
              )) : <p className="text-sm text-slate-400">Chưa có người chơi.</p>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold">Chọn trò chơi</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {games.map((g) => (
              <button key={g.type} onClick={() => setSelectedGame(g.type)} className={`rounded-xl border p-3 text-left transition ${selectedGame === g.type ? g.color : "border-slate-700 bg-slate-900/50"}`}>
                <p className="font-semibold">{g.title}</p>
                <p className="mt-1 text-xs text-slate-300">{g.desc}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => void startGame()} disabled={!isHost || !canPlay} className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-900 disabled:opacity-50">Bắt đầu</button>
            <button onClick={() => void endGame()} disabled={!isHost || !canPlay} className="rounded-lg border border-amber-400/60 px-4 py-2 font-semibold text-amber-200 disabled:opacity-50">Kết thúc</button>
          </div>

          {selectedGame === "memory" && (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
              <p className="text-sm font-semibold text-emerald-200">Cấu hình board nhớ</p>
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="memory-board-length" className="text-sm text-slate-200">
                  Số ô trên board
                </label>
                <select
                  id="memory-board-length"
                  value={memoryBoardLength}
                  onChange={(e) => setMemoryBoardLength(Number(e.target.value))}
                  className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
                >
                  {[8, 12, 16, 20, 24, 30, 36].map((value) => (
                    <option key={value} value={value}>
                      {value} ô
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-xs text-slate-300">Mặc định 12 ô (6 cặp). Chỉ nhận số chẵn.</p>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">Bảng điều khiển trò chơi</h3>
            <GamePanelSwitch
              game={currentGame}
              reactionSignal={reactionSignal}
              disabled={!canPlay || (currentGame === "reaction" && !isHost)}
              onEmit={emitAction}
              gameState={gameState}
              playerId={playerId}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Trạng thái game</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-cyan-100">{pretty(gameState)}</pre>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Kết quả</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-100">{pretty(resultState)}</pre>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Nhật ký realtime</h3>
          <div className="mt-2 max-h-60 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">
            {logs.length ? logs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>Chưa có log.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

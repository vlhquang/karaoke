import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { Server } from "socket.io";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import type {
  AddSongPayload,
  ClientToServerEvents,
  CloseRoomPayload,
  QueueSong,
  RemoveSongPayload,
  RestoreSessionPayload,
  RoomMember,
  RoomSnapshot,
  RoomState,
  ServerToClientEvents,
  SetQueueLimitPayload,
  SkipSongPayload,
  LotoClientToServerEvents,
  LotoConfig,
  LotoCreateRoomPayload,
  LotoJoinRoomPayload,
  LotoStartGamePayload,
  LotoCallNumberPayload,
  LotoClaimWinPayload,
  LotoCloseRoomPayload,
  LotoToggleReadyPayload,
  LotoResetRoundPayload,
  LotoRoomSnapshot,
  LotoRoomState,
  LotoGameStatus
} from "@karaoke/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envCandidates = [
  resolve(__dirname, ".env"),
  resolve(__dirname, ".env.local"),
  resolve(__dirname, "../../.env"),
  resolve(__dirname, "../../.env.local")
];
for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const dev = process.env.NODE_ENV !== "production";
const host = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const createRoomSchema = z.object({
  displayName: z.string().trim().min(1).max(80)
});

const joinRoomSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6).regex(/^[A-Z0-9]{6}$/),
  displayName: z.string().trim().min(1).max(80)
});

const restoreSessionSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6).regex(/^[A-Z0-9]{6}$/),
  userId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(80)
});

const addSongSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6).regex(/^[A-Z0-9]{6}$/),
  videoId: z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/),
  title: z.string().trim().min(1).max(200),
  thumbnailUrl: z.string().url(),
  duration: z.string().trim().max(20)
});

const skipSongSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6).regex(/^[A-Z0-9]{6}$/),
  reason: z.enum(["manual", "ended"]).optional().default("manual")
});

const removeSongSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6).regex(/^[A-Z0-9]{6}$/),
  songId: z.string().uuid()
});

const closeRoomSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6).regex(/^[A-Z0-9]{6}$/)
});

const setQueueLimitSchema = z.object({
  roomCode: z.string().trim().toUpperCase().length(6).regex(/^[A-Z0-9]{6}$/),
  maxQueueSize: z.coerce.number().int().min(1).max(100)
});

type SocketUser = { userId: string; roomCode: string; displayName: string; role: "host" | "guest" };
type KaraokeSocket = Parameters<Server<ClientToServerEvents, ServerToClientEvents>["on"]>[1] extends (
  socket: infer T
) => void
  ? T & { data: { user?: SocketUser } }
  : never;

const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateRoomCode = (): string => {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

interface InternalRoom {
  roomCode: string;
  hostSessionId: string;
  createdAt: string;
  maxQueueSize: number;
  nowPlaying: QueueSong | null;
  queue: QueueSong[];
  members: Map<string, RoomMember>;
}

const rooms = new Map<string, InternalRoom>();

const roomState = (room: InternalRoom): RoomState => ({
  roomCode: room.roomCode,
  hostSessionId: room.hostSessionId,
  nowPlaying: room.nowPlaying,
  queueLength: room.queue.length,
  maxQueueSize: room.maxQueueSize,
  createdAt: room.createdAt
});

const snapshot = (room: InternalRoom): RoomSnapshot => ({
  room: roomState(room),
  nowPlaying: room.nowPlaying,
  queue: [...room.queue]
});

const alreadyInRoom = (room: InternalRoom, videoId: string): boolean =>
  room.nowPlaying?.videoId === videoId || room.queue.some((song) => song.videoId === videoId);

// ── Lô tô room data ──

interface LotoMember {
  userId: string;
  displayName: string;
  socketId: string;
  ready: boolean;
  bankingInfo?: { bankId: string; accountNo: string };
  board: number[][] | null;
}

interface LotoInternalRoom {
  roomCode: string;
  hostId: string;
  config: LotoConfig;
  calledNumbers: number[];
  currentNumber: number | null;
  gameStatus: LotoGameStatus;
  members: Map<string, LotoMember>;
  createdAt: string;
  autoCallTimer: ReturnType<typeof setInterval> | null;
}

const lotoRooms = new Map<string, LotoInternalRoom>();

const computeNearWin = (member: LotoMember, calledNumbers: number[]): { waitingNumber: number }[] => {
  if (!member.board || !member.ready) return [];
  const calledSet = new Set(calledNumbers);
  const results: { waitingNumber: number }[] = [];
  for (const row of member.board) {
    const rowNumbers = row.filter((n) => n > 0);
    if (rowNumbers.length === 0) continue;
    const missing = rowNumbers.filter((n) => !calledSet.has(n));
    if (missing.length === 1) {
      results.push({ waitingNumber: missing[0] });
    }
  }
  return results;
};

const lotoSnapshot = (room: LotoInternalRoom, forUserId?: string): LotoRoomSnapshot => {
  const snap: LotoRoomSnapshot = {
    room: {
      roomCode: room.roomCode,
      hostId: room.hostId,
      config: room.config,
      calledNumbers: [...room.calledNumbers],
      currentNumber: room.currentNumber,
      gameStatus: room.gameStatus,
      memberCount: room.members.size,
      readyCount: [...room.members.values()].filter((m) => m.ready).length,
      members: [...room.members.values()].map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        ready: member.ready,
        bankingInfo: member.bankingInfo,
        nearWinRows: computeNearWin(member, room.calledNumbers)
      })),
      createdAt: room.createdAt
    }
  };
  if (forUserId) {
    const member = room.members.get(forUserId);
    if (member?.board) {
      snap.myBoard = member.board;
    }
  }
  return snap;
};

const pickNextNumber = (room: LotoInternalRoom): number | null => {
  const max = room.config.maxNumber;
  const remaining: number[] = [];
  for (let i = 1; i <= max; i++) {
    if (!room.calledNumbers.includes(i)) {
      remaining.push(i);
    }
  }
  if (remaining.length === 0) return null;
  return remaining[Math.floor(Math.random() * remaining.length)];
};

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: true, methods: ["GET", "POST"] },
    transports: ["websocket", "polling"]
  });

  const emitRoomState = (roomCode: string): void => {
    const room = rooms.get(roomCode);
    if (!room) {
      return;
    }
    const state = snapshot(room);
    io.to(roomCode).emit("queue_updated", state);
    io.to(roomCode).emit("now_playing", state.nowPlaying);
  };

  io.on("connection", (socket: KaraokeSocket) => {
    socket.on("create_room", (payload, ack) => {
      try {
        const parsed = createRoomSchema.parse(payload);
        const hostUserId = randomUUID();

        let roomCode = "";
        for (let i = 0; i < 8; i += 1) {
          const nextCode = generateRoomCode();
          if (!rooms.has(nextCode)) {
            roomCode = nextCode;
            break;
          }
        }
        if (!roomCode) {
          ack({ ok: false, message: "Failed to allocate room code" });
          return;
        }

        const createdAt = new Date().toISOString();
        const hostMember: RoomMember = {
          userId: hostUserId,
          roomCode,
          displayName: parsed.displayName,
          role: "host",
          socketId: socket.id,
          createdAt
        };

        const room: InternalRoom = {
          roomCode,
          hostSessionId: hostUserId,
          createdAt,
          maxQueueSize: 10,
          nowPlaying: null,
          queue: [],
          members: new Map([[hostUserId, hostMember]])
        };

        rooms.set(roomCode, room);
        socket.join(roomCode);
        socket.data.user = { userId: hostUserId, roomCode, displayName: parsed.displayName, role: "host" };

        const snap = snapshot(room);
        socket.emit("room_created", snap);
        ack({ ok: true, roomCode, userId: hostUserId });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Create room failed" });
      }
    });

    socket.on("join_room", (payload, ack) => {
      try {
        const parsed = joinRoomSchema.parse(payload);
        const room = rooms.get(parsed.roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }

        const userId = randomUUID();
        const member: RoomMember = {
          userId,
          roomCode: parsed.roomCode,
          displayName: parsed.displayName,
          role: "guest",
          socketId: socket.id,
          createdAt: new Date().toISOString()
        };
        room.members.set(userId, member);

        socket.join(parsed.roomCode);
        socket.data.user = { userId, roomCode: parsed.roomCode, displayName: parsed.displayName, role: "guest" };

        const snap = snapshot(room);
        socket.emit("room_joined", snap);
        io.to(parsed.roomCode).emit("queue_updated", snap);
        ack({ ok: true, roomCode: parsed.roomCode, userId });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Join room failed" });
      }
    });

    socket.on("restore_session", (payload, ack) => {
      try {
        const parsed = restoreSessionSchema.parse(payload as RestoreSessionPayload);
        const room = rooms.get(parsed.roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }

        const member = room.members.get(parsed.userId);
        if (!member) {
          ack({ ok: false, message: "Session expired" });
          return;
        }

        member.socketId = socket.id;
        room.members.set(parsed.userId, member);

        socket.join(parsed.roomCode);
        socket.data.user = {
          userId: member.userId,
          roomCode: member.roomCode,
          displayName: member.displayName,
          role: member.role
        };

        const snap = snapshot(room);
        socket.emit("queue_updated", snap);
        socket.emit("now_playing", snap.nowPlaying);
        ack({ ok: true, roomCode: parsed.roomCode, userId: member.userId, role: member.role });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Restore session failed" });
      }
    });

    const handleAdd = (payload: AddSongPayload, ack: (response: { ok: true } | { ok: false; message: string }) => void, isPriority: boolean) => {
      try {
        const parsed = addSongSchema.parse(payload);
        const user = socket.data.user;
        if (!user || user.roomCode !== parsed.roomCode) {
          ack({ ok: false, message: "Join room first" });
          return;
        }

        const room = rooms.get(parsed.roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }

        if (room.queue.length >= room.maxQueueSize) {
          ack({ ok: false, message: `Queue limit reached (${room.maxQueueSize})` });
          return;
        }
        if (alreadyInRoom(room, parsed.videoId)) {
          ack({ ok: false, message: "Video already in this room" });
          return;
        }

        const song: QueueSong = {
          id: randomUUID(),
          roomCode: parsed.roomCode,
          videoId: parsed.videoId,
          title: parsed.title,
          thumbnailUrl: parsed.thumbnailUrl,
          duration: parsed.duration,
          addedByUserId: user.userId,
          addedByName: user.displayName,
          isPriority,
          createdAt: new Date().toISOString()
        };

        if (!room.nowPlaying) {
          room.nowPlaying = song;
        } else if (isPriority) {
          room.queue.unshift(song);
        } else {
          room.queue.push(song);
        }

        emitRoomState(parsed.roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Add song failed" });
      }
    };

    socket.on("add_song", (payload, ack) => handleAdd(payload, ack, false));
    socket.on("add_priority_song", (payload, ack) => handleAdd(payload, ack, true));

    socket.on("skip_song", (payload, ack) => {
      try {
        const parsed = skipSongSchema.parse(payload as SkipSongPayload);
        const user = socket.data.user;
        if (!user || user.roomCode !== parsed.roomCode) {
          ack({ ok: false, message: "Join room first" });
          return;
        }
        const room = rooms.get(parsed.roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }
        if (room.hostSessionId !== user.userId) {
          ack({ ok: false, message: "Only host can perform this action" });
          return;
        }

        room.nowPlaying = room.queue.shift() ?? null;
        emitRoomState(parsed.roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Skip failed" });
      }
    });

    socket.on("remove_song", (payload, ack) => {
      try {
        const parsed = removeSongSchema.parse(payload as RemoveSongPayload);
        const user = socket.data.user;
        if (!user || user.roomCode !== parsed.roomCode) {
          ack({ ok: false, message: "Join room first" });
          return;
        }
        const room = rooms.get(parsed.roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }
        if (room.hostSessionId !== user.userId) {
          ack({ ok: false, message: "Only host can perform this action" });
          return;
        }

        const before = room.queue.length;
        room.queue = room.queue.filter((song) => song.id !== parsed.songId);
        if (room.queue.length === before) {
          ack({ ok: false, message: "Song not found in queue" });
          return;
        }

        emitRoomState(parsed.roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Remove failed" });
      }
    });

    socket.on("leave_room", (payload, ack) => {
      try {
        const roomCode = String((payload as { roomCode?: string }).roomCode ?? "").toUpperCase().trim();
        if (!roomCode) {
          ack({ ok: false, message: "Invalid room" });
          return;
        }
        socket.leave(roomCode);
        if (socket.data.user?.roomCode === roomCode) {
          socket.data.user = undefined;
        }
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Leave room failed" });
      }
    });

    socket.on("close_room", (payload, ack) => {
      try {
        const parsed = closeRoomSchema.parse(payload as CloseRoomPayload);
        const user = socket.data.user;
        if (!user || user.roomCode !== parsed.roomCode) {
          ack({ ok: false, message: "Join room first" });
          return;
        }

        const room = rooms.get(parsed.roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }
        if (room.hostSessionId !== user.userId) {
          ack({ ok: false, message: "Only host can close room" });
          return;
        }

        io.to(parsed.roomCode).emit("room_closed", { roomCode: parsed.roomCode, message: "Host closed this room" });
        rooms.delete(parsed.roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Close room failed" });
      }
    });

    socket.on("set_queue_limit", (payload, ack) => {
      try {
        const parsed = setQueueLimitSchema.parse(payload as SetQueueLimitPayload);
        const user = socket.data.user;
        if (!user || user.roomCode !== parsed.roomCode) {
          ack({ ok: false, message: "Join room first" });
          return;
        }
        const room = rooms.get(parsed.roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }
        if (room.hostSessionId !== user.userId) {
          ack({ ok: false, message: "Only host can configure queue limit" });
          return;
        }
        if (parsed.maxQueueSize < room.queue.length) {
          ack({ ok: false, message: `Current queue has ${room.queue.length} songs. Remove songs before lowering limit.` });
          return;
        }

        room.maxQueueSize = parsed.maxQueueSize;
        emitRoomState(parsed.roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Set queue limit failed" });
      }
    });

    // ── Lô tô socket handlers ──

    const lotoRoomPrefix = "loto:";

    const emitLotoState = (roomCode: string): void => {
      const room = lotoRooms.get(roomCode);
      if (!room) return;
      io.to(lotoRoomPrefix + roomCode).emit("loto_state_updated", lotoSnapshot(room));
    };

    const startAutoCall = (room: LotoInternalRoom): void => {
      stopAutoCall(room);
      room.autoCallTimer = setInterval(() => {
        const num = pickNextNumber(room);
        if (num === null) {
          room.gameStatus = "finished";
          stopAutoCall(room);
          emitLotoState(room.roomCode);
          return;
        }
        room.currentNumber = num;
        room.calledNumbers.push(num);
        io.to(lotoRoomPrefix + room.roomCode).emit("loto_number_called", {
          number: num,
          calledNumbers: [...room.calledNumbers]
        });
        emitLotoState(room.roomCode);
      }, room.config.intervalSeconds * 1000);
    };

    const stopAutoCall = (room: LotoInternalRoom): void => {
      if (room.autoCallTimer) {
        clearInterval(room.autoCallTimer);
        room.autoCallTimer = null;
      }
    };

    socket.on("loto_create_room", (payload: LotoCreateRoomPayload, ack) => {
      try {
        const displayName = String(payload.displayName ?? "").trim() || "Host";
        const config = payload.config;
        if (!config || ![60, 90].includes(config.maxNumber)) {
          ack({ ok: false, message: "maxNumber must be 60 or 90" });
          return;
        }
        const interval = Number(config.intervalSeconds);
        if (!Number.isFinite(interval) || interval < 1 || interval > 60) {
          ack({ ok: false, message: "intervalSeconds must be between 1 and 60" });
          return;
        }
        if (payload.bankingInfo && (!payload.bankingInfo.bankId || !payload.bankingInfo.accountNo)) {
          ack({ ok: false, message: "Invalid banking info" });
          return;
        }

        const hostUserId = randomUUID();
        let roomCode = "";
        for (let i = 0; i < 8; i++) {
          const candidate = generateRoomCode();
          if (!lotoRooms.has(candidate)) {
            roomCode = candidate;
            break;
          }
        }
        if (!roomCode) {
          ack({ ok: false, message: "Failed to allocate room code" });
          return;
        }

        const room: LotoInternalRoom = {
          roomCode,
          hostId: hostUserId,
          config: {
            maxNumber: config.maxNumber as 60 | 90,
            intervalSeconds: interval,
            voiceEnabled: Boolean(config.voiceEnabled)
          },
          calledNumbers: [],
          currentNumber: null,
          gameStatus: "waiting",
          members: new Map([[hostUserId, {
            userId: hostUserId,
            displayName,
            socketId: socket.id,
            ready: false,
            bankingInfo: payload.bankingInfo,
            board: null
          }]]),
          createdAt: new Date().toISOString(),
          autoCallTimer: null
        };

        lotoRooms.set(roomCode, room);
        socket.join(lotoRoomPrefix + roomCode);
        socket.data.user = { userId: hostUserId, roomCode, displayName, role: "host" };

        socket.emit("loto_room_created", lotoSnapshot(room));
        ack({ ok: true, roomCode, userId: hostUserId });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Create loto room failed" });
      }
    });

    socket.on("loto_join_room", (payload: LotoJoinRoomPayload, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const displayName = String(payload.displayName ?? "").trim() || "Guest";
        const room = lotoRooms.get(roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }
        if (payload.bankingInfo && (!payload.bankingInfo.bankId || !payload.bankingInfo.accountNo)) {
          ack({ ok: false, message: "Invalid banking info" });
          return;
        }

        const userId = randomUUID();
        room.members.set(userId, {
          userId,
          displayName,
          socketId: socket.id,
          ready: false,
          bankingInfo: payload.bankingInfo,
          board: null
        });

        socket.join(lotoRoomPrefix + roomCode);
        socket.data.user = { userId, roomCode, displayName, role: "guest" };

        socket.emit("loto_room_joined", lotoSnapshot(room));
        emitLotoState(roomCode);
        ack({ ok: true, roomCode, userId });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Join loto room failed" });
      }
    });

    socket.on("loto_start_game", (payload: LotoStartGamePayload, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const room = lotoRooms.get(roomCode);
        if (!room) { ack({ ok: false, message: "Room not found" }); return; }
        const user = socket.data.user;
        if (!user || room.hostId !== user.userId) {
          ack({ ok: false, message: "Only host can start the game" });
          return;
        }
        if (room.gameStatus === "playing") {
          ack({ ok: false, message: "Game is already playing" });
          return;
        }
        const hasReadyPlayer = [...room.members.values()].some((member) => member.ready);
        if (!hasReadyPlayer) {
          ack({ ok: false, message: "At least one player must be ready" });
          return;
        }

        room.gameStatus = "playing";
        startAutoCall(room);
        emitLotoState(roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Start game failed" });
      }
    });

    socket.on("loto_pause_game", (payload: { roomCode: string }, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const room = lotoRooms.get(roomCode);
        if (!room) { ack({ ok: false, message: "Room not found" }); return; }
        const user = socket.data.user;
        if (!user || room.hostId !== user.userId) {
          ack({ ok: false, message: "Only host can pause" });
          return;
        }

        room.gameStatus = "paused";
        stopAutoCall(room);
        emitLotoState(roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Pause failed" });
      }
    });

    socket.on("loto_call_number", (payload: LotoCallNumberPayload, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const room = lotoRooms.get(roomCode);
        if (!room) { ack({ ok: false, message: "Room not found" }); return; }
        const user = socket.data.user;
        if (!user || room.hostId !== user.userId) {
          ack({ ok: false, message: "Only host can call numbers" });
          return;
        }
        if (room.gameStatus !== "playing") {
          ack({ ok: false, message: "Game is not in playing state" });
          return;
        }

        const num = pickNextNumber(room);
        if (num === null) {
          room.gameStatus = "finished";
          stopAutoCall(room);
          emitLotoState(roomCode);
          ack({ ok: false, message: "All numbers have been called" });
          return;
        }

        room.currentNumber = num;
        room.calledNumbers.push(num);
        io.to(lotoRoomPrefix + roomCode).emit("loto_number_called", {
          number: num,
          calledNumbers: [...room.calledNumbers]
        });
        emitLotoState(roomCode);
        ack({ ok: true, number: num });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Call number failed" });
      }
    });

    socket.on("loto_claim_win", (payload: LotoClaimWinPayload, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const room = lotoRooms.get(roomCode);
        if (!room) { ack({ ok: false, message: "Room not found" }); return; }
        const user = socket.data.user;
        if (!user || user.roomCode !== roomCode) {
          ack({ ok: false, message: "Join room first" });
          return;
        }
        if (room.gameStatus !== "playing") {
          ack({ ok: false, message: "Game is not in playing state" });
          return;
        }
        const member = room.members.get(user.userId);
        if (!member || !member.ready) {
          ack({ ok: false, message: "Only ready players can claim win" });
          return;
        }

        room.gameStatus = "finished";
        stopAutoCall(room);
        io.to(lotoRoomPrefix + roomCode).emit("loto_game_won", {
          winnerName: member.displayName,
          roomCode,
          betAmount: room.config.betAmount,
          winnerBankingInfo: member.bankingInfo
        });
        emitLotoState(roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Claim win failed" });
      }
    });

    socket.on("loto_close_room", (payload: LotoCloseRoomPayload, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const room = lotoRooms.get(roomCode);
        if (!room) { ack({ ok: false, message: "Room not found" }); return; }
        const user = socket.data.user;
        if (!user || room.hostId !== user.userId) {
          ack({ ok: false, message: "Only host can close room" });
          return;
        }

        stopAutoCall(room);
        io.to(lotoRoomPrefix + roomCode).emit("loto_room_closed", { roomCode, message: "Host closed this room" });
        lotoRooms.delete(roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Close loto room failed" });
      }
    });

    socket.on("loto_toggle_ready", (payload: LotoToggleReadyPayload, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const ready = Boolean(payload.ready);
        const room = lotoRooms.get(roomCode);
        if (!room) { ack({ ok: false, message: "Room not found" }); return; }
        const user = socket.data.user;
        if (!user || user.roomCode !== roomCode) {
          ack({ ok: false, message: "Join room first" });
          return;
        }
        const member = room.members.get(user.userId);
        if (!member) {
          ack({ ok: false, message: "Member not found" });
          return;
        }
        member.ready = ready;
        room.members.set(member.userId, member);
        emitLotoState(roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Toggle ready failed" });
      }
    });

    socket.on("loto_submit_board", (payload: { roomCode: string; board: number[][] }, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const room = lotoRooms.get(roomCode);
        if (!room) { ack({ ok: false, message: "Room not found" }); return; }
        const user = socket.data.user;
        if (!user || user.roomCode !== roomCode) {
          ack({ ok: false, message: "Join room first" });
          return;
        }
        const member = room.members.get(user.userId);
        if (!member) {
          ack({ ok: false, message: "Member not found" });
          return;
        }
        if (!Array.isArray(payload.board) || payload.board.length === 0 || payload.board.length > 9) {
          ack({ ok: false, message: "Invalid board" });
          return;
        }
        member.board = payload.board;
        room.members.set(member.userId, member);
        emitLotoState(roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Submit board failed" });
      }
    });

    socket.on("loto_restore_session", (payload: { roomCode: string; userId: string }, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const userId = String(payload.userId ?? "");
        const room = lotoRooms.get(roomCode);
        if (!room) {
          ack({ ok: false, message: "Room not found" });
          return;
        }
        const member = room.members.get(userId);
        if (!member) {
          ack({ ok: false, message: "Session expired" });
          return;
        }
        member.socketId = socket.id;
        room.members.set(userId, member);
        const role = room.hostId === userId ? "host" : "guest";
        socket.join(lotoRoomPrefix + roomCode);
        socket.data.user = { userId, roomCode, displayName: member.displayName, role };
        const snap = lotoSnapshot(room, userId);
        socket.emit("loto_state_updated", snap);
        ack({ ok: true, roomCode, userId, displayName: member.displayName, role });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Restore session failed" });
      }
    });

    socket.on("loto_reset_round", (payload: LotoResetRoundPayload, ack) => {
      try {
        const roomCode = String(payload.roomCode ?? "").trim().toUpperCase();
        const room = lotoRooms.get(roomCode);
        if (!room) { ack({ ok: false, message: "Room not found" }); return; }
        const user = socket.data.user;
        if (!user || room.hostId !== user.userId) {
          ack({ ok: false, message: "Only host can reset round" });
          return;
        }

        room.calledNumbers = [];
        room.currentNumber = null;
        room.gameStatus = "waiting";
        for (const m of room.members.values()) {
          m.board = null;
        }
        stopAutoCall(room);
        emitLotoState(roomCode);
        ack({ ok: true });
      } catch (error) {
        ack({ ok: false, message: error instanceof Error ? error.message : "Reset round failed" });
      }
    });

    socket.on("disconnect", () => {
      const user = socket.data.user;
      if (user && (user.role === "host" || user.role === "guest")) {
        const roomCode = user.roomCode;
        const lotoRoom = lotoRooms.get(roomCode);
        if (lotoRoom) {
          lotoRoom.members.delete(user.userId);
          if (lotoRoom.members.size === 0) {
            lotoRooms.delete(roomCode);
          } else {
            emitLotoState(roomCode);
          }
        }
      }
    });
  });

  httpServer.listen(port, host, () => {
    console.log(`> Ready on http://${host}:${port}`);
  });
});

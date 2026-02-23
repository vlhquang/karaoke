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
  SkipSongPayload
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
  });

  httpServer.listen(port, host, () => {
    console.log(`> Ready on http://${host}:${port}`);
  });
});

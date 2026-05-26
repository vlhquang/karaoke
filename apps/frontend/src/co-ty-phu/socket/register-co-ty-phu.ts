import type { Namespace } from "socket.io";
import { maxRoomPlayers } from "../data";
import {
  applyGameAction,
  createInitialGame,
  getCurrentPlayer,
  type GameAction,
  type GameState,
} from "../game";

interface RoomPlayer {
  id: string;
  name: string;
  socketId: string;
  connected: boolean;
}

interface Room {
  code: string;
  hostSocketId: string;
  status: "lobby" | "playing" | "finished";
  players: RoomPlayer[];
  game: GameState | null;
}

const rooms = new Map<string, Room>();
let coTyPhuNamespace: Namespace | null = null;

export function registerCoTyPhuNamespace(io: Namespace): void {
  coTyPhuNamespace = io;

  io.on("connection", (socket) => {
  socket.on("room:create", (payload: { playerName?: string }, ack) => {
    const code = createRoomCode();
    const playerName = normalizeName(payload?.playerName);
    const room: Room = {
      code,
      hostSocketId: socket.id,
      status: "lobby",
      players: [
        {
          id: "p1",
          name: playerName,
          socketId: socket.id,
          connected: true,
        },
      ],
      game: null,
    };

    rooms.set(code, room);
    socket.join(code);
    ack?.({ ok: true, room: toRoomView(room, socket.id) });
    emitRoomUpdate(room);
  });

  socket.on("room:join", (payload: { code?: string; playerName?: string }, ack) => {
    const code = payload?.code?.trim().toUpperCase() ?? "";
    const room = rooms.get(code);

    if (!room) {
      ack?.({ ok: false, error: "Không tìm thấy phòng." });
      return;
    }

    if (room.status !== "lobby") {
      ack?.({ ok: false, error: "Phòng đã bắt đầu." });
      return;
    }

    if (room.players.length >= maxRoomPlayers) {
      ack?.({ ok: false, error: "Phòng đã đủ 6 người chơi." });
      return;
    }

    const player: RoomPlayer = {
      id: `p${room.players.length + 1}`,
      name: createUniqueName(normalizeName(payload?.playerName), room.players.map((candidate) => candidate.name)),
      socketId: socket.id,
      connected: true,
    };

    room.players.push(player);
    socket.join(code);
    ack?.({ ok: true, room: toRoomView(room, socket.id) });
    emitRoomUpdate(room);
  });

  socket.on("room:start", (payload: { code?: string }, ack) => {
    const room = getRoom(payload?.code);
    if (!room) {
      ack?.({ ok: false, error: "Không tìm thấy phòng." });
      return;
    }

    if (room.hostSocketId !== socket.id) {
      ack?.({ ok: false, error: "Chỉ host được bắt đầu phòng." });
      return;
    }

    if (room.players.length < 2) {
      ack?.({ ok: false, error: "Cần ít nhất 2 người chơi." });
      return;
    }

    room.status = "playing";
    room.game = createInitialGame({
      playerNames: room.players.map((player) => player.name),
      humanPlayerCount: room.players.length,
      roomCode: room.code,
    });

    ack?.({ ok: true });
    emitRoomUpdate(room);
    io.to(room.code).emit("game:update", room.game);
  });

  socket.on("room:restart", (payload: { code?: string }, ack) => {
    const room = getRoom(payload?.code);
    if (!room) {
      ack?.({ ok: false, error: "Không tìm thấy phòng." });
      return;
    }

    if (room.hostSocketId !== socket.id) {
      ack?.({ ok: false, error: "Chỉ host được chơi lại phòng." });
      return;
    }

    if (room.players.length < 2) {
      ack?.({ ok: false, error: "Cần ít nhất 2 người chơi." });
      return;
    }

    room.status = "playing";
    room.game = createInitialGame({
      playerNames: room.players.map((player) => player.name),
      humanPlayerCount: room.players.length,
      roomCode: room.code,
    });

    ack?.({ ok: true });
    emitRoomUpdate(room);
    io.to(room.code).emit("game:update", room.game);
  });

  socket.on("room:leave", (payload: { code?: string }, ack) => {
    const room = getRoom(payload?.code);
    if (!room) {
      ack?.({ ok: true });
      return;
    }

    const playerIndex = room.players.findIndex((candidate) => candidate.socketId === socket.id);
    if (playerIndex === -1) {
      ack?.({ ok: true });
      return;
    }

    if (room.status === "lobby") {
      room.players.splice(playerIndex, 1);
    } else {
      room.players[playerIndex].connected = false;
    }

    socket.leave(room.code);
    migrateHost(room);
    ack?.({ ok: true });

    if (shouldDeleteRoom(room)) {
      rooms.delete(room.code);
      return;
    }

    emitRoomUpdate(room);
  });

  socket.on("room:state", (payload: { code?: string }, ack) => {
    const room = getRoom(payload?.code);
    if (!room) {
      ack?.({ ok: false, error: "Không tìm thấy phòng." });
      return;
    }

    ack?.({ ok: true, room: toRoomView(room, socket.id), game: room.game });
  });

  socket.on("game:action", (payload: { code?: string; action?: GameAction }, ack) => {
    const room = getRoom(payload?.code);
    if (!room || !room.game || room.status !== "playing") {
      ack?.({ ok: false, error: "Phòng chưa sẵn sàng." });
      return;
    }

    const player = room.players.find((candidate) => candidate.socketId === socket.id);
    const currentPlayer = getCurrentPlayer(room.game);
    if (!player || !currentPlayer || currentPlayer.id !== player.id) {
      ack?.({ ok: false, error: "Chưa đến lượt của bạn." });
      return;
    }

    if (!payload.action) {
      ack?.({ ok: false, error: "Action không hợp lệ." });
      return;
    }

    room.game = applyGameAction(room.game, payload.action);
    if (room.game.phase === "gameOver") {
      room.status = "finished";
    }

    ack?.({ ok: true });
    emitRoomUpdate(room);
    io.to(room.code).emit("game:update", room.game);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const player = room.players.find((candidate) => candidate.socketId === socket.id);
      if (!player) {
        continue;
      }

      player.connected = false;
      migrateHost(room);
      if (shouldDeleteRoom(room)) {
        rooms.delete(room.code);
        continue;
      }
      emitRoomUpdate(room);
    }
  });
  });
}

function getRoom(code?: string): Room | null {
  if (!code) {
    return null;
  }
  return rooms.get(code.trim().toUpperCase()) ?? null;
}

function toRoomView(room: Room, viewerSocketId?: string) {
  const viewer = room.players.find((player) => player.socketId === viewerSocketId);
  return {
    code: room.code,
    status: room.status,
    maxPlayers: maxRoomPlayers,
    ownPlayerId: viewer?.id ?? null,
    isHost: viewerSocketId ? room.hostSocketId === viewerSocketId : false,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected,
      isHost: player.socketId === room.hostSocketId,
    })),
  };
}

function emitRoomUpdate(room: Room) {
  if (!coTyPhuNamespace) {
    return;
  }

  for (const player of room.players) {
    coTyPhuNamespace.to(player.socketId).emit("room:update", toRoomView(room, player.socketId));
  }
}

function migrateHost(room: Room) {
  const host = room.players.find((player) => player.socketId === room.hostSocketId);
  if (host?.connected) {
    return;
  }

  const nextHost = room.players.find((player) => player.connected) ?? room.players[0];
  if (nextHost) {
    room.hostSocketId = nextHost.socketId;
  }
}

function shouldDeleteRoom(room: Room): boolean {
  return room.players.length === 0 || room.players.every((player) => !player.connected);
}

function createRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function normalizeName(name?: string): string {
  const trimmed = name?.trim();
  return trimmed || "Người chơi";
}

function createUniqueName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) {
    return name;
  }

  let suffix = 2;
  while (existingNames.includes(`${name} ${suffix}`)) {
    suffix += 1;
  }
  return `${name} ${suffix}`;
}

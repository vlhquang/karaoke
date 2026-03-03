import { v4 as uuidv4 } from "uuid";
import type { GameType, Player, Room, StartGameOptions } from "../types";
import { AppError } from "../utils/errors";
import { liXiConfig } from "../config/env";

const toRoomId = (): string => uuidv4().slice(0, 6).toUpperCase();

export class RoomService {
  private readonly rooms = new Map<string, Room>();

  createRoom(hostName: string, hostSocketId: string, victoryImageDataUrl?: string): { room: Room; hostPlayer: Player } {
    const roomId = toRoomId();
    const hostPlayer: Player = {
      playerId: uuidv4(),
      name: hostName,
      socketId: hostSocketId,
      score: 0,
      latency: 0,
      isOnline: true,
      lastActionAt: 0,
      ready: false,
      victoryImageDataUrl
    };

    const room: Room = {
      roomId,
      hostId: hostPlayer.playerId,
      players: new Map([[hostPlayer.playerId, hostPlayer]]),
      selectedGame: null,
      selectedGameOptions: null,
      countdownEndsAt: null,
      currentGame: null,
      gameState: null,
      status: "waiting",
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    return { room, hostPlayer };
  }

  joinRoom(roomId: string, name: string, socketId: string, victoryImageDataUrl?: string): { room: Room; player: Player } {
    const room = this.getRoom(roomId);
    const player: Player = {
      playerId: uuidv4(),
      name,
      socketId,
      score: 0,
      latency: 0,
      isOnline: true,
      lastActionAt: 0,
      ready: false,
      victoryImageDataUrl
    };
    room.players.set(player.playerId, player);
    return { room, player };
  }

  restorePlayer(roomId: string, playerId: string, socketId: string): { room: Room; player: Player } {
    const room = this.getRoom(roomId);
    const player = this.getPlayer(room, playerId);
    player.socketId = socketId;
    player.isOnline = true;
    return { room, player };
  }

  getRoom(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    return room;
  }

  getPlayer(room: Room, playerId: string): Player {
    const player = room.players.get(playerId);
    if (!player) {
      throw new AppError("Player not in room", 403);
    }
    return player;
  }

  getWinnerAnnouncement(room: Room, winnerId: string): { playerId: string; name: string; victoryImageDataUrl?: string } {
    const winner = this.getPlayer(room, winnerId);
    return {
      playerId: winner.playerId,
      name: winner.name,
      victoryImageDataUrl: winner.victoryImageDataUrl
    };
  }

  ensureHost(room: Room, playerId: string): void {
    if (room.hostId !== playerId) {
      throw new AppError("Only host can perform this action", 403);
    }
  }

  ensureGameActive(room: Room): void {
    if (room.status !== "playing" || !room.currentGame || !room.gameState) {
      throw new AppError("Game is not active", 400);
    }
  }

  markDisconnected(socketId: string): void {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (player.socketId === socketId) {
          player.isOnline = false;
        }
      }
    }
  }

  setLatency(roomId: string, playerId: string, latency: number): void {
    const room = this.getRoom(roomId);
    const player = this.getPlayer(room, playerId);
    player.latency = latency;
  }

  setPlayerReady(room: Room, playerId: string, ready: boolean): void {
    const player = this.getPlayer(room, playerId);
    player.ready = ready;
  }

  setSelectedGame(room: Room, gameType: GameType, options?: StartGameOptions): void {
    room.selectedGame = gameType;
    room.selectedGameOptions = options ?? null;
  }

  areAllOnlinePlayersReady(room: Room): boolean {
    const onlinePlayers = [...room.players.values()].filter((player) => player.isOnline);
    if (onlinePlayers.length === 0) {
      return false;
    }
    return onlinePlayers.every((player) => player.ready);
  }

  removePlayer(room: Room, playerId: string): void {
    if (room.hostId === playerId) {
      throw new AppError("Cannot kick host", 400);
    }
    room.players.delete(playerId);
  }

  validateAction(room: Room, player: Player, now: number): void {
    if (player.latency > liXiConfig.maxLatencyMs) {
      throw new AppError("Latency too high", 429);
    }
    if (now - player.lastActionAt < liXiConfig.minActionIntervalMs) {
      throw new AppError("Rate limited", 429);
    }
    player.lastActionAt = now;
  }

  startGame(room: Room, gameType: GameType, initialState: object): void {
    room.currentGame = gameType;
    room.status = "playing";
    room.gameState = initialState;
    room.countdownEndsAt = null;

    // Bot injection for solo testing
    const onlinePlayers = [...room.players.values()].filter((p) => p.isOnline);
    if (onlinePlayers.length === 1) {
      const botPlayer: Player = {
        playerId: "bot-player-id",
        name: "Máy (Bot)",
        socketId: "bot-socket-id",
        score: 0,
        latency: 0,
        isOnline: true,
        lastActionAt: 0,
        ready: true,
        victoryImageDataUrl: undefined
      };
      room.players.set(botPlayer.playerId, botPlayer);
    }
  }

  endGame(room: Room): void {
    room.status = "finished";
    room.countdownEndsAt = null;
  }

  resetToWaiting(room: Room): void {
    room.status = "waiting";
    room.countdownEndsAt = null;
    room.currentGame = null;
    room.gameState = null;
    // Remove bot if present
    room.players.delete("bot-player-id");
    for (const player of room.players.values()) {
      player.ready = false;
    }
  }

  getActiveRooms(): Room[] {
    return Array.from(this.rooms.values()).filter((r) => r.status === "playing");
  }

  listRooms(): Array<{ roomId: string; status: string; players: number; createdAt: number }> {
    return [...this.rooms.values()].map((room) => ({
      roomId: room.roomId,
      status: room.status,
      players: room.players.size,
      createdAt: room.createdAt
    }));
  }

  cleanupExpiredRooms(now: number): void {
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.createdAt > liXiConfig.roomTtlMs) {
        this.rooms.delete(roomId);
      }
    }
  }
}

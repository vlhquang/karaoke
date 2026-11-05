import { randomInt, randomUUID } from "node:crypto";
import type { Namespace } from "socket.io";
import { z } from "zod";
import { DrawingRoom, type Player } from "./engine";
import { aiSimilarity } from "./matching";
import { CATEGORIES, type Reply, type Settings } from "./types";
import { hasVoiceRelay, voiceIceServers } from "./voice-config";

const settingsSchema = z.object({
  rounds: z.number().int().min(1).max(5), duration: z.union([z.literal(60), z.literal(90), z.literal(120)]),
  preparation: z.union([z.literal(0), z.literal(3), z.literal(5), z.literal(10), z.literal(15)]).default(5),
  voiceEnabled: z.boolean().default(false),
  difficulty: z.enum(["easy", "medium", "mixed"]), category: z.string().refine(value => value === "all" || CATEGORIES.includes(value as typeof CATEGORIES[number])),
  judging: z.enum(["hybrid", "manual"]), hints: z.boolean(),
});
const nameSchema = z.string().trim().min(1, "Nhập tên của bạn.").max(30, "Tên tối đa 30 ký tự.");
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/, "Mã phòng gồm 6 chữ và số.");
const strokeSchema = z.object({
  id: z.string().min(1).max(60), color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  width: z.union([z.literal(4), z.literal(10), z.literal(20), z.literal(32)]),
  points: z.array(z.object({ x: z.number().finite().min(0).max(1000), y: z.number().finite().min(0).max(650) })).min(1).max(64),
});
type Identity = { code: string; playerId: string };

export function registerDrawingNamespace(namespace: Namespace) {
  const rooms = new Map<string, DrawingRoom>();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const broadcast = (room: DrawingRoom) => {
    for (const player of room.players) if (player.connected && player.socketId) namespace.to(player.socketId).emit("room:state", room.view(player.id));
  };
  const createCode = () => {
    let code: string;
    do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(""); } while (rooms.has(code));
    return code;
  };
  namespace.on("connection", socket => {
    let counter = 0;
    let windowAt = Date.now();
    let createAttempts = 0;
    let createWindowAt = Date.now();
    const current = (): { room: DrawingRoom; player: Player } => {
      const identity = socket.data.drawing as Identity | undefined;
      const room = identity && rooms.get(identity.code);
      const player = room?.players.find(p => p.id === identity?.playerId && p.socketId === socket.id && !p.kicked);
      if (!room || !player) throw new Error("Bạn chưa ở trong phòng. Hãy vào lại phòng.");
      if (room.tick()) broadcast(room);
      return { room, player };
    };
    const handle = (event: string, operation: (payload: unknown) => Reply | void) => {
      socket.on(event, (payload: unknown, ack?: (result: Reply) => void) => {
        try {
          if (Date.now() - windowAt >= 1000) { counter = 0; windowAt = Date.now(); }
          if (++counter > 100) throw new Error("Thao tác hơi nhanh. Hãy thử lại sau một giây.");
          const result = operation(payload);
          if (typeof ack === "function") ack(result ?? { ok: true });
        } catch (error) {
          const message = error instanceof z.ZodError ? error.issues[0]?.message ?? "Dữ liệu không hợp lệ." : error instanceof Error ? error.message : "Không thể thực hiện thao tác. Hãy thử lại.";
          if (typeof ack === "function") ack({ ok: false, error: message });
        }
      });
    };
    const enter = (room: DrawingRoom, player: Player): Reply => {
      socket.data.drawing = { code: room.code, playerId: player.id } satisfies Identity;
      socket.join(room.code);
      broadcast(room);
      return { ok: true, session: { code: room.code, playerId: player.id, token: player.token } };
    };
    const requireNotInRoom = () => {
      if (socket.data.drawing) throw new Error("Hãy rời phòng hiện tại trước.");
    };
    handle("room:create", payload => {
      requireNotInRoom();
      if (Date.now() - createWindowAt >= 60000) { createAttempts = 0; createWindowAt = Date.now(); }
      if (++createAttempts > 5 || rooms.size >= 500) throw new Error("Chưa thể tạo thêm phòng. Hãy thử lại sau.");
      const data = z.object({ name: nameSchema, settings: settingsSchema.optional() }).parse(payload);
      const room = new DrawingRoom(createCode());
      if (data.settings) room.settings = data.settings as Settings;
      rooms.set(room.code, room);
      return enter(room, room.addPlayer(data.name, socket.id));
    });
    handle("room:join", payload => {
      requireNotInRoom();
      const data = z.object({ name: nameSchema, code: codeSchema }).parse(payload);
      const room = rooms.get(data.code);
      if (!room) throw new Error("Không tìm thấy phòng. Kiểm tra lại mã mời nhé.");
      room.tick();
      return enter(room, room.addPlayer(data.name, socket.id));
    });
    handle("room:restore", payload => {
      requireNotInRoom();
      const data = z.object({ code: codeSchema, playerId: z.string().uuid(), token: z.string().uuid() }).parse(payload);
      const room = rooms.get(data.code);
      if (!room) throw new Error("Phòng đã hết hạn. Hãy tạo hoặc vào phòng mới.");
      room.tick();
      const previous = room.players.find(p => p.id === data.playerId && p.token === data.token && !p.kicked);
      const previousSocket = previous?.socketId && namespace.sockets.get(previous.socketId);
      const player = room.restore(data.playerId, data.token, socket.id);
      if (previousSocket && previousSocket.id !== socket.id) {
        delete previousSocket.data.drawing;
        previousSocket.leave(room.code);
        previousSocket.emit("session:ended", "Phiên chơi đã được mở trong một cửa sổ khác.");
      }
      return enter(room, player);
    });
    handle("room:ready", () => { const { room, player } = current(); room.ready(player.id); broadcast(room); });
    handle("room:sync", () => { const { room, player } = current(); socket.emit("room:state", room.view(player.id)); });
    handle("room:settings", payload => { const { room, player } = current(); room.configure(player.id, settingsSchema.parse(payload) as Settings); broadcast(room); });
    handle("room:start", () => { const { room, player } = current(); room.start(player.id); broadcast(room); });
    handle("room:rematch", () => { const { room, player } = current(); room.rematch(player.id); broadcast(room); });
    handle("room:pause", () => { const { room, player } = current(); room.togglePause(player.id); broadcast(room); });
    handle("room:finish", () => { const { room, player } = current(); room.finish(player.id); broadcast(room); });
    handle("room:leave", () => {
      const { room, player } = current();
      room.disconnect(player.id, true);
      socket.leave(room.code);
      delete socket.data.drawing;
      broadcast(room);
    });
    handle("room:kick", payload => {
      const { room, player } = current();
      room.requireHost(player.id);
      const id = z.object({ playerId: z.string().uuid() }).parse(payload).playerId;
      if (id === player.id) throw new Error("Bạn không thể loại chính mình.");
      const target = room.players.find(p => p.id === id && !p.kicked);
      if (!target) throw new Error("Người chơi đã rời phòng.");
      const targetSocket = target.socketId && namespace.sockets.get(target.socketId);
      room.disconnect(id, true);
      if (targetSocket) { targetSocket.leave(room.code); delete targetSocket.data.drawing; targetSocket.emit("session:ended", "Chủ phòng đã mời bạn rời phòng."); }
      broadcast(room);
    });
    handle("turn:reroll", () => { const { room, player } = current(); room.reroll(player.id); broadcast(room); });
    handle("turn:begin", payload => {
      const { room, player } = current();
      room.beginDrawing(player.id, z.object({ turnId: z.string().uuid() }).parse(payload).turnId); broadcast(room);
    });
    handle("turn:next", payload => {
      const { room, player } = current();
      const { resultId } = z.object({ resultId: z.string().uuid() }).parse(payload);
      room.nextTurn(player.id, resultId);
      broadcast(room);
    });
    handle("draw:stroke", payload => {
      const { room, player } = current();
      const { turnId } = z.object({ turnId: z.string().uuid().optional() }).parse(payload);
      if (turnId && turnId !== room.view(player.id).turnId) throw new Error("Lượt vẽ này đã kết thúc.");
      const stroke = strokeSchema.parse(payload);
      room.addStroke(player.id, stroke);
      socket.to(room.code).emit("draw:stroke", stroke, room.canvasRevision, room.view(player.id).turnId);
      return { ok: true, canvasRevision: room.canvasRevision, turnId: room.view(player.id).turnId };
    });
    handle("draw:fill", payload => {
      const { room, player } = current();
      const data = z.object({ id: z.string().uuid(), color: z.string().regex(/^#[a-fA-F0-9]{6}$/), spans: z.array(z.number().int().min(0).max(650000)).min(2).max(70000), revision: z.number().int().nonnegative(), turnId: z.string().uuid() }).parse(payload);
      room.addFill(player.id, data); broadcast(room);
    });
    handle("draw:edit", payload => {
      const { room, player } = current();
      room.editCanvas(player.id, z.object({ action: z.enum(["undo", "clear"]) }).parse(payload).action);
      broadcast(room);
    });
    handle("guess:send", payload => {
      const { room, player } = current();
      const text = z.object({ text: z.string().trim().min(1).max(80, "Dự đoán tối đa 80 ký tự.") }).parse(payload).text;
      const guess = room.submitGuess(player.id, text);
      const prompt = room.prompt!;
      broadcast(room);
      if (guess.status === "pending" && guess.similarity.source !== "rules") {
        void aiSimilarity(text, prompt).then(similarity => {
          if (similarity && room.applySimilarity(guess.id, similarity)) broadcast(room);
        }).catch(() => { /* Keep immediately available local guidance; manual judging stays active. */ });
      }
    });
    handle("guess:judge", payload => {
      const { room, player } = current();
      const data = z.object({ guessId: z.string().uuid(), accepted: z.boolean() }).parse(payload);
      room.judge(player.id, data.guessId, data.accepted);
      broadcast(room);
    });
    handle("voice:join", () => {
      const { room, player } = current();
      if (!room.settings.voiceEnabled) throw new Error("Chủ phòng chưa bật trò chuyện bằng micro.");
      const iceServers = voiceIceServers(player.id);
      player.voiceId = randomUUID(); player.voiceMuted = true; broadcast(room);
      return { ok: true, voice: { id: player.voiceId, iceServers, relayConfigured: hasVoiceRelay(iceServers) } };
    });
    const voiceMember = (payload: unknown) => {
      const { room, player } = current();
      const { voiceId } = z.object({ voiceId: z.string().uuid() }).parse(payload);
      if (!room.settings.voiceEnabled || !player.voiceId || player.voiceId !== voiceId) throw new Error("Hãy tham gia lại phòng thoại.");
      return { room, player };
    };
    handle("voice:ice", payload => {
      const { player } = voiceMember(payload);
      const iceServers = voiceIceServers(player.id);
      return { ok: true, voice: { id: player.voiceId!, iceServers, relayConfigured: hasVoiceRelay(iceServers) } };
    });
    handle("voice:leave", payload => {
      const { room, player } = voiceMember(payload);
      player.voiceId = null; player.voiceMuted = true; broadcast(room);
    });
    handle("voice:state", payload => {
      const { room, player } = voiceMember(payload);
      player.voiceMuted = z.object({ muted: z.boolean() }).parse(payload).muted; broadcast(room);
    });
    handle("voice:mute-all", () => {
      const { room, player } = current(); room.requireHost(player.id);
      room.players.forEach(member => { member.voiceMuted = true; }); broadcast(room);
    });
    handle("voice:signal", payload => {
      const { room, player } = current();
      const data = z.object({
        targetId: z.string().uuid(), targetVoiceId: z.string().uuid(), fromVoiceId: z.string().uuid(),
        exchangeId: z.string().uuid().optional(), restart: z.literal(true).optional(), manual: z.boolean().optional(),
        description: z.object({ type: z.enum(["offer", "answer"]), sdp: z.string().min(1).max(32000) }).optional(),
        candidate: z.object({ candidate: z.string().max(4096), sdpMid: z.string().max(256).nullable().optional(), sdpMLineIndex: z.number().int().min(0).max(16).nullable().optional(), usernameFragment: z.string().max(256).nullable().optional() }).optional(),
      }).refine(value => Number(!!value.description) + Number(!!value.candidate) + Number(!!value.restart) === 1 && (!value.manual || !!value.restart)).parse(payload);
      const target = room.players.find(member => member.id === data.targetId && member.connected && !member.kicked);
      if (!room.settings.voiceEnabled || player.voiceId !== data.fromVoiceId || !target?.socketId || target.voiceId !== data.targetVoiceId || target.id === player.id) throw new Error("Kết nối âm thanh đã hết hạn.");
      namespace.to(target.socketId).emit("voice:signal", { fromId: player.id, fromVoiceId: player.voiceId, targetVoiceId: target.voiceId, exchangeId: data.exchangeId, ...(data.description ? { description: data.description } : data.restart ? { restart: true, manual: data.manual } : { candidate: data.candidate }) });
    });
    socket.on("disconnect", () => {
      const identity = socket.data.drawing as Identity | undefined;
      const room = identity && rooms.get(identity.code);
      const player = room?.players.find(p => p.id === identity?.playerId && p.socketId === socket.id);
      if (room && player) { room.disconnect(player.id); broadcast(room); }
    });
  });
  const timer = setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.emptySince !== null && Date.now() - room.emptySince >= 30 * 60 * 1000) { rooms.delete(code); continue; }
      if (room.tick()) broadcast(room);
    }
  }, 200);
  timer.unref();
  return { rooms, dispose: () => clearInterval(timer) };
}

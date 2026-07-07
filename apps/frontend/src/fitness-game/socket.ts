import type { Namespace, Socket } from "socket.io";

type GameType = "race" | "boxing";
type MatchMode = "local" | "remote";
type MatchStatus = "lobby" | "countdown" | "playing" | "result";
type PlayerSlot = "A" | "B";

interface FitnessInput {
  runPower?: number;
  jump?: boolean;
  punch?: boolean;
  guard?: boolean;
}

interface PlayerState {
  id: string;
  slot: PlayerSlot;
  name: string;
  screenId: PlayerSlot;
  socketId: string;
  connected: boolean;
  isAi: boolean;
  aiSkill: number;
  aiNextPunchAt: number;
  aiGuardUntil: number;
  input: Required<FitnessInput>;
  distance: number;
  speed: number;
  hp: number;
  stamina: number;
  lastPunchAt: number;
  punchUntil: number;
  guardUntil: number;
  stunnedUntil: number;
  finishedAt: number | null;
  hurdleHits: Set<number>;
}

interface FitnessMatch {
  id: string;
  mode: MatchMode;
  gameType: GameType;
  raceDistance: 100 | 200 | 500;
  hurdles: boolean;
  status: MatchStatus;
  createdAt: number;
  updatedAt: number;
  countdownEndsAt: number | null;
  winnerSlot: PlayerSlot | null;
  hosts: Partial<Record<PlayerSlot, string>>;
  players: Partial<Record<PlayerSlot, PlayerState>>;
  lastTickAt: number;
}

const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const matches = new Map<string, FitnessMatch>();
const socketRefs = new Map<string, { matchId: string; role: "host" | "player"; slot?: PlayerSlot }>();

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const makeMatchId = (): string => {
  let id = "";
  for (let i = 0; i < 4; i += 1) id += chars[Math.floor(Math.random() * chars.length)];
  return matches.has(id) ? makeMatchId() : id;
};

const serializeMatch = (match: FitnessMatch) => ({
  id: match.id,
  mode: match.mode,
  gameType: match.gameType,
  raceDistance: match.raceDistance,
  hurdles: match.hurdles,
  status: match.status,
  createdAt: match.createdAt,
  countdownEndsAt: match.countdownEndsAt,
  winnerSlot: match.winnerSlot,
  hosts: match.hosts,
  players: (["A", "B"] as PlayerSlot[]).map((slot) => {
    const player = match.players[slot];
    return player
      ? {
          id: player.id,
          slot: player.slot,
          name: player.name,
          screenId: player.screenId,
          connected: player.connected,
          isAi: player.isAi,
          distance: player.distance,
          speed: player.speed,
          hp: player.hp,
          stamina: player.stamina,
          punching: Date.now() < player.punchUntil,
          guarding: Date.now() < player.guardUntil,
          stunned: Date.now() < player.stunnedUntil,
          finishedAt: player.finishedAt
        }
      : null;
  })
});

const emitMatch = (namespace: Namespace, match: FitnessMatch): void => {
  namespace.to(`fitness:${match.id}`).emit("match:state", serializeMatch(match));
};

const closeMatch = (namespace: Namespace, match: FitnessMatch, message: string): void => {
  namespace.to(`fitness:${match.id}`).emit("match:closed", { matchId: match.id, message });
  for (const [socketId, ref] of socketRefs.entries()) {
    if (ref.matchId === match.id) socketRefs.delete(socketId);
  }
  matches.delete(match.id);
};

const createPlayer = (slot: PlayerSlot, name: string, screenId: PlayerSlot, socketId: string): PlayerState => ({
  id: `${slot}-${Math.random().toString(36).slice(2, 10)}`,
  slot,
  name,
  screenId,
  socketId,
  connected: true,
  isAi: false,
  aiSkill: 0,
  aiNextPunchAt: 0,
  aiGuardUntil: 0,
  input: { runPower: 0, jump: false, punch: false, guard: false },
  distance: 0,
  speed: 0,
  hp: 100,
  stamina: 100,
  lastPunchAt: 0,
  punchUntil: 0,
  guardUntil: 0,
  stunnedUntil: 0,
  finishedAt: null,
  hurdleHits: new Set()
});

const createAiPlayer = (slot: PlayerSlot, match: FitnessMatch): PlayerState => ({
  ...createPlayer(slot, `AI ${slot}`, slot, `ai:${match.id}:${slot}`),
  id: `ai-${slot}-${match.id}`,
  connected: true,
  isAi: true,
  aiSkill: 0.58 + Math.random() * 0.18,
  aiNextPunchAt: Date.now() + 600 + Math.random() * 500,
  aiGuardUntil: 0
});

const realPlayerCount = (match: FitnessMatch): number =>
  Object.values(match.players).filter((player) => player && !player.isAi && player.connected).length;

const ensureAiOpponent = (match: FitnessMatch): void => {
  if (match.players.A && match.players.B) return;
  const emptySlot: PlayerSlot = match.players.A ? "B" : "A";
  match.players[emptySlot] = createAiPlayer(emptySlot, match);
};

const resetMatchForPlay = (match: FitnessMatch): void => {
  match.winnerSlot = null;
  for (const player of Object.values(match.players)) {
    if (!player) continue;
    player.distance = 0;
    player.speed = 0;
    player.hp = 100;
    player.stamina = 100;
    player.lastPunchAt = 0;
    player.punchUntil = 0;
    player.guardUntil = 0;
    player.stunnedUntil = 0;
    player.finishedAt = null;
    player.hurdleHits.clear();
  }
};

const startCountdown = (match: FitnessMatch, seconds: number): void => {
  if (realPlayerCount(match) < 1) return;
  ensureAiOpponent(match);
  if (!match.players.A || !match.players.B) return;
  resetMatchForPlay(match);
  match.status = "countdown";
  match.countdownEndsAt = Date.now() + seconds * 1000;
  match.lastTickAt = Date.now();
};

const updateAiPlayers = (match: FitnessMatch, now: number): void => {
  for (const player of Object.values(match.players)) {
    if (!player?.isAi) continue;

    if (match.gameType === "race") {
      const wave = Math.sin(now / 430 + (player.slot === "A" ? 0.4 : 1.8)) * 0.08;
      let jump = false;
      if (match.hurdles) {
        const hurdleCount = match.raceDistance === 100 ? 5 : match.raceDistance === 200 ? 8 : 14;
        const spacing = match.raceDistance / (hurdleCount + 1);
        for (let i = 1; i <= hurdleCount; i += 1) {
          const hurdleAt = spacing * i;
          if (player.distance > hurdleAt - 2.4 && player.distance < hurdleAt + 0.8) {
            jump = true;
            break;
          }
        }
      }
      player.input = {
        runPower: clamp(player.aiSkill + wave, 0.35, 0.88),
        jump,
        punch: false,
        guard: false
      };
      continue;
    }

    const opponent = match.players[player.slot === "A" ? "B" : "A"];
    const opponentPunching = opponent ? now < opponent.punchUntil : false;
    if (opponentPunching && player.stamina > 14) {
      player.aiGuardUntil = now + 380;
    }
    const shouldPunch = now >= player.aiNextPunchAt && player.stamina > 24;
    if (shouldPunch) {
      player.aiNextPunchAt = now + 620 + Math.random() * 620;
    }
    player.input = {
      runPower: clamp(player.aiSkill + Math.sin(now / 510) * 0.08, 0.35, 0.88),
      jump: false,
      punch: shouldPunch,
      guard: now < player.aiGuardUntil
    };
  }
};

const updateRace = (match: FitnessMatch, dt: number, now: number): void => {
  for (const player of Object.values(match.players)) {
    if (!player || player.finishedAt) continue;
    const power = clamp(player.input.runPower);
    const targetSpeed = 1.8 + power * 9.4;
    player.speed += (targetSpeed - player.speed) * clamp(dt * 5);
    player.stamina = clamp(player.stamina + (0.16 - power * 0.08) * dt, 0, 100);

    if (match.hurdles) {
      const hurdleCount = match.raceDistance === 100 ? 5 : match.raceDistance === 200 ? 8 : 14;
      const spacing = match.raceDistance / (hurdleCount + 1);
      for (let i = 1; i <= hurdleCount; i += 1) {
        const hurdleAt = spacing * i;
        if (player.hurdleHits.has(i)) continue;
        if (player.distance < hurdleAt && player.distance + player.speed * dt >= hurdleAt) {
          player.hurdleHits.add(i);
          if (!player.input.jump) {
            player.speed *= 0.45;
            player.stamina = Math.max(0, player.stamina - 8);
          }
        }
      }
    }

    player.distance += player.speed * dt;
    if (player.distance >= match.raceDistance) {
      player.distance = match.raceDistance;
      player.finishedAt = now;
      if (!match.winnerSlot) {
        match.winnerSlot = player.slot;
        match.status = "result";
      }
    }
  }
};

const updateBoxing = (match: FitnessMatch, dt: number, now: number): void => {
  const a = match.players.A;
  const b = match.players.B;
  if (!a || !b) return;

  for (const player of [a, b]) {
    const power = clamp(player.input.runPower);
    player.stamina = clamp(player.stamina + (18 - power * 6) * dt, 0, 100);
    if (player.input.guard && player.stamina > 8) {
      player.guardUntil = now + 260;
      player.stamina = Math.max(0, player.stamina - 18 * dt);
    }
  }

  for (const attacker of [a, b]) {
    const defender = attacker.slot === "A" ? b : a;
    if (!attacker.input.punch || attacker.stamina < 18 || now - attacker.lastPunchAt < 420) continue;
    attacker.lastPunchAt = now;
    attacker.punchUntil = now + 240;
    attacker.stamina -= 18;

    const defenderGuarding = now < defender.guardUntil && defender.stamina > 4;
    const damage = defenderGuarding ? 3 : 11 + Math.round(clamp(attacker.input.runPower) * 7);
    defender.hp = Math.max(0, defender.hp - damage);
    if (!defenderGuarding) defender.stunnedUntil = now + 180;
    if (defender.hp <= 0) {
      match.winnerSlot = attacker.slot;
      match.status = "result";
      return;
    }
  }
};

const tickMatch = (namespace: Namespace, match: FitnessMatch, now: number): void => {
  if (match.status === "countdown" && match.countdownEndsAt && now >= match.countdownEndsAt) {
    match.status = "playing";
    match.countdownEndsAt = null;
    match.lastTickAt = now;
  }

  if (match.status !== "playing") return;
  const dt = Math.min(0.08, Math.max(0.001, (now - match.lastTickAt) / 1000));
  match.lastTickAt = now;
  updateAiPlayers(match, now);
  if (match.gameType === "race") updateRace(match, dt, now);
  if (match.gameType === "boxing") updateBoxing(match, dt, now);
  match.updatedAt = now;
  emitMatch(namespace, match);
};

export const registerFitnessGameNamespace = (namespace: Namespace): void => {
  namespace.on("connection", (socket: Socket) => {
    socket.on("host:create", (payload, ack) => {
      const mode: MatchMode = payload?.mode === "remote" ? "remote" : "local";
      const gameType: GameType = payload?.gameType === "boxing" ? "boxing" : "race";
      const raceDistance = [100, 200, 500].includes(Number(payload?.raceDistance)) ? Number(payload.raceDistance) : 100;
      const id = makeMatchId();
      const screenId: PlayerSlot = "A";
      const match: FitnessMatch = {
        id,
        mode,
        gameType,
        raceDistance: raceDistance as 100 | 200 | 500,
        hurdles: Boolean(payload?.hurdles),
        status: "lobby",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        countdownEndsAt: null,
        winnerSlot: null,
        hosts: { [screenId]: socket.id },
        players: {},
        lastTickAt: Date.now()
      };
      matches.set(id, match);
      socket.join(`fitness:${id}`);
      socketRefs.set(socket.id, { matchId: id, role: "host", slot: screenId });
      ack?.({ ok: true, match: serializeMatch(match), screenId });
      emitMatch(namespace, match);
    });

    socket.on("host:join", (payload, ack) => {
      const id = String(payload?.matchId ?? "").trim().toUpperCase();
      const match = matches.get(id);
      if (!match) {
        ack?.({ ok: false, message: "Không tìm thấy phòng." });
        return;
      }
      const screenId: PlayerSlot = match.hosts.A ? "B" : "A";
      match.hosts[screenId] = socket.id;
      match.mode = "remote";
      socket.join(`fitness:${id}`);
      socketRefs.set(socket.id, { matchId: id, role: "host", slot: screenId });
      ack?.({ ok: true, match: serializeMatch(match), screenId });
      emitMatch(namespace, match);
    });

    socket.on("match:configure", (payload, ack) => {
      const id = String(payload?.matchId ?? "").trim().toUpperCase();
      const match = matches.get(id);
      if (!match || match.status !== "lobby") {
        ack?.({ ok: false });
        return;
      }
      if (payload?.gameType === "race" || payload?.gameType === "boxing") match.gameType = payload.gameType;
      if ([100, 200, 500].includes(Number(payload?.raceDistance))) match.raceDistance = Number(payload.raceDistance) as 100 | 200 | 500;
      if (typeof payload?.hurdles === "boolean") match.hurdles = payload.hurdles;
      emitMatch(namespace, match);
      ack?.({ ok: true });
    });

    socket.on("player:join", (payload, ack) => {
      const id = String(payload?.matchId ?? "").trim().toUpperCase();
      const match = matches.get(id);
      const wantedScreen = payload?.screenId === "B" ? "B" : "A";
      if (!match) {
        ack?.({ ok: false, message: "Không tìm thấy phòng." });
        return;
      }
      const slot: PlayerSlot | null = match.mode === "remote" ? wantedScreen : !match.players.A ? "A" : !match.players.B ? "B" : null;
      if (!slot || match.players[slot]?.connected) {
        ack?.({ ok: false, message: "Phòng đã đủ 2 người chơi." });
        return;
      }
      const player = createPlayer(slot, String(payload?.name ?? `Người chơi ${slot}`).slice(0, 24), wantedScreen, socket.id);
      match.players[slot] = player;
      socket.join(`fitness:${id}`);
      socketRefs.set(socket.id, { matchId: id, role: "player", slot });
      ack?.({ ok: true, match: serializeMatch(match), playerId: player.id, slot });
      emitMatch(namespace, match);
    });

    socket.on("controller:input", (payload) => {
      const id = String(payload?.matchId ?? "").trim().toUpperCase();
      const match = matches.get(id);
      if (!match) return;
      const slot = payload?.slot === "B" ? "B" : "A";
      const player = match.players[slot];
      if (!player || player.id !== payload?.playerId) return;
      player.input = {
        runPower: clamp(Number(payload?.input?.runPower ?? 0)),
        jump: Boolean(payload?.input?.jump),
        punch: Boolean(payload?.input?.punch),
        guard: Boolean(payload?.input?.guard)
      };
      player.connected = true;
      player.socketId = socket.id;
    });

    socket.on("match:start", (payload, ack) => {
      const id = String(payload?.matchId ?? "").trim().toUpperCase();
      const match = matches.get(id);
      if (!match || realPlayerCount(match) < 1) {
        ack?.({ ok: false, message: "Cần tối thiểu 1 người chơi join." });
        return;
      }
      startCountdown(match, Number(payload?.seconds) === 10 ? 10 : 5);
      emitMatch(namespace, match);
      ack?.({ ok: true });
    });

    socket.on("match:close", (payload, ack) => {
      const id = String(payload?.matchId ?? "").trim().toUpperCase();
      const match = matches.get(id);
      if (!match) {
        ack?.({ ok: true });
        return;
      }
      closeMatch(namespace, match, "Phòng game đã đóng.");
      ack?.({ ok: true });
    });

    socket.on("match:leave", (payload, ack) => {
      const id = String(payload?.matchId ?? "").trim().toUpperCase();
      const match = matches.get(id);
      const ref = socketRefs.get(socket.id);
      if (!match || !ref || ref.matchId !== id) {
        ack?.({ ok: true });
        return;
      }

      socket.leave(`fitness:${id}`);
      socketRefs.delete(socket.id);

      if (ref.role === "host") {
        closeMatch(namespace, match, "Màn TV đã thoát khỏi game.");
        ack?.({ ok: true });
        return;
      }

      if (ref.slot && match.players[ref.slot]) {
        delete match.players[ref.slot];
        if (match.status === "countdown" || match.status === "playing") {
          match.status = "lobby";
          match.countdownEndsAt = null;
          match.winnerSlot = null;
        }
      }

      emitMatch(namespace, match);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const ref = socketRefs.get(socket.id);
      if (!ref) return;
      socketRefs.delete(socket.id);
      const match = matches.get(ref.matchId);
      if (!match) return;
      if (ref.role === "host" && ref.slot) delete match.hosts[ref.slot];
      if (ref.role === "player" && ref.slot && match.players[ref.slot]) {
        match.players[ref.slot]!.connected = false;
      }
      if (!match.hosts.A && !match.hosts.B && !match.players.A?.connected && !match.players.B?.connected) {
        matches.delete(match.id);
        return;
      }
      emitMatch(namespace, match);
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const match of matches.values()) {
      if (now - match.createdAt > 6 * 60 * 60 * 1000) {
        matches.delete(match.id);
        continue;
      }
      tickMatch(namespace, match, now);
    }
  }, 50);
};

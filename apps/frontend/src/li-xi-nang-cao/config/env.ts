import dotenv from "dotenv";

dotenv.config();

export const liXiConfig = {
  roomTtlMs: Number(process.env.LIXI_ROOM_TTL_MS ?? 60 * 60 * 1000),
  maxShakeThreshold: Number(process.env.LIXI_MAX_SHAKE_THRESHOLD ?? 100000),
  maxLatencyMs: Number(process.env.LIXI_MAX_LATENCY_MS ?? 300),
  minActionIntervalMs: Number(process.env.LIXI_MIN_ACTION_INTERVAL_MS ?? 50)
};

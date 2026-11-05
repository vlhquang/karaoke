import { createHmac } from "node:crypto";
import { z } from "zod";
import type { VoiceIceServer } from "./types";

const urls = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
const iceSchema = z.array(z.object({
  urls: z.union([z.string().max(2048), z.array(z.string().max(2048)).min(1).max(8)]),
  username: z.string().max(512).optional(), credential: z.string().max(1024).optional(),
})).max(12).refine(servers => servers.every(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).every(url => /^(stun|stuns|turn|turns):[^\s]+$/i.test(url) && (!/^turns?:/i.test(url) || !!(server.username && server.credential)))));

export const hasVoiceRelay = (servers: VoiceIceServer[]) => servers.some(server => (Array.isArray(server.urls) ? server.urls : [server.urls]).some(url => /^turns?:/i.test(url)));

/** Called only for authenticated room members after they choose to join voice. */
export function voiceIceServers(playerId: string, env: Record<string, string | undefined> = process.env, now = Date.now()): VoiceIceServer[] {
  try {
    if (env.DRAWING_VOICE_ICE_SERVERS) return iceSchema.parse(JSON.parse(env.DRAWING_VOICE_ICE_SERVERS));
    const servers: VoiceIceServer[] = [];
    const stun = urls(env.DRAWING_VOICE_STUN_URLS ?? "stun:stun.l.google.com:19302");
    if (stun.length) servers.push({ urls: stun });
    const turn = urls(env.DRAWING_VOICE_TURN_URLS ?? "");
    if (turn.length) {
      if (env.DRAWING_VOICE_TURN_SECRET) {
        const username = `${Math.floor(now / 1000) + 3600}:${playerId}`;
        servers.push({ urls: turn, username, credential: createHmac("sha1", env.DRAWING_VOICE_TURN_SECRET).update(username).digest("base64") });
      } else {
        if (!env.DRAWING_VOICE_TURN_USERNAME || !env.DRAWING_VOICE_TURN_PASSWORD) throw new Error("TURN credentials missing");
        servers.push({ urls: turn, username: env.DRAWING_VOICE_TURN_USERNAME, credential: env.DRAWING_VOICE_TURN_PASSWORD });
      }
    }
    return iceSchema.parse(servers);
  } catch { throw new Error("Cấu hình âm thanh của máy chủ chưa hợp lệ. Báo chủ phòng giúp nhé."); }
}

import { env } from "../config/env.js";

export class SocketRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async consume(key: string): Promise<boolean> {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || now >= current.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + env.SOCKET_RATE_LIMIT_WINDOW_MS });
      return true;
    }

    if (current.count >= env.SOCKET_RATE_LIMIT_MAX) {
      return false;
    }

    current.count += 1;
    this.buckets.set(key, current);
    return true;
  }
}

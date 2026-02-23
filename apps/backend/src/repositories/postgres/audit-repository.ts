import type { Pool } from "pg";

export class AuditRepository {
  constructor(private readonly pool: Pool) {}

  async log(roomCode: string, eventType: string, payload: object): Promise<void> {
    await this.pool.query(
      `INSERT INTO room_events (room_code, event_type, payload) VALUES ($1, $2, $3::jsonb)`,
      [roomCode, eventType, JSON.stringify(payload)]
    );
  }
}

import type { Pool } from "pg";

export class RoomRepository {
  constructor(private readonly pool: Pool) {}

  async createRoom(roomId: string, roomCode: string, hostUserId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO rooms (id, room_code, host_user_id) VALUES ($1, $2, $3)`,
      [roomId, roomCode, hostUserId]
    );
  }

  async closeRoom(roomCode: string): Promise<void> {
    await this.pool.query(`UPDATE rooms SET closed_at = NOW() WHERE room_code = $1`, [roomCode]);
  }
}

import type { QueueSong } from "@karaoke/shared";
import type { Pool } from "pg";

export class SongHistoryRepository {
  constructor(private readonly pool: Pool) {}

  async insertQueued(song: QueueSong): Promise<void> {
    await this.pool.query(
      `INSERT INTO song_history (id, room_code, video_id, title, thumbnail_url, duration, added_by_user_id, added_by_name, is_priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued')
       ON CONFLICT (id) DO NOTHING`,
      [song.id, song.roomCode, song.videoId, song.title, song.thumbnailUrl, song.duration, song.addedByUserId, song.addedByName, song.isPriority]
    );
  }

  async markNowPlaying(songId: string): Promise<void> {
    await this.pool.query(
      `UPDATE song_history SET status = 'playing', started_at = NOW() WHERE id = $1`,
      [songId]
    );
  }

  async markSkipped(songId: string): Promise<void> {
    await this.pool.query(
      `UPDATE song_history SET status = 'skipped', ended_at = NOW() WHERE id = $1`,
      [songId]
    );
  }

  async markFinished(songId: string): Promise<void> {
    await this.pool.query(
      `UPDATE song_history SET status = 'finished', ended_at = NOW() WHERE id = $1`,
      [songId]
    );
  }

  async markRemoved(songId: string): Promise<void> {
    await this.pool.query(
      `UPDATE song_history SET status = 'removed', ended_at = NOW() WHERE id = $1`,
      [songId]
    );
  }
}

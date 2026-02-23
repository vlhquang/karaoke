CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,
  host_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS song_history (
  id UUID PRIMARY KEY,
  room_code VARCHAR(6) NOT NULL,
  video_id VARCHAR(32) NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  duration VARCHAR(20) NOT NULL,
  added_by_user_id UUID NOT NULL,
  added_by_name VARCHAR(80) NOT NULL,
  is_priority BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(16) NOT NULL CHECK (status IN ('queued', 'playing', 'skipped', 'finished', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_song_history_room_created_at ON song_history (room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_song_history_status ON song_history (status);

CREATE TABLE IF NOT EXISTS room_events (
  id BIGSERIAL PRIMARY KEY,
  room_code VARCHAR(6) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_events_room_created_at ON room_events (room_code, created_at DESC);

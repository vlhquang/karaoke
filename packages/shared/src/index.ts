export type UserRole = "host" | "guest";

export interface QueueSong {
  id: string;
  roomCode: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
  addedByUserId: string;
  addedByName: string;
  isPriority: boolean;
  createdAt: string;
}

export interface RoomState {
  roomCode: string;
  hostSessionId: string;
  nowPlaying: QueueSong | null;
  queueLength: number;
  maxQueueSize: number;
  createdAt: string;
}

export interface RoomMember {
  userId: string;
  roomCode: string;
  displayName: string;
  role: UserRole;
  socketId: string;
  createdAt: string;
}

export interface CreateRoomPayload {
  displayName: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  displayName: string;
}

export interface RestoreSessionPayload {
  roomCode: string;
  userId: string;
  displayName: string;
}

export interface AddSongPayload {
  roomCode: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  duration: string;
}

export interface RemoveSongPayload {
  roomCode: string;
  songId: string;
}

export interface SkipSongPayload {
  roomCode: string;
  reason?: "manual" | "ended";
}

export interface CloseRoomPayload {
  roomCode: string;
}

export interface SetQueueLimitPayload {
  roomCode: string;
  maxQueueSize: number;
}

export interface RoomSnapshot {
  room: RoomState;
  nowPlaying: QueueSong | null;
  queue: QueueSong[];
}

export interface YouTubeSearchItem {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channelTitle: string;
  duration: string;
}

export interface ApiErrorBody {
  message: string;
  code: string;
}

export type ClientToServerEvents = {
  create_room: (
    payload: CreateRoomPayload,
    ack: (response: { ok: true; roomCode: string; userId: string } | { ok: false; message: string }) => void
  ) => void;
  join_room: (
    payload: JoinRoomPayload,
    ack: (response: { ok: true; roomCode: string; userId: string } | { ok: false; message: string }) => void
  ) => void;
  restore_session: (
    payload: RestoreSessionPayload,
    ack: (response: { ok: true; roomCode: string; userId: string; role: UserRole } | { ok: false; message: string }) => void
  ) => void;
  add_song: (
    payload: AddSongPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  add_priority_song: (
    payload: AddSongPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  skip_song: (
    payload: SkipSongPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  remove_song: (
    payload: RemoveSongPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  leave_room: (
    payload: { roomCode: string },
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  close_room: (
    payload: CloseRoomPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  set_queue_limit: (
    payload: SetQueueLimitPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
};

export type ServerToClientEvents = {
  room_created: (snapshot: RoomSnapshot) => void;
  room_joined: (snapshot: RoomSnapshot) => void;
  queue_updated: (snapshot: RoomSnapshot) => void;
  now_playing: (song: QueueSong | null) => void;
  room_closed: (payload: { roomCode: string; message: string }) => void;
  error: (error: ApiErrorBody) => void;

  // Lô tô events
  loto_room_created: (snapshot: LotoRoomSnapshot) => void;
  loto_room_joined: (snapshot: LotoRoomSnapshot) => void;
  loto_state_updated: (snapshot: LotoRoomSnapshot) => void;
  loto_number_called: (payload: { number: number; calledNumbers: number[] }) => void;
  loto_game_won: (payload: { winnerName: string; roomCode: string; winnerQrImage?: string }) => void;
  loto_room_closed: (payload: { roomCode: string; message: string }) => void;
};

// ── Lô tô types ──

export type LotoMaxNumber = 60 | 90;

export interface LotoConfig {
  maxNumber: LotoMaxNumber;
  intervalSeconds: number;
  voiceEnabled: boolean;
}

export type LotoGameStatus = "waiting" | "playing" | "paused" | "finished";

export interface LotoRoomState {
  roomCode: string;
  hostId: string;
  config: LotoConfig;
  calledNumbers: number[];
  currentNumber: number | null;
  gameStatus: LotoGameStatus;
  memberCount: number;
  readyCount: number;
  members: LotoMemberState[];
  createdAt: string;
}

export interface LotoRoomSnapshot {
  room: LotoRoomState;
}

export interface LotoMemberState {
  userId: string;
  displayName: string;
  ready: boolean;
  hasQrImage: boolean;
}

export interface LotoCreateRoomPayload {
  displayName: string;
  config: LotoConfig;
  winnerQrImage?: string;
}

export interface LotoJoinRoomPayload {
  roomCode: string;
  displayName: string;
  winnerQrImage?: string;
}

export interface LotoStartGamePayload {
  roomCode: string;
}

export interface LotoCallNumberPayload {
  roomCode: string;
}

export interface LotoClaimWinPayload {
  roomCode: string;
}

export interface LotoCloseRoomPayload {
  roomCode: string;
}

export interface LotoToggleReadyPayload {
  roomCode: string;
  ready: boolean;
}

export interface LotoResetRoundPayload {
  roomCode: string;
}

export type LotoClientToServerEvents = {
  loto_create_room: (
    payload: LotoCreateRoomPayload,
    ack: (response: { ok: true; roomCode: string; userId: string } | { ok: false; message: string }) => void
  ) => void;
  loto_join_room: (
    payload: LotoJoinRoomPayload,
    ack: (response: { ok: true; roomCode: string; userId: string } | { ok: false; message: string }) => void
  ) => void;
  loto_start_game: (
    payload: LotoStartGamePayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  loto_pause_game: (
    payload: { roomCode: string },
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  loto_call_number: (
    payload: LotoCallNumberPayload,
    ack: (response: { ok: true; number: number } | { ok: false; message: string }) => void
  ) => void;
  loto_claim_win: (
    payload: LotoClaimWinPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  loto_close_room: (
    payload: LotoCloseRoomPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  loto_toggle_ready: (
    payload: LotoToggleReadyPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
  loto_reset_round: (
    payload: LotoResetRoundPayload,
    ack: (response: { ok: true } | { ok: false; message: string }) => void
  ) => void;
};

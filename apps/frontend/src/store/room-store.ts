"use client";

import { create } from "zustand";
import type { QueueSong, RoomSnapshot, UserRole, YouTubeSearchItem } from "@karaoke/shared";
import { getSocket } from "../lib/socket";

type Role = "host" | "guest" | null;

interface SessionCache {
  roomCode: string;
  userId: string;
  displayName: string;
  role: UserRole;
}

interface RoomStore {
  connected: boolean;
  roomCode: string;
  userId: string;
  displayName: string;
  role: Role;
  queue: QueueSong[];
  nowPlaying: QueueSong | null;
  maxQueueSize: number;
  searching: boolean;
  loadingMoreSearch: boolean;
  searchQuery: string;
  nextSearchPageToken: string | null;
  hasMoreSearch: boolean;
  searchResults: YouTubeSearchItem[];
  errorMessage: string;
  initialized: boolean;
  connect: () => void;
  createRoom: (displayName: string) => Promise<void>;
  joinRoom: (roomCode: string, displayName: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  closeRoom: () => Promise<void>;
  addSong: (song: YouTubeSearchItem, isPriority: boolean) => Promise<void>;
  skipSong: (reason?: "manual" | "ended") => Promise<void>;
  removeSong: (songId: string) => Promise<void>;
  searchSongs: (query: string) => Promise<void>;
  loadMoreSongs: () => Promise<void>;
  setQueueLimit: (maxQueueSize: number) => Promise<void>;
  hydrateSnapshot: (snapshot: RoomSnapshot) => void;
  clearError: () => void;
}

type SetFn = (fn: (state: RoomStore) => Partial<RoomStore>) => void;
type GetFn = () => RoomStore;

const SESSION_KEY = "karaoke_session_v1";
const LEGACY_SESSION_KEY = "karaoke_session_v1";

const dedupeByVideoId = (items: YouTubeSearchItem[]): YouTubeSearchItem[] => {
  const map = new Map<string, YouTubeSearchItem>();
  for (const item of items) {
    if (!map.has(item.videoId)) {
      map.set(item.videoId, item);
    }
  }
  return Array.from(map.values());
};

const saveSession = (session: SessionCache): void => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const loadSession = (): SessionCache | null => {
  const raw = sessionStorage.getItem(SESSION_KEY);
  const legacyRaw = raw ? null : localStorage.getItem(LEGACY_SESSION_KEY);
  const source = raw ?? legacyRaw;
  if (!source) {
    return null;
  }

  try {
    const parsed = JSON.parse(source) as SessionCache;
    if (!parsed.roomCode || !parsed.userId || !parsed.displayName || !parsed.role) {
      return null;
    }
    if (legacyRaw) {
      // Migrate old shared session to tab-scoped session to avoid cross-tab overwrite.
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
    return parsed;
  } catch {
    return null;
  }
};

const clearSession = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
};

const clearRoomState = (set: SetFn): void => {
  set(() => ({
    roomCode: "",
    userId: "",
    displayName: "",
    role: null,
    queue: [],
    nowPlaying: null,
    maxQueueSize: 10,
    searchQuery: "",
    nextSearchPageToken: null,
    hasMoreSearch: false,
    searchResults: []
  }));
};

const applySnapshot = (set: SetFn, snapshot: RoomSnapshot): void => {
  set(() => ({
    roomCode: snapshot.room.roomCode,
    queue: snapshot.queue,
    nowPlaying: snapshot.nowPlaying,
    maxQueueSize: snapshot.room.maxQueueSize,
    errorMessage: ""
  }));
};

const emitWithAck = async <TResponse>(
  event: string,
  payload: Record<string, unknown>
): Promise<TResponse> => {
  const socket = await getSocket();
  return await new Promise<TResponse>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      resolve({ ok: false, message: "Khong ket noi duoc realtime socket" } as TResponse);
    }, 6000);

    socket.emit(event, payload, (response: TResponse) => {
      window.clearTimeout(timeoutId);
      resolve(response);
    });
  });
};

const tryRestoreSession = async (set: SetFn): Promise<void> => {
  const cached = loadSession();
  if (!cached) {
    return;
  }

  const response = await emitWithAck<
    { ok: true; roomCode: string; userId: string; role: UserRole } | { ok: false; message: string }
  >("restore_session", {
    roomCode: cached.roomCode,
    userId: cached.userId,
    displayName: cached.displayName
  });

  if (!response.ok) {
    clearSession();
    clearRoomState(set);
    return;
  }

  saveSession({
    roomCode: response.roomCode,
    userId: response.userId,
    displayName: cached.displayName,
    role: response.role
  });

  set(() => ({
    roomCode: response.roomCode,
    userId: response.userId,
    displayName: cached.displayName,
    role: response.role,
    errorMessage: ""
  }));
};

const setupSocketListeners = async (set: SetFn, get: GetFn): Promise<void> => {
  let socket;
  try {
    socket = await getSocket();
  } catch (error) {
    set(() => ({
      connected: false,
      errorMessage: error instanceof Error ? error.message : "Khong tai duoc Socket.IO client"
    }));
    return;
  }

  socket.off("connect");
  socket.off("disconnect");
  socket.off("room_created");
  socket.off("room_joined");
  socket.off("queue_updated");
  socket.off("now_playing");
  socket.off("room_closed");
  socket.off("error");

  socket.on("connect", () => {
    set(() => ({ connected: true }));
    void tryRestoreSession(set);
  });

  socket.on("disconnect", () => {
    set(() => ({ connected: false }));
  });

  socket.on("room_created", (snapshot) => {
    applySnapshot(set, snapshot as RoomSnapshot);
  });

  socket.on("room_joined", (snapshot) => {
    applySnapshot(set, snapshot as RoomSnapshot);
  });

  socket.on("queue_updated", (snapshot) => {
    applySnapshot(set, snapshot as RoomSnapshot);
  });

  socket.on("now_playing", (song) => {
    set(() => ({ nowPlaying: song as QueueSong | null }));
  });

  socket.on("room_closed", (payload) => {
    const message = (payload as { message?: string }).message ?? "Room has been closed";
    clearSession();
    clearRoomState(set);
    set(() => ({ errorMessage: message }));
  });

  socket.on("error", (error) => {
    const typedError = error as { message?: string };
    set(() => ({ errorMessage: typedError.message || "Socket error" }));
  });

  if (!socket.connected) {
    socket.connect();
  } else if (!get().connected) {
    set(() => ({ connected: true }));
    void tryRestoreSession(set);
  }
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  connected: false,
  roomCode: "",
  userId: "",
  displayName: "",
  role: null,
  queue: [],
  nowPlaying: null,
  maxQueueSize: 10,
  searching: false,
  loadingMoreSearch: false,
  searchQuery: "",
  nextSearchPageToken: null,
  hasMoreSearch: false,
  searchResults: [],
  errorMessage: "",
  initialized: false,

  connect: () => {
    if (get().initialized) {
      return;
    }
    void setupSocketListeners(set, get);
    set(() => ({ initialized: true }));
  },

  createRoom: async (displayName: string) => {
    const normalizedName = displayName.trim() || "Host";
    const response = await emitWithAck<{ ok: true; roomCode: string; userId: string } | { ok: false; message: string }>(
      "create_room",
      { displayName: normalizedName }
    );

    if (!response.ok) {
      set(() => ({ errorMessage: response.message }));
      return;
    }

    saveSession({
      roomCode: response.roomCode,
      userId: response.userId,
      displayName: normalizedName,
      role: "host"
    });

    set(() => ({
      roomCode: response.roomCode,
      userId: response.userId,
      displayName: normalizedName,
      role: "host",
      maxQueueSize: 10,
      errorMessage: ""
    }));
  },

  joinRoom: async (roomCode: string, displayName: string) => {
    const normalizedCode = roomCode.trim().toUpperCase();
    const normalizedName = displayName.trim() || "Guest";
    const response = await emitWithAck<{ ok: true; roomCode: string; userId: string } | { ok: false; message: string }>(
      "join_room",
      { roomCode: normalizedCode, displayName: normalizedName }
    );

    if (!response.ok) {
      set(() => ({ errorMessage: response.message }));
      return false;
    }

    saveSession({
      roomCode: response.roomCode,
      userId: response.userId,
      displayName: normalizedName,
      role: "guest"
    });

    set(() => ({
      roomCode: response.roomCode,
      userId: response.userId,
      displayName: normalizedName,
      role: "guest",
      searchQuery: "",
      nextSearchPageToken: null,
      hasMoreSearch: false,
      searchResults: [],
      errorMessage: ""
    }));
    return true;
  },

  leaveRoom: async () => {
    const { roomCode } = get();
    if (roomCode) {
      await emitWithAck<{ ok: true } | { ok: false; message: string }>("leave_room", { roomCode });
    }
    clearSession();
    clearRoomState(set);
  },

  closeRoom: async () => {
    const { roomCode } = get();
    if (!roomCode) {
      return;
    }

    const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>("close_room", { roomCode });
    if (!response.ok) {
      set(() => ({ errorMessage: response.message }));
      return;
    }

    clearSession();
    clearRoomState(set);
  },

  addSong: async (song: YouTubeSearchItem, isPriority: boolean) => {
    const { roomCode, queue, nowPlaying } = get();
    if (queue.some((item) => item.videoId === song.videoId) || nowPlaying?.videoId === song.videoId) {
      set(() => ({ errorMessage: "Video nay da co trong room" }));
      return;
    }

    const event = isPriority ? "add_priority_song" : "add_song";
    const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>(event, {
      roomCode,
      videoId: song.videoId,
      title: song.title,
      thumbnailUrl: song.thumbnailUrl,
      duration: song.duration
    });

    if (!response.ok) {
      set(() => ({ errorMessage: response.message }));
    }
  },

  skipSong: async (reason = "manual") => {
    const { roomCode } = get();
    const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>("skip_song", { roomCode, reason });

    if (!response.ok) {
      set(() => ({ errorMessage: response.message }));
    }
  },

  removeSong: async (songId: string) => {
    const { roomCode } = get();
    const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>("remove_song", { roomCode, songId });

    if (!response.ok) {
      set(() => ({ errorMessage: response.message }));
    }
  },

  searchSongs: async (query: string) => {
    const { searchYouTube } = await import("../lib/api");
    const normalizedQuery = query.trim();
    set(() => ({ searching: true, errorMessage: "", searchQuery: normalizedQuery }));

    try {
      const result = await searchYouTube(normalizedQuery);
      set(() => ({
        searchResults: dedupeByVideoId(result.items),
        nextSearchPageToken: result.nextPageToken,
        hasMoreSearch: Boolean(result.nextPageToken)
      }));
    } catch (error) {
      set(() => ({ errorMessage: error instanceof Error ? error.message : "Tim kiem that bai" }));
    } finally {
      set(() => ({ searching: false }));
    }
  },

  loadMoreSongs: async () => {
    const { searchYouTube } = await import("../lib/api");
    const { searchQuery, nextSearchPageToken, loadingMoreSearch } = get();
    if (!searchQuery || !nextSearchPageToken || loadingMoreSearch) {
      return;
    }

    set(() => ({ loadingMoreSearch: true, errorMessage: "" }));
    try {
      const result = await searchYouTube(searchQuery, nextSearchPageToken);
      set((state) => ({
        searchResults: dedupeByVideoId([...state.searchResults, ...result.items]),
        nextSearchPageToken: result.nextPageToken,
        hasMoreSearch: Boolean(result.nextPageToken)
      }));
    } catch (error) {
      set(() => ({ errorMessage: error instanceof Error ? error.message : "Tai them that bai" }));
    } finally {
      set(() => ({ loadingMoreSearch: false }));
    }
  },

  setQueueLimit: async (maxQueueSize: number) => {
    const { roomCode } = get();
    const response = await emitWithAck<{ ok: true } | { ok: false; message: string }>("set_queue_limit", {
      roomCode,
      maxQueueSize
    });
    if (!response.ok) {
      set(() => ({ errorMessage: response.message }));
    }
  },

  hydrateSnapshot: (snapshot: RoomSnapshot) => {
    applySnapshot(set, snapshot);
  },

  clearError: () => {
    set(() => ({ errorMessage: "" }));
  }
}));

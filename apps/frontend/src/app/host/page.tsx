"use client";

import { useCallback, useEffect, useState } from "react";
import { useRoomStore } from "../../store/room-store";
import { RoomHeader } from "../../components/room-header";
import { QueueList } from "../../components/queue-list";
import { YouTubeHostPlayer } from "../../components/youtube-host-player";
import { ErrorBanner } from "../../components/error-banner";

export default function HostPage() {
  const {
    connect,
    createRoom,
    closeRoom,
    roomCode,
    queue,
    nowPlaying,
    maxQueueSize,
    setQueueLimit,
    skipSong,
    removeSong,
    role,
    errorMessage,
    clearError
  } = useRoomStore();
  const [displayName, setDisplayName] = useState("Chu phong");
  const [loading, setLoading] = useState(false);
  const [queueLimitInput, setQueueLimitInput] = useState("10");
  const isHostReady = role === "host" && Boolean(roomCode);
  const handleEnded = useCallback(() => {
    void skipSong("ended");
  }, [skipSong]);

  useEffect(() => {
    connect();
  }, [connect]);

  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      await createRoom(displayName.trim() || "Host");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setQueueLimitInput(String(maxQueueSize));
  }, [maxQueueSize]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const currentRoomInUrl = url.searchParams.get("room")?.toUpperCase() ?? "";
    if (roomCode && currentRoomInUrl !== roomCode) {
      url.searchParams.set("room", roomCode);
      window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    if (!roomCode && currentRoomInUrl) {
      url.searchParams.delete("room");
      const nextUrl = url.searchParams.toString() ? `${url.pathname}?${url.searchParams.toString()}` : url.pathname;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [roomCode]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Man hinh Chu phong</h1>
        <ErrorBanner message={errorMessage} onClose={clearError} />

        {!roomCode ? (
          <section className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <label className="mb-2 block text-sm text-slate-300">Ten chu phong</label>
            <input
              className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <button
              className="w-full rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-900"
              onClick={handleCreateRoom}
              disabled={loading}
            >
              {loading ? "Dang tao..." : "Tao phong"}
            </button>
          </section>
        ) : (
          <>
            <RoomHeader roomCode={roomCode} />
            <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <YouTubeHostPlayer
                  videoId={nowPlaying?.videoId ?? null}
                  onEnded={handleEnded}
                />
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Dang phat</p>
                  <p className="text-lg font-semibold text-slate-100">{nowPlaying?.title ?? "Chua co bai dang phat"}</p>
                  <p className="text-sm text-slate-400">{nowPlaying?.addedByName ?? "Dang cho hang doi"}</p>
                  <p className="mt-1 text-xs text-slate-500">Hang doi: {queue.length}/{maxQueueSize}</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                  <label className="text-xs text-slate-400">Gioi han hang doi</label>
                  <input
                    className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                    value={queueLimitInput}
                    onChange={(event) => setQueueLimitInput(event.target.value.replace(/[^0-9]/g, ""))}
                  />
                  <button
                    className="rounded border border-cyan-400/50 px-3 py-1 text-xs text-cyan-200"
                    onClick={() => {
                      const parsed = Number(queueLimitInput);
                      if (!Number.isFinite(parsed) || parsed < 1) {
                        return;
                      }
                      void setQueueLimit(parsed);
                    }}
                  >
                    Ap dung
                  </button>
                </div>
                <button
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900"
                  onClick={() => {
                    void skipSong("manual");
                  }}
                  disabled={!isHostReady}
                >
                  Bo qua bai
                </button>
                <button
                  className="rounded-lg border border-red-400/60 px-4 py-2 text-sm font-semibold text-red-200"
                  onClick={() => {
                    void closeRoom();
                  }}
                  disabled={!isHostReady}
                >
                  Huy phong
                </button>
              </div>

              <aside className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                <h2 className="mb-3 text-lg font-semibold">Hang doi</h2>
                <QueueList queue={queue} canRemove onRemove={removeSong} />
              </aside>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

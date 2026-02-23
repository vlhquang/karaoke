"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useRoomStore } from "../../../store/room-store";
import { QueueList } from "../../../components/queue-list";
import { SearchPanel } from "../../../components/search-panel";
import { ErrorBanner } from "../../../components/error-banner";

export default function UserRoomPage() {
  const params = useParams<{ code: string }>();
  const roomCode = useMemo(() => (params.code ?? "").toUpperCase(), [params.code]);
  const {
    connect,
    joinRoom,
    leaveRoom,
    queue,
    nowPlaying,
    maxQueueSize,
    role,
    searchResults,
    searching,
    loadingMoreSearch,
    hasMoreSearch,
    searchSongs,
    loadMoreSongs,
    addSong,
    errorMessage,
    clearError
  } = useRoomStore();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  useEffect(() => {
    connect();
  }, [connect]);

  const handleJoin = async () => {
    await joinRoom(roomCode, displayName.trim() || "Guest");
  };
  const addedVideoIds = useMemo(
    () => [nowPlaying?.videoId, ...queue.map((song) => song.videoId)].filter((id): id is string => Boolean(id)),
    [nowPlaying?.videoId, queue]
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8">
      <h1 className="mb-4 text-2xl font-bold">Man hinh Nguoi dung</h1>
      <ErrorBanner message={errorMessage} onClose={clearError} />

      {role !== "guest" ? (
        <section className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="mb-2 text-sm text-slate-300">Dang vao phong <span className="font-bold text-cyan-200">{roomCode}</span></p>
          <input
            className="mb-3 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2"
            placeholder="Ten hien thi cua ban"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <button className="w-full rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-900" onClick={handleJoin}>
            Vao phong
          </button>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <SearchPanel
              searching={searching}
              loadingMore={loadingMoreSearch}
              hasMore={hasMoreSearch}
              results={searchResults}
              addedVideoIds={addedVideoIds}
              onSearch={searchSongs}
              onLoadMore={loadMoreSongs}
              onAdd={addSong}
            />
          </div>

          <aside className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Hang doi thoi gian thuc</h2>
              <button
                className="rounded border border-slate-500 px-2 py-1 text-xs"
                onClick={async () => {
                  await leaveRoom();
                  router.push("/join");
                }}
              >
                Thoat phong
              </button>
            </div>
            <p className="mb-1 mt-1 text-xs text-slate-400">Dang phat: {nowPlaying?.title ?? "Chua co bai"}</p>
            <p className="mb-3 text-xs text-slate-500">Hang doi: {queue.length}/{maxQueueSize}</p>
            <QueueList queue={queue} canRemove={false} onRemove={() => undefined} />
          </aside>
        </section>
      )}
    </main>
  );
}

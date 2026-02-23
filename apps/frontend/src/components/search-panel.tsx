"use client";

import { useState } from "react";
import Image from "next/image";
import type { YouTubeSearchItem } from "@karaoke/shared";

interface Props {
  searching: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  results: YouTubeSearchItem[];
  addedVideoIds: string[];
  onSearch: (query: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onAdd: (song: YouTubeSearchItem, isPriority: boolean) => Promise<void>;
}

export const SearchPanel = ({ searching, loadingMore, hasMore, results, addedVideoIds, onSearch, onLoadMore, onAdd }: Props) => {
  const [query, setQuery] = useState("");
  const addedSet = new Set(addedVideoIds);

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <form
        className="mb-4 flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (query.trim().length < 2) {
            return;
          }
          await onSearch(query);
        }}
      >
        <input
          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
          placeholder="Tim bai karaoke"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900" type="submit">
          {searching ? "..." : "Tim"}
        </button>
      </form>

      <div className="space-y-2">
        {results.map((song) => (
          <article key={song.videoId} className="rounded-xl border border-slate-700 p-3">
            <div className="flex gap-3">
              <Image src={song.thumbnailUrl} alt={song.title} width={120} height={68} className="h-16 w-28 rounded object-cover" />
              <div className="flex-1">
                <h4 className="line-clamp-2 text-sm font-semibold text-slate-100">{song.title}</h4>
                <p className="text-xs text-slate-400">{song.channelTitle} • {song.duration}</p>
                {addedSet.has(song.videoId) ? (
                  <p className="mt-2 text-xs text-emerald-300">Da co trong hang doi</p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded bg-cyan-500 px-2 py-1 text-xs font-medium text-slate-900"
                      onClick={() => onAdd(song, false)}
                      type="button"
                    >
                      Them
                    </button>
                    <button
                      className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-slate-900"
                      onClick={() => onAdd(song, true)}
                      type="button"
                    >
                      Uu tien
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {hasMore ? (
        <div className="mt-3">
          <button
            className="w-full rounded-lg border border-cyan-400/40 px-3 py-2 text-sm font-semibold text-cyan-200"
            onClick={() => {
              void onLoadMore();
            }}
            disabled={loadingMore}
            type="button"
          >
            {loadingMore ? "Dang tai..." : "Xem them"}
          </button>
        </div>
      ) : null}
    </section>
  );
};

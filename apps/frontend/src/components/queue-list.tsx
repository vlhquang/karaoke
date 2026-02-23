"use client";

import Image from "next/image";
import type { QueueSong } from "@karaoke/shared";

interface Props {
  queue: QueueSong[];
  canRemove: boolean;
  onRemove: (songId: string) => void;
}

export const QueueList = ({ queue, canRemove, onRemove }: Props) => {
  if (queue.length === 0) {
    return <p className="text-sm text-slate-400">Hang doi trong.</p>;
  }

  return (
    <ul className="space-y-3">
      {queue.map((song, index) => (
        <li key={song.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <div className="flex gap-3">
            <Image
              src={song.thumbnailUrl}
              alt={song.title}
              width={120}
              height={68}
              className="h-16 w-28 rounded object-cover"
            />
            <div className="flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-slate-100">{index + 1}. {song.title}</p>
              <p className="text-xs text-slate-400">Them boi {song.addedByName} • {song.duration}</p>
              {song.isPriority && (
                <span className="mt-1 inline-block rounded bg-brand.warm/20 px-2 py-0.5 text-[10px] font-semibold text-brand.warm">
                  Uu tien
                </span>
              )}
            </div>
            {canRemove && (
              <button
                className="h-fit rounded-lg border border-red-400/50 px-2 py-1 text-xs text-red-300"
                onClick={() => onRemove(song.id)}
              >
                Xoa
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

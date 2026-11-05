"use client";

import { useEffect, useRef } from "react";
import type { RoomView } from "./types";

export function useGuessNotifications(room: RoomView | null, announce: (message: string) => void) {
  const previous = useRef<{ turnId: string; statuses: Map<string, string> } | null>(null);
  useEffect(() => {
    if (!room) { previous.current = null; return; }
    const statuses = new Map(room.guesses.map(guess => [guess.id, guess.status]));
    const last = previous.current; previous.current = { turnId: room.turnId, statuses };
    // Restoring a room never replays old notifications.
    if (!last || last.turnId !== room.turnId) return;
    const added = room.guesses.filter(guess => !last.statuses.has(guess.id));
    const ownChanged = room.guesses.filter(guess => guess.playerId === room.ownId && last.statuses.get(guess.id) !== guess.status);
    const accepted = ownChanged.find(guess => guess.status === "accepted");
    if (accepted) { announce(`Bạn đoán đúng ở lần thử ${accepted.attempt}!`); return; }
    if (ownChanged.some(guess => guess.status === "rejected")) { announce(room.phase === "drawing" ? "Đáp án chưa đúng. Bạn có thể thử tiếp nhé." : "Đáp án chưa được chấp nhận trong lượt này."); return; }
    if (added.some(guess => guess.playerId === room.ownId)) { announce("Đã gửi đáp án — chờ người vẽ duyệt."); return; }
    if (room.ownId === room.drawerId && added.length) {
      const name = room.players.find(player => player.id === added[0].playerId)?.name ?? "Một người chơi";
      announce(added.length === 1 ? `${name} vừa gửi đáp án.` : `Có ${added.length} đáp án mới từ cả nhà.`); return;
    }
    const otherAccepted = room.guesses.find(guess => guess.status === "accepted" && last.statuses.get(guess.id) !== "accepted");
    if (otherAccepted) announce(`${room.players.find(player => player.id === otherAccepted.playerId)?.name ?? "Một người chơi"} đã đoán đúng!`);
  }, [room, announce]);
}

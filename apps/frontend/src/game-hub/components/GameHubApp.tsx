"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, Gamepad2, Pause, Play, RefreshCcw, Sparkles, Users } from "lucide-react";
import { gameRegistry } from "../core/registry";
import type { GameCategory, GameDefinition } from "../core/types";
import { ThreeGameCanvas } from "./ThreeGameCanvas";

const categoryLabels: Record<GameCategory | "all", string> = {
  all: "Tất cả",
  competitive: "Đối kháng",
  coop: "Phối hợp",
  party: "Party",
};

export function GameHubApp() {
  const [selectedId, setSelectedId] = useState(gameRegistry[2].id);
  const [activeGame, setActiveGame] = useState<GameDefinition | null>(null);
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const [paused, setPaused] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const selectedGame = useMemo(
    () => gameRegistry.find((game) => game.id === selectedId) ?? gameRegistry[0],
    [selectedId],
  );
  const visibleGames = useMemo(
    () => gameRegistry.filter((game) => category === "all" || game.category === category),
    [category],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playId = params.get("play");
    const game = playId ? gameRegistry.find((candidate) => candidate.id === playId) : null;
    if (game) {
      setSelectedId(game.id);
      setActiveGame(game);
      setPaused(false);
      setRestartKey((value) => value + 1);
    }
  }, []);

  if (activeGame) {
    return (
      <main className={["game-hub-play-screen", activeGame.id === "ghost-hunters-3d" ? "is-ghost-game" : ""].filter(Boolean).join(" ")}>
        <header className="game-hub-playbar">
          <button type="button" onClick={() => setActiveGame(null)} aria-label="Quay lại Game Hub">
            <ArrowLeft aria-hidden="true" size={18} />
            <span>Hub</span>
          </button>
          <div>
            <small>{activeGame.modeLabel}</small>
            <strong>{activeGame.title}</strong>
          </div>
          <div className="game-hub-play-actions">
            <button type="button" onClick={() => setPaused((value) => !value)}>
              {paused ? <Play aria-hidden="true" size={18} /> : <Pause aria-hidden="true" size={18} />}
              <span>{paused ? "Tiếp tục" : "Tạm dừng"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(false);
                setRestartKey((value) => value + 1);
              }}
            >
              <RefreshCcw aria-hidden="true" size={18} />
              <span>Chơi lại</span>
            </button>
          </div>
        </header>

        <ThreeGameCanvas game={activeGame} paused={paused} restartKey={restartKey} />
      </main>
    );
  }

  return (
    <main className="game-hub-page">
      <section className="game-hub-hero">
        <div className="game-hub-hero-copy">
          <span className="game-hub-kicker">
            <Sparkles aria-hidden="true" size={16} />
            Game Hub 3D cho 2 người chơi
          </span>
          <h1>Game Hub 3D</h1>
          <p>
            Cổng trò chơi 2 người local, đồ họa low-poly 3D, luật ngắn gọn và sẵn sàng mở rộng online sau này.
          </p>
        </div>
        <div className="game-hub-hero-panel">
          <Gamepad2 aria-hidden="true" size={34} />
          <strong>{gameRegistry.length} game prototype</strong>
          <span>Đối kháng, phối hợp và party đều dùng chung core 3D.</span>
        </div>
      </section>

      <section className="game-hub-layout">
        <aside className="game-hub-sidebar">
          <div className="game-hub-filter">
            {(Object.keys(categoryLabels) as Array<GameCategory | "all">).map((key) => (
              <button
                key={key}
                type="button"
                className={category === key ? "is-active" : ""}
                onClick={() => setCategory(key)}
              >
                {categoryLabels[key]}
              </button>
            ))}
          </div>

          <div className="game-hub-selected">
            <span style={{ "--game-accent": selectedGame.accent } as CSSProperties} />
            <small>{selectedGame.modeLabel}</small>
            <h2>{selectedGame.title}</h2>
            <p>{selectedGame.objective}</p>
            <button
              type="button"
              onClick={() => {
                setActiveGame(selectedGame);
                setPaused(false);
                setRestartKey((value) => value + 1);
              }}
            >
              <Play aria-hidden="true" size={18} />
              <span>Bắt đầu chơi</span>
            </button>
          </div>

          <div className="game-hub-control-card">
            <Users aria-hidden="true" size={22} />
            <strong>Điều khiển 2 người</strong>
            <p>P1 dùng WASD + F/G. P2 dùng phím mũi tên + K/L. MVP ưu tiên desktop/keyboard.</p>
          </div>
        </aside>

        <section className="game-hub-games" aria-label="Danh sach game 3D">
          {visibleGames.map((game) => (
            <button
              key={game.id}
              type="button"
              className={["game-card", selectedId === game.id ? "is-selected" : ""].filter(Boolean).join(" ")}
              style={
                {
                  "--game-accent": game.accent,
                  "--game-secondary": game.secondaryAccent,
                } as CSSProperties
              }
              onClick={() => setSelectedId(game.id)}
            >
              <span className="game-card-art" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="game-card-meta">
                <small>{categoryLabels[game.category]}</small>
                <strong>{game.title}</strong>
                <em>{game.subtitle}</em>
              </span>
              <span className="game-card-footer">
                <span>{game.durationLabel}</span>
                <span>{game.difficulty}</span>
              </span>
            </button>
          ))}
        </section>
      </section>

      <section className="game-hub-detail">
        <div>
          <small>Game đang chọn</small>
          <h2>{selectedGame.shortTitle}</h2>
          <p>{selectedGame.kidTheme}</p>
        </div>
        <ul>
          {selectedGame.mechanics.map((mechanic) => (
            <li key={mechanic}>{mechanic}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

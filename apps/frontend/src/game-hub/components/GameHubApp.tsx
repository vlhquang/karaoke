"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CircleHelp,
  Gamepad2,
  Monitor,
  Pause,
  Play,
  RefreshCcw,
  Sparkles,
  Tv,
  Users,
  X,
} from "lucide-react";
import { isLegacyThreeGame, playableGameRegistry } from "../core/playable-registry";
import type { GameCategory, GamePlatform, PlayableGameDefinition } from "../core/types";
import { CameraDodgeGame } from "../../camera-dodge/CameraDodgeGame";
import { R3FGhostHuntersGame } from "./R3FGhostHuntersGame";
import { ThreeGameCanvas } from "./ThreeGameCanvas";

type FlowStep = "select-game" | "select-players" | "play";

const categoryLabels: Record<GameCategory | "all", string> = {
  all: "Tất cả",
  competitive: "Đối kháng",
  coop: "Phối hợp",
  party: "Party",
};

const platformLabels: Record<GamePlatform, string> = {
  desktop: "Desktop",
  tv: "TV/Web full màn hình",
  mobile: "Mobile",
  camera: "Camera",
};

const defaultGame = playableGameRegistry.find((game) => game.id === "ghost-hunters-3d") ?? playableGameRegistry[0];

export function GameHubApp() {
  const [flowStep, setFlowStep] = useState<FlowStep>("select-game");
  const [selectedId, setSelectedId] = useState(defaultGame.id);
  const [selectedPlayers, setSelectedPlayers] = useState(defaultGame.defaultPlayers);
  const [activeGame, setActiveGame] = useState<PlayableGameDefinition | null>(null);
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const [paused, setPaused] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [cameraPreviewVisible, setCameraPreviewVisible] = useState(true);

  const selectedGame = useMemo(
    () => playableGameRegistry.find((game) => game.id === selectedId) ?? playableGameRegistry[0],
    [selectedId],
  );
  const visibleGames = useMemo(
    () => playableGameRegistry.filter((game) => category === "all" || game.category === category),
    [category],
  );

  useEffect(() => {
    if (!selectedGame.supportedPlayers.includes(selectedPlayers)) {
      setSelectedPlayers(selectedGame.defaultPlayers);
    }
  }, [selectedGame, selectedPlayers]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playId = params.get("play");
    const game = playId ? playableGameRegistry.find((candidate) => candidate.id === playId) : null;
    if (!game) return;

    const requestedPlayers = Number(params.get("players"));
    const playerCount = game.supportedPlayers.includes(requestedPlayers) ? requestedPlayers : game.defaultPlayers;
    setSelectedId(game.id);
    setSelectedPlayers(playerCount);
    setActiveGame(game);
    setFlowStep("play");
    setPaused(true);
    setHelpOpen(true);
    setCameraPreviewVisible(true);
    setRestartKey((value) => value + 1);
  }, []);

  const openPlayerSelect = () => {
    setSelectedPlayers(selectedGame.defaultPlayers);
    setFlowStep("select-players");
  };

  const launchGame = () => {
    setActiveGame(selectedGame);
    setFlowStep("play");
    setPaused(true);
    setHelpOpen(true);
    setCameraPreviewVisible(true);
    setRestartKey((value) => value + 1);
    const params = new URLSearchParams(window.location.search);
    params.set("play", selectedGame.id);
    params.set("players", String(selectedPlayers));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  const leavePlayScreen = () => {
    setActiveGame(null);
    setFlowStep("select-players");
    setPaused(true);
    setHelpOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.delete("play");
    params.delete("players");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  };

  if (activeGame && flowStep === "play") {
    return (
      <main
        className={[
          "game-hub-play-screen",
          activeGame.id === "ghost-hunters-3d" ? "is-ghost-game" : "",
          activeGame.runtime === "camera-dodge" ? "is-camera-game" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className="game-hub-playbar">
          <button type="button" onClick={leavePlayScreen} aria-label="Quay lại chọn người chơi">
            <ArrowLeft aria-hidden="true" size={18} />
            <span>Quay lại</span>
          </button>
          <div>
            <small>
              {activeGame.modeLabel} | {selectedPlayers} người chơi | {getEngineLabel(activeGame)}
            </small>
            <strong>{activeGame.title}</strong>
          </div>
          <div className="game-hub-play-actions">
            {activeGame.runtime === "camera-dodge" ? (
              <button
                type="button"
                onClick={() => setCameraPreviewVisible((value) => !value)}
                aria-label={cameraPreviewVisible ? "Ẩn camera preview" : "Hiện camera preview"}
                title={cameraPreviewVisible ? "Ẩn camera preview" : "Hiện camera preview"}
              >
                {cameraPreviewVisible ? <CameraOff aria-hidden="true" size={18} /> : <Camera aria-hidden="true" size={18} />}
                <span>{cameraPreviewVisible ? "Ẩn camera" : "Hiện camera"}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="game-hub-icon-action"
              onClick={() => {
                setPaused(true);
                setHelpOpen(true);
              }}
              aria-label="Mở hướng dẫn"
              title="Mở hướng dẫn"
            >
              <CircleHelp aria-hidden="true" size={20} />
            </button>
            <button type="button" onClick={() => setPaused((value) => !value)}>
              {paused ? <Play aria-hidden="true" size={18} /> : <Pause aria-hidden="true" size={18} />}
              <span>{paused ? "Tiếp tục" : "Tạm dừng"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(true);
                setHelpOpen(true);
                setRestartKey((value) => value + 1);
              }}
            >
              <RefreshCcw aria-hidden="true" size={18} />
              <span>Chơi lại</span>
            </button>
          </div>
        </header>

        <GameRuntime
          game={activeGame}
          paused={paused}
          restartKey={restartKey}
          playerCount={selectedPlayers}
          cameraPreviewVisible={cameraPreviewVisible}
          onCameraPreviewVisibleChange={setCameraPreviewVisible}
        />

        <GameHelpDialog
          game={activeGame}
          open={helpOpen}
          paused={paused}
          playerCount={selectedPlayers}
          onClose={() => setHelpOpen(false)}
          onResume={() => {
            setHelpOpen(false);
            setPaused(false);
          }}
        />
      </main>
    );
  }

  if (flowStep === "select-players") {
    return (
      <main className="game-hub-page game-hub-step-page">
        <header className="game-hub-step-header">
          <button type="button" onClick={() => setFlowStep("select-game")} aria-label="Quay lại chọn game">
            <ArrowLeft aria-hidden="true" size={18} />
            <span>Chọn game</span>
          </button>
          <div>
            <small>Bước 2</small>
            <h1>Chọn số lượng người chơi</h1>
          </div>
        </header>

        <section
          className="game-hub-player-setup"
          style={
            {
              "--game-accent": selectedGame.accent,
              "--game-secondary": selectedGame.secondaryAccent,
            } as CSSProperties
          }
        >
          <div className="game-hub-player-copy">
            <small>{selectedGame.modeLabel}</small>
            <h2>{selectedGame.title}</h2>
            <p>{selectedGame.objective}</p>
            <div className="game-hub-platform-list" aria-label="Nền tảng hỗ trợ">
              {selectedGame.supportedPlatforms.map((platform) => (
                <span key={platform}>
                  {platform === "camera" ? <Camera aria-hidden="true" size={15} /> : platform === "tv" ? <Tv aria-hidden="true" size={15} /> : <Monitor aria-hidden="true" size={15} />}
                  {platformLabels[platform]}
                </span>
              ))}
            </div>
          </div>

          <div className="game-hub-player-options" aria-label="Chọn số lượng người chơi">
            {selectedGame.supportedPlayers.map((count) => (
              <button
                key={count}
                type="button"
                className={selectedPlayers === count ? "is-selected" : ""}
                onClick={() => setSelectedPlayers(count)}
              >
                <Users aria-hidden="true" size={24} />
                <strong>{count}P</strong>
                <span>{getPlayerLabel(count, selectedGame)}</span>
              </button>
            ))}
          </div>

          <aside className="game-hub-player-summary">
            <strong>{getEngineLabel(selectedGame)}</strong>
            <p>{selectedGame.requiresCamera ? "Game này cần quyền camera. Camera sẽ nằm trong màn chơi và có thể ẩn preview." : "Game này chạy trực tiếp trong full-screen web bằng keyboard/local input."}</p>
            <button type="button" onClick={launchGame}>
              <Play aria-hidden="true" size={18} />
              <span>Vào màn chơi</span>
            </button>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="game-hub-page">
      <section className="game-hub-hero">
        <div className="game-hub-hero-copy">
          <span className="game-hub-kicker">
            <Sparkles aria-hidden="true" size={16} />
            Game Hub đa nền tảng
          </span>
          <h1>Game Hub</h1>
          <p>Chọn game, chọn số người chơi, rồi vào màn chơi full màn hình với engine mới và hướng dẫn pause tức thì.</p>
        </div>
        <div className="game-hub-hero-panel">
          <Gamepad2 aria-hidden="true" size={34} />
          <strong>{playableGameRegistry.length} game</strong>
          <span>R3F runtime mới, legacy adapter và camera motion cùng chung flow.</span>
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
            <small>
              {selectedGame.modeLabel} | {getEngineLabel(selectedGame)}
            </small>
            <h2>{selectedGame.title}</h2>
            <p>{selectedGame.objective}</p>
            <button type="button" onClick={openPlayerSelect}>
              <Users aria-hidden="true" size={18} />
              <span>Chọn người chơi</span>
            </button>
          </div>

          <div className="game-hub-control-card">
            <CircleHelp aria-hidden="true" size={22} />
            <strong>Flow mới</strong>
            <p>Game sẽ đi qua chọn game, chọn số người chơi, rồi vào full-screen web. Nút hướng dẫn luôn pause trận đấu.</p>
          </div>
        </aside>

        <section className="game-hub-games" aria-label="Danh sach game">
          {visibleGames.map((game) => (
            <button
              key={game.id}
              type="button"
              className={["game-card", selectedId === game.id ? "is-selected" : "", game.requiresCamera ? "is-camera-card" : ""]
                .filter(Boolean)
                .join(" ")}
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
                <span>{game.supportedPlayers.join("P / ")}P</span>
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
          <li>{getEngineLabel(selectedGame)}</li>
          {selectedGame.mechanics.map((mechanic) => (
            <li key={mechanic}>{mechanic}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function GameRuntime({
  game,
  paused,
  restartKey,
  playerCount,
  cameraPreviewVisible,
  onCameraPreviewVisibleChange,
}: {
  game: PlayableGameDefinition;
  paused: boolean;
  restartKey: number;
  playerCount: number;
  cameraPreviewVisible: boolean;
  onCameraPreviewVisibleChange: (visible: boolean) => void;
}) {
  if (game.runtime === "r3f-ghost") {
    return <R3FGhostHuntersGame game={game} paused={paused} restartKey={restartKey} playerCount={playerCount} />;
  }

  if (game.runtime === "camera-dodge") {
    return (
      <CameraDodgeGame
        embedded
        paused={paused}
        restartKey={restartKey}
        cameraPreviewVisible={cameraPreviewVisible}
        onCameraPreviewVisibleChange={onCameraPreviewVisibleChange}
      />
    );
  }

  if (isLegacyThreeGame(game)) {
    return <ThreeGameCanvas game={game} paused={paused} restartKey={restartKey} playerCount={playerCount} />;
  }

  return null;
}

function GameHelpDialog({
  game,
  open,
  paused,
  playerCount,
  onClose,
  onResume,
}: {
  game: PlayableGameDefinition;
  open: boolean;
  paused: boolean;
  playerCount: number;
  onClose: () => void;
  onResume: () => void;
}) {
  if (!open) return null;

  return (
    <div className="game-help-backdrop" role="presentation">
      <section className="game-help-dialog" role="dialog" aria-modal="true" aria-label={`Hướng dẫn ${game.title}`}>
        <button type="button" className="game-help-close" onClick={onClose} aria-label="Đóng hướng dẫn">
          <X aria-hidden="true" size={18} />
        </button>
        <small>{game.modeLabel}</small>
        <h2>{game.title}</h2>
        <p>{game.help.goal}</p>
        <div className="game-help-grid">
          <div>
            <strong>Điều khiển</strong>
            <ul>
              {game.help.controls.map((control) => (
                <li key={control}>{control}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Gợi ý</strong>
            <ul>
              {game.help.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="game-help-footer">
          <span>{playerCount} người chơi</span>
          <span>{game.requiresCamera ? "Cần camera" : getEngineLabel(game)}</span>
          <button type="button" onClick={onResume}>
            <Play aria-hidden="true" size={18} />
            <span>{paused ? "Bắt đầu chơi" : "Tiếp tục"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function getEngineLabel(game: PlayableGameDefinition) {
  return {
    "legacy-three": "Legacy Three adapter",
    "r3f-ghost": "R3F engine",
    "camera-dodge": "Camera runtime",
  }[game.runtime];
}

function getPlayerLabel(count: number, game: PlayableGameDefinition) {
  if (game.requiresCamera) return "Camera motion";
  if (count === 1) return "Solo";
  return "Local co-op/versus";
}

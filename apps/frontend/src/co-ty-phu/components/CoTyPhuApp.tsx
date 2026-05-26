"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BadgeAlert,
  Bot,
  CheckCircle2,
  Coins,
  Copy,
  Dice5,
  DoorClosed,
  Hotel,
  KeyRound,
  Landmark,
  LogIn,
  MapPinned,
  Menu,
  Plane,
  Play,
  RotateCcw,
  ShieldQuestion,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrendingUp,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import {
  DeckKind,
  DrawCard,
  jailFine,
  maxJailTurns,
  maxRoomPlayers,
  maxUpgradeLevel,
  regionLabels,
  Tile,
  TileKind,
  tiles,
} from "../data";
import {
  applyGameAction,
  canBuyCurrentTile,
  canPayJailFine,
  canUpgradeCurrentTile,
  canUseJailFreeCard,
  createInitialGame,
  formatMoney,
  GameAction,
  GameState,
  getCardById,
  getCurrentPlayer,
  getDeckLabel,
  getOwnedTiles,
  getOwner,
  getRent,
  getSelectedTile,
  getTileById,
  getUpgradeCost,
  isOwnable,
  playBotTurn,
  resetGame,
} from "../game";

const STORAGE_KEY = "du-lich-ty-phu-viet-nam-state-v2";
const SOCKET_NAMESPACE = "/co-ty-phu";

interface LobbyPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

interface ServerRoomView {
  code: string;
  status: "lobby" | "playing" | "finished";
  maxPlayers: number;
  ownPlayerId: string | null;
  isHost: boolean;
  players: LobbyPlayer[];
}

interface LobbyState {
  code: string;
  playerName: string;
  joinCode: string;
  players: LobbyPlayer[];
  error: string;
  connected: boolean;
  isHost: boolean;
  status: "idle" | "lobby" | "playing" | "finished";
  ownPlayerId: string | null;
}

type DiceMode = "normal" | "jailDouble" | null;
type AppScreen = "mode-select" | "solo-setup" | "multiplayer-lobby" | "game";
type GameMode = "solo-ai" | "multiplayer" | null;

interface SoloConfig {
  playerName: string;
  botCount: number;
}

export function CoTyPhuApp() {
  const [game, setGame] = useState<GameState>(() => loadSavedGame());
  const [screen, setScreen] = useState<AppScreen>("mode-select");
  const [gameMode, setGameMode] = useState<GameMode>(null);
  const [soloConfig, setSoloConfig] = useState<SoloConfig>({
    playerName: "Bạn",
    botCount: 3,
  });
  const [lobby, setLobby] = useState<LobbyState>(() => ({
    code: "",
    playerName: "Bạn",
    joinCode: "",
    players: [],
    error: "",
    connected: false,
    isHost: false,
    status: "idle",
    ownPlayerId: null,
  }));
  const [socket, setSocket] = useState<Socket | null>(null);
  const [inspectedTileId, setInspectedTileId] = useState(game.selectedTileId);
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [diceMode, setDiceMode] = useState<DiceMode>(null);

  const currentPlayer = getCurrentPlayer(game);
  const currentTile = getSelectedTile(game);
  const inspectedTile = getTileById(inspectedTileId);
  const activeCard = game.activeCardDraw ? getCardById(game.activeCardDraw.cardId) : null;
  const isSoloMode = gameMode === "solo-ai";
  const isMultiplayerMode = gameMode === "multiplayer";
  const isRealtimeGame = Boolean(isMultiplayerMode && socket?.connected && lobby.code && lobby.status === "playing");
  const canAct = Boolean(
    isSoloMode
      ? currentPlayer && !currentPlayer.isBot
      : isRealtimeGame && currentPlayer?.id === lobby.ownPlayerId,
  );
  const canRoll = Boolean(
    currentPlayer &&
      canAct &&
      !currentPlayer.isBot &&
      !currentPlayer.inJail &&
      game.phase === "ready" &&
      !game.pendingCardDraw &&
      !game.activeCardDraw,
  );
  const canEndTurn = Boolean(
    currentPlayer &&
      canAct &&
      !currentPlayer.isBot &&
      game.phase === "resolved" &&
      !game.pendingCardDraw &&
      !game.activeCardDraw,
  );

  const currentActionLabel = useMemo(() => {
    if (!currentPlayer) {
      return "Đang chuẩn bị lượt";
    }
    if (game.phase === "gameOver") {
      return "Ván chơi đã kết thúc";
    }
    if (game.phase === "drawingCard") {
      return game.pendingCardDraw
        ? `Rút ${getDeckLabel(game.pendingCardDraw.kind)}`
        : "Đang mở thẻ";
    }
    if (currentPlayer.inJail) {
      return `${currentPlayer.name} đang ở tù`;
    }
    if (currentPlayer.isBot) {
      return `${currentPlayer.name} đang chơi`;
    }
    if (game.phase === "ready") {
      return "Gieo xúc xắc";
    }
    return `Xử lý ${currentTile.shortName}`;
  }, [currentPlayer, currentTile.shortName, game]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game]);

  useEffect(() => {
    setInspectedTileId(game.selectedTileId);
    setIsSheetOpen(true);
  }, [game.selectedTileId]);

  useEffect(() => {
    const instance = io(getSocketUrl(), {
      transports: ["websocket", "polling"],
    });

    setSocket(instance);

    instance.on("connect", () => {
      setLobby((current) => ({ ...current, connected: true, error: "" }));
    });

    instance.on("disconnect", () => {
      setLobby((current) => ({ ...current, connected: false }));
    });

    instance.on("room:update", (room: ServerRoomView) => {
      setLobby((current) => ({
        ...current,
        code: room.code,
        joinCode: room.code,
        players: room.players,
        isHost: room.isHost,
        status: room.status,
        ownPlayerId: room.ownPlayerId,
        error: "",
      }));
    });

    instance.on("game:update", (nextGame: GameState) => {
      setGame(nextGame);
      setGameMode("multiplayer");
      setScreen("game");
      setInspectedTileId(nextGame.selectedTileId);
      setIsSheetOpen(true);
    });

    return () => {
      instance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (screen !== "game" || !isSoloMode || !currentPlayer?.isBot || game.phase !== "ready") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setGame((previous) => playBotTurn(previous));
    }, currentPlayer.inJail ? 900 : 850);

    return () => window.clearTimeout(timer);
  }, [
    currentPlayer?.id,
    currentPlayer?.isBot,
    currentPlayer?.inJail,
    game.phase,
    game.turnNumber,
    isSoloMode,
    screen,
  ]);

  function inspectTile(tileId: string) {
    setInspectedTileId(tileId);
    setIsSheetOpen(true);
  }

  function handleReset() {
    if (isMultiplayerMode && lobby.isHost && socket) {
      socket.emit("room:restart", { code: lobby.code }, handleAck);
      return;
    }

    const freshGame =
      isSoloMode
        ? createSoloGame(soloConfig)
        : resetGame();
    setGame(freshGame);
    setInspectedTileId(freshGame.selectedTileId);
    setIsSheetOpen(true);
  }

  function handleChangeMode() {
    if (isMultiplayerMode && socket && lobby.code) {
      socket.emit("room:leave", { code: lobby.code });
    }

    setScreen("mode-select");
    setGameMode(null);
    setDiceMode(null);
    setShowLog(false);
    setLobby((current) => ({
      ...current,
      code: "",
      joinCode: "",
      players: [],
      error: "",
      isHost: false,
      status: "idle",
      ownPlayerId: null,
    }));
  }

  function handleLeaveRoom() {
    if (socket && lobby.code) {
      socket.emit("room:leave", { code: lobby.code }, handleAck);
    }

    setScreen("multiplayer-lobby");
    setGameMode("multiplayer");
    setDiceMode(null);
    setLobby((current) => ({
      ...current,
      code: "",
      joinCode: "",
      players: [],
      error: "",
      isHost: false,
      status: "idle",
      ownPlayerId: null,
    }));
  }

  function startSoloGame(nextConfig = soloConfig) {
    const freshGame = createSoloGame(nextConfig);
    setSoloConfig(nextConfig);
    setGame(freshGame);
    setGameMode("solo-ai");
    setScreen("game");
    setInspectedTileId(freshGame.selectedTileId);
    setIsSheetOpen(true);
  }

  function handleStartRoom() {
    if (!socket || !lobby.code) {
      return;
    }

    socket.emit("room:start", { code: lobby.code }, handleAck);
  }

  function submitGameAction(action: GameAction) {
    if (isMultiplayerMode && socket) {
      socket.emit("game:action", { code: lobby.code, action }, handleAck);
      return;
    }

    setGame((previous) => applyGameAction(previous, action));
  }

  function handleConfirmDice(dice: [number, number]) {
    const mode = diceMode;
    setDiceMode(null);
    if (!mode) {
      return;
    }

    submitGameAction(mode === "jailDouble" ? { type: "TRY_JAIL_DOUBLE", dice } : { type: "ROLL", dice });
  }

  function handleAck(response?: { ok?: boolean; error?: string }) {
    if (response?.ok === false) {
      setLobby((current) => ({ ...current, error: response.error ?? "Server từ chối action." }));
    }
  }

  if (screen === "mode-select") {
    return (
      <ModeSelectScreen
        onSelectSolo={() => {
          setGameMode("solo-ai");
          setScreen("solo-setup");
        }}
        onSelectMultiplayer={() => {
          setGameMode("multiplayer");
          setScreen("multiplayer-lobby");
        }}
      />
    );
  }

  if (screen === "solo-setup") {
    return (
      <SoloSetupScreen
        config={soloConfig}
        onChange={setSoloConfig}
        onBack={() => {
          setGameMode(null);
          setScreen("mode-select");
        }}
        onStart={startSoloGame}
      />
    );
  }

  if (screen === "multiplayer-lobby") {
    return (
      <MultiplayerLobbyScreen
        lobby={lobby}
        setLobby={setLobby}
        socket={socket}
        onBack={() => {
          setGameMode(null);
          setScreen("mode-select");
        }}
        onStartRoom={handleStartRoom}
      />
    );
  }

  return (
    <div className="app-shell">
      <TopBar
        game={game}
        gameMode={gameMode}
        lobby={lobby}
        actionLabel={currentActionLabel}
        onToggleLog={() => setShowLog((value) => !value)}
        onReset={handleReset}
        onChangeMode={handleChangeMode}
        onLeaveRoom={handleLeaveRoom}
      />

      <main className="game-stage">
        <section className="board-section" aria-label="Bàn cờ du lịch">
          <GameBoard
            game={game}
            inspectedTileId={inspectedTileId}
            activeCard={activeCard}
            onInspectTile={inspectTile}
          />
        </section>

        <aside className="side-panel" aria-label="Bảng điều khiển ván chơi">
          <PlayerPanel game={game} gameMode={gameMode} lobby={lobby} />

          <ActionDock
            game={game}
            canRoll={canRoll}
            canEndTurn={canEndTurn}
            canAct={canAct}
            waitLabel={getWaitLabel(game, gameMode, lobby)}
            onRoll={() => setDiceMode("normal")}
            onTryJailDouble={() => setDiceMode("jailDouble")}
            onPayJailFine={() => submitGameAction({ type: "PAY_JAIL_FINE" })}
            onUseJailFreeCard={() => submitGameAction({ type: "USE_JAIL_FREE_CARD" })}
            onBuy={() => submitGameAction({ type: "BUY_TILE" })}
            onUpgrade={() => submitGameAction({ type: "UPGRADE_TILE" })}
            onEndTurn={() => submitGameAction({ type: "END_TURN" })}
          />

          <EndGamePanel
            game={game}
            gameMode={gameMode}
            lobby={lobby}
            onReset={handleReset}
            onChangeMode={handleChangeMode}
            onLeaveRoom={handleLeaveRoom}
          />

          <TileDetail
            game={game}
            tile={inspectedTile}
            activeCardTitle={activeCard?.title}
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
          />

          <GameLog game={game} isExpanded={showLog} onToggle={() => setShowLog((value) => !value)} />
        </aside>
      </main>

      <DiceRollModal mode={diceMode} onCancel={() => setDiceMode(null)} onConfirm={handleConfirmDice} />

      <CardDrawModal
        game={game}
        card={activeCard}
        canAct={canAct}
        onDraw={() => submitGameAction({ type: "DRAW_CARD" })}
        onClose={() => submitGameAction({ type: "CLOSE_CARD" })}
      />
    </div>
  );
}

function TopBar({
  game,
  gameMode,
  lobby,
  actionLabel,
  onToggleLog,
  onReset,
  onChangeMode,
  onLeaveRoom,
}: {
  game: GameState;
  gameMode: GameMode;
  lobby: LobbyState;
  actionLabel: string;
  onToggleLog: () => void;
  onReset: () => void;
  onChangeMode: () => void;
  onLeaveRoom: () => void;
}) {
  const currentPlayer = getCurrentPlayer(game);
  const isMultiplayer = gameMode === "multiplayer";
  const modeLabel = gameMode === "solo-ai" ? "Chơi với AI" : `Phòng ${game.room.code}`;
  const canReset = gameMode === "solo-ai" || (isMultiplayer && lobby.isHost);

  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <MapPinned aria-hidden="true" size={24} />
        <div>
          <span>Du Lịch</span>
          <strong>Tỷ Phú Việt Nam</strong>
        </div>
      </div>

      <div className="turn-summary" aria-live="polite">
        <span className="turn-dot" style={{ "--player-color": currentPlayer?.color } as CSSProperties} />
        <div>
          <small>
            {modeLabel} · {isMultiplayer ? (lobby.connected ? "Realtime online" : "Server offline") : "Local"} · Lượt{" "}
            {game.turnNumber}
          </small>
          <strong>{actionLabel}</strong>
        </div>
      </div>

      <div className="top-actions">
        <button className="icon-button" type="button" onClick={onChangeMode} aria-label="Đổi chế độ">
          <ArrowLeft aria-hidden="true" size={20} />
        </button>
        {isMultiplayer ? (
          <button className="icon-button" type="button" onClick={onLeaveRoom} aria-label="Rời phòng">
            <LogIn aria-hidden="true" size={20} />
          </button>
        ) : null}
        <button className="icon-button" type="button" onClick={onToggleLog} aria-label="Mở lịch sử">
          <Menu aria-hidden="true" size={20} />
        </button>
        <button className="icon-button" type="button" onClick={onReset} disabled={!canReset} aria-label="Chơi lại">
          <RotateCcw aria-hidden="true" size={20} />
        </button>
      </div>
    </header>
  );
}

function ModeSelectScreen({
  onSelectSolo,
  onSelectMultiplayer,
}: {
  onSelectSolo: () => void;
  onSelectMultiplayer: () => void;
}) {
  return (
    <main className="mode-screen">
      <section className="mode-card">
        <div className="mode-brand">
          <MapPinned aria-hidden="true" size={34} />
          <div>
            <span>Du Lịch Tỷ Phú Việt Nam</span>
            <h1>Chọn chế độ chơi</h1>
          </div>
        </div>

        <div className="mode-options">
          <button type="button" onClick={onSelectSolo}>
            <Bot aria-hidden="true" size={30} />
            <strong>Chơi với AI</strong>
            <span>Tạo ván local với 1-5 bot, không cần server.</span>
          </button>
          <button type="button" onClick={onSelectMultiplayer}>
            <Users aria-hidden="true" size={30} />
            <strong>Chơi với bạn bè</strong>
            <span>Tạo mã phòng realtime, tối đa 6 người chơi.</span>
          </button>
        </div>
      </section>
    </main>
  );
}

function SoloSetupScreen({
  config,
  onChange,
  onBack,
  onStart,
}: {
  config: SoloConfig;
  onChange: (config: SoloConfig) => void;
  onBack: () => void;
  onStart: (config: SoloConfig) => void;
}) {
  return (
    <main className="mode-screen">
      <section className="mode-card setup-card">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} />
          <span>Chọn chế độ</span>
        </button>

        <div className="mode-brand">
          <Bot aria-hidden="true" size={34} />
          <div>
            <span>Chơi với AI</span>
            <h1>Cấu hình ván local</h1>
          </div>
        </div>

        <div className="setup-form">
          <label>
            <span>Tên người chơi</span>
            <input
              value={config.playerName}
              maxLength={18}
              onChange={(event) => onChange({ ...config, playerName: event.target.value })}
            />
          </label>

          <label>
            <span>Số bot</span>
            <select
              value={config.botCount}
              onChange={(event) => onChange({ ...config, botCount: Number(event.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {count} bot
                </option>
              ))}
            </select>
          </label>
        </div>

        <button className="room-start" type="button" onClick={() => onStart(config)}>
          <Play aria-hidden="true" size={18} />
          <span>Bắt đầu với AI</span>
        </button>
      </section>
    </main>
  );
}

function MultiplayerLobbyScreen({
  lobby,
  setLobby,
  socket,
  onBack,
  onStartRoom,
}: {
  lobby: LobbyState;
  setLobby: Dispatch<SetStateAction<LobbyState>>;
  socket: Socket | null;
  onBack: () => void;
  onStartRoom: () => void;
}) {
  return (
    <main className="mode-screen">
      <section className="mode-card setup-card">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={18} />
          <span>Chọn chế độ</span>
        </button>
        <RoomPanel lobby={lobby} setLobby={setLobby} socket={socket} onStartRoom={onStartRoom} />
      </section>
    </main>
  );
}

function RoomPanel({
  lobby,
  setLobby,
  socket,
  onStartRoom,
}: {
  lobby: LobbyState;
  setLobby: Dispatch<SetStateAction<LobbyState>>;
  socket: Socket | null;
  onStartRoom: () => void;
}) {
  const canUseServer = Boolean(socket?.connected);
  const canStart =
    canUseServer &&
    lobby.isHost &&
    lobby.status === "lobby" &&
    lobby.players.length >= 2 &&
    lobby.players.length <= maxRoomPlayers;

  function createRoom() {
    if (!socket?.connected) {
      setLobby((current) => ({ ...current, error: "Socket.IO server chưa kết nối." }));
      return;
    }

    socket.emit("room:create", { playerName: normalizeName(lobby.playerName) }, handleRoomAck);
  }

  function joinRoom() {
    if (!socket?.connected) {
      setLobby((current) => ({ ...current, error: "Socket.IO server chưa kết nối." }));
      return;
    }

    socket.emit(
      "room:join",
      { code: lobby.joinCode.trim().toUpperCase(), playerName: normalizeName(lobby.playerName) },
      handleRoomAck,
    );
  }

  function handleRoomAck(response?: { ok?: boolean; error?: string; room?: ServerRoomView }) {
    if (response?.ok === false) {
      setLobby((current) => ({ ...current, error: response.error ?? "Không thể xử lý phòng." }));
      return;
    }

    if (response?.room) {
      setLobby((current) => ({
        ...current,
        code: response.room!.code,
        joinCode: response.room!.code,
        players: response.room!.players,
        isHost: response.room!.isHost,
        status: response.room!.status,
        ownPlayerId: response.room!.ownPlayerId,
        error: "",
      }));
    }
  }

  async function copyCode() {
    if (!lobby.code) {
      return;
    }

    await navigator.clipboard?.writeText(lobby.code);
    setLobby((current) => ({ ...current, error: "Đã copy mã phòng." }));
  }

  return (
    <section className="panel-section room-panel">
      <div className="panel-heading">
        <Users aria-hidden="true" size={18} />
        <h2>Phòng chơi</h2>
      </div>

      <div className="socket-status">
        <span className={lobby.connected ? "is-online" : "is-offline"} />
        {lobby.connected ? <Wifi aria-hidden="true" size={15} /> : <WifiOff aria-hidden="true" size={15} />}
        <strong>{lobby.connected ? "Realtime online" : "Server offline"}</strong>
      </div>

      <div className="room-form">
        <label>
          <span>Tên</span>
          <input
            value={lobby.playerName}
            maxLength={18}
            onChange={(event) => setLobby((current) => ({ ...current, playerName: event.target.value }))}
          />
        </label>

        <label>
          <span>Mã phòng</span>
          <input
            value={lobby.joinCode}
            maxLength={6}
            placeholder="VD: VN7KQ2"
            onChange={(event) =>
              setLobby((current) => ({ ...current, joinCode: event.target.value.toUpperCase() }))
            }
          />
        </label>
      </div>

      <div className="room-actions">
        <button type="button" onClick={createRoom} disabled={!canUseServer || lobby.status === "playing"}>
          <UserPlus aria-hidden="true" size={17} />
          <span>Tạo mã</span>
        </button>
        <button type="button" onClick={joinRoom} disabled={!canUseServer || lobby.status === "playing"}>
          <LogIn aria-hidden="true" size={17} />
          <span>Join</span>
        </button>
        <button type="button" onClick={copyCode} disabled={!lobby.code}>
          <Copy aria-hidden="true" size={17} />
          <span>Copy</span>
        </button>
      </div>

      {lobby.error ? <p className="room-error">{lobby.error}</p> : null}

      {lobby.code ? (
        <div className="room-code">
          <span>Mã</span>
          <strong>{lobby.code}</strong>
          <small>
            {lobby.players.length}/{maxRoomPlayers} người
          </small>
        </div>
      ) : null}

      {lobby.players.length > 0 ? (
        <div className="room-list">
          {lobby.players.map((player) => (
            <span
              key={player.id}
              className={!player.connected ? "is-disconnected" : ""}
              title={player.connected ? "Đang kết nối" : "Mất kết nối"}
            >
              {player.name}
              {player.isHost ? " · Host" : ""}
            </span>
          ))}
        </div>
      ) : null}

      <button
        className="room-start"
        type="button"
        disabled={!canStart}
        onClick={onStartRoom}
      >
        <Play aria-hidden="true" size={18} />
        <span>Bắt đầu phòng</span>
      </button>
    </section>
  );
}

function GameBoard({
  game,
  inspectedTileId,
  activeCard,
  onInspectTile,
}: {
  game: GameState;
  inspectedTileId: string;
  activeCard: DrawCard | null;
  onInspectTile: (tileId: string) => void;
}) {
  return (
    <div className="board-wrap">
      <div className="board" role="grid" aria-label="Bàn cờ địa danh Việt Nam">
        <div className="board-center" aria-live="polite">
          <img src="/co-ty-phu/vietnam-route.svg" alt="" className="route-art" />
          <div className="dice-panel">
            <span className="dice-value">{game.dice ? game.dice.join(" + ") : "--"}</span>
            <span className="dice-label">Xí ngầu</span>
          </div>
          <p>{game.message}</p>
          {activeCard ? <strong className="event-ribbon">{activeCard.title}</strong> : null}
        </div>

        {tiles.map((tile, index) => (
          <BoardTile
            key={tile.id}
            tile={tile}
            index={index}
            game={game}
            isInspected={tile.id === inspectedTileId}
            onInspectTile={onInspectTile}
          />
        ))}
      </div>
    </div>
  );
}

function BoardTile({
  tile,
  index,
  game,
  isInspected,
  onInspectTile,
}: {
  tile: Tile;
  index: number;
  game: GameState;
  isInspected: boolean;
  onInspectTile: (tileId: string) => void;
}) {
  const style = {
    ...getBoardPosition(index),
    "--tile-color": tile.color,
    "--owner-color": getOwner(game, tile.id)?.color ?? tile.color,
  } as CSSProperties;
  const TileIcon = getTileIcon(tile.kind);
  const property = game.properties[tile.id];
  const owner = getOwner(game, tile.id);
  const tokens = game.players.filter((player) => !player.bankrupt && player.position === index);
  const isCurrent = tile.id === game.selectedTileId;
  const tileClass = [
    "board-tile",
    `kind-${tile.kind}`,
    owner ? "is-owned" : "",
    isInspected ? "is-inspected" : "",
    isCurrent ? "is-current" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={tileClass}
      style={style}
      onClick={() => onInspectTile(tile.id)}
      role="gridcell"
      aria-label={tile.name}
    >
      <span className="tile-accent" aria-hidden="true" />
      <span className="tile-heading">
        <TileIcon aria-hidden="true" size={14} />
        <span>{tile.shortName}</span>
      </span>
      <span className="tile-meta">
        {isOwnable(tile) ? formatMoney(tile.price ?? 0) : getKindLabel(tile.kind)}
      </span>
      {isOwnable(tile) ? (
        <span className="upgrade-dots" aria-label={`Cấp ${property?.level ?? 0}`}>
          {Array.from({ length: maxUpgradeLevel }).map((_, dotIndex) => (
            <span
              key={`${tile.id}-${dotIndex}`}
              className={dotIndex < (property?.level ?? 0) ? "is-filled" : ""}
            />
          ))}
        </span>
      ) : null}
      <span className="tile-tokens">
        {tokens.map((player) => (
          <span
            key={player.id}
            className={["player-token", player.inJail ? "is-jailed" : ""].filter(Boolean).join(" ")}
            style={{ "--player-color": player.color } as CSSProperties}
            aria-label={player.name}
            title={player.inJail ? `${player.name} đang ở tù` : player.name}
          />
        ))}
      </span>
    </button>
  );
}

function PlayerPanel({
  game,
  gameMode,
  lobby,
}: {
  game: GameState;
  gameMode: GameMode;
  lobby: LobbyState;
}) {
  const currentPlayer = getCurrentPlayer(game);

  return (
    <section className="panel-section player-panel">
      <div className="panel-heading">
        <Users aria-hidden="true" size={18} />
        <h2>Người chơi</h2>
      </div>

      <div className="players-grid">
        {game.players.map((player) => {
          const ownedTiles = getOwnedTiles(game, player.id);
          const netWorth = getNetWorth(game, player.id);
          const lobbyPlayer = lobby.players.find((candidate) => candidate.id === player.id);
          const labels = [
            gameMode === "solo-ai" && player.isBot ? "Bot" : null,
            gameMode === "solo-ai" && !player.isBot ? "Bạn" : null,
            gameMode === "multiplayer" && lobbyPlayer?.id === lobby.ownPlayerId ? "Bạn" : null,
            gameMode === "multiplayer" && lobbyPlayer?.isHost ? "Host" : null,
            gameMode === "multiplayer" && lobbyPlayer && !lobbyPlayer.connected ? "Offline" : null,
            player.inJail ? "Trong tù" : null,
          ].filter(Boolean);

          return (
            <article
              key={player.id}
              className={[
                "player-card",
                currentPlayer?.id === player.id ? "is-active" : "",
                player.bankrupt ? "is-bankrupt" : "",
                player.inJail ? "is-jailed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--player-color": player.color } as CSSProperties}
            >
              <div className="player-card-main">
                <span className="player-avatar" aria-hidden="true" />
                <div>
                  <strong>{player.name}</strong>
                  <small>
                    {labels.join(" · ") || "Người chơi"} · {player.heldCardIds.length} thẻ tù
                  </small>
                </div>
              </div>
              <div className="player-stats">
                <span>{formatMoney(player.cash)}</span>
                <span>{ownedTiles.length} điểm</span>
                <span>{formatMoney(netWorth)}</span>
              </div>
              {player.inJail ? (
                <strong className="jail-badge">Tù: {player.jailTurnsRemaining}/{maxJailTurns}</strong>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActionDock({
  game,
  canRoll,
  canEndTurn,
  canAct,
  waitLabel,
  onRoll,
  onTryJailDouble,
  onPayJailFine,
  onUseJailFreeCard,
  onBuy,
  onUpgrade,
  onEndTurn,
}: {
  game: GameState;
  canRoll: boolean;
  canEndTurn: boolean;
  canAct: boolean;
  waitLabel: string;
  onRoll: () => void;
  onTryJailDouble: () => void;
  onPayJailFine: () => void;
  onUseJailFreeCard: () => void;
  onBuy: () => void;
  onUpgrade: () => void;
  onEndTurn: () => void;
}) {
  const tile = getSelectedTile(game);
  const currentPlayer = getCurrentPlayer(game);
  const buyLabel = isOwnable(tile) ? formatMoney(tile.price ?? 0) : "";
  const upgradeLabel = isOwnable(tile) ? formatMoney(getUpgradeCost(game, tile)) : "";

  if (!canAct) {
    return (
      <section className="action-dock action-dock-wait" aria-label="Đang chờ lượt">
        <button className="action-button primary" type="button" disabled>
          <Dice5 aria-hidden="true" size={20} />
          <span>{waitLabel}</span>
        </button>
      </section>
    );
  }

  if (canAct && currentPlayer?.inJail && !currentPlayer.isBot && game.phase === "ready") {
    return (
      <section className="action-dock" aria-label="Hành động trong tù">
        <button className="action-button primary" type="button" onClick={onPayJailFine} disabled={!canPayJailFine(game)}>
          <Coins aria-hidden="true" size={20} />
          <span>Trả {formatMoney(jailFine)}</span>
        </button>
        <button className="action-button" type="button" onClick={onUseJailFreeCard} disabled={!canUseJailFreeCard(game)}>
          <Ticket aria-hidden="true" size={20} />
          <span>Dùng thẻ</span>
        </button>
        <button className="action-button" type="button" onClick={onTryJailDouble}>
          <Dice5 aria-hidden="true" size={20} />
          <span>Gieo đôi</span>
        </button>
        <button className="action-button finish" type="button" disabled>
          <CheckCircle2 aria-hidden="true" size={20} />
          <span>Chưa xong</span>
        </button>
      </section>
    );
  }

  return (
    <section className="action-dock" aria-label="Hành động lượt chơi">
      <button className="action-button primary" type="button" onClick={onRoll} disabled={!canRoll}>
        <Dice5 aria-hidden="true" size={20} />
        <span>Gieo</span>
      </button>
      <button className="action-button" type="button" onClick={onBuy} disabled={!canAct || !canBuyCurrentTile(game)}>
        <ShoppingBag aria-hidden="true" size={20} />
        <span>Mua {buyLabel}</span>
      </button>
      <button
        className="action-button"
        type="button"
        onClick={onUpgrade}
        disabled={!canAct || !canUpgradeCurrentTile(game)}
      >
        <TrendingUp aria-hidden="true" size={20} />
        <span>Nâng {upgradeLabel}</span>
      </button>
      <button className="action-button finish" type="button" onClick={onEndTurn} disabled={!canEndTurn}>
        <CheckCircle2 aria-hidden="true" size={20} />
        <span>Kết thúc</span>
      </button>
    </section>
  );
}

function EndGamePanel({
  game,
  gameMode,
  lobby,
  onReset,
  onChangeMode,
  onLeaveRoom,
}: {
  game: GameState;
  gameMode: GameMode;
  lobby: LobbyState;
  onReset: () => void;
  onChangeMode: () => void;
  onLeaveRoom: () => void;
}) {
  if (game.phase !== "gameOver") {
    return null;
  }

  const winner = game.players.find((player) => player.id === game.winnerId);
  const isMultiplayer = gameMode === "multiplayer";

  return (
    <section className="panel-section end-panel">
      <div>
        <small>Kết thúc ván</small>
        <h2>{winner ? `${winner.name} thắng` : "Đã kết thúc"}</h2>
      </div>
      {isMultiplayer && !lobby.isHost ? (
        <p>Đang chờ host bắt đầu lại phòng.</p>
      ) : null}
      <div className="end-actions">
        {gameMode === "solo-ai" || lobby.isHost ? (
          <button type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" size={18} />
            <span>{gameMode === "solo-ai" ? "Chơi lại" : "Chơi lại phòng"}</span>
          </button>
        ) : null}
        {isMultiplayer ? (
          <button type="button" onClick={onLeaveRoom}>
            <LogIn aria-hidden="true" size={18} />
            <span>Rời phòng</span>
          </button>
        ) : (
          <button type="button" onClick={onChangeMode}>
            <ArrowLeft aria-hidden="true" size={18} />
            <span>Đổi chế độ</span>
          </button>
        )}
      </div>
    </section>
  );
}

function TileDetail({
  game,
  tile,
  activeCardTitle,
  isOpen,
  onClose,
}: {
  game: GameState;
  tile: Tile;
  activeCardTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const owner = getOwner(game, tile.id);
  const property = game.properties[tile.id];
  const rent = getRent(game, tile);
  const upgradeCost = getUpgradeCost(game, tile);
  const isActionTile = tile.id === game.selectedTileId;
  const deckKind = tile.kind === "chance" || tile.kind === "fortune" ? tile.kind : null;
  const deck = deckKind ? game.decks[deckKind] : null;

  return (
    <section className={["detail-sheet", isOpen ? "is-open" : ""].join(" ")}>
      <span className="sheet-handle" aria-hidden="true" />
      <header className="detail-header">
        <div>
          <small>{getKindLabel(tile.kind)}</small>
          <h2>{tile.name}</h2>
        </div>
        <button className="icon-button sheet-close" type="button" onClick={onClose} aria-label="Đóng">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <p className="detail-description">{tile.description}</p>

      <div className="detail-stats">
        {tile.region ? (
          <span>
            <strong>Vùng</strong>
            {regionLabels[tile.region]}
          </span>
        ) : null}
        {isOwnable(tile) ? (
          <>
            <span>
              <strong>Giá</strong>
              {formatMoney(tile.price ?? 0)}
            </span>
            <span>
              <strong>Phí</strong>
              {formatMoney(rent)}
            </span>
            <span>
              <strong>Nâng cấp</strong>
              {property && property.level < maxUpgradeLevel ? formatMoney(upgradeCost) : "Tối đa"}
            </span>
            <span>
              <strong>Chủ</strong>
              {owner?.name ?? "Chưa có"}
            </span>
          </>
        ) : null}
        {deckKind && deck ? (
          <>
            <span>
              <strong>Lượt rút kế</strong>
              {deck.nextDrawNumber}/50
            </span>
            <span>
              <strong>Vòng deck</strong>
              {deck.cycle}
            </span>
          </>
        ) : null}
        {tile.kind === "jail" ? (
          <span>
            <strong>Phạt ra tù</strong>
            {formatMoney(jailFine)}
          </span>
        ) : null}
        {(tile.kind === "chance" || tile.kind === "fortune") && activeCardTitle ? (
          <span>
            <strong>Thẻ vừa rút</strong>
            {activeCardTitle}
          </span>
        ) : null}
      </div>

      {isOwnable(tile) ? (
        <div className="level-row" aria-label={`Cấp nâng cấp ${property?.level ?? 0}`}>
          {Array.from({ length: maxUpgradeLevel }).map((_, index) => (
            <span
              key={`${tile.id}-level-${index}`}
              className={index < (property?.level ?? 0) ? "is-filled" : ""}
            />
          ))}
        </div>
      ) : null}

      {isActionTile ? <strong className="action-note">Ô hiện tại của lượt chơi</strong> : null}
    </section>
  );
}

function DiceRollModal({
  mode,
  onCancel,
  onConfirm,
}: {
  mode: DiceMode;
  onCancel: () => void;
  onConfirm: (dice: [number, number]) => void;
}) {
  const [previewDice, setPreviewDice] = useState<[number, number]>([1, 1]);

  useEffect(() => {
    if (!mode) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setPreviewDice([randomFace(), randomFace()]);
    }, 110);

    return () => window.clearInterval(timer);
  }, [mode]);

  if (!mode) {
    return null;
  }

  const isJailMode = mode === "jailDouble";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Canh xí ngầu">
      <section className="dice-modal">
        <header>
          <div>
            <small>{isJailMode ? "Gieo đôi để ra tù" : "Canh số nút"}</small>
            <h2>{isJailMode ? "Chốt đúng cặp đôi" : "Tập trung và chốt số"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Đóng">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="dice-faces" aria-live="polite">
          <DiceFace value={previewDice[0]} />
          <DiceFace value={previewDice[1]} />
        </div>

        <strong className="dice-total">
          {previewDice[0]} + {previewDice[1]} = {previewDice[0] + previewDice[1]}
        </strong>

        <button className="dice-confirm" type="button" onClick={() => onConfirm(previewDice)}>
          <Dice5 aria-hidden="true" size={21} />
          <span>Chốt số</span>
        </button>
      </section>
    </div>
  );
}

function DiceFace({ value }: { value: number }) {
  return (
    <div className={`dice-face dice-${value}`} aria-label={`${value} nút`}>
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function CardDrawModal({
  game,
  card,
  canAct,
  onDraw,
  onClose,
}: {
  game: GameState;
  card: DrawCard | null;
  canAct: boolean;
  onDraw: () => void;
  onClose: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const pending = game.pendingCardDraw;
  const active = game.activeCardDraw;
  const deckKind = pending?.kind ?? active?.kind ?? null;

  useEffect(() => {
    if (!active) {
      setFlipped(false);
      return undefined;
    }

    setFlipped(false);
    const timer = window.setTimeout(() => setFlipped(true), 80);
    return () => window.clearTimeout(timer);
  }, [active?.cardId]);

  if (!deckKind) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Rút ${getDeckLabel(deckKind)}`}>
      <section className="card-modal">
        <header>
          <div>
            <small>{getDeckLabel(deckKind)}</small>
            <h2>{active ? `${active.drawNumber}/50 · Vòng ${active.cycle}` : "Rút thẻ"}</h2>
          </div>
        </header>

        <div className="draw-card-scene">
          <article className={["draw-card", flipped ? "is-flipped" : ""].join(" ")}>
            <div className="draw-card-face draw-card-back">
              <Sparkles aria-hidden="true" size={38} />
              <strong>{getDeckLabel(deckKind)}</strong>
              <span>Nhấn rút để lật thẻ</span>
            </div>
            <div className="draw-card-face draw-card-front">
              <small>{card ? getEffectLabel(card) : "Đang mở"}</small>
              <strong>{card?.title ?? "Đang rút thẻ"}</strong>
              <p>{card?.description ?? "Thẻ sẽ hiển thị sau khi lật."}</p>
            </div>
          </article>
        </div>

        {!active ? (
          <button className="dice-confirm" type="button" onClick={onDraw} disabled={!canAct}>
            <Sparkles aria-hidden="true" size={20} />
            <span>{canAct ? "Rút thẻ" : "Chờ người chơi rút"}</span>
          </button>
        ) : (
          <button className="dice-confirm" type="button" onClick={onClose} disabled={!canAct}>
            <CheckCircle2 aria-hidden="true" size={20} />
            <span>{canAct ? "Đóng và tiếp tục" : "Chờ xử lý thẻ"}</span>
          </button>
        )}
      </section>
    </div>
  );
}

function GameLog({
  game,
  isExpanded,
  onToggle,
}: {
  game: GameState;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className={["panel-section game-log", isExpanded ? "is-expanded" : ""].join(" ")}>
      <button className="log-toggle" type="button" onClick={onToggle}>
        <Sparkles aria-hidden="true" size={18} />
        <span>Lịch sử</span>
      </button>
      <ol>
        {game.log.slice(0, isExpanded ? 12 : 5).map((entry, index) => (
          <li key={`${entry}-${index}`}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}

function getBoardPosition(index: number): CSSProperties {
  if (index <= 7) {
    return { gridRow: 8, gridColumn: 8 - index };
  }
  if (index <= 14) {
    return { gridRow: 15 - index, gridColumn: 1 };
  }
  if (index <= 21) {
    return { gridRow: 1, gridColumn: index - 14 + 1 };
  }
  return { gridRow: index - 21 + 1, gridColumn: 8 };
}

function getTileIcon(kind: TileKind): LucideIcon {
  switch (kind) {
    case "landmark":
      return Landmark;
    case "transport":
      return Plane;
    case "chance":
      return ShieldQuestion;
    case "fortune":
      return BadgeAlert;
    case "tax":
      return Coins;
    case "rest":
      return Hotel;
    case "jail":
      return DoorClosed;
    case "goToJail":
      return KeyRound;
    case "start":
    default:
      return MapPinned;
  }
}

function getKindLabel(kind: TileKind): string {
  switch (kind) {
    case "landmark":
      return "Địa danh";
    case "transport":
      return "Giao thông";
    case "chance":
      return "Cơ hội";
    case "fortune":
      return "Khí vận";
    case "tax":
      return "Phí";
    case "rest":
      return "Nghỉ dưỡng";
    case "jail":
      return "Nhà tù";
    case "goToJail":
      return "Vào tù";
    case "start":
    default:
      return "Xuất phát";
  }
}

function getEffectLabel(card: DrawCard): string {
  switch (card.effect.type) {
    case "cash":
      return "Nhận tiền";
    case "pay":
      return "Trả tiền";
    case "ownedIncome":
    case "regionIncome":
      return "Doanh thu";
    case "maintenance":
      return "Bảo trì";
    case "goToJail":
      return "Vào tù";
    case "getOutOfJailFree":
      return "Giữ thẻ";
  }
}

function getNetWorth(game: GameState, playerId: string): number {
  return getOwnedTiles(game, playerId).reduce((sum, tile) => {
    const property = game.properties[tile.id];
    return sum + (tile.price ?? 0) + (property?.level ?? 0) * (tile.upgradeCost ?? 0);
  }, game.players.find((player) => player.id === playerId)?.cash ?? 0);
}

function createSoloGame(config: SoloConfig): GameState {
  const botNames = ["Lan", "Minh", "An", "Hải", "Vy"];
  return createInitialGame({
    playerNames: [normalizeName(config.playerName), ...botNames.slice(0, config.botCount)],
    humanPlayerCount: 1,
    roomCode: "AI",
  });
}

function getWaitLabel(game: GameState, gameMode: GameMode, lobby: LobbyState): string {
  const currentPlayer = getCurrentPlayer(game);
  if (gameMode !== "multiplayer") {
    return currentPlayer?.isBot ? `${currentPlayer.name} đang chơi` : "Đang chờ";
  }

  if (!lobby.connected) {
    return "Mất kết nối server";
  }

  if (!currentPlayer) {
    return "Đang chờ phòng";
  }

  if (game.phase === "drawingCard") {
    return `Chờ ${currentPlayer.name} rút thẻ`;
  }

  if (currentPlayer.inJail) {
    return `Chờ ${currentPlayer.name} xử lý tù`;
  }

  return `Chờ ${currentPlayer.name} gieo`;
}

function randomFace(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function getSocketUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (!baseUrl) {
    return SOCKET_NAMESPACE;
  }
  return baseUrl.endsWith(SOCKET_NAMESPACE) ? baseUrl : `${baseUrl}${SOCKET_NAMESPACE}`;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  return trimmed || "Người chơi";
}

function loadSavedGame(): GameState {
  if (typeof window === "undefined") {
    return createInitialGame();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialGame();
    }

    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 2 || !Array.isArray(parsed.players) || !parsed.properties || !parsed.decks) {
      return createInitialGame();
    }

    return parsed;
  } catch {
    return createInitialGame();
  }
}

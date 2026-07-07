import {
  allCards,
  chanceCards,
  deckSize,
  DeckKind,
  DrawCard,
  fortuneCards,
  jailFine,
  maxJailTurns,
  maxRoomPlayers,
  regionLabels,
  restBonus,
  startBonus,
  startingCash,
  taxAmount,
  Tile,
  tiles,
} from "./data";

export interface Player {
  id: string;
  name: string;
  color: string;
  cash: number;
  position: number;
  isBot: boolean;
  bankrupt: boolean;
  inJail: boolean;
  jailTurnsRemaining: number;
  heldCardIds: string[];
}

export interface PropertyState {
  ownerId: string | null;
  level: number;
  mortgaged: boolean;
  investedUpgradeCost: number;
}

export interface SharedDeckState {
  drawPile: string[];
  discardPile: string[];
  cycle: number;
  nextDrawNumber: number;
}

export interface PendingCardDraw {
  kind: DeckKind;
  playerId: string;
  tileId: string;
}

export interface ActiveCardDraw extends PendingCardDraw {
  cardId: string;
  drawNumber: number;
  cycle: number;
}

export interface RoomState {
  code: string;
  hostPlayerId: string;
  status: "lobby" | "playing" | "finished";
  maxPlayers: number;
}

export type GamePhase = "ready" | "resolved" | "drawingCard" | "gameOver";

export interface GameState {
  version: number;
  room: RoomState;
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  dice: [number, number] | null;
  properties: Record<string, PropertyState>;
  decks: Record<DeckKind, SharedDeckState>;
  selectedTileId: string;
  pendingCardDraw: PendingCardDraw | null;
  activeCardDraw: ActiveCardDraw | null;
  upgradedThisTurn: boolean;
  message: string;
  log: string[];
  turnNumber: number;
  winnerId: string | null;
}

export type GameAction =
  | { type: "ROLL"; dice: [number, number] }
  | { type: "TRY_JAIL_DOUBLE"; dice: [number, number] }
  | { type: "DRAW_CARD" }
  | { type: "CLOSE_CARD" }
  | { type: "BUY_TILE" }
  | { type: "UPGRADE_TILE"; tileId?: string }
  | { type: "SELL_TILE"; tileId: string }
  | { type: "MORTGAGE_TILE"; tileId: string }
  | { type: "REDEEM_MORTGAGE"; tileId: string }
  | { type: "END_TURN" }
  | { type: "PAY_JAIL_FINE" }
  | { type: "USE_JAIL_FREE_CARD" };

export interface CreateGameOptions {
  playerNames?: string[];
  humanPlayerCount?: number;
  roomCode?: string;
}

const playerColors = ["#e84336", "#2f7e79", "#4567b0", "#f2a541", "#7b5ab6", "#d84f3a"];
const defaultNames = ["Bạn", "Lan", "Minh", "An"];

export function createInitialGame(options: CreateGameOptions = {}): GameState {
  const properties = tiles.reduce<Record<string, PropertyState>>((acc, tile) => {
    if (isOwnable(tile)) {
      acc[tile.id] = createEmptyProperty();
    }
    return acc;
  }, {});
  const names = (options.playerNames?.length ? options.playerNames : defaultNames).slice(
    0,
    maxRoomPlayers,
  );
  const humanPlayerCount = options.humanPlayerCount ?? 1;

  return {
    version: 3,
    room: {
      code: options.roomCode ?? "LOCAL",
      hostPlayerId: "p1",
      status: "playing",
      maxPlayers: maxRoomPlayers,
    },
    players: names.map((name, index) => createPlayer(index, name, index >= humanPlayerCount)),
    currentPlayerIndex: 0,
    phase: "ready",
    dice: null,
    properties,
    decks: {
      chance: createDeckState("chance"),
      fortune: createDeckState("fortune"),
    },
    selectedTileId: "start",
    pendingCardDraw: null,
    activeCardDraw: null,
    upgradedThisTurn: false,
    message: "Đến lượt Bạn. Hãy gieo xúc xắc để bắt đầu hành trình.",
    log: ["Ván chơi mới đã sẵn sàng."],
    turnNumber: 1,
    winnerId: null,
  };
}

export function isOwnable(tile: Tile): boolean {
  return tile.kind === "landmark" || tile.kind === "transport";
}

export function createEmptyProperty(): PropertyState {
  return { ownerId: null, level: 0, mortgaged: false, investedUpgradeCost: 0 };
}

export function getCurrentPlayer(state: GameState): Player | null {
  return state.players[state.currentPlayerIndex] ?? null;
}

export function getSelectedTile(state: GameState): Tile {
  return tiles.find((tile) => tile.id === state.selectedTileId) ?? tiles[0];
}

export function getTileById(tileId: string): Tile {
  return tiles.find((tile) => tile.id === tileId) ?? tiles[0];
}

export function getCardById(cardId: string): DrawCard | null {
  return allCards.find((card) => card.id === cardId) ?? null;
}

export function getOwner(state: GameState, tileId: string): Player | null {
  const ownerId = state.properties[tileId]?.ownerId;
  return ownerId ? state.players.find((player) => player.id === ownerId) ?? null : null;
}

export function getOwnedTiles(state: GameState, playerId: string): Tile[] {
  return tiles.filter((tile) => state.properties[tile.id]?.ownerId === playerId);
}

export function getRent(state: GameState, tile: Tile): number {
  if (!isOwnable(tile)) {
    return 0;
  }

  const property = state.properties[tile.id];
  if (property?.mortgaged) {
    return 0;
  }

  const level = property?.level ?? 0;
  const transportCount = tile.kind === "transport" && property?.ownerId ? countOwnedActiveTransports(state, property.ownerId) : 0;

  return getRentAtLevel(tile, level, transportCount);
}

export function getUpgradeCost(state: GameState, tile: Tile): number {
  const property = state.properties[tile.id];
  return getUpgradeCostAtLevel(tile, property?.level ?? 0);
}

export function getRentAtLevel(tile: Tile, level: number, transportCount = 0): number {
  if (!isOwnable(tile)) {
    return 0;
  }

  if (tile.kind === "transport") {
    return Math.round((tile.baseFee ?? 0) * getTransportRentMultiplier(transportCount));
  }

  const safeLevel = Math.max(0, level);
  return Math.round((tile.baseFee ?? 0) * (1 + safeLevel * 0.75));
}

export function getUpgradeCostAtLevel(tile: Tile, level: number): number {
  if (tile.kind !== "landmark") {
    return 0;
  }

  const safeLevel = Math.max(0, level);
  return Math.round((tile.upgradeCost ?? 0) * (1 + safeLevel * 0.35));
}

export function getSellValue(tile: Tile, property?: PropertyState | null): number {
  if (!isOwnable(tile)) {
    return 0;
  }

  return Math.round((tile.price ?? 0) * 0.8 + (property?.investedUpgradeCost ?? 0) * 0.5);
}

export function getMortgageValue(tile: Tile, property?: PropertyState | null): number {
  if (!isOwnable(tile)) {
    return 0;
  }

  return Math.round((tile.price ?? 0) * 0.5 + (property?.investedUpgradeCost ?? 0) * 0.25);
}

export function getRedeemMortgageValue(tile: Tile, property?: PropertyState | null): number {
  return Math.round(getMortgageValue(tile, property) * 1.1);
}

export function canBuyCurrentTile(state: GameState): boolean {
  const player = getCurrentPlayer(state);
  const tile = getSelectedTile(state);
  const property = state.properties[tile.id];

  return Boolean(
    player &&
      !player.isBot &&
      !player.inJail &&
      state.phase === "resolved" &&
      !state.pendingCardDraw &&
      !state.activeCardDraw &&
      isOwnable(tile) &&
      property &&
      property.ownerId === null &&
      player.cash >= (tile.price ?? 0),
  );
}

export function canUpgradeCurrentTile(state: GameState): boolean {
  return canUpgradeTile(state, state.selectedTileId);
}

export function canUpgradeTile(state: GameState, tileId: string): boolean {
  const player = getCurrentPlayer(state);
  const tile = getTileById(tileId);
  const property = state.properties[tile.id];
  const cost = getUpgradeCost(state, tile);

  return Boolean(
    player &&
      !player.isBot &&
      !player.inJail &&
      !state.upgradedThisTurn &&
      state.phase === "resolved" &&
      !state.pendingCardDraw &&
      !state.activeCardDraw &&
      tile.kind === "landmark" &&
      property &&
      property.ownerId === player.id &&
      !property.mortgaged &&
      player.cash >= cost,
  );
}

export function canSellTile(state: GameState, tileId: string): boolean {
  const player = getCurrentPlayer(state);
  const property = state.properties[tileId];
  const tile = getTileById(tileId);

  return Boolean(
    player &&
      !player.isBot &&
      !player.inJail &&
      (state.phase === "ready" || state.phase === "resolved") &&
      !state.pendingCardDraw &&
      !state.activeCardDraw &&
      isOwnable(tile) &&
      property &&
      property.ownerId === player.id &&
      !property.mortgaged,
  );
}

export function canMortgageTile(state: GameState, tileId: string): boolean {
  const player = getCurrentPlayer(state);
  const property = state.properties[tileId];
  const tile = getTileById(tileId);

  return Boolean(
    player &&
      !player.isBot &&
      !player.inJail &&
      (state.phase === "ready" || state.phase === "resolved") &&
      !state.pendingCardDraw &&
      !state.activeCardDraw &&
      isOwnable(tile) &&
      property &&
      property.ownerId === player.id &&
      !property.mortgaged,
  );
}

export function canRedeemMortgageTile(state: GameState, tileId: string): boolean {
  const player = getCurrentPlayer(state);
  const property = state.properties[tileId];
  const tile = getTileById(tileId);
  const redeemValue = getRedeemMortgageValue(tile, property);

  return Boolean(
    player &&
      !player.isBot &&
      !player.inJail &&
      (state.phase === "ready" || state.phase === "resolved") &&
      !state.pendingCardDraw &&
      !state.activeCardDraw &&
      isOwnable(tile) &&
      property &&
      property.ownerId === player.id &&
      property.mortgaged &&
      player.cash >= redeemValue,
  );
}

export function canPayJailFine(state: GameState): boolean {
  const player = getCurrentPlayer(state);
  return Boolean(player && !player.isBot && player.inJail && state.phase === "ready" && player.cash >= jailFine);
}

export function canUseJailFreeCard(state: GameState): boolean {
  const player = getCurrentPlayer(state);
  return Boolean(player && !player.isBot && player.inJail && state.phase === "ready" && player.heldCardIds.length > 0);
}

export function applyGameAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ROLL":
      return rollCurrentTurn(state, action.dice);
    case "TRY_JAIL_DOUBLE":
      return tryRollDoubleForJail(state, action.dice);
    case "DRAW_CARD":
      return drawPendingCard(state);
    case "CLOSE_CARD":
      return closeActiveCard(state);
    case "BUY_TILE":
      return buyCurrentTile(state);
    case "UPGRADE_TILE":
      return upgradeTile(state, action.tileId ?? state.selectedTileId);
    case "SELL_TILE":
      return sellTile(state, action.tileId);
    case "MORTGAGE_TILE":
      return mortgageTile(state, action.tileId);
    case "REDEEM_MORTGAGE":
      return redeemMortgageTile(state, action.tileId);
    case "END_TURN":
      return endTurn(state);
    case "PAY_JAIL_FINE":
      return payJailFine(state);
    case "USE_JAIL_FREE_CARD":
      return useJailFreeCard(state);
  }
}

export function rollCurrentTurn(state: GameState, dice: [number, number] = randomDice()): GameState {
  const player = getCurrentPlayer(state);
  if (!player || player.bankrupt || player.inJail || state.phase !== "ready") {
    return state;
  }

  return movePlayerByDice(state, player.id, dice);
}

export function drawPendingCard(state: GameState): GameState {
  const pending = state.pendingCardDraw;
  if (!pending || state.activeCardDraw || state.phase !== "drawingCard") {
    return state;
  }

  const draw = drawFromSharedDeck(state.decks[pending.kind], pending.kind);
  const card = getCardById(draw.cardId);
  const next: GameState = {
    ...state,
    decks: {
      ...state.decks,
      [pending.kind]: draw.deck,
    },
    pendingCardDraw: null,
    activeCardDraw: {
      ...pending,
      cardId: draw.cardId,
      drawNumber: draw.drawNumber,
      cycle: draw.cycle,
    },
    message: `${getDeckLabel(pending.kind)} ${draw.drawNumber}/${deckSize}: ${
      card?.title ?? "Thẻ chưa xác định"
    }.`,
  };

  return addLog(next, `${getPlayerName(next, pending.playerId)} rút ${getDeckLabel(pending.kind)} ${draw.drawNumber}/${deckSize}.`);
}

export function closeActiveCard(state: GameState): GameState {
  const active = state.activeCardDraw;
  if (!active || state.phase !== "drawingCard") {
    return state;
  }

  const card = getCardById(active.cardId);
  if (!card) {
    return {
      ...state,
      activeCardDraw: null,
      phase: "resolved",
      message: "Thẻ không hợp lệ, lượt chơi được tiếp tục.",
    };
  }

  let next: GameState = {
    ...state,
    activeCardDraw: null,
    phase: "resolved",
  };
  next = applyCardEffect(next, active.playerId, card);

  if (card.effect.type !== "getOutOfJailFree") {
    next = discardCard(next, card.id);
  }

  return finalizeState(addLog(next, `${getPlayerName(next, active.playerId)} xử lý thẻ ${card.title}.`));
}

export function buyCurrentTile(state: GameState): GameState {
  if (!canBuyCurrentTile(state)) {
    return state;
  }

  const player = getCurrentPlayer(state)!;
  const tile = getSelectedTile(state);

  const next = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === player.id
        ? { ...candidate, cash: candidate.cash - (tile.price ?? 0) }
        : candidate,
    ),
    properties: {
      ...state.properties,
      [tile.id]: { ...createEmptyProperty(), ownerId: player.id },
    },
    message: `${player.name} đã mua ${tile.name} với giá ${formatMoney(tile.price ?? 0)}.`,
  };

  return finalizeState(addLog(next, next.message));
}

export function upgradeCurrentTile(state: GameState): GameState {
  return upgradeTile(state, state.selectedTileId);
}

export function upgradeTile(state: GameState, tileId: string): GameState {
  if (!canUpgradeTile(state, tileId)) {
    return state;
  }

  const player = getCurrentPlayer(state)!;
  const tile = getTileById(tileId);
  const cost = getUpgradeCost(state, tile);
  const property = state.properties[tile.id];
  const nextLevel = (property?.level ?? 0) + 1;

  const next = {
    ...state,
    upgradedThisTurn: true,
    players: state.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, cash: candidate.cash - cost } : candidate,
    ),
    properties: {
      ...state.properties,
      [tile.id]: {
        ...property,
        ownerId: player.id,
        level: nextLevel,
        mortgaged: false,
        investedUpgradeCost: (property?.investedUpgradeCost ?? 0) + cost,
      },
    },
    message: `${player.name} nâng cấp ${tile.name} lên cấp ${nextLevel}.`,
  };

  return finalizeState(addLog(next, `${next.message} Chi phí ${formatMoney(cost)}.`));
}

export function sellTile(state: GameState, tileId: string): GameState {
  if (!canSellTile(state, tileId)) {
    return state;
  }

  const player = getCurrentPlayer(state)!;
  const tile = getTileById(tileId);
  const property = state.properties[tile.id];
  const sellValue = getSellValue(tile, property);
  const next: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, cash: candidate.cash + sellValue } : candidate,
    ),
    properties: {
      ...state.properties,
      [tile.id]: createEmptyProperty(),
    },
    message: `${player.name} bán ${tile.name} và nhận ${formatMoney(sellValue)}.`,
  };

  return finalizeState(addLog(next, next.message));
}

export function mortgageTile(state: GameState, tileId: string): GameState {
  if (!canMortgageTile(state, tileId)) {
    return state;
  }

  const player = getCurrentPlayer(state)!;
  const tile = getTileById(tileId);
  const property = state.properties[tile.id];
  const mortgageValue = getMortgageValue(tile, property);
  const next: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, cash: candidate.cash + mortgageValue } : candidate,
    ),
    properties: {
      ...state.properties,
      [tile.id]: { ...property, ownerId: player.id, mortgaged: true },
    },
    message: `${player.name} cầm cố ${tile.name} và nhận ${formatMoney(mortgageValue)}.`,
  };

  return finalizeState(addLog(next, `${next.message} Ô cầm cố không thu phí và không thể nâng cấp.`));
}

export function redeemMortgageTile(state: GameState, tileId: string): GameState {
  if (!canRedeemMortgageTile(state, tileId)) {
    return state;
  }

  const player = getCurrentPlayer(state)!;
  const tile = getTileById(tileId);
  const property = state.properties[tile.id];
  const redeemValue = getRedeemMortgageValue(tile, property);
  const next: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, cash: candidate.cash - redeemValue } : candidate,
    ),
    properties: {
      ...state.properties,
      [tile.id]: { ...property, ownerId: player.id, mortgaged: false },
    },
    message: `${player.name} chuộc ${tile.name} với ${formatMoney(redeemValue)}.`,
  };

  return settleBankruptcy(addLog(next, next.message), player.id);
}

export function payJailFine(state: GameState): GameState {
  const player = getCurrentPlayer(state);
  if (!player || player.isBot || !player.inJail || state.phase !== "ready" || player.cash < jailFine) {
    return state;
  }

  let next: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === player.id
        ? {
            ...candidate,
            cash: candidate.cash - jailFine,
            inJail: false,
            jailTurnsRemaining: 0,
          }
        : candidate,
    ),
    message: `${player.name} trả ${formatMoney(jailFine)} để ra tù. Có thể gieo ngay trong lượt này.`,
  };

  next = settleBankruptcy(next, player.id);
  return addLog(next, next.message);
}

export function useJailFreeCard(state: GameState): GameState {
  const player = getCurrentPlayer(state);
  if (!player || player.isBot || !player.inJail || state.phase !== "ready" || player.heldCardIds.length === 0) {
    return state;
  }

  const [cardId, ...remainingCards] = player.heldCardIds;
  let next: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === player.id
        ? {
            ...candidate,
            heldCardIds: remainingCards,
            inJail: false,
            jailTurnsRemaining: 0,
          }
        : candidate,
    ),
    message: `${player.name} dùng thẻ ra tù miễn phí. Có thể gieo ngay trong lượt này.`,
  };
  next = discardCard(next, cardId);

  return addLog(next, next.message);
}

export function tryRollDoubleForJail(
  state: GameState,
  dice: [number, number] = randomDice(),
): GameState {
  const player = getCurrentPlayer(state);
  if (!player || player.bankrupt || !player.inJail || state.phase !== "ready") {
    return state;
  }

  if (dice[0] === dice[1]) {
    const released: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, inJail: false, jailTurnsRemaining: 0 }
          : candidate,
      ),
      message: `${player.name} gieo đôi ${dice[0]}-${dice[1]}, ra tù và di chuyển ${dice[0] + dice[1]} ô.`,
    };
    return movePlayerByDice(addLog(released, released.message), player.id, dice);
  }

  const remaining = Math.max(player.jailTurnsRemaining - 1, 0);
  let next: GameState = {
    ...state,
    dice,
    phase: "resolved",
    players: state.players.map((candidate) =>
      candidate.id === player.id ? { ...candidate, jailTurnsRemaining: remaining } : candidate,
    ),
    message: `${player.name} không gieo đôi. Còn ${remaining} lượt thử trong tù.`,
  };

  if (remaining === 0) {
    next = {
      ...next,
      players: next.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, inJail: false, jailTurnsRemaining: 0 }
          : candidate,
      ),
    };
    next = chargeBank(
      next,
      player.id,
      jailFine,
      `${player.name} hết lượt thử gieo đôi và phải trả phạt ra tù.`,
    );
  }

  return finalizeState(addLog(next, next.message));
}

export function endTurn(state: GameState): GameState {
  if (state.phase === "gameOver" || state.phase === "drawingCard") {
    return state;
  }

  const nextIndex = findNextActivePlayerIndex(state.players, state.currentPlayerIndex);
  const nextPlayer = state.players[nextIndex];

  if (!nextPlayer) {
    return finalizeState(state);
  }

  return {
    ...state,
    currentPlayerIndex: nextIndex,
    phase: "ready",
    dice: null,
    pendingCardDraw: null,
    activeCardDraw: null,
    upgradedThisTurn: false,
    selectedTileId: tiles[nextPlayer.position]?.id ?? "start",
    message: nextPlayer.inJail
      ? `${nextPlayer.name} đang ở tù. Trả phạt, dùng thẻ hoặc gieo đôi để ra.`
      : `Đến lượt ${nextPlayer.name}.`,
    turnNumber: state.turnNumber + 1,
  };
}

export function playBotTurn(state: GameState): GameState {
  const player = getCurrentPlayer(state);
  if (!player || !player.isBot || state.phase !== "ready") {
    return state;
  }

  let next = state;

  if (player.inJail) {
    next = playBotJailAction(next);
    if (next.phase !== "ready") {
      return next.phase === "gameOver" ? next : endTurn(next);
    }
  }

  next = rollCurrentTurn(next);

  if (next.pendingCardDraw) {
    next = drawPendingCard(next);
    next = closeActiveCard(next);
  }

  next = applyBotDecision(next);

  if (next.phase !== "gameOver" && !next.pendingCardDraw && !next.activeCardDraw) {
    next = endTurn(next);
  }

  return next;
}

export function resetGame(): GameState {
  return createInitialGame();
}

export function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}K`;
}

export function getDeckLabel(kind: DeckKind): string {
  return kind === "chance" ? "Cơ hội" : "Khí vận";
}

function createPlayer(index: number, name: string, isBot: boolean): Player {
  return {
    id: `p${index + 1}`,
    name,
    color: playerColors[index % playerColors.length],
    cash: startingCash,
    position: 0,
    isBot,
    bankrupt: false,
    inJail: false,
    jailTurnsRemaining: 0,
    heldCardIds: [],
  };
}

function createDeckState(kind: DeckKind): SharedDeckState {
  const ids = kind === "chance" ? chanceCards.map((card) => card.id) : fortuneCards.map((card) => card.id);
  return {
    drawPile: shuffle(ids),
    discardPile: [],
    cycle: 1,
    nextDrawNumber: 1,
  };
}

function resolveLanding(state: GameState, playerId: string, tile: Tile): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return state;
  }

  if (tile.kind === "start") {
    return {
      ...state,
      message: `${player.name} dừng tại Xuất phát.`,
    };
  }

  if (tile.kind === "jail") {
    return {
      ...state,
      message: `${player.name} ghé Nhà tù nhưng không bị giữ.`,
    };
  }

  if (tile.kind === "goToJail") {
    return sendToJail(state, playerId, `${player.name} dừng ở ô Vào tù.`);
  }

  if (tile.kind === "tax") {
    return chargeBank(state, playerId, taxAmount, `${player.name} đóng Quỹ bảo tồn.`);
  }

  if (tile.kind === "rest") {
    const next = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId ? { ...candidate, cash: candidate.cash + restBonus } : candidate,
      ),
      message: `${player.name} nghỉ dưỡng và nhận ${formatMoney(restBonus)}.`,
    };
    return addLog(next, next.message);
  }

  if (tile.kind === "chance" || tile.kind === "fortune") {
    const kind = tile.kind;
    return {
      ...state,
      phase: "drawingCard",
      pendingCardDraw: { kind, playerId, tileId: tile.id },
      activeCardDraw: null,
      message: `${player.name} vào ô ${getDeckLabel(kind)}. Nhấn rút thẻ để tiếp tục.`,
    };
  }

  const property = state.properties[tile.id];
  if (!property || !isOwnable(tile)) {
    return state;
  }

  if (!property.ownerId) {
    return {
      ...state,
      message: `${tile.name} chưa có chủ. Có thể mua với giá ${formatMoney(tile.price ?? 0)}.`,
    };
  }

  if (property.ownerId === playerId) {
    if (property.mortgaged) {
      return {
        ...state,
        message: `${player.name} ghé ${tile.name}. Tài sản đang cầm cố, cần chuộc trước khi khai thác.`,
      };
    }

    if (tile.kind !== "landmark") {
      return {
        ...state,
        message: `${player.name} ghé ${tile.name}. Trạm giao thông thu phí theo số lượng sở hữu.`,
      };
    }

    return {
      ...state,
      message: `${player.name} ghé ${tile.name}. Có thể nâng cấp với ${formatMoney(
        getUpgradeCost(state, tile),
      )}.`,
    };
  }

  const owner = state.players.find((candidate) => candidate.id === property.ownerId);
  if (property.mortgaged) {
    return {
      ...state,
      message: `${tile.name} đang được ${owner?.name ?? "chủ sở hữu"} cầm cố. Không thu phí lượt này.`,
    };
  }

  const rent = getRent(state, tile);

  return transferMoney(
    state,
    playerId,
    property.ownerId,
    rent,
    `${player.name} trả ${formatMoney(rent)} phí tham quan ${tile.shortName} cho ${
      owner?.name ?? "chủ sở hữu"
    }.`,
  );
}

function movePlayerByDice(state: GameState, playerId: string, dice: [number, number]): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return state;
  }

  const steps = dice[0] + dice[1];
  const oldPosition = player.position;
  const newPosition = (oldPosition + steps) % tiles.length;
  const passedStart = oldPosition + steps >= tiles.length;
  const tile = tiles[newPosition];

  let next: GameState = {
    ...state,
    dice,
    selectedTileId: tile.id,
    pendingCardDraw: null,
    activeCardDraw: null,
    phase: "resolved",
    players: state.players.map((candidate) =>
      candidate.id === player.id
        ? {
            ...candidate,
            position: newPosition,
            cash: candidate.cash + (passedStart ? startBonus : 0),
          }
        : candidate,
    ),
    log: [
      `${player.name} gieo ${dice[0]} + ${dice[1]} và đến ${tile.shortName}.`,
      ...state.log,
    ].slice(0, 24),
  };

  if (passedStart) {
    next = addLog(next, `${player.name} đi qua Xuất phát và nhận ${formatMoney(startBonus)}.`);
  }

  next = resolveLanding(next, player.id, tile);
  return finalizeState(next);
}

function applyCardEffect(state: GameState, playerId: string, card: DrawCard): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return state;
  }

  switch (card.effect.type) {
    case "cash":
      return applyCashDelta(
        state,
        playerId,
        card.effect.amount,
        `${card.title}: ${player.name} nhận ${formatMoney(card.effect.amount)}.`,
      );
    case "pay":
      return applyCashDelta(
        state,
        playerId,
        -card.effect.amount,
        `${card.title}: ${player.name} trả ${formatMoney(card.effect.amount)}.`,
      );
    case "ownedIncome": {
      const ownedCount = getOwnedTiles(state, playerId).length;
      const amount = ownedCount * card.effect.amountPerTile;
      return applyCashDelta(
        state,
        playerId,
        amount,
        `${card.title}: ${player.name} ${amount >= 0 ? "nhận" : "trả"} ${formatMoney(Math.abs(amount))}.`,
      );
    }
    case "regionIncome": {
      const { region, amountPerTile } = card.effect;
      const ownedCount = getOwnedTiles(state, playerId).filter(
        (tile) => tile.region === region,
      ).length;
      const amount = ownedCount * amountPerTile;
      return applyCashDelta(
        state,
        playerId,
        amount,
        `${card.title}: ${regionLabels[region]} tạo thêm ${formatMoney(amount)}.`,
      );
    }
    case "maintenance": {
      const totalLevels = getOwnedTiles(state, playerId).reduce(
        (sum, tile) => sum + (state.properties[tile.id]?.level ?? 0),
        0,
      );
      const amount = totalLevels * card.effect.amountPerLevel;
      return applyCashDelta(
        state,
        playerId,
        -amount,
        `${card.title}: ${player.name} trả ${formatMoney(amount)} bảo trì.`,
      );
    }
    case "goToJail":
      return sendToJail(state, playerId, `${card.title}: ${player.name} phải vào tù.`);
    case "getOutOfJailFree": {
      const next = {
        ...state,
        players: state.players.map((candidate) =>
          candidate.id === playerId
            ? { ...candidate, heldCardIds: [...candidate.heldCardIds, card.id] }
            : candidate,
        ),
        message: `${card.title}: ${player.name} giữ thẻ ra tù miễn phí.`,
      };
      return addLog(next, next.message);
    }
  }
}

function playBotJailAction(state: GameState): GameState {
  const player = getCurrentPlayer(state);
  if (!player) {
    return state;
  }

  if (player.heldCardIds.length > 0) {
    const [cardId, ...remainingCards] = player.heldCardIds;
    let next: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              heldCardIds: remainingCards,
              inJail: false,
              jailTurnsRemaining: 0,
            }
          : candidate,
      ),
      message: `${player.name} dùng thẻ ra tù miễn phí.`,
    };
    next = discardCard(next, cardId);
    return addLog(next, next.message);
  }

  if (player.cash > 420) {
    let next: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? {
              ...candidate,
              cash: candidate.cash - jailFine,
              inJail: false,
              jailTurnsRemaining: 0,
            }
          : candidate,
      ),
      message: `${player.name} trả ${formatMoney(jailFine)} để ra tù.`,
    };
    next = settleBankruptcy(next, player.id);
    return addLog(next, next.message);
  }

  return tryRollDoubleForJail(state);
}

function applyBotDecision(state: GameState): GameState {
  const player = getCurrentPlayer(state);
  const tile = getSelectedTile(state);
  const property = state.properties[tile.id];

  if (!player || !player.isBot || player.inJail || !property || !isOwnable(tile) || state.phase !== "resolved") {
    return state;
  }

  if (!property.ownerId && player.cash >= (tile.price ?? 0) + 260) {
    const next = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, cash: candidate.cash - (tile.price ?? 0) }
          : candidate,
      ),
      properties: {
        ...state.properties,
        [tile.id]: { ...createEmptyProperty(), ownerId: player.id },
      },
      message: `${player.name} mua ${tile.name}.`,
    };
    return finalizeState(addLog(next, `${player.name} mua ${tile.name} với ${formatMoney(tile.price ?? 0)}.`));
  }

  if (
    property.ownerId === player.id &&
    tile.kind === "landmark" &&
    !property.mortgaged &&
    !state.upgradedThisTurn &&
    player.cash >= getUpgradeCost(state, tile) + 360 &&
    Math.random() > 0.35
  ) {
    const cost = getUpgradeCost(state, tile);
    const nextLevel = property.level + 1;
    const next = {
      ...state,
      upgradedThisTurn: true,
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, cash: candidate.cash - cost } : candidate,
      ),
      properties: {
        ...state.properties,
        [tile.id]: {
          ...property,
          ownerId: player.id,
          level: nextLevel,
          investedUpgradeCost: (property.investedUpgradeCost ?? 0) + cost,
        },
      },
      message: `${player.name} nâng cấp ${tile.shortName} lên cấp ${nextLevel}.`,
    };
    return finalizeState(addLog(next, `${next.message} Chi phí ${formatMoney(cost)}.`));
  }

  return state;
}

function drawFromSharedDeck(
  deck: SharedDeckState,
  kind: DeckKind,
): { deck: SharedDeckState; cardId: string; drawNumber: number; cycle: number } {
  let drawPile = [...deck.drawPile];
  let discardPile = [...deck.discardPile];
  let cycle = deck.cycle;
  let nextDrawNumber = deck.nextDrawNumber;

  if (drawPile.length === 0) {
    const fallbackIds = kind === "chance" ? chanceCards.map((card) => card.id) : fortuneCards.map((card) => card.id);
    drawPile = shuffle(discardPile.length > 0 ? discardPile : fallbackIds);
    discardPile = [];
    cycle += 1;
    nextDrawNumber = 1;
  }

  const [cardId, ...remaining] = drawPile;
  const drawNumber = nextDrawNumber;

  return {
    cardId,
    drawNumber,
    cycle,
    deck: {
      drawPile: remaining,
      discardPile,
      cycle,
      nextDrawNumber: remaining.length === 0 ? 1 : Math.min(deckSize, drawNumber + 1),
    },
  };
}

function discardCard(state: GameState, cardId: string): GameState {
  const card = getCardById(cardId);
  if (!card) {
    return state;
  }

  const deck = state.decks[card.deck];
  return {
    ...state,
    decks: {
      ...state.decks,
      [card.deck]: {
        ...deck,
        discardPile: [...deck.discardPile, cardId],
      },
    },
  };
}

function sendToJail(state: GameState, playerId: string, reason: string): GameState {
  const jailIndex = tiles.findIndex((tile) => tile.kind === "jail");
  const next = {
    ...state,
    phase: "resolved" as GamePhase,
    selectedTileId: tiles[jailIndex]?.id ?? state.selectedTileId,
    pendingCardDraw: null,
    activeCardDraw: null,
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            position: jailIndex >= 0 ? jailIndex : candidate.position,
            inJail: true,
            jailTurnsRemaining: maxJailTurns,
          }
        : candidate,
    ),
    message: `${reason} Bị giữ tối đa ${maxJailTurns} lượt.`,
  };

  return addLog(next, next.message);
}

function randomDice(): [number, number] {
  return [rollDie(), rollDie()];
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function applyCashDelta(state: GameState, playerId: string, delta: number, message: string): GameState {
  const next = {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, cash: player.cash + delta } : player,
    ),
    message,
  };

  return settleBankruptcy(addLog(next, message), playerId);
}

function chargeBank(state: GameState, playerId: string, amount: number, reason: string): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const next = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId ? { ...candidate, cash: candidate.cash - amount } : candidate,
    ),
  };
  const message = `${reason} Trả ${formatMoney(amount)}.`;

  return settleBankruptcy(
    addLog(
      {
        ...next,
        message: player ? message : state.message,
      },
      message,
    ),
    playerId,
  );
}

function transferMoney(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string,
  amount: number,
  reason: string,
): GameState {
  const next = {
    ...state,
    players: state.players.map((player) => {
      if (player.id === fromPlayerId) {
        return { ...player, cash: player.cash - amount };
      }
      if (player.id === toPlayerId) {
        return { ...player, cash: player.cash + amount };
      }
      return player;
    }),
    message: reason,
  };

  return settleBankruptcy(addLog(next, reason), fromPlayerId);
}

function settleBankruptcy(state: GameState, playerId: string): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.cash >= 0 || player.bankrupt) {
    return finalizeState(state);
  }

  const next = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            bankrupt: true,
            cash: 0,
            inJail: false,
            jailTurnsRemaining: 0,
            heldCardIds: [],
          }
        : candidate,
    ),
    properties: Object.fromEntries(
      Object.entries(state.properties).map(([tileId, property]) => [
        tileId,
        property.ownerId === playerId ? createEmptyProperty() : property,
      ]),
    ),
  };

  return finalizeState(addLog(next, `${player.name} phá sản. Các địa danh được trả lại thị trường.`));
}

function finalizeState(state: GameState): GameState {
  const activePlayers = state.players.filter((player) => !player.bankrupt);

  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    return {
      ...state,
      room: { ...state.room, status: "finished" },
      phase: "gameOver",
      winnerId: winner.id,
      message: `${winner.name} thắng ván chơi.`,
    };
  }

  return state;
}

function findNextActivePlayerIndex(candidates: Player[], currentIndex: number): number {
  for (let offset = 1; offset <= candidates.length; offset += 1) {
    const index = (currentIndex + offset) % candidates.length;
    if (!candidates[index].bankrupt) {
      return index;
    }
  }

  return currentIndex;
}

function countOwnedActiveTransports(state: GameState, playerId: string): number {
  return tiles.filter((tile) => {
    const property = state.properties[tile.id];
    return tile.kind === "transport" && property?.ownerId === playerId && !property.mortgaged;
  }).length;
}

function getTransportRentMultiplier(transportCount: number): number {
  if (transportCount <= 1) {
    return 1;
  }
  if (transportCount === 2) {
    return 2;
  }
  if (transportCount === 3) {
    return 4;
  }
  return 6;
}

function addLog(state: GameState, entry: string): GameState {
  return {
    ...state,
    log: [entry, ...state.log].slice(0, 30),
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getPlayerName(state: GameState, playerId: string): string {
  return state.players.find((player) => player.id === playerId)?.name ?? "Người chơi";
}

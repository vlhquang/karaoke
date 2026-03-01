import { ColorPanel } from "./color-panel";
import { MemoryPanel } from "./memory-panel";
import { NumberPanel } from "./number-panel";
import { ReactionPanel } from "./reaction-panel";
import { RpsPanel } from "./rps-panel";
import { ShakePanel } from "./shake-panel";
import type { LiXiActionProps, LiXiGameType } from "./types";

interface GamePanelSwitchProps extends LiXiActionProps {
  game: LiXiGameType;
  reactionSignal: string;
  gameState?: unknown;
  playerId?: string;
}

export function GamePanelSwitch({ game, disabled, onEmit, reactionSignal, gameState, playerId }: GamePanelSwitchProps) {
  if (game === "reaction") return <ReactionPanel disabled={disabled} onEmit={onEmit} signalText={reactionSignal} />;
  if (game === "memory") return <MemoryPanel disabled={disabled} onEmit={onEmit} gameState={gameState} playerId={playerId} />;
  if (game === "rps") return <RpsPanel disabled={disabled} onEmit={onEmit} />;
  if (game === "number") return <NumberPanel disabled={disabled} onEmit={onEmit} />;
  if (game === "shake") return <ShakePanel disabled={disabled} onEmit={onEmit} />;
  return <ColorPanel disabled={disabled} onEmit={onEmit} />;
}

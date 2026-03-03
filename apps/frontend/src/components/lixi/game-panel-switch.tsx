import { ColorPanel } from "./color-panel";
import { MemoryPanel } from "./memory-panel";
import { NumberPanel } from "./number-panel";
import { ReactionPanel } from "./reaction-panel";
import { RpsPanel } from "./rps-panel";
import { ShakePanel } from "./shake-panel";
import type { LiXiActionProps, LiXiGameType } from "./types";

interface GamePanelSwitchProps extends LiXiActionProps {
  game: LiXiGameType;
}

export function GamePanelSwitch({ game, disabled, onEmit, gameState, playerId, room, onClose }: GamePanelSwitchProps) {
  if (game === "reaction") return <ReactionPanel disabled={disabled} onEmit={onEmit} gameState={gameState} playerId={playerId} room={room} onClose={onClose} />;
  if (game === "memory") return <MemoryPanel disabled={disabled} onEmit={onEmit} gameState={gameState} playerId={playerId} room={room} onClose={onClose} />;
  if (game === "rps") return <RpsPanel disabled={disabled} onEmit={onEmit} gameState={gameState} playerId={playerId} room={room} onClose={onClose} />;
  if (game === "number") return <NumberPanel disabled={disabled} onEmit={onEmit} gameState={gameState} playerId={playerId} room={room} onClose={onClose} />;
  if (game === "shake") return <ShakePanel disabled={disabled} onEmit={onEmit} room={room} onClose={onClose} />;
  return <ColorPanel disabled={disabled} onEmit={onEmit} room={room} onClose={onClose} />;
}

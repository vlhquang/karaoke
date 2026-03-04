export type LiXiGameType = "reaction" | "memory" | "rps" | "number" | "shake" | "color" | "mathking";

export interface LiXiActionProps {
  disabled: boolean;
  onEmit: (event: string, payload: Record<string, unknown>) => void;
  gameState?: any;
  playerId?: string;
  room?: any;
  onClose?: () => void;
}

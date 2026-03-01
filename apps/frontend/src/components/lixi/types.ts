export type LiXiGameType = "reaction" | "memory" | "rps" | "number" | "shake" | "color";

export interface LiXiActionProps {
  disabled: boolean;
  onEmit: (event: string, payload: Record<string, unknown>) => void;
}

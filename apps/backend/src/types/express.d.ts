import type { RoomMember } from "@karaoke/shared";

declare global {
  namespace Express {
    interface Request {
      user?: RoomMember;
    }
  }
}

export {};

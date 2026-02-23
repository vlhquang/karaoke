import type { Request, Response, NextFunction } from "express";
import { searchSchema } from "../validators/room-validator.js";
import { YouTubeService } from "../services/youtube/youtube-service.js";

const youTubeService = new YouTubeService();

export const searchYouTube = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = searchSchema.parse(req.query);
    const items = await youTubeService.searchKaraoke(parsed.q);
    res.json({ items });
  } catch (error) {
    next(error);
  }
};

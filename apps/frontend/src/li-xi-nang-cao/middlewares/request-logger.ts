import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("lixi_http", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start
    });
  });
  next();
};

import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/errors.js";

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof AppError) {
    res.status(error.status).json({ message: error.message, code: error.code });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation error",
      code: "VALIDATION_ERROR",
      details: error.issues
    });
    return;
  }

  logger.error({ error }, "Unhandled error");
  res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
};

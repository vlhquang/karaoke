import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ ok: false, message: error.message });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ ok: false, message: error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  res.status(500).json({ ok: false, message: "Internal server error" });
};

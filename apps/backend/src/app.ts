import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { RequestHandler } from "express";
import { healthCheck } from "./controllers/health-controller.js";
import { searchYouTube } from "./controllers/youtube-controller.js";
import { apiRateLimit } from "./middleware/rate-limit.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { logger } from "./config/logger.js";
import { env } from "./config/env.js";

export const createApp = () => {
  const app = express();
  const httpLogger = pinoHttp as unknown as (options: { logger: typeof logger }) => RequestHandler;

  app.use(helmet());
  app.use(cors({ origin: env.BACKEND_CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "256kb" }));
  app.use(apiRateLimit);
  app.use(
    httpLogger({
      logger
    })
  );

  app.get("/health", healthCheck);
  app.get("/api/youtube/search", searchYouTube);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

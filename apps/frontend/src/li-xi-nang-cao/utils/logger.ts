export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

const print = (level: "INFO" | "WARN" | "ERROR", message: string, meta?: Record<string, unknown>) => {
  const now = new Date().toISOString();
  if (meta) {
    console.log(`[${now}] [${level}] ${message}`, meta);
    return;
  }
  console.log(`[${now}] [${level}] ${message}`);
};

export const logger: Logger = {
  info: (message, meta) => print("INFO", message, meta),
  warn: (message, meta) => print("WARN", message, meta),
  error: (message, meta) => print("ERROR", message, meta)
};

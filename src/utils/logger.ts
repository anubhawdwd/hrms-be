// Minimal logger wrapper
// Can be replaced later by Winston / Pino / Cloud logger

export const logger = {
  info(message: string, meta?: any) {
    console.log("[INFO]", message, meta ?? "");
  },

  warn(message: string, meta?: any) {
    console.warn("[WARN]", message, meta ?? "");
  },

  error(message: string, meta?: any) {
    console.error("[ERROR]", message, meta ?? "");
  },
};

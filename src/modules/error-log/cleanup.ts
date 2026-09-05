// src/modules/error-log/cleanup.ts
import { ErrorLogService } from "./service.js";

const errorLogService = new ErrorLogService();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function startErrorLogRetentionJob() {
  const runPurge = async () => {
    try {
      const result = await errorLogService.purgeExpiredLogs(20);
      if (result.deletedCount > 0) {
        console.log(
          `[ERROR LOG PURGE] Auto-purged ${result.deletedCount} error log records older than 20 days.`
        );
      }
    } catch (err) {
      console.error("[ERROR LOG PURGE ERROR] Failed to purge expired error logs:", err);
    }
  };

  // Run on startup
  runPurge();

  // Schedule every 24 hours
  const timer = setInterval(runPurge, TWENTY_FOUR_HOURS_MS);
  timer.unref(); // Do not prevent process exit in test runners
}

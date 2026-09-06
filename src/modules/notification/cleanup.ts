// src/modules/notification/cleanup.ts
import { NotificationService } from "./service.js";

const notificationService = new NotificationService();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function startNotificationRetentionJob() {
  const runPurge = async () => {
    try {
      const result = await notificationService.purgeExpired(90); // 3 months
      if (result.deletedCount > 0) {
        console.log(
          `[NOTIFICATION PURGE] Auto-purged ${result.deletedCount} notification records older than 90 days.`
        );
      }
    } catch (err) {
      console.error("[NOTIFICATION PURGE ERROR] Failed to purge expired notifications:", err);
    }
  };

  // Run on startup
  runPurge();

  // Schedule every 24 hours
  const timer = setInterval(runPurge, TWENTY_FOUR_HOURS_MS);
  timer.unref(); // Do not prevent process exit in test runners
}

// src/modules/notification/routes.ts
import { Router } from "express";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from "./controller.js";

const router = Router();

router.use(authenticateJWT);

router.get("/", listNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/:id/read", markAsRead);
router.post("/mark-all-read", markAllAsRead);
router.delete("/", deleteAllNotifications);
router.delete("/all", deleteAllNotifications);
router.delete("/:id", deleteNotification);

export default router;

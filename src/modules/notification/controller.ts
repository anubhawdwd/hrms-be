// src/modules/notification/controller.ts
import type { Request, Response } from "express";
import { NotificationService } from "./service.js";

const service = new NotificationService();

export async function listNotifications(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const unreadOnly = req.query.unreadOnly === "true";

    const result = await service.listNotifications({
      userId,
      page,
      limit,
      unreadOnly,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to fetch notifications" });
  }
}

export async function getUnreadCount(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const count = await service.getUnreadCount(userId);
    res.json({ unreadCount: count });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to fetch unread count" });
  }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    if (!id || id === "undefined") {
      return res.status(400).json({ message: "Notification ID is required" });
    }

    const result = await service.markAsRead(id, userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to mark notification as read" });
  }
}

export async function markAllAsRead(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const result = await service.markAllAsRead(userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to mark all notifications as read" });
  }
}

export async function deleteNotification(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    if (!id || id === "undefined") {
      return res.status(400).json({ message: "Notification ID is required" });
    }

    const result = await service.deleteNotification(id, userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to delete notification" });
  }
}

export async function deleteAllNotifications(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;
    const result = await service.deleteAllNotifications(userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to delete all notifications" });
  }
}

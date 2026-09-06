// src/modules/notification/service.ts
import { NotificationRepository } from "./repository.js";
import { prisma } from "../../config/prisma.js";
import { NotificationType } from "../../generated/prisma/enums.js";
import {
  emitNotification,
  emitDashboardSync,
  emitToCompany,
} from "../../socket/index.js";
import type {
  CreateNotificationDTO,
  ListNotificationsParams,
  ListNotificationsResponse,
} from "./types.js";

const repo = new NotificationRepository();

export class NotificationService {
  async sendNotification(dto: CreateNotificationDTO) {
    const notification = await repo.create(dto);
    // Real-time socket delivery to recipient
    emitNotification(dto.userId, notification);
    return notification;
  }

  async broadcastHoliday(companyId: string, holidayName: string, date: Date, holidayType = "NORMAL") {
    // 1. Fetch all active users in company
    const users = await prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    });

    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const title = holidayType === "RESTRICTED"
      ? `New Restricted Holiday: ${holidayName}`
      : `New Holiday: ${holidayName}`;
    const message = `A new ${holidayType === "RESTRICTED" ? "restricted " : ""}holiday "${holidayName}" has been added on **${formattedDate}**.`;

    const dtos: CreateNotificationDTO[] = users.map((u) => ({
      companyId,
      userId: u.id,
      type: NotificationType.HOLIDAY_ADDED,
      title,
      message,
      link: "/employee/dashboard",
      metadata: { holidayName, date: date.toISOString(), holidayType },
    }));

    await repo.createMany(dtos);

    // Real-time broadcast to company room
    emitToCompany(companyId, "notification:new", {
      type: NotificationType.HOLIDAY_ADDED,
      title,
      message,
      link: "/employee/dashboard",
    });

    emitDashboardSync(`company:${companyId}`, "holiday", { holidayName });
  }

  async listNotifications(params: ListNotificationsParams): Promise<ListNotificationsResponse> {
    return repo.list(params);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return repo.getUnreadCount(userId);
  }

  async markAsRead(id: string, userId: string) {
    const result = await repo.markAsRead(id, userId);
    return { success: result.count > 0 };
  }

  async markAllAsRead(userId: string) {
    const result = await repo.markAllAsRead(userId);
    return { success: true, count: result.count };
  }

  async deleteNotification(id: string, userId: string) {
    const result = await repo.delete(id, userId);
    return { success: result.count > 0 };
  }

  async deleteAllNotifications(userId: string) {
    const result = await repo.deleteAll(userId);
    return { success: true, count: result.count };
  }

  async purgeExpired(days = 90) {
    return repo.purgeExpired(days);
  }
}

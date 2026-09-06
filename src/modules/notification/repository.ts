// src/modules/notification/repository.ts
import { prisma } from "../../config/prisma.js";
import type {
  CreateNotificationDTO,
  ListNotificationsParams,
  ListNotificationsResponse,
} from "./types.js";

export class NotificationRepository {
  async create(dto: CreateNotificationDTO) {
    const data: any = {
      companyId: dto.companyId,
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      link: dto.link || null,
    };
    if (dto.metadata !== undefined && dto.metadata !== null) {
      data.metadata = dto.metadata;
    }
    return prisma.notification.create({ data });
  }

  async createMany(dtos: CreateNotificationDTO[]) {
    if (dtos.length === 0) return { count: 0 };
    return prisma.notification.createMany({
      data: dtos.map((d) => {
        const item: any = {
          companyId: d.companyId,
          userId: d.userId,
          type: d.type,
          title: d.title,
          message: d.message,
          link: d.link || null,
        };
        if (d.metadata !== undefined && d.metadata !== null) {
          item.metadata = d.metadata;
        }
        return item;
      }),
    });
  }

  async list(params: ListNotificationsParams): Promise<ListNotificationsResponse> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { userId: params.userId };
    if (params.unreadOnly) {
      where.isRead = false;
    }

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { isRead: "asc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: params.userId, isRead: false },
      }),
    ]);

    return {
      items: items.map((i) => ({
        ...i,
        metadata: i.metadata as any,
      })),
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async delete(id: string, userId: string) {
    return prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  async deleteAll(userId: string) {
    return prisma.notification.deleteMany({
      where: { userId },
    });
  }

  async purgeExpired(days = 90) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    return { deletedCount: result.count };
  }
}

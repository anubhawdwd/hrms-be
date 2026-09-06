// src/modules/notification/types.ts
import { NotificationType } from "../../generated/prisma/enums.js";

export interface CreateNotificationDTO {
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, any> | null;
}

export interface ListNotificationsParams {
  userId: string;
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface ListNotificationsResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface NotificationItem {
  id: string;
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  metadata: any;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

// src/socket/index.ts
import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../config/auth.js";
import { prisma } from "../config/prisma.js";
import { UserRole } from "../generated/prisma/enums.js";

let io: SocketIOServer | null = null;

export interface SocketUserData {
  userId: string;
  companyId: string | null;
  roles: UserRole[];
  employeeProfileId: string | null;
}

export function initSocketServer(
  httpServer: HttpServer,
  allowedOrigins: string[]
): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // ─── Authentication Middleware ───
  io.use(async (socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null) ||
        socket.handshake.query?.token;

      if (!token || typeof token !== "string") {
        return next(new Error("Authentication error: Missing token"));
      }

      const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
      if (!decoded || typeof decoded.sub !== "string") {
        return next(new Error("Authentication error: Invalid token payload"));
      }

      const userId = decoded.sub;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: true,
          employee: {
            select: { id: true },
          },
        },
      });

      if (!user || !user.isActive) {
        return next(new Error("Authentication error: User not found or inactive"));
      }

      const roles = user.roles.map((r) => r.role);
      const companyId = user.companyId || (decoded.companyId as string) || null;
      const employeeProfileId = user.employee?.id || null;

      socket.data = {
        userId,
        companyId,
        roles,
        employeeProfileId,
      } as SocketUserData;

      next();
    } catch (err: any) {
      next(new Error(`Authentication error: ${err.message || "Unauthorized"}`));
    }
  });

  // ─── Connection & Room Subscriptions ───
  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketUserData;
    if (!data || !data.userId) {
      socket.disconnect(true);
      return;
    }

    // 1. Personal User Room
    socket.join(`user:${data.userId}`);

    // 2. Company Room
    if (data.companyId) {
      socket.join(`company:${data.companyId}`);

      // 3. Company Admins & HR Room
      const isAdminOrHr =
        data.roles.includes(UserRole.COMPANY_ADMIN) ||
        data.roles.includes(UserRole.HR) ||
        data.roles.includes(UserRole.SUPER_ADMIN);

      if (isAdminOrHr) {
        socket.join(`company:${data.companyId}:admins`);
      }
    }

    // 4. Reporting Manager Room
    if (data.employeeProfileId) {
      socket.join(`manager:${data.employeeProfileId}`);
    }

    socket.on("disconnect", () => {
      // Room cleanup is handled automatically by Socket.IO
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/* ======================================================
   TARGETED EMITTERS
   ====================================================== */

export function emitToUser(userId: string, event: string, payload: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToCompany(companyId: string, event: string, payload: any) {
  if (!io) return;
  io.to(`company:${companyId}`).emit(event, payload);
}

export function emitToAdmins(companyId: string, event: string, payload: any) {
  if (!io) return;
  io.to(`company:${companyId}:admins`).emit(event, payload);
}

export function emitToManager(managerProfileId: string, event: string, payload: any) {
  if (!io) return;
  io.to(`manager:${managerProfileId}`).emit(event, payload);
}

export function emitNotification(userId: string, notification: any) {
  if (!io) return;
  io.to(`user:${userId}`).emit("notification:new", notification);
}

export function emitDashboardSync(
  room: string,
  topic: "leave" | "attendance" | "badges" | "holiday" | "general",
  extraData?: Record<string, any>
) {
  if (!io) return;
  io.to(room).emit("dashboard:sync", {
    topic,
    timestamp: Date.now(),
    ...extraData,
  });
}

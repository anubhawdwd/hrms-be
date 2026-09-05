// src/modules/error-log/service.ts
import { ErrorLogRepository } from "./repository.js";
import type { CreateErrorLogDTO, FrontendErrorLogDTO, ListErrorLogsQuery } from "./types.js";

const repo = new ErrorLogRepository();

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "token",
  "refreshtoken",
  "accesstoken",
  "idtoken",
  "newpassword",
  "currentpassword",
  "manualpassword",
  "authorization",
  "secret",
];

export function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== "object") {
    return body;
  }

  if (Array.isArray(body)) {
    return body.map(sanitizeRequestBody);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeRequestBody(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class ErrorLogService {
  async logBackendError(data: CreateErrorLogDTO) {
    try {
      const sanitizedBody = sanitizeRequestBody(data.requestBody);
      return await repo.create({
        ...data,
        source: "BACKEND",
        requestBody: sanitizedBody,
      });
    } catch (err) {
      console.error("[ERROR LOG SERVICE] Failed to record backend error:", err);
      return null;
    }
  }

  async logFrontendError(
    dto: FrontendErrorLogDTO,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const sanitizedBody = sanitizeRequestBody(dto.requestBody);
      return await repo.create({
        source: "FRONTEND",
        statusCode: dto.statusCode ?? null,
        message: dto.message || "Frontend Application Error",
        stackTrace: dto.stackTrace ?? null,
        endpoint: dto.endpoint || dto.url || null,
        method: "FRONTEND_EVENT",
        requestBody: sanitizedBody,
        userId: dto.userId ?? null,
        companyId: dto.companyId ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });
    } catch (err) {
      console.error("[ERROR LOG SERVICE] Failed to record frontend error:", err);
      return null;
    }
  }

  async listErrorLogs(query: ListErrorLogsQuery) {
    return repo.findMany(query);
  }

  async deleteLogsByIds(ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("ids array is required and must not be empty");
    }
    const result = await repo.deleteByIds(ids);
    return {
      deletedCount: result.count,
    };
  }

  async deleteLogsByFilter(query: ListErrorLogsQuery) {
    const result = await repo.deleteByFilter(query);
    return {
      deletedCount: result.count,
    };
  }

  async purgeExpiredLogs(retentionDays = 20) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const result = await repo.purgeOldLogs(cutoffDate);
    return {
      deletedCount: result.count,
      cutoffDate,
      retentionDays,
    };
  }
}


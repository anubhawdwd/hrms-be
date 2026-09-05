// src/modules/error-log/types.ts
import type { ErrorLogModel } from "../../generated/prisma/models/ErrorLog.js";


export interface CreateErrorLogDTO {
  source: "BACKEND" | "FRONTEND";
  statusCode?: number | null | undefined;
  message: string;
  stackTrace?: string | null | undefined;
  endpoint?: string | null | undefined;
  method?: string | null | undefined;
  requestBody?: any;
  userId?: string | null | undefined;
  companyId?: string | null | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface FrontendErrorLogDTO {
  message: string;
  stackTrace?: string | null | undefined;
  endpoint?: string | null | undefined;
  url?: string | null | undefined;
  statusCode?: number | null | undefined;
  requestBody?: any;
  userId?: string | null | undefined;
  companyId?: string | null | undefined;
}

export interface ListErrorLogsQuery {
  page?: number | undefined;
  limit?: number | undefined;
  source?: "BACKEND" | "FRONTEND" | "ALL" | undefined;
  statusCode?: number | undefined;
  companyId?: string | undefined; // UUID or "SYSTEM"
  startDate?: string | undefined;
  endDate?: string | undefined;
  search?: string | undefined;
}

export type EnrichedErrorLog = ErrorLogModel & {
  companyName: string;
};

export interface DeleteErrorLogsDTO {
  ids: string[];
}



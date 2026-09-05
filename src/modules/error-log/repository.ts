// src/modules/error-log/repository.ts
import { prisma } from "../../config/prisma.js";
import type { CreateErrorLogDTO, EnrichedErrorLog, ListErrorLogsQuery } from "./types.js";

export class ErrorLogRepository {
  async create(data: CreateErrorLogDTO) {
    return prisma.errorLog.create({
      data: {
        source: data.source,
        statusCode: data.statusCode ?? null,
        message: data.message,
        stackTrace: data.stackTrace ?? null,
        endpoint: data.endpoint ?? null,
        method: data.method ?? null,
        requestBody: data.requestBody ?? undefined,
        userId: data.userId ?? null,
        companyId: data.companyId ?? null,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  buildWhereClause(query: ListErrorLogsQuery) {
    const where: any = {};

    if (query.source && query.source !== "ALL") {
      where.source = query.source;
    }

    if (query.statusCode) {
      where.statusCode = Number(query.statusCode);
    }

    if (query.companyId) {
      if (query.companyId.trim() === "SYSTEM") {
        where.companyId = null;
      } else {
        where.companyId = query.companyId.trim();
      }
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }


    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { message: { contains: s, mode: "insensitive" } },
        { endpoint: { contains: s, mode: "insensitive" } },
        { stackTrace: { contains: s, mode: "insensitive" } },
      ];
    }

    return where;
  }

  async findMany(query: ListErrorLogsQuery): Promise<{
    items: EnrichedErrorLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(query);

    const [rawItems, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.errorLog.count({ where }),
    ]);

    // Resolve company names
    const companyIds = Array.from(
      new Set(rawItems.map((item) => item.companyId).filter((id): id is string => Boolean(id)))
    );

    let companyMap: Record<string, string> = {};
    if (companyIds.length > 0) {
      const companies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      });
      companyMap = companies.reduce<Record<string, string>>((acc, comp) => {
        acc[comp.id] = comp.name;
        return acc;
      }, {});
    }

    const items: EnrichedErrorLog[] = rawItems.map((item) => {
      let companyName = "System / Unauthenticated";
      if (item.companyId) {
        companyName = companyMap[item.companyId] || "Unknown Company";
      }
      return {
        ...item,
        companyName,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async deleteByIds(ids: string[]) {
    return prisma.errorLog.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  async deleteByFilter(query: ListErrorLogsQuery) {
    const where = this.buildWhereClause(query);
    return prisma.errorLog.deleteMany({
      where,
    });
  }

  async purgeOldLogs(cutoffDate: Date) {
    return prisma.errorLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
  }
}


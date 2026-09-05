// src/middlewares/error.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { ErrorLogService } from "../modules/error-log/service.js";

const errorLogService = new ErrorLogService();

/**
 * Middleware to capture non-exception HTTP 4xx/5xx responses (e.g. 400, 401, 403, 404)
 */
export function errorCaptureMiddleware(req: Request, res: Response, next: NextFunction) {
  // Do not log calls to the error logging endpoint itself or swagger docs
  if (req.originalUrl.startsWith("/api/error-logs") || req.originalUrl.startsWith("/api-docs")) {
    return next();
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  const captureError = (body: any) => {
    if (res.statusCode >= 400) {
      let errorMessage = "HTTP Error " + res.statusCode;
      if (typeof body === "string") {
        errorMessage = body;
      } else if (body && typeof body === "object") {
        errorMessage = body.message || body.error || JSON.stringify(body);
      }

      const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip;
      const userAgent = req.headers["user-agent"];

      errorLogService.logBackendError({
        source: "BACKEND",
        statusCode: res.statusCode,
        message: errorMessage,
        stackTrace: null,
        endpoint: req.originalUrl,
        method: req.method,
        requestBody: req.body,
        userId: req.user?.userId ?? null,
        companyId: req.user?.companyId ?? (req as any).companyId ?? null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      });
    }
  };

  res.json = function (body: any) {
    captureError(body);
    return originalJson(body);
  };

  res.send = function (body: any) {
    captureError(body);
    return originalSend(body);
  };

  next();
}

/**
 * Global Express Error Handling Middleware (for unhandled exceptions passed to next(err))
 */
export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip;
  const userAgent = req.headers["user-agent"];

  errorLogService.logBackendError({
    source: "BACKEND",
    statusCode,
    message,
    stackTrace: err.stack ?? null,
    endpoint: req.originalUrl,
    method: req.method,
    requestBody: req.body,
    userId: req.user?.userId ?? null,
    companyId: req.user?.companyId ?? (req as any).companyId ?? null,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });

  if (!res.headersSent) {
    res.status(statusCode).json({ message });
  }
}

// src/app.ts
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";
import { errorCaptureMiddleware, globalErrorHandler } from "./middlewares/error.middleware.js";

const app = express();

const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
  : [];

const lanServerIp = process.env.LAN_SERVER_IP?.trim();
const lanOrigins = lanServerIp
  ? [
      `http://${lanServerIp}`,
      `http://${lanServerIp}:80`,
      `http://${lanServerIp}:5173`,
      `http://${lanServerIp}:5174`,
      `http://${lanServerIp}:3000`,
      `http://${lanServerIp}:8080`,
      `https://${lanServerIp}`,
    ]
  : [];

const devOrigins =
  process.env.NODE_ENV !== "production"
    ? [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ]
    : [];

export const allowedOrigins = Array.from(
  new Set([...configuredOrigins, ...lanOrigins, ...devOrigins].filter(Boolean))
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // If LAN_SERVER_IP is configured, match any port requested from that host
      if (lanServerIp) {
        try {
          const parsed = new URL(origin);
          if (parsed.hostname === lanServerIp) {
            return callback(null, true);
          }
        } catch {
          // Invalid origin URL
        }
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.set("trust proxy", 1);
app.use(cookieParser());

app.use(express.json());
app.use(errorCaptureMiddleware);

app.get("/", (_, res) => {
  res.status(200).json({ status: "ok" });
});

const swaggerPath = path.resolve("./swagger-output.json");

if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(
    fs.readFileSync(swaggerPath, "utf-8")
  );

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

app.use("/api", routes);

app.use(globalErrorHandler);

export default app;

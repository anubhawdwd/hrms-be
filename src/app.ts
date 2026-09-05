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

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://192.168.1.185:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://192.168.1.185:5174",
];

const allowedOrigins = Array.from(
  new Set([...defaultOrigins, ...configuredOrigins].filter(Boolean))
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
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

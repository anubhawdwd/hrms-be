// src/server.ts
import "dotenv/config";
import http from "http";
import app, { allowedOrigins } from "./app.js";
import { initSocketServer } from "./socket/index.js";
import { startErrorLogRetentionJob } from "./modules/error-log/cleanup.js";
import { startNotificationRetentionJob } from "./modules/notification/cleanup.js";

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;
const HOST = process.env.API_HOST || "0.0.0.0";

const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
initSocketServer(server, allowedOrigins);

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT} (bound to ${HOST})`);
  startErrorLogRetentionJob();
  startNotificationRetentionJob();
});



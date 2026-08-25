// src/server.ts
import "dotenv/config";
import app from "./app.js";

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;
const HOST = process.env.API_HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT} (bound to ${HOST})`);
});


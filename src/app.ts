// src/app.ts
import express from "express";
import cors from "cors";
import organizationRoutes from "./modules/organization/routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});

/**
 * Temporary company scoping:
 * In Phase 2 this will come from JWT.
 */
app.use("/api/organization", organizationRoutes);

export default app;

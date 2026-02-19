// src/app.ts
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin:[
      "http://localhost:5173",
      "https://tender-employ-hampton-seeing.trycloudflare.com",
    ], 
    credentials: true,
  })
);
app.set("trust proxy", 1);
app.use(cookieParser());

app.use(express.json());

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

export default app;

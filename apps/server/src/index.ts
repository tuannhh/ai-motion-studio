import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import path from "node:path";
import { appConfig, storagePaths } from "./config";
import { pool, verifyTables } from "./db";
import { errorHandler } from "./middleware/error";
import { requireAuth } from "./middleware/auth";
import { authRoutes } from "./routes/auth.routes";
import { projectRoutes } from "./routes/project.routes";
import { jobRoutes, scriptRoutes } from "./routes/script.routes";
import { adminRoutes } from "./routes/admin.routes";
import { watermarkRoutes } from "./routes/watermark.routes";
import { watermarkPresetRoutes } from "./routes/watermark-preset.routes";
import { templateRoutes } from "./routes/template.routes";
import { seriesRoutes } from "./routes/series.routes";
import { musicRoutes } from "./routes/music.routes";
import { integrationRoutes } from "./routes/integrations.routes";
import {
  recoverStaleJobs,
  startRenderWorker,
  stopRenderWorker,
} from "./services/render-worker";

const app = express();
app.disable("x-powered-by");
// Helmet: giữ CSP chặt nhưng BỎ `upgrade-insecure-requests` và HSTS — app phục vụ
// web tĩnh qua HTTP trực tiếp (docker/dev); 2 directive đó ép asset sang HTTPS →
// trang trắng. Khi chạy sau proxy/Cloud Run (HTTPS thật), proxy tự set HSTS.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "upgrade-insecure-requests": null,
        "img-src": ["'self'", "data:", "blob:"],
        "media-src": ["'self'", "blob:"],
      },
    },
    strictTransportSecurity: false,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/** Health-check cho hạ tầng — không cần auth, không lộ thông tin nội bộ */
app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ data: { status: "ok" } });
  } catch {
    res.status(503).json({ error: { message: "database unavailable" } });
  }
});

app.use("/v1/auth", authRoutes);
app.use("/v1/projects", requireAuth, projectRoutes);
app.use("/v1/scripts", requireAuth, scriptRoutes);
app.use("/v1/jobs", requireAuth, jobRoutes);
app.use("/v1/watermark", requireAuth, watermarkRoutes);
app.use("/v1/watermark-presets", requireAuth, watermarkPresetRoutes);
app.use("/v1/templates", requireAuth, templateRoutes);
app.use("/v1/series", requireAuth, seriesRoutes);
app.use("/v1/music", requireAuth, musicRoutes);
app.use("/v1/integrations", requireAuth, integrationRoutes);
app.use("/v1/admin", requireAuth, adminRoutes);

// API không khớp → 404 JSON (đặt trước SPA để không nuốt route /v1)
app.use("/v1", (_req, res) => {
  res.status(404).json({ error: { message: "Không tìm thấy endpoint." } });
});

// Production: phục vụ web build tĩnh + SPA fallback (cùng origin với API →
// cookie phiên & OAuth redirect dùng chung 1 domain, không cần CORS).
if (fs.existsSync(appConfig.webDist)) {
  app.use(express.static(appConfig.webDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(appConfig.webDist, "index.html"));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: { message: "Không tìm thấy endpoint." } });
  });
}

app.use(errorHandler);

const main = async () => {
  for (const dir of Object.values(storagePaths)) fs.mkdirSync(dir, { recursive: true });
  await verifyTables();
  await recoverStaleJobs();
  startRenderWorker();

  const server = app.listen(appConfig.listenPort, () => {
    console.log(`[server] AI Motion Studio API — http://localhost:${appConfig.listenPort} (${appConfig.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    console.log(`[server] Nhận ${signal} — đóng graceful...`);
    stopRenderWorker();
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

main().catch((err) => {
  console.error("[server] Không khởi động được:", err);
  process.exit(1);
});

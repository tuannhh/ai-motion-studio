import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loadEnv } from "@ams/pipeline/src/env";

/**
 * Cấu hình server — validate fail-fast lúc khởi động (misa-backend-standard 09).
 * Giá trị nhạy cảm nằm ở .env repo root (gitignored), default chỉ cho dev local.
 */

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // PORT (chuẩn Cloud Run/PaaS) ưu tiên hơn SERVER_PORT nếu có.
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(4600),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().default(3310),
  DB_USER: z.string().default("ams"),
  DB_PASSWORD: z.string().default("ams_dev_password"),
  DB_NAME: z.string().default("ams"),
  SESSION_TTL_HOURS: z.coerce.number().min(1).max(720).default(8),
  /** giới hạn file tư liệu upload (MB) — khớp giới hạn inline Gemini 18MB */
  UPLOAD_MAX_MB: z.coerce.number().min(1).max(64).default(18),
  /** Số job render chạy song song trong 1 tiến trình (pha TTS/ảnh I/O chồng lấn) */
  RENDER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  /** Khoá mã hoá token tích hợp (AES-256-GCM) — 32 byte = 64 ký tự hex. */
  APP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "phải là 64 ký tự hex (32 byte)")
    .default("0".repeat(64)),
  /** Google Drive OAuth — để trống = tắt tính năng export Drive. */
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_OAUTH_REDIRECT: z
    .string()
    .url()
    .default("http://localhost:4600/v1/integrations/gdrive/callback"),
  /** URL app web để redirect người dùng về sau callback OAuth. */
  WEB_BASE_URL: z.string().url().default("http://localhost:4610"),
  /**
   * Cookie phiên gắn cờ Secure? Chỉ bật khi thật sự phục vụ qua HTTPS. Mặc định
   * TẮT: Docker/dev chạy HTTP, cookie Secure trên HTTP bị Safari từ chối lưu →
   * đăng nhập xong vẫn 401. Đặt COOKIE_SECURE=1 khi chạy sau proxy HTTPS thật.
   */
  COOKIE_SECURE: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const detail = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Cấu hình môi trường không hợp lệ — ${detail}`);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const appConfig = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  /** cookie Secure: chỉ khi COOKIE_SECURE=1 (HTTPS thật), KHÔNG theo NODE_ENV */
  cookieSecure: parsed.data.COOKIE_SECURE === "1" || parsed.data.COOKIE_SECURE === "true",
  /** cổng lắng nghe thực tế: PORT (Cloud Run) > SERVER_PORT */
  listenPort: parsed.data.PORT ?? parsed.data.SERVER_PORT,
  /** thư mục gốc dữ liệu server (ngoài src, gitignored) */
  storageRoot: path.resolve(__dirname, "../storage"),
  /** thư mục web build tĩnh (apps/web/dist) — phục vụ SPA ở production */
  webDist: path.resolve(__dirname, "../../web/dist"),
  /** Drive export bật khi có đủ client id/secret */
  gdriveEnabled:
    parsed.data.GOOGLE_CLIENT_ID !== "" &&
    parsed.data.GOOGLE_CLIENT_SECRET !== "",
};

// Fail-fast: bật tích hợp nhưng khoá mã hoá còn để mặc định = từ chối khởi động
// (production tuyệt đối không được lưu token với khoá rỗng).
if (appConfig.gdriveEnabled && appConfig.APP_ENCRYPTION_KEY === "0".repeat(64)) {
  throw new Error(
    "Bật Google Drive nhưng APP_ENCRYPTION_KEY chưa đặt — sinh khoá: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

export const storagePaths = {
  /** file người dùng upload + video render — chỉ phục vụ qua endpoint có auth */
  privateSources: path.join(appConfig.storageRoot, "private/sources"),
  privateRenders: path.join(appConfig.storageRoot, "private/renders"),
  privateWatermark: path.join(appConfig.storageRoot, "private/watermark"),
  privateTemplates: path.join(appConfig.storageRoot, "private/templates"),
  privateMusic: path.join(appConfig.storageRoot, "private/music"),
  temp: path.join(appConfig.storageRoot, "temp"),
};

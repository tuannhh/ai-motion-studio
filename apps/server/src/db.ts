import mysql from "mysql2/promise";
import { appConfig } from "./config";

/** Pool MySQL dùng chung — mọi truy vấn đều tham số hoá, không nối chuỗi SQL. */
export const pool = mysql.createPool({
  // Cloud SQL trên Cloud Run: có DB_SOCKET_PATH → nối qua Unix socket (host/port
  // bị bỏ qua khi có socketPath, theo mysql2). Local/Docker: TCP host:port như cũ.
  ...(appConfig.DB_SOCKET_PATH
    ? { socketPath: appConfig.DB_SOCKET_PATH }
    : { host: appConfig.DB_HOST, port: appConfig.DB_PORT }),
  user: appConfig.DB_USER,
  password: appConfig.DB_PASSWORD,
  database: appConfig.DB_NAME,
  timezone: "Z",
  connectionLimit: 10,
  namedPlaceholders: false,
  charset: "utf8mb4_unicode_ci",
});

const REQUIRED_TABLES = [
  "users",
  "sessions",
  "projects",
  "project_sources",
  "scripts",
  "script_versions",
  "render_jobs",
  "watermark_config",
  "user_watermarks",
  "templates",
  "motion_runs",
  "series",
  "music_tracks",
  "gdrive_accounts",
  "oauth_states",
  "drive_exports",
  "watermark_presets",
];

/**
 * App không tự chạy migration (misa-backend-standard 05) — chỉ kiểm tra
 * schema.sql đã được áp thủ công chưa; thiếu bảng thì fail-fast với hướng dẫn.
 */
export const verifyTables = async (): Promise<void> => {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?`,
    [appConfig.DB_NAME],
  );
  const existing = new Set(rows.map((r) => String(r.t)));
  const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));
  const [columns] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=? AND table_name IN ('scripts','projects','music_tracks')",
    [appConfig.DB_NAME],
  );
  for (const [table, column] of [
    ["scripts", "research_json"],
    ["projects", "research_json"],
    ["music_tracks", "is_shared"],
  ]) {
    if (
      !columns.some(
        (r) =>
          (r.TABLE_NAME === table && r.COLUMN_NAME === column) ||
          (r.table_name === table && r.column_name === column),
      )
    )
      missing.push(`${table}.${column}`);
  }
  if (missing.length) {
    throw new Error(
      `Thiếu bảng: ${missing.join(", ")}. Áp schema trước:\n` +
        `  docker compose exec -T mysql mysql -h127.0.0.1 -uams -p... ams < apps/server/startup/database/schema.sql`,
    );
  }
};

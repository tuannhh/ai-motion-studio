/**
 * Seed tài khoản admin đầu tiên (idempotent):
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @ams/server seed
 * Không hard-code mật khẩu — bắt buộc truyền qua biến môi trường lúc chạy.
 */
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "./db";
import { hashPassword } from "./services/auth.service";

const main = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_NAME ?? "Quản trị viên";
  if (!email || !password || password.length < 8) {
    console.error("Cần ADMIN_EMAIL và ADMIN_PASSWORD (≥8 ký tự) trong biến môi trường.");
    process.exit(1);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  if (rows[0]) {
    console.log(`Admin ${email} đã tồn tại (id=${rows[0].id}) — bỏ qua.`);
  } else {
    await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, 'admin')`,
      [email, await hashPassword(password), displayName]
    );
    console.log(`✅ Đã tạo admin ${email}.`);
  }
  await pool.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

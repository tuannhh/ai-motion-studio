import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { appConfig } from "../config";
import { badRequest, unauthorized } from "../http-error";

/**
 * Xác thực session-cookie (port pattern đã audit từ ai-video-studio):
 * - token phiên ngẫu nhiên, DB chỉ lưu SHA-256 hash (lộ DB không lộ phiên);
 * - CSRF token riêng theo phiên, client gửi lại qua header với request ghi;
 * - verify argon2 cả khi email không tồn tại để chống dò email qua timing.
 */

const INVALID_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$hhAVgkzo6+NKoQM5DwTCrg$jU6pcAlsKMeHLNGzdsxhn28fdJYfuRfj7d3xiXMMBoI";

export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "creator";
};

const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

export const login = async (email: string, password: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, email, password_hash, display_name, role
       FROM users WHERE email = ? AND is_active = 1 LIMIT 1`,
    [normalizedEmail]
  );
  const user = rows[0];
  const matches = await argon2.verify(
    user?.password_hash ?? INVALID_PASSWORD_HASH,
    password
  );
  if (!user || !matches) throw unauthorized("Email hoặc mật khẩu không đúng.");

  const sessionToken = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const maxAgeMs = appConfig.SESSION_TTL_HOURS * 60 * 60 * 1000;
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, csrf_token, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [user.id, hashToken(sessionToken), csrfToken, appConfig.SESSION_TTL_HOURS]
  );
  // Dọn phiên hết hạn nhân tiện (rẻ, tránh bảng sessions phình vô hạn)
  await pool.query(`DELETE FROM sessions WHERE expires_at < NOW()`);

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
  };
  return { sessionToken, csrfToken, maxAgeMs, user: sessionUser };
};

export const logout = async (rawToken?: string): Promise<void> => {
  if (!rawToken) return;
  await pool.query(`DELETE FROM sessions WHERE token_hash = ?`, [
    hashToken(rawToken),
  ]);
};

export type AuthContext = { user: SessionUser; csrfToken: string };

/** Tra phiên từ cookie token — trả null nếu không hợp lệ/hết hạn */
export const resolveSession = async (
  rawToken?: string
): Promise<AuthContext | null> => {
  if (!rawToken) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.csrf_token, u.id, u.email, u.display_name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.is_active = 1
      WHERE s.token_hash = ? AND s.expires_at > NOW()
      LIMIT 1`,
    [hashToken(rawToken)]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    csrfToken: row.csrf_token,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    },
  };
};

export const hashPassword = (password: string): Promise<string> =>
  argon2.hash(password);

/**
 * Đổi mật khẩu tự phục vụ: xác minh mật khẩu hiện tại, băm mật khẩu mới, và
 * VÔ HIỆU HOÁ mọi phiên khác của user (giữ lại phiên hiện tại theo token) —
 * đổi mật khẩu phải đá các thiết bị đang đăng nhập cũ ra (misa-backend-standard 02).
 */
export const changePassword = async (
  userId: number,
  currentPassword: string,
  newPassword: string,
  keepRawToken?: string
): Promise<void> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT password_hash FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
    [userId]
  );
  const user = rows[0];
  const matches = await argon2.verify(
    user?.password_hash ?? INVALID_PASSWORD_HASH,
    currentPassword
  );
  if (!user || !matches) throw badRequest("Mật khẩu hiện tại không đúng.");

  const newHash = await argon2.hash(newPassword);
  await pool.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [
    newHash,
    userId,
  ]);
  // Đá tất cả phiên khác (giữ phiên đang thao tác nếu có token)
  if (keepRawToken) {
    await pool.query(
      `DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`,
      [userId, hashToken(keepRawToken)]
    );
  } else {
    await pool.query(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
  }
};

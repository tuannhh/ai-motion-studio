import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { pool } from "../db";
import { badRequest, notFound } from "../http-error";
import { hashPassword } from "./auth.service";

/** Quản lý creator (admin) — allowlist trường rõ ràng, không mass assignment. */

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(190),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
  role: z.enum(["admin", "creator"]).default("creator"),
});

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(8).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const listUsers = async () => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, email, display_name, role, is_active, created_at,
            (SELECT COUNT(*) FROM projects WHERE user_id = users.id) AS project_count
       FROM users ORDER BY id`
  );
  return rows;
};

export const createUser = async (
  input: z.infer<typeof createUserSchema>
): Promise<number> => {
  const [dup] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM users WHERE email = ? LIMIT 1`,
    [input.email]
  );
  if (dup[0]) throw badRequest("Email này đã được đăng ký.");
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)`,
    [input.email, await hashPassword(input.password), input.displayName, input.role]
  );
  return result.insertId;
};

export const updateUser = async (
  actorId: number,
  userId: number,
  input: z.infer<typeof updateUserSchema>
): Promise<void> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy người dùng.");
  if (input.isActive === false && userId === actorId) {
    throw badRequest("Không thể tự khoá tài khoản của chính mình.");
  }
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.displayName !== undefined) {
    sets.push("display_name = ?");
    params.push(input.displayName);
  }
  if (input.password !== undefined) {
    sets.push("password_hash = ?");
    params.push(await hashPassword(input.password));
  }
  if (input.isActive !== undefined) {
    sets.push("is_active = ?");
    params.push(input.isActive ? 1 : 0);
    if (!input.isActive) {
      await pool.query(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
    }
  }
  if (!sets.length) throw badRequest("Không có trường nào để cập nhật.");
  params.push(userId);
  await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
};

import fs from "node:fs";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { pool } from "../db";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";

/**
 * Watermark toàn hệ thống (1 dòng id=1, admin quản lý): text hoặc ảnh,
 * vị trí x/y theo tỷ lệ khung, độ mờ, kích thước — khớp schema
 * style.watermark của motion-engine, worker chèn vào spec lúc render.
 */

export const watermarkUpdateSchema = z.object({
  kind: z.enum(["none", "text", "image"]),
  text: z.string().trim().max(40).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  opacity: z.number().min(0.05).max(1),
  scale: z.number().min(0.03).max(0.6),
});
export type WatermarkUpdate = z.infer<typeof watermarkUpdateSchema>;

export type WatermarkConfig = {
  kind: "none" | "text" | "image";
  text: string | null;
  hasImage: boolean;
  imagePath: string | null;
  x: number;
  y: number;
  opacity: number;
  scale: number;
};

export const getWatermark = async (): Promise<WatermarkConfig> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT kind, text, image_path, pos_x, pos_y, opacity, scale FROM watermark_config WHERE id = 1`
  );
  const r = rows[0];
  if (!r) throw notFound("Chưa có cấu hình watermark (schema chưa seed dòng id=1).");
  return {
    kind: r.kind,
    text: r.text,
    hasImage: Boolean(r.image_path),
    imagePath: r.image_path,
    x: Number(r.pos_x),
    y: Number(r.pos_y),
    opacity: Number(r.opacity),
    scale: Number(r.scale),
  };
};

export const updateWatermark = async (input: WatermarkUpdate): Promise<void> => {
  if (input.kind === "text" && !input.text) {
    throw badRequest("Watermark dạng text cần nội dung text.");
  }
  if (input.kind === "image") {
    const current = await getWatermark();
    if (!current.hasImage) {
      throw badRequest("Chưa upload ảnh watermark — upload ảnh trước khi chọn dạng ảnh.");
    }
  }
  await pool.query(
    `UPDATE watermark_config
        SET kind = ?, text = ?, pos_x = ?, pos_y = ?, opacity = ?, scale = ?
      WHERE id = 1`,
    [input.kind, input.text ?? null, input.x, input.y, input.opacity, input.scale]
  );
};

// ===== Watermark riêng của creator (kind='inherit' = dùng mặc định hệ thống) =====

export const userWatermarkUpdateSchema = z.object({
  kind: z.enum(["inherit", "none", "text", "image"]),
  text: z.string().trim().max(40).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  opacity: z.number().min(0.05).max(1),
  scale: z.number().min(0.03).max(0.6),
});
export type UserWatermarkUpdate = z.infer<typeof userWatermarkUpdateSchema>;

export type UserWatermarkConfig = Omit<WatermarkConfig, "kind"> & {
  kind: "inherit" | "none" | "text" | "image";
};

const USER_WATERMARK_DEFAULTS: UserWatermarkConfig = {
  kind: "inherit",
  text: null,
  hasImage: false,
  imagePath: null,
  x: 0.5,
  y: 0.06,
  opacity: 0.5,
  scale: 0.16,
};

export const getUserWatermark = async (
  userId: number
): Promise<UserWatermarkConfig> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT kind, text, image_path, pos_x, pos_y, opacity, scale
       FROM user_watermarks WHERE user_id = ?`,
    [userId]
  );
  const r = rows[0];
  if (!r) return { ...USER_WATERMARK_DEFAULTS };
  return {
    kind: r.kind,
    text: r.text,
    hasImage: Boolean(r.image_path),
    imagePath: r.image_path,
    x: Number(r.pos_x),
    y: Number(r.pos_y),
    opacity: Number(r.opacity),
    scale: Number(r.scale),
  };
};

export const updateUserWatermark = async (
  userId: number,
  input: UserWatermarkUpdate
): Promise<void> => {
  if (input.kind === "text" && !input.text) {
    throw badRequest("Watermark dạng text cần nội dung text.");
  }
  if (input.kind === "image") {
    const current = await getUserWatermark(userId);
    if (!current.hasImage) {
      throw badRequest("Chưa upload ảnh watermark — upload ảnh trước khi chọn dạng ảnh.");
    }
  }
  await pool.query(
    `INSERT INTO user_watermarks (user_id, kind, text, pos_x, pos_y, opacity, scale)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       kind = VALUES(kind), text = VALUES(text), pos_x = VALUES(pos_x),
       pos_y = VALUES(pos_y), opacity = VALUES(opacity), scale = VALUES(scale)`,
    [userId, input.kind, input.text ?? null, input.x, input.y, input.opacity, input.scale]
  );
};

/**
 * Watermark hiệu lực lúc render: creator đã tự cấu hình (khác 'inherit')
 * thì dùng của họ, chưa thì rơi về mặc định hệ thống do admin đặt.
 */
export const getEffectiveWatermark = async (
  userId: number
): Promise<WatermarkConfig> => {
  const own = await getUserWatermark(userId);
  if (own.kind !== "inherit") {
    return { ...own, kind: own.kind };
  }
  return getWatermark();
};

const IMAGE_MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

/**
 * Lưu file ảnh watermark (kiểm tra magic bytes thật, không tin Content-Type
 * client), dọn ảnh cũ CÙNG baseName (không đụng ảnh của user khác).
 */
const storeWatermarkImageFile = (tmpPath: string, baseName: string): string => {
  const head = Buffer.alloc(8);
  const fd = fs.openSync(tmpPath, "r");
  fs.readSync(fd, head, 0, 8, 0);
  fs.closeSync(fd);
  const match = IMAGE_MAGIC.find((m) => m.bytes.every((b, i) => head[i] === b));
  if (!match) {
    fs.rmSync(tmpPath, { force: true });
    throw badRequest("File không phải ảnh PNG/JPEG/WebP hợp lệ.");
  }
  fs.mkdirSync(storagePaths.privateWatermark, { recursive: true });
  const ext = match.mime === "image/png" ? ".png" : match.mime === "image/jpeg" ? ".jpg" : ".webp";
  for (const old of fs.readdirSync(storagePaths.privateWatermark)) {
    if (old.startsWith(`${baseName}.`)) {
      fs.rmSync(path.join(storagePaths.privateWatermark, old), { force: true });
    }
  }
  const dest = path.join(storagePaths.privateWatermark, `${baseName}${ext}`);
  fs.renameSync(tmpPath, dest);
  return dest;
};

/** Ảnh watermark mặc định hệ thống (admin) */
export const saveWatermarkImage = async (tmpPath: string): Promise<void> => {
  const dest = storeWatermarkImageFile(tmpPath, "watermark");
  await pool.query(`UPDATE watermark_config SET image_path = ? WHERE id = 1`, [dest]);
};

/** Ảnh watermark riêng của creator */
export const saveUserWatermarkImage = async (
  userId: number,
  tmpPath: string
): Promise<void> => {
  const dest = storeWatermarkImageFile(tmpPath, `user-${userId}`);
  await pool.query(
    `INSERT INTO user_watermarks (user_id, image_path) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE image_path = VALUES(image_path)`,
    [userId, dest]
  );
};

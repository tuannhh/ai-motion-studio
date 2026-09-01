import fs from "node:fs";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { pool } from "../db";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";

/**
 * Thư viện watermark (GĐ4): mỗi user (admin & creator) tạo nhiều watermark có
 * tên, chọn khi tạo video. Vị trí/độ mờ/kích thước theo tỷ lệ khung — khớp
 * schema style.watermark của motion-engine. Mọi truy vấn kèm user_id (chống IDOR).
 */

export const presetInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["text", "image"]),
  text: z.string().trim().max(40).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  opacity: z.number().min(0.05).max(1),
  scale: z.number().min(0.03).max(0.6),
});
export type PresetInput = z.infer<typeof presetInputSchema>;

const rowToDto = (r: RowDataPacket) => ({
  id: r.id,
  name: r.name,
  kind: r.kind as "text" | "image",
  text: r.text as string | null,
  hasImage: Boolean(r.image_path),
  x: Number(r.pos_x),
  y: Number(r.pos_y),
  opacity: Number(r.opacity),
  scale: Number(r.scale),
});

export const listPresets = async (userId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM watermark_presets WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
    [userId]
  );
  return rows.map(rowToDto);
};

const getOwnedRow = async (userId: number, id: number): Promise<RowDataPacket> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM watermark_presets WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy watermark.");
  return rows[0];
};

export const createPreset = async (
  userId: number,
  input: PresetInput
): Promise<number> => {
  if (input.kind === "text" && !input.text) {
    throw badRequest("Watermark dạng chữ cần nội dung.");
  }
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO watermark_presets (user_id, name, kind, text, pos_x, pos_y, opacity, scale)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, input.name, input.kind, input.text ?? null, input.x, input.y, input.opacity, input.scale]
  );
  return res.insertId;
};

export const updatePreset = async (
  userId: number,
  id: number,
  input: PresetInput
): Promise<void> => {
  const row = await getOwnedRow(userId, id);
  if (input.kind === "text" && !input.text) {
    throw badRequest("Watermark dạng chữ cần nội dung.");
  }
  if (input.kind === "image" && !row.image_path) {
    throw badRequest("Chưa có ảnh — upload ảnh trước khi đổi sang dạng ảnh.");
  }
  await pool.query(
    `UPDATE watermark_presets
        SET name = ?, kind = ?, text = ?, pos_x = ?, pos_y = ?, opacity = ?, scale = ?
      WHERE id = ? AND user_id = ?`,
    [input.name, input.kind, input.text ?? null, input.x, input.y, input.opacity, input.scale, id, userId]
  );
};

export const deletePreset = async (userId: number, id: number): Promise<void> => {
  const row = await getOwnedRow(userId, id);
  await pool.query(`DELETE FROM watermark_presets WHERE id = ? AND user_id = ?`, [id, userId]);
  if (row.image_path) fs.rmSync(String(row.image_path), { force: true });
};

/** Preset cho render-worker: chỉ trả khi thuộc về đúng chủ dự án (chống IDOR) */
export const getPresetForRender = async (userId: number, id: number) => {
  const row = await getOwnedRow(userId, id);
  return {
    kind: row.kind as "text" | "image",
    text: row.text as string | null,
    imagePath: row.image_path as string | null,
    x: Number(row.pos_x),
    y: Number(row.pos_y),
    opacity: Number(row.opacity),
    scale: Number(row.scale),
  };
};

const IMAGE_MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

/** Lưu ảnh watermark của 1 preset (magic bytes thật, dọn ảnh cũ cùng baseName) */
export const savePresetImage = async (
  userId: number,
  id: number,
  tmpPath: string
): Promise<void> => {
  await getOwnedRow(userId, id); // xác thực sở hữu trước khi ghi file
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
  const baseName = `preset-${id}`;
  for (const old of fs.readdirSync(storagePaths.privateWatermark)) {
    if (old.startsWith(`${baseName}.`)) {
      fs.rmSync(path.join(storagePaths.privateWatermark, old), { force: true });
    }
  }
  const dest = path.join(storagePaths.privateWatermark, `${baseName}${ext}`);
  fs.renameSync(tmpPath, dest);
  await pool.query(
    `UPDATE watermark_presets SET image_path = ? WHERE id = ? AND user_id = ?`,
    [dest, id, userId]
  );
};

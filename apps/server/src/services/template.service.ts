import fs from "node:fs";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { pool } from "../db";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";
import {
  analyzeVideoStyle,
  styleProfileSchema,
  videoMimeOf,
  type StyleProfile,
} from "@ams/pipeline/src/template";

/**
 * Template-from-video (GĐ3): creator upload video mẫu → Gemini vision phân tích
 * ở nền → StyleProfile lưu DB. Workflow của template (mode/variants/duration/
 * voice/autoRender) chỉnh được sau. Mọi truy vấn kèm user_id (chống IDOR).
 */

/** Workflow pipeline chỉnh được trong template */
export const workflowSchema = z.object({
  mode: z.enum(["angles", "series"]).default("angles"),
  variantCount: z.number().int().min(1).max(5).default(1),
  durationSec: z.number().int().min(20).max(120).default(50),
  voiceGender: z.enum(["male", "female"]).default("female"),
  voiceRegion: z.enum(["bac", "nam"]).default("bac"),
  voiceStyle: z.enum(["thoisu", "tintuc"]).default("tintuc"),
  voiceSpeed: z.union([z.literal(1), z.literal(1.2)]).default(1),
  /**
   * true (mặc định) = giữ gate người duyệt kịch bản trước khi render;
   * false = pipeline tự động: sinh kịch bản xong tự approve + render ngay.
   */
  approveGate: z.boolean().default(true),
  /**
   * Pipeline/workflow kịch bản do creator định nghĩa/sửa. Rỗng = dùng gợi ý
   * AI học từ video mẫu (profile.scriptPipeline). Có phần tử = ghi đè hoàn toàn.
   */
  scriptPipeline: z.array(z.string().min(1).max(160)).max(10).default([]),
});
export type TemplateWorkflow = z.infer<typeof workflowSchema>;

const rowToDto = (row: RowDataPacket) => ({
  id: row.id,
  name: row.name,
  sourceVideoName: row.source_video_name,
  status: row.status,
  errorMessage: row.error_message,
  profile: row.profile_json ? JSON.parse(String(row.profile_json)) : null,
  workflow: workflowSchema.parse(JSON.parse(String(row.workflow_json))),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listTemplates = async (userId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM templates WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
    [userId]
  );
  return rows.map(rowToDto);
};

export const getTemplateOwned = async (userId: number, templateId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM templates WHERE id = ? AND user_id = ? LIMIT 1`,
    [templateId, userId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy template.");
  return rows[0];
};

export const getTemplateDetail = async (userId: number, templateId: number) =>
  rowToDto(await getTemplateOwned(userId, templateId));

/** Profile đã ready của template (dùng khi sinh kịch bản) — fail-closed */
export const getReadyProfile = async (
  userId: number,
  templateId: number
): Promise<{ profile: StyleProfile; workflow: TemplateWorkflow }> => {
  const row = await getTemplateOwned(userId, templateId);
  if (row.status !== "ready" || !row.profile_json) {
    throw badRequest("Template chưa sẵn sàng (đang phân tích hoặc lỗi).");
  }
  return {
    profile: styleProfileSchema.parse(JSON.parse(String(row.profile_json))),
    workflow: workflowSchema.parse(JSON.parse(String(row.workflow_json))),
  };
};

/**
 * Tạo template từ video mẫu upload: lưu file, insert 'analyzing', phân tích
 * Gemini ở nền (client poll qua GET). Magic bytes video kiểm tra thật —
 * không tin Content-Type/đuôi file.
 */
export const createTemplate = async (
  userId: number,
  name: string,
  file: { originalname: string; path: string; size: number }
): Promise<number> => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!videoMimeOf(file.originalname)) {
    fs.rmSync(file.path, { force: true });
    throw badRequest("Định dạng chưa hỗ trợ — dùng mp4, mov hoặc webm.");
  }
  if (!looksLikeVideo(file.path, ext)) {
    fs.rmSync(file.path, { force: true });
    throw badRequest("File không phải video hợp lệ.");
  }

  const dir = path.join(storagePaths.privateTemplates, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  const storedPath = path.join(dir, `tpl-${Date.now()}${ext}`);
  fs.renameSync(file.path, storedPath);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO templates (user_id, name, source_video_name, source_video_path, workflow_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      name,
      file.originalname.slice(0, 255),
      storedPath,
      JSON.stringify(workflowSchema.parse({})),
    ]
  );
  const templateId = result.insertId;

  void analyzeVideoStyle(storedPath)
    .then(async (profile) => {
      await pool.query(
        `UPDATE templates SET status = 'ready', profile_json = ?, error_message = NULL WHERE id = ?`,
        [JSON.stringify(profile), templateId]
      );
    })
    .catch(async (err) => {
      await pool.query(
        `UPDATE templates SET status = 'failed', error_message = ? WHERE id = ?`,
        [String((err as Error).message).slice(0, 1000), templateId]
      );
    });
  return templateId;
};

/** Phân tích lại (sau lỗi hoặc muốn refresh profile) */
export const reanalyzeTemplate = async (
  userId: number,
  templateId: number
): Promise<void> => {
  const row = await getTemplateOwned(userId, templateId);
  if (row.status === "analyzing") {
    throw badRequest("Template đang được phân tích, vui lòng đợi.");
  }
  const videoPath = String(row.source_video_path ?? "");
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw badRequest("Video mẫu không còn trên máy chủ — tạo template mới.");
  }
  await pool.query(
    `UPDATE templates SET status = 'analyzing', error_message = NULL WHERE id = ?`,
    [templateId]
  );
  void analyzeVideoStyle(videoPath)
    .then(async (profile) => {
      await pool.query(
        `UPDATE templates SET status = 'ready', profile_json = ? WHERE id = ?`,
        [JSON.stringify(profile), templateId]
      );
    })
    .catch(async (err) => {
      await pool.query(
        `UPDATE templates SET status = 'failed', error_message = ? WHERE id = ?`,
        [String((err as Error).message).slice(0, 1000), templateId]
      );
    });
};

/** Sửa tên + workflow (không cho sửa profile tay — profile là kết quả phân tích) */
export const updateTemplate = async (
  userId: number,
  templateId: number,
  input: { name?: string; workflow?: TemplateWorkflow }
): Promise<void> => {
  await getTemplateOwned(userId, templateId);
  if (input.name !== undefined) {
    await pool.query(`UPDATE templates SET name = ? WHERE id = ?`, [
      input.name,
      templateId,
    ]);
  }
  if (input.workflow !== undefined) {
    await pool.query(`UPDATE templates SET workflow_json = ? WHERE id = ?`, [
      JSON.stringify(input.workflow),
      templateId,
    ]);
  }
};

export const deleteTemplate = async (
  userId: number,
  templateId: number
): Promise<void> => {
  const row = await getTemplateOwned(userId, templateId);
  await pool.query(`DELETE FROM templates WHERE id = ?`, [templateId]);
  if (row.source_video_path) {
    fs.rmSync(String(row.source_video_path), { force: true });
  }
};

/**
 * Magic bytes: mp4/mov có "ftyp" tại offset 4; webm mở đầu EBML 1A 45 DF A3.
 * (Theo cách watermark.service kiểm ảnh — không tin metadata client.)
 */
const looksLikeVideo = (filePath: string, ext: string): boolean => {
  const fd = fs.openSync(filePath, "r");
  try {
    const head = Buffer.alloc(12);
    fs.readSync(fd, head, 0, 12, 0);
    if (ext === ".webm") {
      return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
    }
    return head.subarray(4, 8).toString("ascii") === "ftyp";
  } finally {
    fs.closeSync(fd);
  }
};

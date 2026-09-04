import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { badRequest, notFound } from "../http-error";
import { enqueueRender } from "./render-worker";
import { planSchema } from "@ams/pipeline/src/prompts";
import { planToNarrationMd } from "@ams/pipeline/src/api";
import { mergeSceneContent } from "@ams/pipeline/src/scene-content";

/**
 * Duyệt/từ chối kịch bản + tra job render. Mọi truy vấn join tới
 * projects.user_id — script/job của người khác trả 404 (chống IDOR).
 */

const getScriptOwned = async (userId: number, scriptId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.status, s.plan_json, s.narration_md, s.title, s.angle, s.preset
       FROM scripts s
       JOIN projects p ON p.id = s.project_id AND p.user_id = ?
      WHERE s.id = ? LIMIT 1`,
    [userId, scriptId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy kịch bản.");
  return rows[0];
};

export const getScriptDetail = async (userId: number, scriptId: number) => {
  const script = await getScriptOwned(userId, scriptId);
  return {
    id: script.id,
    status: script.status,
    title: script.title,
    angle: script.angle,
    preset: script.preset,
    narrationMd: script.narration_md,
    plan: JSON.parse(String(script.plan_json)),
  };
};

/** Các trạng thái job đang chạy — cấm sửa/duyệt lại khi đang render dở */
const ACTIVE_JOB_STATUSES = ["queued", "images", "tts", "rendering"] as const;

/** true nếu script đang có job render chạy dở (không cho sửa/render lại lúc này) */
const hasActiveJob = async (scriptId: number): Promise<boolean> => {
  const [jobs] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM render_jobs WHERE script_id = ? AND status IN (?) LIMIT 1`,
    [scriptId, ACTIVE_JOB_STATUSES as unknown as string[]]
  );
  return Boolean(jobs[0]);
};

/**
 * Sửa lời thoại (narration) + chữ trên hình (content — headline/sub/items...)
 * từng scene — cho phép CẢ trước khi duyệt (pending) LẪN sau khi đã render
 * (approved), để người dùng phát hiện lỗi thì sửa rồi render lại. Chỉ cấm khi
 * kịch bản đã bị từ chối hoặc đang có job render chạy dở. `content` chỉ ghi đè
 * field text thuần theo SCENE_CONTENT_FIELDS (allow-list, không tin field lạ
 * từ client) — giữ nguyên field cấu trúc/thẩm mỹ do AI/engine quyết định. Re-
 * validate theo planSchema (fail-closed), dựng lại narration_md. IDOR qua
 * getScriptOwned. (Không tự render lại — người dùng bấm "Duyệt & render" /
 * "Render lại" sau khi lưu.)
 */
export const updateScriptScenes = async (
  userId: number,
  scriptId: number,
  edits: Array<{ id: string; narration?: string; content?: Record<string, unknown> }>
): Promise<void> => {
  const script = await getScriptOwned(userId, scriptId);
  if (script.status === "rejected") {
    throw badRequest("Kịch bản đã bị từ chối — không sửa được.");
  }
  if (await hasActiveJob(scriptId)) {
    throw badRequest("Kịch bản đang render — đợi render xong rồi hãy sửa.");
  }
  const plan = JSON.parse(String(script.plan_json));
  const byId = new Map(edits.map((e) => [e.id, e]));
  for (const scene of plan.scenes as Array<Record<string, unknown>>) {
    const edit = byId.get(scene.id as string);
    if (!edit) continue;
    if (edit.narration !== undefined) scene.narration = edit.narration.trim();
    mergeSceneContent(scene, edit.content);
  }
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) {
    throw badRequest(
      `Nội dung không hợp lệ: ${parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  await pool.query(
    `UPDATE scripts SET plan_json = ?, narration_md = ? WHERE id = ?`,
    [JSON.stringify(parsed.data), planToNarrationMd(parsed.data), scriptId]
  );
};

/** Duyệt kịch bản → tạo render job (checkpoint Human-AI bắt buộc trước render) */
export const approveScript = async (
  userId: number,
  scriptId: number
): Promise<number> => {
  const script = await getScriptOwned(userId, scriptId);
  if (await hasActiveJob(scriptId)) {
    throw badRequest("Kịch bản này đang có job render chạy dở.");
  }
  if (script.status !== "approved") {
    await pool.query(`UPDATE scripts SET status = 'approved' WHERE id = ?`, [scriptId]);
  }
  return enqueueRender(scriptId);
};

export const rejectScript = async (
  userId: number,
  scriptId: number
): Promise<void> => {
  await getScriptOwned(userId, scriptId);
  await pool.query(`UPDATE scripts SET status = 'rejected' WHERE id = ?`, [scriptId]);
};

/** Job render kèm kiểm tra sở hữu qua chuỗi job→script→project */
export const getJobOwned = async (userId: number, jobId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT j.id, j.status, j.progress, j.output_path, j.error_message,
            j.created_at, j.started_at, j.finished_at, s.title, s.slug
       FROM render_jobs j
       JOIN scripts s ON s.id = j.script_id
       JOIN projects p ON p.id = s.project_id AND p.user_id = ?
      WHERE j.id = ? LIMIT 1`,
    [userId, jobId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy job render.");
  return rows[0];
};

/** Danh sách video đã render xong của user (thư viện video) */
export const listFinishedJobs = async (userId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT j.id, j.status, j.progress, j.finished_at, s.title, s.slug, s.preset, p.id AS project_id
       FROM render_jobs j
       JOIN scripts s ON s.id = j.script_id
       JOIN projects p ON p.id = s.project_id AND p.user_id = ?
      ORDER BY j.id DESC LIMIT 100`,
    [userId]
  );
  return rows;
};

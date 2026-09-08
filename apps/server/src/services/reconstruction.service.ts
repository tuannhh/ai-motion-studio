import fs from "node:fs";
import path from "node:path";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../db";
import { storagePaths } from "../config";
import { badRequest, conflict, notFound } from "../http-error";
import { getTemplateOwned } from "./template.service";
import {
  reconstructionOptionsSchema,
  runReconstruction,
  type ReconstructionOptions,
} from "@ams/pipeline/src/reconstruction";
import { motionDocumentSchema } from "@ams/motion-engine/src/motion/schema";
import { styleProfileSchema } from "@ams/pipeline/src/template";
const decode = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
export const runDirectory = (id: number) =>
  path.join(storagePaths.privateTemplates, "motion-runs", String(id));
const dto = (r: any) => ({
  id: r.id,
  templateId: r.template_id,
  status: r.status,
  options: decode(r.options_json),
  state: decode(r.state_json),
  error: r.error_message,
  createdAt: r.created_at,
});
export async function getMotionRun(userId: number, id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM motion_runs WHERE id=? AND user_id=?",
    [id, userId],
  );
  if (!rows[0]) throw notFound("Không tìm thấy bản tái dựng.");
  return dto(rows[0]);
}
export async function listMotionRuns(userId: number, templateId: number) {
  await getTemplateOwned(userId, templateId);
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id,template_id,status,options_json,error_message,created_at,JSON_OBJECT("stage",JSON_UNQUOTE(JSON_EXTRACT(state_json,"$.stage")),"progress",JSON_EXTRACT(state_json,"$.progress")) AS state_json FROM motion_runs WHERE user_id=? AND template_id=? ORDER BY id DESC LIMIT 30',
    [userId, templateId],
  );
  return rows.map(dto);
}
export async function createMotionRun(
  userId: number,
  templateId: number,
  input: ReconstructionOptions,
  document?: unknown,
  analysis?: unknown,
) {
  const options = reconstructionOptionsSchema.parse(input);
  const parsed = document ? motionDocumentSchema.parse(document) : undefined;
  if (parsed && Math.abs(parsed.durationSec - options.durationSec) > 0.05)
    throw badRequest("Thời lượng bản sửa phải khớp đoạn đã chọn.");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [owned] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM templates WHERE id=? AND user_id=? FOR UPDATE",
      [templateId, userId],
    );
    if (!owned[0]) throw notFound();
    // Serialize per user, including requests for different templates.
    await conn.query("SELECT id FROM users WHERE id=? FOR UPDATE", [userId]);
    const [active] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM motion_runs WHERE user_id=? AND status IN ("queued","running") LIMIT 1',
      [userId],
    );
    if (active.length)
      throw conflict(
        "Đang có một bản tái dựng. Hãy đợi hoàn tất trước khi tạo tiếp.",
      );
    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO motion_runs(user_id,template_id,options_json,state_json) VALUES(?,?,?,?)",
      [
        userId,
        templateId,
        JSON.stringify(options),
        JSON.stringify({
          stage: "queued",
          progress: 0,
          ...(parsed ? { initial: parsed, analysis } : {}),
        }),
      ],
    );
    await conn.commit();
    return { id: result.insertId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
export async function enableMotionBlueprint(
  userId: number,
  id: number,
  version?: number,
) {
  const run = await getMotionRun(userId, id);
  if (run.status !== "done") throw badRequest("Bản tái dựng chưa hoàn tất.");
  const selected =
    version === undefined
      ? run.state.document
      : run.state.versions?.find((v: any) => v.index === version)?.document;
  if (!selected) throw badRequest("Vòng dựng không tồn tại.");
  const document = motionDocumentSchema.parse(selected);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT profile_json,status FROM templates WHERE id=? AND user_id=? FOR UPDATE",
      [run.templateId, userId],
    );
    if (!rows[0]) throw notFound();
    if (rows[0].status !== "ready")
      throw conflict("Mẫu đang phân tích hoặc chưa sẵn sàng.");
    const profile = styleProfileSchema.parse({
      ...decode(rows[0].profile_json),
      motionBlueprint: document,
      motionEnabled: true,
    });
    await conn.query("UPDATE templates SET profile_json=? WHERE id=?", [
      JSON.stringify(profile),
      run.templateId,
    ]);
    await conn.commit();
    return { templateId: run.templateId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
export async function motionAsset(userId: number, id: number, file: string) {
  await getMotionRun(userId, id);
  if (
    !/^(reference\.mp4|best\.mp4|motion\.json|MotionScene\.tsx|render-\d\.mp4)$/.test(
      file,
    )
  )
    throw notFound();
  const dir = runDirectory(id),
    target = path.join(dir, file);
  if (
    !fs.existsSync(target) ||
    !fs.realpathSync(target).startsWith(fs.realpathSync(dir) + path.sep)
  )
    throw notFound("Tệp chưa sẵn sàng.");
  return target;
}
let timer: ReturnType<typeof setInterval> | undefined;
let busy = false;
export async function recoverMotionRuns() {
  await pool.query(
    'UPDATE motion_runs SET status="failed",error_message="Máy chủ đã khởi động lại. Bản phân tích và các vòng dựng đã lưu; có thể tạo lại." WHERE status="running"',
  );
}
export async function processNextMotionRun() {
  if (busy) return;
  busy = true;
  let id: number | undefined;
  try {
    const conn = await pool.getConnection();
    let row: any;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM motion_runs WHERE status="queued" ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED',
      );
      row = rows[0];
      if (row)
        await conn.query('UPDATE motion_runs SET status="running" WHERE id=?', [
          row.id,
        ]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    if (!row) return;
    id = row.id;
    const template = await getTemplateOwned(row.user_id, row.template_id);
    const initial = decode(row.state_json);
    await runReconstruction(
      String(template.source_video_path),
      runDirectory(row.id),
      decode(row.options_json),
      async (state) => {
        await pool.query(
          "UPDATE motion_runs SET state_json=?,status=? WHERE id=?",
          [
            JSON.stringify(state),
            state.stage === "done" ? "done" : "running",
            row.id,
          ],
        );
      },
      initial.initial,
      initial.analysis,
    );
  } catch (error) {
    console.error(
      "[motion-run]",
      id,
      error instanceof Error ? error.message : "unknown error",
    );
    if (id)
      await pool.query(
        'UPDATE motion_runs SET status="failed",error_message=? WHERE id=?',
        [
          "Không hoàn tất bước tái dựng. Dữ liệu và những vòng đã dựng được giữ lại. Thử lại với đoạn ngắn hơn; xem nhật ký máy chủ để biết nguyên nhân.",
          id,
        ],
      );
  } finally {
    busy = false;
  }
}
export function startMotionWorker() {
  timer = setInterval(
    () =>
      void processNextMotionRun().catch((e) =>
        console.error("[motion-worker]", e.message),
      ),
    2500,
  );
}
export function stopMotionWorker() {
  if (timer) clearInterval(timer);
}

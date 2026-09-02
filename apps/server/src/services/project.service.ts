import fs from "node:fs";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";
import { ingestFile, ingestUrl } from "@ams/pipeline/src/ingest";
import { generatePlans, planToNarrationMd } from "@ams/pipeline/src/api";
import type { VoiceProfile } from "@ams/pipeline/src/gemini";
import { getReadyProfile } from "./template.service";
import { enqueueRender } from "./render-worker";
import {
  buildSeriesContext,
  createSeries,
  getSeriesOwned,
} from "./series.service";
import { assertMusicExists } from "./music.service";
import { getPresetForRender } from "./watermark-preset.service";

/**
 * Nghiệp vụ project của creator. Mọi truy vấn theo id đều kèm điều kiện
 * user_id (chống IDOR — misa-backend-standard 02): không có hàm nào nhận
 * projectId mà thiếu userId đi kèm.
 */

export type CreateProjectInput = {
  idea: string;
  /** nguồn tư liệu: user=chỉ của người dùng; ai=AI tự tìm web; combine=cả hai */
  sourceMode: "user" | "ai" | "combine";
  mode: "angles" | "series";
  variantCount: number;
  presetHint?: string;
  durationSec?: number;
  voiceGender: "male" | "female";
  voiceRegion: "bac" | "nam";
  voiceStyle: "thoisu" | "tintuc";
  voiceSpeed: 1 | 1.2;
  /** template-from-video áp cho project (phải thuộc user và đã ready) */
  templateId?: number;
  /** serie có sẵn để nối tập (phải thuộc user) */
  seriesId?: number;
  /** hoặc tạo serie mới với tên này (chỉ khi mode=series, không kèm seriesId) */
  newSeriesName?: string;
  /** nhạc nền chọn từ thư viện chung (tùy chọn) */
  musicTrackId?: number;
  /** watermark chọn từ thư viện của user (tùy chọn — NULL = watermark mặc định) */
  watermarkPresetId?: number;
};

export const createProject = async (
  userId: number,
  input: CreateProjectInput
): Promise<number> => {
  let presetHint = input.presetHint ?? null;
  if (input.templateId) {
    // Kiểm tra sở hữu + ready (fail-closed); preset khoá theo profile template
    const { profile } = await getReadyProfile(userId, input.templateId);
    presetHint = profile.preset;
  }
  let seriesId: number | null = null;
  if (input.mode === "series") {
    if (input.seriesId) {
      await getSeriesOwned(userId, input.seriesId); // chống IDOR
      seriesId = input.seriesId;
    } else if (input.newSeriesName) {
      seriesId = await createSeries(userId, input.newSeriesName);
    }
  } else if (input.seriesId || input.newSeriesName) {
    throw badRequest("Serie chỉ dùng với chế độ kịch bản 'series'.");
  }
  if (input.musicTrackId) await assertMusicExists(input.musicTrackId);
  if (input.watermarkPresetId) {
    // chống IDOR: preset phải thuộc user (getPresetForRender ném 404 nếu không)
    await getPresetForRender(userId, input.watermarkPresetId);
  }
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO projects
       (user_id, template_id, series_id, music_track_id, watermark_preset_id, idea, source_mode, mode, variant_count, preset_hint, duration_sec,
        voice_gender, voice_region, voice_style, voice_speed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      input.templateId ?? null,
      seriesId,
      input.musicTrackId ?? null,
      input.watermarkPresetId ?? null,
      input.idea,
      input.sourceMode,
      input.mode,
      input.variantCount,
      presetHint,
      input.durationSec ?? null,
      input.voiceGender,
      input.voiceRegion,
      input.voiceStyle,
      input.voiceSpeed,
    ]
  );
  return result.insertId;
};

/**
 * Danh sách project phân trang KEYSET theo p.id giảm dần (misa-backend-standard
 * 04 — không OFFSET để tránh quét sâu khi dữ liệu lớn). cursor = id nhỏ nhất của
 * trang trước; lấy limit+1 dòng để biết còn trang sau không.
 */
export const listProjects = async (
  userId: number,
  opts: { cursor?: number; limit?: number } = {}
): Promise<{ items: RowDataPacket[]; nextCursor: number | null }> => {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const hasCursor = typeof opts.cursor === "number" && opts.cursor > 0;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.idea, p.mode, p.variant_count, p.preset_hint, p.duration_sec,
            p.status, p.error_message, p.created_at,
            (SELECT COUNT(*) FROM scripts s WHERE s.project_id = p.id) AS script_count,
            (SELECT COUNT(*) FROM project_sources ps WHERE ps.project_id = p.id) AS source_count
       FROM projects p
      WHERE p.user_id = ?${hasCursor ? " AND p.id < ?" : ""}
      ORDER BY p.id DESC
      LIMIT ?`,
    hasCursor ? [userId, opts.cursor, limit + 1] : [userId, limit + 1]
  );
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? Number(items[items.length - 1].id) : null;
  return { items, nextCursor };
};

export const getProjectOwned = async (userId: number, projectId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM projects WHERE id = ? AND user_id = ? LIMIT 1`,
    [projectId, userId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy project.");
  return rows[0];
};

/**
 * Trích CHỮ HIỂN THỊ trên hình của 1 scene (khác lời đọc voice-off) để màn duyệt
 * cho user đối chiếu "chữ trên hình" vs "lời đọc". Chỉ đọc, không đổi plan.
 */
const sceneDisplayText = (s: any): string => {
  const parts: string[] = [];
  const push = (v?: unknown) => {
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
  };
  switch (s?.type) {
    case "hook":
      push(s.badge); push(s.headline); push(s.sub);
      break;
    case "points":
      push(s.title); (s.items ?? []).forEach((it: any) => push(it?.text));
      break;
    case "flow":
      push(s.title); (s.nodes ?? []).forEach((n: any) => push(n?.label));
      break;
    case "timeline":
      push(s.title);
      (s.steps ?? []).forEach((st: any) => push([st?.time, st?.label, st?.desc].filter(Boolean).join(" — ")));
      break;
    case "compare":
      push(s.title);
      push(`${s.left?.label ?? ""}: ${(s.left?.points ?? []).join("; ")}`);
      push(`${s.right?.label ?? ""}: ${(s.right?.points ?? []).join("; ")}`);
      break;
    case "stat":
      push(`${s.value ?? ""}${s.unit ?? ""} — ${s.label ?? ""}`); push(s.source);
      break;
    case "quote":
      push(`“${s.text ?? ""}”`); push(s.author);
      break;
    case "rank":
      push(s.title);
      (s.items ?? []).forEach((it: any) => push(`${it?.label ?? ""}: ${it?.value ?? ""}${it?.unit ?? ""}`));
      break;
    case "chart":
      push(s.title); push((s.points ?? []).map((p: any) => `${p?.label}:${p?.value}`).join("  "));
      break;
    case "media":
      push(s.title); push(s.caption); push(s.credit);
      break;
    case "bigword":
      push((s.phrases ?? []).map((p: any) => p?.text).filter(Boolean).join("  •  "));
      break;
    case "annotate":
      push(s.kicker); push(s.headline); push(s.note);
      break;
    case "terminal":
      push(s.title); (s.lines ?? []).forEach((l: any) => push(l?.text));
      break;
    case "screenshot":
      push(s.kicker); push(s.headline);
      (s.markers ?? []).forEach((m: any) => push(m?.label));
      break;
    case "outro":
      push(s.headline); push(s.cta); push(s.handle);
      break;
    default:
      break;
  }
  return parts.join("\n");
};

export const getProjectDetail = async (userId: number, projectId: number) => {
  const project = await getProjectOwned(userId, projectId);
  const [sources] = await pool.query<RowDataPacket[]>(
    `SELECT id, file_name, mime, size_bytes, status, extract_method, error_message, created_at
       FROM project_sources WHERE project_id = ? ORDER BY id`,
    [projectId]
  );
  const [scriptRows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id, s.variant_index, s.title, s.angle, s.slug, s.preset,
            s.narration_md, s.plan_json, s.status, s.created_at,
            j.id AS job_id, j.status AS job_status, j.progress AS job_progress,
            j.error_message AS job_error
       FROM scripts s
       LEFT JOIN render_jobs j
         ON j.script_id = s.id
        AND j.id = (SELECT MAX(id) FROM render_jobs WHERE script_id = s.id)
      WHERE s.project_id = ?
      ORDER BY s.variant_index`,
    [projectId]
  );
  // Bóc scenes (id/type/narration) để client sửa lời thoại trước duyệt; KHÔNG
  // trả nguyên plan_json (nặng + lộ chi tiết dựng không cần cho màn duyệt).
  const scripts = scriptRows.map((r) => {
    const { plan_json, ...rest } = r;
    let scenes: Array<{ id: string; type: string; narration: string; display: string }> = [];
    try {
      const plan = JSON.parse(String(plan_json));
      scenes = (plan.scenes ?? []).map((s: any) => ({
        id: s.id,
        type: s.type,
        narration: s.narration,
        // chữ hiển thị trên hình (để đối chiếu với lời đọc voice-off)
        display: sceneDisplayText(s),
      }));
    } catch {
      // plan hỏng không chặn hiển thị — chỉ mất khả năng sửa scene
    }
    return { ...rest, scenes };
  });
  return { project, sources, scripts };
};

/** Lưu file tư liệu upload rồi trích xuất nội dung ở nền (Gemini/local) */
export const addSource = async (
  userId: number,
  projectId: number,
  file: { originalname: string; path: string; mimetype: string; size: number }
): Promise<number> => {
  await getProjectOwned(userId, projectId);
  const dir = path.join(storagePaths.privateSources, String(projectId));
  fs.mkdirSync(dir, { recursive: true });
  // Tên lưu trữ do server sinh — không dùng tên client tránh path traversal
  const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
  const storedPath = path.join(dir, `src-${Date.now()}${ext}`);
  fs.renameSync(file.path, storedPath);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO project_sources (project_id, file_name, stored_path, mime, size_bytes, status)
     VALUES (?, ?, ?, ?, ?, 'extracting')`,
    [projectId, file.originalname.slice(0, 255), storedPath, file.mimetype, file.size]
  );
  const sourceId = result.insertId;

  // Trích xuất ở nền — client poll trạng thái qua GET project detail
  void ingestFile(storedPath)
    .then(async (r) => {
      await pool.query(
        `UPDATE project_sources SET status = 'ready', extracted_text = ?, extract_method = ? WHERE id = ?`,
        [r.text.slice(0, 200_000), r.method, sourceId]
      );
    })
    .catch(async (err) => {
      await pool.query(
        `UPDATE project_sources SET status = 'failed', error_message = ? WHERE id = ?`,
        [String((err as Error).message).slice(0, 1000), sourceId]
      );
    });
  return sourceId;
};

/**
 * Thêm tư liệu từ LINK: lưu 1 dòng project_sources (stored_path = URL), trích xuất
 * ở nền qua ingestUrl (đã chặn SSRF). Không tin URL client — ingestUrl tự kiểm.
 */
export const addLinkSource = async (
  userId: number,
  projectId: number,
  url: string
): Promise<number> => {
  await getProjectOwned(userId, projectId);
  const trimmed = url.trim().slice(0, 500);
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO project_sources (project_id, file_name, stored_path, mime, size_bytes, status)
     VALUES (?, ?, ?, 'text/link', 0, 'extracting')`,
    [projectId, `🔗 ${trimmed}`.slice(0, 255), trimmed]
  );
  const sourceId = result.insertId;
  void ingestUrl(trimmed)
    .then(async (r) => {
      await pool.query(
        `UPDATE project_sources SET status = 'ready', extracted_text = ?, extract_method = ? WHERE id = ?`,
        [r.text.slice(0, 200_000), r.method, sourceId]
      );
    })
    .catch(async (err) => {
      await pool.query(
        `UPDATE project_sources SET status = 'failed', error_message = ? WHERE id = ?`,
        [String((err as Error).message).slice(0, 1000), sourceId]
      );
    });
  return sourceId;
};

export const deleteSource = async (
  userId: number,
  projectId: number,
  sourceId: number
): Promise<void> => {
  await getProjectOwned(userId, projectId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT stored_path, mime FROM project_sources WHERE id = ? AND project_id = ? LIMIT 1`,
    [sourceId, projectId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy tư liệu.");
  await pool.query(`DELETE FROM project_sources WHERE id = ?`, [sourceId]);
  // Link (mime text/link) không có file trên đĩa — stored_path là URL, đừng rm
  if (rows[0].mime !== "text/link") fs.rmSync(String(rows[0].stored_path), { force: true });
};

const voiceProfileOf = (project: RowDataPacket): VoiceProfile => ({
  gender: project.voice_gender,
  region: project.voice_region,
  style: project.voice_style,
  speed: Number(project.voice_speed) === 1.2 ? 1.2 : 1,
});

export { voiceProfileOf };

/**
 * Sinh kịch bản: gom text tư liệu đã ready → gọi Gemini → lưu bảng scripts
 * chờ duyệt. Chạy nền, cập nhật projects.status để client poll.
 */
export const generateScripts = async (
  userId: number,
  projectId: number
): Promise<void> => {
  const project = await getProjectOwned(userId, projectId);
  if (project.status === "generating") {
    throw badRequest("Project đang sinh kịch bản, vui lòng đợi.");
  }
  const [pending] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM project_sources WHERE project_id = ? AND status = 'extracting'`,
    [projectId]
  );
  if (Number(pending[0].n) > 0) {
    throw badRequest("Tư liệu đang được trích xuất — đợi xong rồi sinh kịch bản.");
  }

  await pool.query(
    `UPDATE projects SET status = 'generating', error_message = NULL WHERE id = ?`,
    [projectId]
  );

  void (async () => {
    try {
      const [sources] = await pool.query<RowDataPacket[]>(
        `SELECT file_name, extracted_text FROM project_sources
          WHERE project_id = ? AND status = 'ready' AND extracted_text IS NOT NULL`,
        [projectId]
      );
      const sourcesText = sources
        .map((s) => `--- Nguồn: ${s.file_name} ---\n${s.extracted_text}`)
        .join("\n\n");

      // Template-from-video: profile ép style, workflow quyết định gate duyệt
      const tpl = project.template_id
        ? await getReadyProfile(userId, Number(project.template_id))
        : null;

      // Serie manager: cấp ngữ cảnh tập trước + số tập bắt đầu
      const series = project.series_id
        ? await buildSeriesContext(userId, Number(project.series_id))
        : undefined;

      // Pipeline hiệu lực: bản creator sửa trong template (ưu tiên) → gợi ý AI học
      const effectivePipeline = tpl
        ? tpl.workflow.scriptPipeline.length
          ? tpl.workflow.scriptPipeline
          : tpl.profile.scriptPipeline
        : undefined;

      const plans = await generatePlans({
        idea: String(project.idea),
        mode: project.mode,
        count: Number(project.variant_count),
        sourcesText: sourcesText || undefined,
        presetHint: project.preset_hint ?? undefined,
        durationSec: project.duration_sec ? Number(project.duration_sec) : undefined,
        styleProfile: tpl?.profile,
        scriptPipeline: effectivePipeline,
        // Nguồn 'ai'/'combine' → bật google_search grounding để AI tự tìm tư liệu web
        webSearch:
          project.source_mode === "ai" || project.source_mode === "combine",
        series,
      });

      // Sinh lại = thay thế bộ kịch bản cũ chưa duyệt (job đã render giữ nguyên qua script cũ bị xoá? Không — xoá cascade).
      // Chọn an toàn: chỉ xoá script chưa có render job 'done'.
      await pool.query(
        `DELETE s FROM scripts s
          LEFT JOIN render_jobs j ON j.script_id = s.id AND j.status = 'done'
         WHERE s.project_id = ? AND j.id IS NULL`,
        [projectId]
      );
      const scriptIds: number[] = [];
      for (let i = 0; i < plans.length; i++) {
        const plan = plans[i];
        // #7 preset mismatch: khi áp template, ÉP preset theo profile của template
        // (model hay tự chọn midnight). Ghi đè cả plan_json để render đọc đúng.
        if (tpl?.profile) plan.preset = tpl.profile.preset;
        const [ins] = await pool.query<ResultSetHeader>(
          `INSERT INTO scripts (project_id, variant_index, title, angle, slug, preset, plan_json, narration_md)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            i,
            plan.title,
            plan.angle,
            `${plan.slug}-p${projectId}v${i}`,
            plan.preset,
            JSON.stringify(plan),
            planToNarrationMd(plan),
          ]
        );
        scriptIds.push(ins.insertId);
      }
      await pool.query(`UPDATE projects SET status = 'ready' WHERE id = ?`, [projectId]);

      // Workflow template tắt gate duyệt → tự approve + render toàn bộ kịch bản
      if (tpl && tpl.workflow.approveGate === false) {
        for (const scriptId of scriptIds) {
          await pool.query(`UPDATE scripts SET status = 'approved' WHERE id = ?`, [scriptId]);
          await enqueueRender(scriptId);
        }
      }
    } catch (err) {
      await pool.query(
        `UPDATE projects SET status = 'failed', error_message = ? WHERE id = ?`,
        [String((err as Error).message).slice(0, 2000), projectId]
      );
    }
  })();
};

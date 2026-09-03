import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { appConfig, storagePaths } from "../config";
import { getEffectiveWatermark } from "./watermark.service";
import { getPresetForRender } from "./watermark-preset.service";
import { getProjectImageSources, voiceProfileOf } from "./project.service";
import {
  generateSpecImages,
  planToSpec,
  renderSpecFile,
  synthesizeSpecAudio,
} from "@ams/pipeline/src/api";
import { planSchema } from "@ams/pipeline/src/prompts";

/**
 * Hàng đợi render in-process. Chạy tối đa RENDER_CONCURRENCY luồng song song:
 * pha sinh ảnh + TTS là I/O (gọi Gemini) nên khi một job đang render ăn CPU,
 * job khác vẫn tranh thủ làm I/O — throughput tăng thật. Mỗi luồng claim job
 * riêng bằng FOR UPDATE SKIP LOCKED nên an toàn cả khi chạy NHIỀU tiến trình
 * (multi-pod): bundle-cache build nguyên tử (rename tmp→đích) + asset job theo
 * namespace riêng, hai tiến trình không giẫm nhau (misa-backend-standard 05).
 */

export const enqueueRender = async (scriptId: number): Promise<number> => {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO render_jobs (script_id) VALUES (?)`,
    [scriptId]
  );
  void kick();
  return result.insertId;
};

/** Số luồng đang chạy hiện tại (không vượt RENDER_CONCURRENCY) */
let activeLanes = 0;

/** Một luồng: rút job liên tục tới khi hết queued rồi tự kết thúc */
const runLane = async (): Promise<void> => {
  for (;;) {
    const jobId = await claimNextJob();
    if (!jobId) break;
    await processJob(jobId).catch(async (err) => {
      console.error(`[worker] Job ${jobId} lỗi:`, err);
      await pool.query(
        `UPDATE render_jobs SET status = 'failed', error_message = ?, finished_at = NOW() WHERE id = ?`,
        [String((err as Error).message).slice(0, 2000), jobId]
      );
    });
  }
};

/**
 * Đánh thức worker — mở thêm luồng cho tới khi đạt RENDER_CONCURRENCY. Mỗi
 * luồng tự rút cạn hàng đợi; luồng đóng lại khi không còn job (giảm activeLanes).
 */
export const kick = async (): Promise<void> => {
  while (activeLanes < appConfig.RENDER_CONCURRENCY) {
    activeLanes += 1;
    void runLane().finally(() => {
      activeLanes -= 1;
    });
  }
};

/** Nhặt job queued cũ nhất trong transaction có khoá dòng */
const claimNextJob = async (): Promise<number | null> => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM render_jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    if (!rows[0]) {
      await conn.rollback();
      return null;
    }
    const jobId = Number(rows[0].id);
    await conn.query(
      `UPDATE render_jobs SET status = 'images', started_at = NOW(), progress = 5 WHERE id = ?`,
      [jobId]
    );
    await conn.commit();
    return jobId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const setProgress = (jobId: number, progress: number) =>
  pool.query(`UPDATE render_jobs SET progress = ? WHERE id = ?`, [progress, jobId]);

const processJob = async (jobId: number): Promise<void> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT j.id, s.plan_json, s.slug, s.project_id, p.user_id, p.watermark_preset_id,
            p.voice_gender, p.voice_region, p.voice_style, p.voice_speed,
            t.profile_json AS template_profile,
            m.stored_path AS music_path
       FROM render_jobs j
       JOIN scripts s ON s.id = j.script_id
       JOIN projects p ON p.id = s.project_id
       LEFT JOIN templates t ON t.id = p.template_id
       LEFT JOIN music_tracks m ON m.id = p.music_track_id
      WHERE j.id = ? LIMIT 1`,
    [jobId]
  );
  const row = rows[0];
  if (!row) throw new Error(`Job ${jobId} không còn script/project tương ứng.`);

  const plan = planSchema.parse(JSON.parse(String(row.plan_json)));
  const { spec, narrations } = planToSpec(plan);
  spec.meta.slug = String(row.slug);

  // Nhạc nền từ thư viện (nếu creator chọn) — engine tự ducking dưới voiceover.
  // File còn tồn tại mới gán (đường dẫn tuyệt đối, render.ts sẽ stage như asset).
  if (row.music_path && fs.existsSync(String(row.music_path))) {
    spec.audio.music = String(row.music_path);
  }

  // Template-from-video: accent quan sát từ video mẫu override accent preset
  if (row.template_profile) {
    try {
      const accent = JSON.parse(String(row.template_profile))?.accent;
      if (typeof accent === "string" && /^#[0-9a-fA-F]{6}$/.test(accent)) {
        spec.style.accent = accent;
      }
    } catch {
      // profile hỏng không được phép chặn render — bỏ accent, giữ preset
    }
  }

  // Watermark: preset creator chọn cho video (thư viện) → ưu tiên; nếu không
  // chọn thì dùng watermark hiệu lực cũ (riêng creator hoặc mặc định hệ thống).
  const wm = row.watermark_preset_id
    ? await getPresetForRender(Number(row.user_id), Number(row.watermark_preset_id)).catch(
        () => getEffectiveWatermark(Number(row.user_id))
      )
    : await getEffectiveWatermark(Number(row.user_id));
  if (wm.kind === "text" && wm.text) {
    spec.style.watermark = {
      kind: "text", text: wm.text,
      x: wm.x, y: wm.y, opacity: wm.opacity, scale: wm.scale,
    };
  } else if (wm.kind === "image" && wm.imagePath && fs.existsSync(wm.imagePath)) {
    spec.style.watermark = {
      kind: "image", image: wm.imagePath,
      x: wm.x, y: wm.y, opacity: wm.opacity, scale: wm.scale,
    };
  }

  const jobDir = path.join(storagePaths.privateRenders, `job-${jobId}`);
  fs.mkdirSync(jobDir, { recursive: true });

  // Pha sinh ảnh minh họa (Gemini image) — 5→30%
  await pool.query(`UPDATE render_jobs SET status = 'images' WHERE id = ?`, [jobId]);
  // Ảnh thật người dùng đã tải lên (để giải các token 'userimg:N' trong plan)
  const userImages = await getProjectImageSources(Number(row.project_id));
  const imgWarnings = await generateSpecImages(
    plan,
    spec,
    jobDir,
    (done, total) => void setProgress(jobId, 5 + Math.round((done / Math.max(1, total)) * 25)),
    userImages
  );
  if (imgWarnings.length) {
    console.log(`[worker] Job ${jobId} ảnh nền bị bỏ: ${imgWarnings.join(" | ")}`);
  }

  await pool.query(`UPDATE render_jobs SET status = 'tts', progress = 30 WHERE id = ?`, [jobId]);
  const profile = voiceProfileOf(row);
  const warnings = await synthesizeSpecAudio(
    spec, narrations, jobDir, profile,
    (done, total) => void setProgress(jobId, 30 + Math.round((done / total) * 25))
  );
  if (warnings.length) console.log(`[worker] Job ${jobId} TTS cần review: ${warnings.join(" | ")}`);

  const specPath = path.join(jobDir, "spec.json");
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));

  await pool.query(
    `UPDATE render_jobs SET status = 'rendering', progress = 55 WHERE id = ?`,
    [jobId]
  );
  const outMp4 = path.join(jobDir, "video.mp4");
  // Render ra ĐĨA CỤC BỘ trước rồi copy nguyên file vào jobDir (có thể là GCS FUSE
  // trên Cloud Run): mux mp4 (ffmpeg) cần seek-back để ghi lại header/moov sau khi
  // ghi xong mdat — FUSE streaming-write chỉ chấp nhận ghi tuần tự, seek-back giữa
  // chừng làm gcsfuse lỗi "BufferedWriteHandler.OutOfOrderError" và rơi về đường
  // chậm. Ghi cục bộ (luôn hỗ trợ seek) rồi copy 1 lần tránh hẳn vấn đề này.
  const localTmpMp4 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ams-render-")), "video.mp4");
  await renderSpecFile(specPath, localTmpMp4);
  fs.copyFileSync(localTmpMp4, outMp4);
  fs.rmSync(path.dirname(localTmpMp4), { recursive: true, force: true });

  await pool.query(
    `UPDATE render_jobs SET status = 'done', progress = 100, output_path = ?, finished_at = NOW() WHERE id = ?`,
    [outMp4, jobId]
  );
};

/** Khởi động: job kẹt giữa chừng (server restart) → trả về queued */
export const recoverStaleJobs = async (): Promise<void> => {
  await pool.query(
    `UPDATE render_jobs SET status = 'queued', progress = 0 WHERE status IN ('images', 'tts', 'rendering')`
  );
};

let timer: ReturnType<typeof setInterval> | null = null;
export const startRenderWorker = (): void => {
  if (timer) return;
  timer = setInterval(() => void kick(), 15_000);
  void kick();
};
export const stopRenderWorker = (): void => {
  if (timer) clearInterval(timer);
  timer = null;
};

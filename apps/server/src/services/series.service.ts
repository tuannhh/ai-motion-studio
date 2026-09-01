import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { badRequest, notFound } from "../http-error";

/**
 * Serie manager (GĐ3): serie là chuỗi tập nối tiếp; khi sinh tập mới, AI được
 * cấp ngữ cảnh các tập trước (tiêu đề + góc nhìn + lời thoại tập gần nhất) để
 * móc nối nội dung. Mọi truy vấn kèm user_id (chống IDOR).
 */

export const listSeries = async (userId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT se.id, se.name, se.description, se.created_at,
            COUNT(DISTINCT p.id) AS project_count,
            COUNT(s.id) AS episode_count
       FROM series se
       LEFT JOIN projects p ON p.series_id = se.id
       LEFT JOIN scripts s ON s.project_id = p.id
      WHERE se.user_id = ?
      GROUP BY se.id
      ORDER BY se.id DESC
      LIMIT 100`,
    [userId]
  );
  return rows;
};

export const getSeriesOwned = async (userId: number, seriesId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM series WHERE id = ? AND user_id = ? LIMIT 1`,
    [seriesId, userId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy serie.");
  return rows[0];
};

/**
 * Chi tiết serie + danh sách tập (mỗi script chưa bị từ chối là 1 tập), kèm
 * trạng thái render tập gần nhất để trang quản lý serie hiển thị tiến độ.
 */
export const getSeriesDetail = async (userId: number, seriesId: number) => {
  const series = await getSeriesOwned(userId, seriesId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id AS script_id, s.title, s.angle, s.slug, s.status AS script_status,
            s.plan_json, s.created_at, p.id AS project_id, p.status AS project_status,
            j.id AS job_id, j.status AS job_status, j.progress AS job_progress, j.output_path
       FROM projects p
       JOIN scripts s ON s.project_id = p.id AND s.status <> 'rejected'
       LEFT JOIN render_jobs j
         ON j.script_id = s.id
        AND j.id = (SELECT MAX(id) FROM render_jobs WHERE script_id = s.id)
      WHERE p.series_id = ? AND p.user_id = ?
      ORDER BY s.id`,
    [seriesId, userId]
  );

  const episodes = rows
    .map((row) => {
      let episode = 0;
      try {
        episode = Number(JSON.parse(String(row.plan_json))?.series?.episode) || 0;
      } catch {
        episode = 0;
      }
      return {
        episode,
        scriptId: Number(row.script_id),
        projectId: Number(row.project_id),
        title: String(row.title),
        angle: String(row.angle),
        slug: String(row.slug),
        scriptStatus: String(row.script_status),
        jobId: row.job_id == null ? null : Number(row.job_id),
        jobStatus: row.job_status ? String(row.job_status) : null,
        jobProgress: row.job_progress == null ? null : Number(row.job_progress),
        hasVideo: row.job_status === "done" && !!row.output_path,
        createdAt: row.created_at,
      };
    })
    .map((ep, i) => ({ ...ep, episode: ep.episode || i + 1 }))
    .sort((a, b) => a.episode - b.episode);

  return { series, episodes };
};

export const updateSeries = async (
  userId: number,
  seriesId: number,
  patch: { name?: string; description?: string | null }
): Promise<void> => {
  await getSeriesOwned(userId, seriesId);
  const fields: string[] = [];
  const values: (string | null)[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.description !== undefined) {
    fields.push("description = ?");
    values.push(patch.description);
  }
  if (!fields.length) return;
  values.push(String(seriesId));
  await pool.query(`UPDATE series SET ${fields.join(", ")} WHERE id = ?`, values);
};

export const createSeries = async (
  userId: number,
  name: string,
  description?: string
): Promise<number> => {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO series (user_id, name, description) VALUES (?, ?, ?)`,
    [userId, name, description ?? null]
  );
  return result.insertId;
};

export const deleteSeries = async (
  userId: number,
  seriesId: number
): Promise<void> => {
  await getSeriesOwned(userId, seriesId);
  // projects.series_id ON DELETE SET NULL — tập đã sinh giữ nguyên
  await pool.query(`DELETE FROM series WHERE id = ?`, [seriesId]);
};

export type SeriesEpisodeContext = {
  name: string;
  /** tập kế tiếp bắt đầu từ số này */
  startEpisode: number;
  /** tóm tắt các tập trước (đưa vào <SERIES_CONTEXT>) — rỗng nếu là tập đầu */
  context: string;
};

/**
 * Gom ngữ cảnh tập trước của serie: mỗi tập 1 dòng "Tập N: title — angle",
 * kèm nguyên văn lời thoại của TẬP GẦN NHẤT để hook tập mới móc nối chính xác.
 * Chỉ tính script chưa bị từ chối (rejected coi như không tồn tại trong serie).
 */
export const buildSeriesContext = async (
  userId: number,
  seriesId: number
): Promise<SeriesEpisodeContext> => {
  const series = await getSeriesOwned(userId, seriesId);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.title, s.angle, s.plan_json, s.narration_md
       FROM scripts s
       JOIN projects p ON p.id = s.project_id AND p.user_id = ?
      WHERE p.series_id = ? AND s.status <> 'rejected'
      ORDER BY s.id`,
    [userId, seriesId]
  );

  type Ep = { episode: number; title: string; angle: string; narrationMd: string };
  const episodes: Ep[] = [];
  for (const row of rows) {
    let episode = 0;
    try {
      episode = Number(JSON.parse(String(row.plan_json))?.series?.episode) || 0;
    } catch {
      // plan_json hỏng → vẫn tính là 1 tập, số tập suy từ thứ tự
    }
    episodes.push({
      episode: episode || episodes.length + 1,
      title: String(row.title),
      angle: String(row.angle),
      narrationMd: String(row.narration_md),
    });
  }
  episodes.sort((a, b) => a.episode - b.episode);

  const startEpisode = episodes.length
    ? Math.max(...episodes.map((e) => e.episode)) + 1
    : 1;

  const lines = episodes.map((e) => `- Tập ${e.episode}: ${e.title} — ${e.angle}`);
  const last = episodes[episodes.length - 1];
  const context = episodes.length
    ? [
        `Serie "${series.name}" đã có ${episodes.length} tập:`,
        ...lines,
        "",
        `Lời thoại nguyên văn của tập gần nhất (Tập ${last.episode} — để tập mới móc nối, KHÔNG lặp lại nội dung):`,
        last.narrationMd.slice(0, 4000),
      ].join("\n")
    : "";

  return { name: String(series.name), startEpisode, context };
};

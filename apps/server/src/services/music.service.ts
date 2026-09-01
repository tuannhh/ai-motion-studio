import fs from "node:fs";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";

/**
 * Thư viện nhạc nền dùng chung (GĐ4): admin tải file nhạc license-free (tải thủ
 * công từ pixabay.com/music — Pixabay không mở API audio) vào kho; creator chọn
 * khi tạo video. Engine đã có ducking + volume nên chỉ cần gán spec.audio.music.
 * Kiểm magic bytes thật, không tin Content-Type client (misa-backend-standard 02).
 */

const MAX_MUSIC_BYTES = 20 * 1024 * 1024;

/** mp3 (ID3 hoặc frame-sync 0xFFEx), wav (RIFF/WAVE), m4a/aac (ftyp), ogg (OggS) */
const looksLikeAudio = (filePath: string, ext: string): boolean => {
  const fd = fs.openSync(filePath, "r");
  try {
    const head = Buffer.alloc(12);
    fs.readSync(fd, head, 0, 12, 0);
    const ascii4 = head.subarray(0, 4).toString("ascii");
    switch (ext) {
      case ".wav":
        return ascii4 === "RIFF" && head.subarray(8, 12).toString("ascii") === "WAVE";
      case ".ogg":
        return ascii4 === "OggS";
      case ".m4a":
      case ".aac":
        return head.subarray(4, 8).toString("ascii") === "ftyp";
      case ".mp3":
      default:
        // ID3v2 tag hoặc MPEG frame sync (0xFF 0xEx/0xFx)
        return (
          head.subarray(0, 3).toString("ascii") === "ID3" ||
          (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
        );
    }
  } finally {
    fs.closeSync(fd);
  }
};

export const listMusic = async () => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, credit, mime, size_bytes, created_at
       FROM music_tracks ORDER BY id DESC LIMIT 200`
  );
  return rows;
};

export const getMusicTrack = async (trackId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM music_tracks WHERE id = ? LIMIT 1`,
    [trackId]
  );
  if (!rows[0]) throw notFound("Không tìm thấy bản nhạc.");
  return rows[0];
};

export const createMusic = async (
  userId: number,
  name: string,
  credit: string | undefined,
  file: { originalname: string; path: string; size: number; mimetype: string }
): Promise<number> => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!/\.(mp3|wav|m4a|aac|ogg)$/.test(ext)) {
    fs.rmSync(file.path, { force: true });
    throw badRequest("Định dạng nhạc chưa hỗ trợ — dùng mp3, wav, m4a, aac hoặc ogg.");
  }
  if (file.size > MAX_MUSIC_BYTES) {
    fs.rmSync(file.path, { force: true });
    throw badRequest("File nhạc nặng quá 20MB.");
  }
  if (!looksLikeAudio(file.path, ext)) {
    fs.rmSync(file.path, { force: true });
    throw badRequest("File không phải audio hợp lệ (kiểm tra nội dung file).");
  }

  fs.mkdirSync(storagePaths.privateMusic, { recursive: true });
  const storedPath = path.join(storagePaths.privateMusic, `track-${Date.now()}${ext}`);
  fs.renameSync(file.path, storedPath);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO music_tracks (name, stored_path, mime, size_bytes, credit, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name.slice(0, 80), storedPath, file.mimetype.slice(0, 60), file.size, credit?.slice(0, 120) ?? null, userId]
  );
  return result.insertId;
};

export const deleteMusic = async (trackId: number): Promise<void> => {
  const track = await getMusicTrack(trackId);
  await pool.query(`DELETE FROM music_tracks WHERE id = ?`, [trackId]);
  fs.rmSync(String(track.stored_path), { force: true });
};

/** Kiểm tra track tồn tại (dùng khi tạo project) — trả path hoặc ném notFound */
export const assertMusicExists = async (trackId: number): Promise<void> => {
  await getMusicTrack(trackId);
};

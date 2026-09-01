import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db";
import { appConfig } from "../config";
import { badGateway, badRequest, notFound } from "../http-error";
import { decryptSecret, encryptSecret } from "../lib/crypto";

/**
 * Tích hợp Google Drive (GĐ4): creator kết nối Drive bằng OAuth (scope
 * drive.file — chỉ đụng file do app tạo), rồi export video render lên Drive
 * của họ. KHÔNG dùng googleapis SDK — gọi REST bằng fetch (đồng bộ ethos
 * pipeline Gemini). Token refresh/access MÃ HOÁ trước khi lưu DB.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,size";
const SCOPE = "https://www.googleapis.com/auth/drive.file openid email";

const ensureEnabled = () => {
  if (!appConfig.gdriveEnabled) {
    throw badRequest("Google Drive chưa được cấu hình trên máy chủ.");
  }
};

/** Tạo state 1 lần + URL đồng ý của Google (access_type=offline để có refresh token). */
export const buildAuthUrl = async (userId: number): Promise<string> => {
  ensureEnabled();
  const state = crypto.randomBytes(32).toString("hex");
  await pool.query(
    `INSERT INTO oauth_states (state, user_id, provider) VALUES (?, ?, 'gdrive')`,
    [state, userId]
  );
  const params = new URLSearchParams({
    client_id: appConfig.GOOGLE_CLIENT_ID,
    redirect_uri: appConfig.GOOGLE_OAUTH_REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    // luôn hỏi consent để chắc chắn nhận refresh_token (Google chỉ trả lần đầu)
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

const postForm = async (
  url: string,
  form: Record<string, string>
): Promise<TokenResponse> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw badGateway(`Google token lỗi (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
};

/** Đổi authorization code → token, lấy email, lưu (mã hoá). Verify state trước. */
export const handleCallback = async (
  userId: number,
  code: string,
  state: string
): Promise<void> => {
  ensureEnabled();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id FROM oauth_states
      WHERE state = ? AND provider = 'gdrive' AND created_at > (NOW() - INTERVAL 15 MINUTE)`,
    [state]
  );
  await pool.query(`DELETE FROM oauth_states WHERE state = ?`, [state]);
  if (!rows.length || Number(rows[0].user_id) !== userId) {
    throw badRequest("State OAuth không hợp lệ hoặc đã hết hạn.");
  }

  const token = await postForm(TOKEN_URL, {
    code,
    client_id: appConfig.GOOGLE_CLIENT_ID,
    client_secret: appConfig.GOOGLE_CLIENT_SECRET,
    redirect_uri: appConfig.GOOGLE_OAUTH_REDIRECT,
    grant_type: "authorization_code",
  });
  if (!token.refresh_token) {
    throw badGateway(
      "Google không trả refresh_token — thử ngắt kết nối tại myaccount.google.com rồi kết nối lại."
    );
  }

  let email: string | null = null;
  try {
    const ui = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (ui.ok) email = ((await ui.json()) as { email?: string }).email ?? null;
  } catch {
    /* email chỉ để hiển thị — bỏ qua nếu lỗi */
  }

  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  await pool.query(
    `INSERT INTO gdrive_accounts
       (user_id, email, refresh_token_enc, access_token_enc, access_expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       refresh_token_enc = VALUES(refresh_token_enc),
       access_token_enc = VALUES(access_token_enc),
       access_expires_at = VALUES(access_expires_at)`,
    [
      userId,
      email,
      encryptSecret(token.refresh_token),
      encryptSecret(token.access_token),
      expiresAt,
    ]
  );
};

export const getStatus = async (userId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT email, connected_at FROM gdrive_accounts WHERE user_id = ?`,
    [userId]
  );
  if (!rows.length) return { connected: false as const };
  return {
    connected: true as const,
    email: rows[0].email as string | null,
    connectedAt: rows[0].connected_at,
    enabled: appConfig.gdriveEnabled,
  };
};

export const disconnect = async (userId: number): Promise<void> => {
  await pool.query(`DELETE FROM gdrive_accounts WHERE user_id = ?`, [userId]);
};

/** Trả access token còn hạn — tự refresh bằng refresh_token nếu sắp hết. */
const getValidAccessToken = async (userId: number): Promise<string> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT refresh_token_enc, access_token_enc, access_expires_at
       FROM gdrive_accounts WHERE user_id = ?`,
    [userId]
  );
  if (!rows.length) throw badRequest("Chưa kết nối Google Drive.");
  const row = rows[0];
  const notExpired =
    row.access_token_enc &&
    row.access_expires_at &&
    new Date(row.access_expires_at).getTime() > Date.now() + 60_000;
  if (notExpired) return decryptSecret(String(row.access_token_enc));

  const refreshToken = decryptSecret(String(row.refresh_token_enc));
  const token = await postForm(TOKEN_URL, {
    client_id: appConfig.GOOGLE_CLIENT_ID,
    client_secret: appConfig.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  await pool.query(
    `UPDATE gdrive_accounts
        SET access_token_enc = ?, access_expires_at = ? WHERE user_id = ?`,
    [encryptSecret(token.access_token), expiresAt, userId]
  );
  return token.access_token;
};

type DriveFile = { id: string; webViewLink?: string; size?: string };

/** Upload 1 file lên Drive qua resumable upload (init lấy Location → PUT bytes). */
const uploadFile = async (
  accessToken: string,
  filePath: string,
  displayName: string
): Promise<DriveFile> => {
  const stat = fs.statSync(filePath);
  const metadata = { name: displayName, mimeType: "video/mp4" };
  const init = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(stat.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) {
    const detail = await init.text().catch(() => "");
    throw badGateway(`Khởi tạo upload Drive lỗi (${init.status}): ${detail.slice(0, 200)}`);
  }
  const location = init.headers.get("location");
  if (!location) throw badGateway("Google không trả URL upload.");

  // Video ngắn (dọc <90s, vài chục MB) — đọc buffer 1 lần đủ an toàn.
  const bytes = fs.readFileSync(filePath);
  const put = await fetch(location, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
    },
    body: bytes,
  });
  if (!put.ok) {
    const detail = await put.text().catch(() => "");
    throw badGateway(`Upload Drive thất bại (${put.status}): ${detail.slice(0, 200)}`);
  }
  return (await put.json()) as DriveFile;
};

/**
 * Export video của 1 job lên Drive của user. Kiểm chủ sở hữu job + file tồn
 * tại (chống IDOR) trước khi upload. Lưu drive_exports (upsert theo job).
 */
export const exportJobToDrive = async (
  userId: number,
  job: { id: number; status: string; output_path: string | null; title?: string | null; slug?: string | null }
) => {
  ensureEnabled();
  if (job.status !== "done" || !job.output_path || !fs.existsSync(job.output_path)) {
    throw notFound("Video chưa render xong hoặc file không còn.");
  }
  const accessToken = await getValidAccessToken(userId);
  const base = (job.slug || job.title || `video-${job.id}`)
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .slice(0, 80);
  const name = `${base || "video"}-${job.id}${path.extname(job.output_path) || ".mp4"}`;

  const file = await uploadFile(accessToken, job.output_path, name);
  await pool.query<ResultSetHeader>(
    `INSERT INTO drive_exports (job_id, user_id, file_id, web_link, size_bytes)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       file_id = VALUES(file_id), web_link = VALUES(web_link),
       size_bytes = VALUES(size_bytes), exported_at = CURRENT_TIMESTAMP`,
    [job.id, userId, file.id, file.webViewLink ?? null, file.size ? Number(file.size) : null]
  );
  return {
    fileId: file.id,
    webLink: file.webViewLink ?? null,
    name,
  };
};

/** Bản export Drive đã có của 1 job (để UI hiện link thay vì upload lại). */
export const getJobExport = async (userId: number, jobId: number) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT file_id, web_link, exported_at FROM drive_exports
      WHERE job_id = ? AND user_id = ?`,
    [jobId, userId]
  );
  if (!rows.length) return null;
  return {
    fileId: rows[0].file_id as string,
    webLink: rows[0].web_link as string | null,
    exportedAt: rows[0].exported_at,
  };
};

import fs from "node:fs";
import path from "node:path";
import { assertPublicHost } from "./ingest";

/**
 * Nguồn ảnh THẬT từ internet dùng Openverse (openverse.org) — chỉ ảnh có giấy
 * phép Creative Commons/Public Domain, lọc `commercial,modification` để dùng
 * thương mại + biên tập được. Trả kèm attribution (bắt buộc với CC-BY/BY-SA) để
 * scene hiện dòng credit. Tải ảnh về jobDir (không nhúng URL ngoài vào video) và
 * chặn SSRF như ingestUrl. KHÔNG dùng ảnh có thể vi phạm chính sách nội dung —
 * caller nên cho ảnh qua cổng an toàn (reviewImageSafety) trước khi chấp nhận.
 */

const OPENVERSE_URL = "https://api.openverse.org/v1/images/";
const MAX_IMG_BYTES = 8 * 1024 * 1024;
const IMG_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type WebImage = {
  file: string;
  mimeType: string;
  /** dòng credit hiển thị (tựa · tác giả · giấy phép · Openverse) */
  credit: string;
  sourceUrl: string;
  license: string;
};

type OpenverseResult = {
  title?: string;
  url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  foreign_landing_url?: string;
};

/** Tải 1 URL ảnh công khai, chặn IP nội bộ + theo redirect có kiểm tra + giới hạn cỡ */
const downloadImageGuarded = async (
  rawUrl: string
): Promise<{ buf: Buffer; mime: string }> => {
  let current = new URL(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new Error("Ảnh không phải http/https.");
    }
    await assertPublicHost(current.hostname);
    const r = await fetch(current.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "AI-Motion-Studio/1.0 (+web-image)", Accept: "image/*" },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      current = new URL(r.headers.get("location")!, current);
      continue;
    }
    if (!r.ok) throw new Error(`Tải ảnh lỗi HTTP ${r.status}.`);
    const mime = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!IMG_EXT[mime]) throw new Error(`Content-type không phải ảnh hỗ trợ: ${mime}.`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_IMG_BYTES) throw new Error("Ảnh quá lớn (>8MB).");
    if (buf.length < 2048) throw new Error("Ảnh quá nhỏ/nghi hỏng.");
    return { buf, mime };
  }
  throw new Error("Ảnh chuyển hướng quá nhiều lần.");
};

const buildCredit = (r: OpenverseResult): string => {
  const lic = `${(r.license ?? "").toUpperCase()}${r.license_version ? " " + r.license_version : ""}`.trim();
  return [r.title?.trim() || "Ảnh", r.creator?.trim(), lic || "CC", "Openverse"]
    .filter(Boolean)
    .join(" · ");
};

/**
 * Tìm ảnh CC theo truy vấn (tiếng Anh cho kết quả tốt), thử lần lượt các kết quả
 * cho tới khi tải được 1 ảnh hợp lệ. accept(buf,mime) là cổng kiểm duyệt tuỳ chọn
 * (trả false → bỏ ảnh, thử ảnh kế) để lọc nội dung cấm. Lưu vào outPathNoExt.
 */
export const searchWebImage = async (
  query: string,
  outPathNoExt: string,
  accept?: (buf: Buffer, mime: string) => Promise<boolean>
): Promise<WebImage> => {
  const params = new URLSearchParams({
    q: query,
    page_size: "12",
    license_type: "commercial,modification",
    mature: "false",
  });
  const res = await fetch(`${OPENVERSE_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "AI-Motion-Studio/1.0 (+web-image)" },
  });
  if (!res.ok) throw new Error(`Openverse HTTP ${res.status}.`);
  const data: any = await res.json();
  const results: OpenverseResult[] = Array.isArray(data?.results) ? data.results : [];
  let lastErr = "không có kết quả";
  for (const r of results) {
    if (!r.url) continue;
    try {
      const { buf, mime } = await downloadImageGuarded(r.url);
      if (accept && !(await accept(buf, mime))) {
        lastErr = "ảnh không qua cổng an toàn nội dung";
        continue;
      }
      const file = `${outPathNoExt}${IMG_EXT[mime]}`;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      return { file, mimeType: mime, credit: buildCredit(r), sourceUrl: r.foreign_landing_url ?? r.url, license: r.license ?? "" };
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  throw new Error(`Không tìm được ảnh internet phù hợp cho "${query}": ${lastErr}.`);
};

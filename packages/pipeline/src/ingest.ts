import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns/promises";
import { isIP } from "node:net";
import { config } from "./env";

/**
 * Nạp tư liệu người dùng: txt/md đọc thẳng; docx bóc text local;
 * pdf/audio/video gửi Gemini multimodal (inline base64) để OCR/transcribe/tóm tắt.
 * Kết quả là text đưa vào <SOURCES_DATA> của prompt sinh kịch bản.
 */

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

/** Ảnh THẬT do người dùng tải lên (Drive/máy) — làm tư liệu hình ảnh cho scene */
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Giới hạn inline của Gemini API (~20MB cả request) */
const MAX_INLINE_BYTES = 18 * 1024 * 1024;

const EXTRACT_PROMPT = `Bạn là trợ lý nghiên cứu. Trích xuất TOÀN BỘ thông tin hữu ích từ tài liệu đính kèm để làm tư liệu viết kịch bản video:
1. Tóm tắt nội dung chính (10-20 câu).
2. Mọi số liệu, mốc thời gian, tên riêng, trích dẫn đáng chú ý (ghi nguyên văn).
3. Nếu là audio/video: transcript tóm lược theo ý, kèm các câu nói đắt giá nguyên văn.
4. Nếu tài liệu có chữ trong ảnh/scan: OCR đầy đủ phần chữ đó.
Trả về text thuần tiếng Việt, có đề mục rõ ràng. KHÔNG bịa thông tin không có trong tài liệu.`;

const geminiExtract = async (filePath: string, mimeType: string): Promise<string> => {
  const { geminiApiKey, contentModel } = config();
  if (!geminiApiKey) throw new Error("Thiếu GEMINI_API_KEY.");
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > MAX_INLINE_BYTES) {
    throw new Error(
      `File ${path.basename(filePath)} nặng ${(bytes.length / 1e6).toFixed(1)}MB > 18MB — hãy nén/cắt ngắn trước khi nạp.`
    );
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${contentModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACT_PROMPT },
              { inlineData: { mimeType, data: bytes.toString("base64") } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini extract HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text ?? "")
    .join("");
  if (!text) throw new Error(`Gemini không trích xuất được ${path.basename(filePath)}.`);
  return text;
};

const IMAGE_CAPTION_PROMPT = `Bạn là biên tập ảnh cho video. Mô tả ẢNH đính kèm để dùng làm tư liệu hình ảnh minh hoạ:
1. DÒNG ĐẦU TIÊN: một chú thích ngắn gọn (tối đa 120 ký tự) nêu chủ thể chính của ảnh.
2. Các dòng sau: mô tả chi tiết bối cảnh, màu sắc, bố cục; nếu ảnh có CHỮ thì OCR nguyên văn phần chữ.
Trả về text thuần tiếng Việt. KHÔNG bịa chi tiết không có trong ảnh.`;

/** Sinh chú thích + mô tả cho 1 ảnh (dòng đầu là caption ngắn để hiển thị) */
const geminiCaptionImage = async (filePath: string, mimeType: string): Promise<string> => {
  const { geminiApiKey, contentModel } = config();
  if (!geminiApiKey) throw new Error("Thiếu GEMINI_API_KEY.");
  const bytes = fs.readFileSync(filePath);
  if (bytes.length > MAX_INLINE_BYTES) {
    throw new Error(
      `Ảnh ${path.basename(filePath)} nặng ${(bytes.length / 1e6).toFixed(1)}MB > 18MB — hãy nén nhỏ hơn.`
    );
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${contentModel}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: IMAGE_CAPTION_PROMPT },
              { inlineData: { mimeType, data: bytes.toString("base64") } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini caption ảnh HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("");
  if (!text?.trim()) throw new Error(`Gemini không mô tả được ảnh ${path.basename(filePath)}.`);
  return text.trim();
};

/** Bóc text .docx không cần dependency: unzip word/document.xml rồi strip tag */
const extractDocx = (filePath: string): string => {
  const r = spawnSync("unzip", ["-p", filePath, "word/document.xml"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(`Không đọc được ${path.basename(filePath)} (docx hỏng?).`);
  }
  return r.stdout
    .toString("utf8")
    .replace(/<w:p[ >]/g, "\n<w:p ")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export type IngestedSource = { name: string; text: string; method: string };

export const ingestFile = async (filePath: string): Promise<IngestedSource> => {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`Không tìm thấy file: ${abs}`);
  const ext = path.extname(abs).toLocaleLowerCase();
  const name = path.basename(abs);

  if (ext === ".txt" || ext === ".md") {
    return { name, text: fs.readFileSync(abs, "utf8"), method: "text" };
  }
  if (ext === ".docx") {
    return { name, text: extractDocx(abs), method: "docx-local" };
  }
  if (ext === ".doc") {
    throw new Error(`${name}: định dạng .doc cũ chưa hỗ trợ — hãy lưu lại thành .docx hoặc .pdf.`);
  }
  const imageMime = IMAGE_MIME_BY_EXT[ext];
  if (imageMime) {
    // Ảnh THẬT người dùng tải lên: giữ nguyên file trên đĩa (dùng làm asset khi
    // render), extracted_text = chú thích để AI biết nội dung ảnh khi viết kịch bản.
    return { name, text: await geminiCaptionImage(abs, imageMime), method: `image:${imageMime}` };
  }
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw new Error(`${name}: chưa hỗ trợ định dạng ${ext} (hỗ trợ: txt, md, docx, pdf, mp3, wav, m4a, mp4, mov, webm).`);
  }
  return { name, text: await geminiExtract(abs, mime), method: `gemini:${mime}` };
};

// ===== Trích ẢNH NHÚNG trong tài liệu (docx/pdf) =====

const EMBEDDED_IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
/** Bỏ icon/logo/mặt nạ nhỏ (thường < 12KB) để không làm nhiễu danh mục ảnh */
const MIN_EMBEDDED_BYTES = 12 * 1024;
/** Trần số ảnh trích 1 tài liệu (tránh ngập danh mục với tài liệu nhiều ảnh) */
const MAX_EMBEDDED_IMAGES = 8;

/**
 * Trích ẢNH NHÚNG có sẵn trong tài liệu người dùng tải lên (bản quyền do người
 * dùng đảm bảo) để dùng làm tư liệu hình ảnh:
 * - docx: giải nén word/media/* (thuần `unzip`, không cần lib).
 * - pdf: `pdfimages -png` (poppler-utils) — nếu máy KHÔNG có tool thì bỏ qua êm.
 * Lọc bỏ ảnh quá nhỏ (icon/mask), chỉ nhận jpg/png/webp, giới hạn số lượng, và
 * COPY sang destDir với tên do server đặt. Trả danh sách file thật + mime; caller
 * sẽ tạo source ảnh cho từng file (đi tiếp qua caption + cổng an toàn như ảnh upload).
 */
export const extractEmbeddedImages = async (
  filePath: string,
  destDir: string,
  baseName: string
): Promise<{ file: string; mime: string }[]> => {
  const abs = path.resolve(filePath);
  const ext = path.extname(abs).toLowerCase();
  if (ext !== ".docx" && ext !== ".pdf") return [];
  if (!fs.existsSync(abs)) return [];

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ams-imgx-"));
  try {
    if (ext === ".docx") {
      // -j junk paths, -qq im lặng, -o ghi đè; glob khớp trong zip (unzip tự expand)
      spawnSync("unzip", ["-o", "-j", "-qq", abs, "word/media/*", "-d", tmp], {
        maxBuffer: 128 * 1024 * 1024,
      });
    } else {
      // pdf cần poppler-utils; vắng tool (probe lỗi) → trả rỗng, không chặn
      const probe = spawnSync("pdfimages", ["-v"]);
      if (probe.error) return [];
      spawnSync("pdfimages", ["-png", abs, path.join(tmp, "img")], {
        maxBuffer: 8 * 1024 * 1024,
      });
    }

    const picked = fs
      .readdirSync(tmp)
      .map((f) => path.join(tmp, f))
      .filter((f) => EMBEDDED_IMG_EXT.has(path.extname(f).toLowerCase()))
      .filter((f) => {
        try {
          return fs.statSync(f).size >= MIN_EMBEDDED_BYTES;
        } catch {
          return false;
        }
      })
      .sort()
      .slice(0, MAX_EMBEDDED_IMAGES);

    fs.mkdirSync(destDir, { recursive: true });
    const out: { file: string; mime: string }[] = [];
    picked.forEach((src, i) => {
      const e = path.extname(src).toLowerCase();
      const mime = e === ".png" ? "image/png" : e === ".webp" ? "image/webp" : "image/jpeg";
      const dest = path.join(destDir, `${baseName}-img${i + 1}${e === ".jpeg" ? ".jpg" : e}`);
      fs.copyFileSync(src, dest);
      out.push({ file: dest, mime });
    });
    return out;
  } catch {
    return [];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

// ===== Render TỪNG TRANG pdf thành ảnh (để AI cắt vùng minh hoạ — khác ảnh nhúng) =====

/** Trần số trang render (tài liệu dài không ngập danh mục + tránh render vô hạn) */
const MAX_PDF_PAGES_TO_RENDER = 12;
/** DPI đủ nét để cắt (crop) chi tiết 1 vùng nhỏ của trang mà không vỡ hình */
const PDF_PAGE_RENDER_DPI = 144;

/**
 * Render mỗi trang pdf thành 1 ảnh PNG TOÀN TRANG (khác `extractEmbeddedImages`
 * chỉ lấy ảnh/hình đã NHÚNG sẵn) — dùng khi AI cần "chụp" 1 vùng bất kỳ của trang
 * (đoạn văn, bảng, biểu đồ vẽ bằng vector không phải ảnh nhúng...) làm minh hoạ,
 * qua cú pháp cắt vùng ở generateSpecImages (userimg:N:crop:x0,y0,x1,y1).
 * Cần `pdftoppm` (poppler-utils) — vắng tool thì bỏ qua êm như extractEmbeddedImages.
 */
export const renderPdfPages = async (
  filePath: string,
  destDir: string,
  baseName: string
): Promise<{ file: string; page: number }[]> => {
  const abs = path.resolve(filePath);
  if (path.extname(abs).toLowerCase() !== ".pdf") return [];
  if (!fs.existsSync(abs)) return [];

  const probe = spawnSync("pdftoppm", ["-v"]);
  if (probe.error) return [];

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ams-pdfpage-"));
  try {
    spawnSync(
      "pdftoppm",
      ["-png", "-r", String(PDF_PAGE_RENDER_DPI), "-l", String(MAX_PDF_PAGES_TO_RENDER), abs, path.join(tmp, "page")],
      { maxBuffer: 32 * 1024 * 1024 }
    );
    // pdftoppm tự đặt tên "page-<N>.png" (đệm số theo tổng số trang thật của file) —
    // đọc lại thư mục thay vì đoán tên để không phụ thuộc độ đệm.
    const picked = fs
      .readdirSync(tmp)
      .filter((f) => f.endsWith(".png"))
      .sort();

    fs.mkdirSync(destDir, { recursive: true });
    const out: { file: string; page: number }[] = [];
    picked.forEach((f, i) => {
      const dest = path.join(destDir, `${baseName}-page${i + 1}.png`);
      fs.copyFileSync(path.join(tmp, f), dest);
      out.push({ file: dest, page: i + 1 });
    });
    return out;
  } catch {
    return [];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

// ===== Nạp tư liệu từ LINK (có chặn SSRF) =====

/** IP nội bộ/riêng tư/loopback — cấm fetch để chống SSRF ra hạ tầng nội bộ */
const isPrivateIp = (ip: string): boolean => {
  if (isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    return (
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) || // link-local
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) // CGNAT
    );
  }
  const low = ip.toLowerCase();
  return (
    low === "::1" ||
    low === "::" ||
    low.startsWith("fc") || // ULA
    low.startsWith("fd") ||
    low.startsWith("fe80") || // link-local
    low.startsWith("::ffff:") // IPv4-mapped → để lớp trên xử lý riêng nếu cần
  );
};

/** Kiểm host của URL không trỏ tới IP nội bộ (resolve DNS trước khi fetch) */
export const assertPublicHost = async (hostname: string): Promise<void> => {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Link trỏ tới địa chỉ nội bộ — từ chối.");
    return;
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Link trỏ tới host nội bộ — từ chối.");
  }
  const records = await dns.lookup(host, { all: true });
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error("Link phân giải ra địa chỉ nội bộ — từ chối.");
  }
};

const MAX_URL_BYTES = 3 * 1024 * 1024;

/** fetch 1 URL qua cổng SSRF (assertPublicHost), tự đi theo tối đa 3 redirect,
 * kiểm IP lại ở MỖI chặng (redirect có thể trỏ sang host khác host gốc). */
const safeFetch = async (rawUrl: string, accept: string): Promise<{ res: Response; finalUrl: URL }> => {
  let current: URL;
  try {
    current = new URL(rawUrl.trim());
  } catch {
    throw new Error(`Link không hợp lệ: ${rawUrl.slice(0, 80)}`);
  }
  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new Error("Chỉ hỗ trợ link http/https.");
    }
    await assertPublicHost(current.hostname);
    const r = await fetch(current.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "AI-Motion-Studio/1.0 (+source-ingest)", Accept: accept },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      current = new URL(r.headers.get("location")!, current); // giải tương đối, vòng sau kiểm IP lại
      continue;
    }
    return { res: r, finalUrl: current };
  }
  throw new Error("Link chuyển hướng quá nhiều lần.");
};

/**
 * Nạp text từ 1 URL công khai: chỉ http/https, chặn IP nội bộ, tự đi theo tối đa
 * 3 redirect (kiểm tra IP từng chặng), giới hạn dung lượng + timeout, strip HTML.
 */
export const ingestUrl = async (rawUrl: string): Promise<IngestedSource> => {
  const { res, finalUrl: current } = await safeFetch(rawUrl, "text/html,text/plain,*/*");
  if (!res.ok) throw new Error(`Không tải được link (HTTP ${res.status}).`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_URL_BYTES) throw new Error("Nội dung link quá lớn (>3MB).");
  const ctype = res.headers.get("content-type") ?? "";
  let text = buf.toString("utf8");
  if (ctype.includes("html") || /<html[\s>]/i.test(text)) {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  if (!text.trim()) throw new Error("Link không có nội dung text đọc được.");
  return {
    name: current.hostname + current.pathname,
    text: text.slice(0, 40000),
    method: "url",
  };
};

// ===== Trích ẢNH THẬT từ trang web (link tư liệu) =====

/** Lọc icon/tracker theo KÍCH THƯỚC TỆP THẬT sau khi tải (không đoán qua tên) */
const MIN_URL_IMAGE_BYTES = 15 * 1024;
const MAX_URL_IMAGE_BYTES = 8 * 1024 * 1024;
/** Trần số ảnh trích 1 trang (tránh ngập danh mục với trang nhiều ảnh) */
const MAX_URL_IMAGES = 6;

/**
 * Trích vài ẢNH THẬT (<img src>, og:image/twitter:image) từ 1 trang web công khai
 * làm tư liệu hình ảnh — cùng mục đích với extractEmbeddedImages (docx/pdf) nhưng
 * nguồn là link (phản hồi 2026-09-03: link tư liệu cũng phải cho screen capture
 * thật, không chỉ ảnh AI vẽ). Rút ứng viên từ HTML thô (ingestUrl chỉ giữ text đã
 * strip); MỖI url ảnh phải qua LẠI assertPublicHost trước khi tải — ảnh có thể
 * nằm trên CDN khác hẳn host của trang. Lọc icon/tracker theo kích thước tệp
 * THẬT sau khi tải, giới hạn số lượng + dung lượng. Lỗi ở bước này KHÔNG được
 * chặn luồng tư liệu chính (trả rỗng thay vì throw) — text vẫn nạp bình thường.
 */
export const extractUrlImages = async (
  rawUrl: string,
  destDir: string,
  baseName: string
): Promise<{ file: string; mime: string }[]> => {
  let html: string;
  let pageUrl: URL;
  try {
    const { res, finalUrl } = await safeFetch(rawUrl, "text/html,*/*");
    if (!res.ok) return [];
    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("html")) return [];
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_URL_BYTES) return [];
    html = buf.toString("utf8");
    pageUrl = finalUrl;
  } catch {
    return [];
  }

  const candidates = new Set<string>();
  const imgTagRe = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgTagRe.exec(html))) candidates.add(m[1]);
  const metaRe =
    /<meta\b[^>]*?\bproperty\s*=\s*["'](?:og:image|twitter:image)["'][^>]*?\bcontent\s*=\s*["']([^"']+)["']/gi;
  while ((m = metaRe.exec(html))) candidates.add(m[1]);

  const resolved: URL[] = [];
  for (const raw of candidates) {
    const cleaned = raw.trim().replace(/&amp;/g, "&");
    if (!cleaned || cleaned.startsWith("data:")) continue;
    try {
      resolved.push(new URL(cleaned, pageUrl));
    } catch {
      // src hỏng/tương đối không giải được — bỏ qua
    }
  }

  fs.mkdirSync(destDir, { recursive: true });
  const out: { file: string; mime: string }[] = [];
  for (const u of resolved) {
    if (out.length >= MAX_URL_IMAGES) break;
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    try {
      await assertPublicHost(u.hostname); // host ảnh có thể khác host trang (CDN riêng)
      const r = await fetch(u.toString(), {
        redirect: "manual", // ảnh redirect sang host khác thì bỏ qua (giữ đơn giản, an toàn) thay vì đuổi theo
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "AI-Motion-Studio/1.0 (+source-ingest)" },
      });
      if (!r.ok) continue;
      const ctype = (r.headers.get("content-type") ?? "").toLowerCase();
      const ext = ctype.includes("png")
        ? ".png"
        : ctype.includes("webp")
          ? ".webp"
          : ctype.includes("jpeg") || ctype.includes("jpg")
            ? ".jpg"
            : null;
      if (!ext) continue; // chỉ nhận raster thật (bỏ svg/gif/loại không rõ)
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < MIN_URL_IMAGE_BYTES || buf.length > MAX_URL_IMAGE_BYTES) continue;
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      const dest = path.join(destDir, `${baseName}-img${out.length + 1}${ext}`);
      fs.writeFileSync(dest, buf);
      out.push({ file: dest, mime });
    } catch {
      // 1 ảnh lỗi không chặn ảnh khác
    }
  }
  return out;
};

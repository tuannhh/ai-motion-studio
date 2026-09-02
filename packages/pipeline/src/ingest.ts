import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

/**
 * Nạp text từ 1 URL công khai: chỉ http/https, chặn IP nội bộ, tự đi theo tối đa
 * 3 redirect (kiểm tra IP từng chặng), giới hạn dung lượng + timeout, strip HTML.
 */
export const ingestUrl = async (rawUrl: string): Promise<IngestedSource> => {
  let current: URL;
  try {
    current = new URL(rawUrl.trim());
  } catch {
    throw new Error(`Link không hợp lệ: ${rawUrl.slice(0, 80)}`);
  }
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new Error("Chỉ hỗ trợ link http/https.");
    }
    await assertPublicHost(current.hostname);
    const r = await fetch(current.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "AI-Motion-Studio/1.0 (+source-ingest)", Accept: "text/html,text/plain,*/*" },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      current = new URL(r.headers.get("location")!, current); // giải tương đối, vòng sau kiểm IP lại
      continue;
    }
    res = r;
    break;
  }
  if (!res) throw new Error("Link chuyển hướng quá nhiều lần.");
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

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw new Error(`${name}: chưa hỗ trợ định dạng ${ext} (hỗ trợ: txt, md, docx, pdf, mp3, wav, m4a, mp4, mov, webm).`);
  }
  return { name, text: await geminiExtract(abs, mime), method: `gemini:${mime}` };
};

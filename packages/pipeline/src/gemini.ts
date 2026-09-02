import { config } from "./env";

/**
 * Client Gemini REST tối giản (không SDK — theo pattern đã kiểm chứng của
 * ai-video-studio): generateContent cho text/JSON và TTS trả PCM 24kHz.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

const post = async (model: string, body: unknown): Promise<any> => {
  const { geminiApiKey } = config();
  if (!geminiApiKey) {
    throw new Error(
      "Thiếu GEMINI_API_KEY — thêm vào file .env ở repo root (xem .env.example)."
    );
  }
  const res = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${model} HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
};

/** Sinh JSON: ép responseMimeType application/json, trả về chuỗi JSON thô.
 * webSearch=true → bật google_search grounding để model tự tìm tư liệu trên web.
 * LƯU Ý: khi bật tool google_search, Gemini KHÔNG cho responseMimeType=json cùng lúc,
 * nên ta bỏ ép JSON và dựa vào prompt + hàm bóc JSON của lớp trên (api.ts) để parse. */
export const generateJson = async (
  prompt: string,
  opts: { webSearch?: boolean } = {}
): Promise<string> => {
  const { contentModel } = config();
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: opts.webSearch
      ? { temperature: 0.8, maxOutputTokens: 65536 }
      : {
          responseMimeType: "application/json",
          temperature: 0.8,
          maxOutputTokens: 65536,
        },
  };
  if (opts.webSearch) body.tools = [{ google_search: {} }];
  const data = await post(contentModel, body);
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text ?? "")
    .join("");
  if (!text) {
    throw new Error(
      `Gemini không trả nội dung (finishReason: ${data?.candidates?.[0]?.finishReason ?? "?"}).`
    );
  }
  // Quan sát để XÁC MINH search thật sự chạy (không phải model bịa dựa kiến thức
  // tĩnh) — model TỰ quyết định có gọi tool hay không dù được cấp; log ra để caller
  // (CLI/server log) thấy rõ câu truy vấn + nguồn thật đã tra cứu.
  if (opts.webSearch) {
    const gm = data?.candidates?.[0]?.groundingMetadata;
    const queries: string[] = gm?.webSearchQueries ?? [];
    const sourceUris: string[] = (gm?.groundingChunks ?? [])
      .map((c: any) => c?.web?.uri)
      .filter(Boolean);
    if (queries.length) {
      console.log(`   🔎 Gemini đã search: ${queries.join(" | ")}`);
      if (sourceUris.length) console.log(`   🔗 Nguồn: ${sourceUris.slice(0, 5).join(", ")}`);
    } else {
      console.log("   ⚠️  webSearch bật nhưng Gemini KHÔNG gọi google_search lần này (dùng kiến thức nền).");
    }
  }
  return text;
};

export type VoiceProfile = {
  gender: "male" | "female";
  /** giọng miền */
  region: "bac" | "nam";
  /** phong cách đọc */
  style: "thoisu" | "tintuc";
  /** tốc độ đọc: 1 = bình thường, 1.2 = nhanh (xử lý hậu kỳ ffmpeg atempo) */
  speed: 1 | 1.2;
};

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  gender: "female",
  region: "bac",
  style: "tintuc",
  speed: 1,
};

/**
 * Chỉ thị khóa giọng — CỐ ĐỊNH cho mọi scene trong 1 video để giọng đồng nhất.
 * Bài học lỗi thật (2026-09-01): prompt mở + gọi TTS từng scene khiến model
 * "nhập vai" đổi giọng ở câu trích dẫn. Phải cấm tường minh.
 */
export const buildVoiceInstruction = (profile: VoiceProfile): string => {
  const gender = profile.gender === "male" ? "nam" : "nữ";
  const region = profile.region === "nam" ? "miền Nam" : "miền Bắc";
  const style =
    profile.style === "thoisu"
      ? "thời sự trang trọng, chậm rãi có điểm nhấn"
      : "tin tức hiện đại, gọn gàng, dứt khoát";
  return [
    `Bạn là MỘT phát thanh viên ${gender} giọng ${region}, phong cách ${style}.`,
    "Đọc NGUYÊN VĂN đoạn văn dưới đây bằng đúng MỘT giọng duy nhất từ đầu đến cuối.",
    "TUYỆT ĐỐI không đổi giọng, không nhập vai nhân vật khác kể cả khi gặp câu trích dẫn hay lời thoại.",
    "Không thêm, không bớt, không bình luận. Chỉ đọc:",
  ].join(" ");
};

/** TTS tiếng Việt: trả Buffer WAV (PCM 24kHz mono 16-bit được đóng gói) */
export const synthesizeSpeech = async (
  text: string,
  profile: VoiceProfile
): Promise<Buffer> => {
  const cfg = config();
  const voiceName =
    profile.gender === "male" ? cfg.ttsVoiceMale : cfg.ttsVoiceFemale;
  const data = await post(cfg.ttsModel, {
    contents: [
      {
        role: "user",
        parts: [{ text: `${buildVoiceInstruction(profile)}\n${text}` }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        languageCode: "vi-VN",
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });
  const part = data?.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData?.data
  );
  if (!part) throw new Error("Gemini TTS không trả audio.");
  const pcm = Buffer.from(part.inlineData.data, "base64");
  return pcmToWav(pcm, 24000, 1, 16);
};

/** Đóng PCM raw thành WAV (theo cách ai-video-studio đóng gói server-side) */
export const pcmToWav = (
  pcm: Buffer,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): Buffer => {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

/**
 * Forced alignment bằng Gemini: nghe WAV + danh sách TỪ HIỂN THỊ (đúng thứ tự),
 * trả mốc thời gian bắt đầu/kết thúc từng từ. Dùng contentModel (hỗ trợ audio
 * inline). Caller phải kiểm tra lại độ dài/đơn điệu (buildForcedWordTimings) và
 * fallback về proportional khi lệch — hàm này chỉ lấy số thô từ model.
 * Trả mảng {startMs,endMs} đúng tokens.length, hoặc ném lỗi nếu shape sai.
 */
export const alignWordsToAudio = async (
  wav: Buffer,
  tokens: string[]
): Promise<Array<{ startMs: number; endMs: number }>> => {
  const { contentModel } = config();
  const prompt = [
    "Đây là file audio đọc một câu tiếng Việt.",
    `Danh sách TỪ HIỂN THỊ theo đúng thứ tự (mảng ${tokens.length} phần tử):`,
    JSON.stringify(tokens),
    "Nghe kỹ audio và cho biết MỐC THỜI GIAN (mili-giây, số nguyên) mỗi từ hiển thị được đọc.",
    "Lưu ý: một từ hiển thị (ví dụ số/ký hiệu) có thể được đọc thành nhiều tiếng nhưng VẪN tính là MỘT từ hiển thị — không tách, không gộp, không thêm bớt.",
    `Trả JSON: {"words":[{"i":0,"startMs":<int>,"endMs":<int>}, ...]} — ĐÚNG ${tokens.length} phần tử theo thứ tự i tăng dần, startMs và endMs tăng dần, endMs > startMs, endMs không vượt tổng thời lượng audio.`,
  ].join("\n");

  const data = await post(contentModel, {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Forced alignment: Gemini không trả nội dung.");
  const parsed = JSON.parse(text) as { words?: Array<{ startMs: number; endMs: number }> };
  const words = parsed?.words;
  if (!Array.isArray(words) || words.length !== tokens.length) {
    throw new Error(
      `Forced alignment: số từ trả về (${words?.length ?? 0}) khác số từ hiển thị (${tokens.length}).`
    );
  }
  return words.map((w) => ({ startMs: Math.round(w.startMs), endMs: Math.round(w.endMs) }));
};

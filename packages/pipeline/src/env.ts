import fs from "node:fs";
import path from "node:path";

/** Nạp .env ở repo root (không ghi đè biến đã có trong môi trường) */
export const loadEnv = (): void => {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      for (const line of fs.readFileSync(candidate, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
};

export const config = () => ({
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  contentModel: process.env.GEMINI_CONTENT_MODEL ?? "gemini-2.5-flash",
  ttsModel: process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts",
  ttsVoiceFemale: process.env.GEMINI_TTS_VOICE_FEMALE ?? "Kore",
  ttsVoiceMale: process.env.GEMINI_TTS_VOICE_MALE ?? "Charon",
  imageModel: process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image",
  /** Forced alignment caption qua Gemini (mặc định bật; đặt =0 để tắt, tiết kiệm 1 call/scene) */
  forcedAlignment: (process.env.FORCED_ALIGNMENT ?? "1") !== "0",
});

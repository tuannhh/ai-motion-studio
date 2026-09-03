import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeVietnameseVoiceOver } from "./vendor/tts-normalizer";
import {
  buildForcedWordTimings,
  buildProportionalWordTimings,
  readWavDurationMs,
  type WordTimingResult,
} from "./vendor/word-timing";
import { alignWordsToAudio, synthesizeSpeech, VoiceProfile } from "./gemini";
import { config } from "./env";

export type CaptionWord = { text: string; startMs: number; endMs: number };

export type VoiceoverResult = {
  file: string;
  durationMs: number;
  ttsText: string;
  /** timing từng từ của DISPLAY text (narration gốc) cho karaoke caption */
  words: CaptionWord[];
  requiresReview: boolean;
  warnings: string[];
  /** nguồn timing: ESTIMATED_PROPORTIONAL (fallback) hay GEMINI_FORCED_ALIGNMENT */
  timingSource: string;
};

const WORD_RE = /[\p{L}\p{M}\p{N}_]+(?:[-’'][\p{L}\p{M}\p{N}_]+)*/gu;

/**
 * Forced alignment qua Gemini: nghe WAV → mốc thời gian từng từ hiển thị, rồi
 * đưa qua buildForcedWordTimings (validate đơn điệu/khớp token/phủ kín). Bất kỳ
 * sai lệch nào (số từ lệch, không đơn điệu, model lỗi) đều trả null để caller
 * fallback proportional — captions không bao giờ vỡ vì tính năng này.
 */
const tryForcedAlignment = async (
  displayText: string,
  wav: Buffer,
  durationMs: number
): Promise<WordTimingResult | null> => {
  try {
    const tokens = [...displayText.normalize("NFC").matchAll(WORD_RE)].map((m) => m[0]);
    if (tokens.length < 2) return null; // 1 từ: proportional đã đủ chính xác
    const raw = await alignWordsToAudio(wav, tokens);
    const candidates = tokens.map((text, i) => ({
      text,
      startMs: raw[i].startMs,
      endMs: raw[i].endMs,
    }));
    return buildForcedWordTimings(displayText, durationMs, candidates);
  } catch {
    return null;
  }
};

/**
 * Tăng tốc WAV bằng ffmpeg atempo — deterministic, không đổi pitch.
 * (Không nhờ TTS "đọc nhanh hơn" vì kết quả ngẫu nhiên, giọng dễ trôi.)
 */
const applySpeed = (wav: Buffer, speed: number): Buffer => {
  if (speed === 1) return wav;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ams-tts-"));
  const inPath = path.join(tmp, "in.wav");
  const outPath = path.join(tmp, "out.wav");
  fs.writeFileSync(inPath, wav);
  const r = spawnSync("ffmpeg", [
    "-y", "-v", "error",
    "-i", inPath,
    "-filter:a", `atempo=${speed}`,
    "-c:a", "pcm_s16le",
    outPath,
  ]);
  if (r.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    // r.error (vd ENOENT không tìm thấy binary ffmpeg) không có stderr — nếu chỉ
    // đọc stderr sẽ hiện "undefined", che mất nguyên nhân thật lúc debug.
    const detail = r.error ? r.error.message : r.stderr?.toString().slice(0, 300) || `exit ${r.status}`;
    throw new Error(`ffmpeg atempo lỗi: ${detail}`);
  }
  const out = fs.readFileSync(outPath);
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
};

/**
 * Narration → chuẩn hóa tiếng Việt (số/ngày/% → chữ đọc) → Gemini TTS (giọng
 * khóa theo VoiceProfile) → tăng tốc nếu speed 1.2 → WAV + word timing.
 */
export const generateVoiceover = async (
  narration: string,
  sceneId: string,
  outDir: string,
  profile: VoiceProfile
): Promise<VoiceoverResult> => {
  const normalized = normalizeVietnameseVoiceOver(narration);
  let wav = await synthesizeSpeech(normalized.ttsText, profile);
  wav = applySpeed(wav, profile.speed);
  const rel = `audio/${sceneId}.wav`;
  fs.mkdirSync(path.join(outDir, "audio"), { recursive: true });
  fs.writeFileSync(path.join(outDir, rel), wav);
  const durationMs = readWavDurationMs(wav);
  // Caption hiện DISPLAY text (narration gốc "3 ngày"). Ưu tiên forced alignment
  // Gemini (timing thật từng từ); lệch/tắt → fallback chia tỷ lệ theo độ dài từ.
  const forced = config().forcedAlignment
    ? await tryForcedAlignment(normalized.displayText, wav, durationMs)
    : null;
  const timing = forced ?? buildProportionalWordTimings(normalized.displayText, durationMs);
  return {
    file: rel,
    durationMs,
    ttsText: normalized.ttsText,
    words: timing.words.map((w) => ({
      text: w.text,
      startMs: w.startMs,
      endMs: w.endMs,
    })),
    requiresReview: normalized.requiresReview,
    warnings: normalized.warnings.map((w) => `${w.code}: ${w.message}`),
    timingSource: timing.source,
  };
};

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, SAFE_X } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";

/**
 * Karaoke caption đáy màn (chữ ký ainius): lời thoại hiện theo CỤM 3-6 từ,
 * từ đang đọc sáng dần, từ trong captionEmphasis tô màu accent.
 */

type Word = { text: string; startMs: number; endMs: number };

const MAX_CHUNK_WORDS = 6;
const MAX_CHUNK_CHARS = 30;

/** Gom words thành cụm hiển thị — cắt theo dấu câu, số từ, số ký tự */
export const chunkWords = (words: Word[]): Word[][] => {
  const chunks: Word[][] = [];
  let current: Word[] = [];
  let chars = 0;
  for (const w of words) {
    if (
      current.length > 0 &&
      (current.length >= MAX_CHUNK_WORDS || chars + w.text.length > MAX_CHUNK_CHARS)
    ) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(w);
    chars += w.text.length + 1;
    if (/[.,!?;:…]$/.test(w.text) && current.length >= 3) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
};

const normalizeToken = (s: string) =>
  s.replace(/[.,!?;:…"'()\[\]]/g, "").toLocaleLowerCase("vi-VN");

export const KaraokeCaption: React.FC<{
  scene: Scene;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = scene.voiceover?.words;
  if (!words || words.length === 0) return null;

  const emphasis = new Set(scene.captionEmphasis.map(normalizeToken));
  const nowMs = (frame / fps) * 1000;
  const chunks = chunkWords(words as Word[]);
  const chunk =
    chunks.find((c) => nowMs < c[c.length - 1].endMs + 120) ??
    chunks[chunks.length - 1];
  if (!chunk) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_X,
        right: SAFE_X,
        bottom: 150,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 16px",
        textAlign: "center",
      }}
    >
      {chunk.map((w, i) => {
        const started = nowMs >= w.startMs - 40;
        const isAccent = emphasis.has(normalizeToken(w.text));
        // pop nhẹ 120ms khi từ bắt đầu được đọc
        const age = Math.max(0, Math.min(1, (nowMs - w.startMs) / 120));
        return (
          <span
            key={`${w.startMs}-${i}`}
            style={{
              ...type.title,
              fontWeight: 700,
              fontSize: 46,
              lineHeight: 1.35,
              color: isAccent ? theme.accent : theme.text,
              opacity: started ? 0.55 + age * 0.45 : 0.28,
              transform: started ? `scale(${0.96 + age * 0.04})` : "scale(0.96)",
              display: "inline-block",
              textShadow: theme.flat
                ? undefined
                : "0 2px 18px rgba(0,0,0,0.55)",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

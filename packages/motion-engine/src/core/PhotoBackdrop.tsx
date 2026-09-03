import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Theme } from "../style/presets";

const asSrc = (file: string) =>
  file.startsWith("http") ? file : staticFile(file);

/**
 * Nền nhiếp ảnh full-bleed kiểu "photo evidence" (AI News): mọi ảnh tĩnh
 * đều Ken Burns chậm (quy tắc remotion-skill), phủ scrim tối 2 đầu để
 * headline trên và caption dưới luôn đọc được trên mọi ảnh.
 */
/** Hướng Ken Burns AI có thể chỉ định (tái tạo hiệu ứng học từ video mẫu) */
export type KenBurnsMotion =
  | "auto"
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "still";

export const PhotoBackdrop: React.FC<{
  src: string;
  theme: Theme;
  /** độ tối scrim giữa khung (annotate cần ảnh rõ hơn → thấp) */
  midScrim?: number;
  /**
   * seed [0,1) biến thể Ken Burns khi motion="auto": <0.5 zoom-in, ≥0.5 zoom-out
   * + đảo hướng pan (quy tắc skill: các shot liên tiếp nên luân phiên chiều zoom).
   */
  seed?: number;
  /** hướng chuyển động camera do AI chỉ định; "auto" → dùng seed */
  motion?: KenBurnsMotion;
}> = ({ src, theme, midScrim = 0.52, seed = 0, motion = "auto" }) => {
  const frame = useCurrentFrame();
  // motion="auto": luân phiên theo seed. Còn lại: honor đúng hướng AI học được.
  const dir: Exclude<KenBurnsMotion, "auto"> =
    motion === "auto" ? (seed >= 0.5 ? "zoom-out" : "zoom-in") : motion;
  // Từng hướng → cặp scale + vector pan (px ở scale gốc). Zoom luôn chậm & clamp.
  const KB: Record<Exclude<KenBurnsMotion, "auto">, { scale: [number, number]; px: number; py: number }> = {
    "zoom-in": { scale: [1.06, 1.16], px: -18, py: -12 },
    "zoom-out": { scale: [1.16, 1.06], px: 18, py: 12 },
    "pan-left": { scale: [1.12, 1.12], px: 46, py: 0 },
    "pan-right": { scale: [1.12, 1.12], px: -46, py: 0 },
    still: { scale: [1.04, 1.04], px: 0, py: 0 },
  };
  const kb = KB[dir];
  const zoom = interpolate(frame, [0, 360], kb.scale, { extrapolateRight: "clamp" });
  const panX = interpolate(frame, [0, 360], [0, kb.px], { extrapolateRight: "clamp" });
  const panY = interpolate(frame, [0, 360], [0, kb.py], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={asSrc(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
        }}
      />
      {/* Grade soft-light màu accent: đồng nhất ảnh AI/tư liệu về tông preset */}
      <AbsoluteFill
        style={{
          backgroundColor: theme.accent,
          mixBlendMode: "soft-light",
          opacity: theme.isDark ? 0.16 : 0.1,
        }}
      />
      {/* scrim: đậm 2 đầu (vùng chữ), giảm bớt ở giữa để ảnh vẫn "thật" nhưng đủ
          tối/sáng để giảm độ phức tạp của ảnh nền — chữ luôn đọc được (feedback
          2026-09-03: tương phản chữ/ảnh chưa ổn) */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg,
            ${theme.bgBase}F0 0%,
            ${theme.bgBase}${Math.round(midScrim * 255)
              .toString(16)
              .padStart(2, "0")} 34%,
            ${theme.bgBase}${Math.round(midScrim * 255)
              .toString(16)
              .padStart(2, "0")} 62%,
            ${theme.bgBase}F5 100%)`,
        }}
      />
      {/* viền tối 4 cạnh giữ chữ ký vignette của engine */}
      <AbsoluteFill
        style={{
          boxShadow: `inset 0 0 260px 60px ${theme.bgBase}CC`,
        }}
      />
    </AbsoluteFill>
  );
};

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
export const PhotoBackdrop: React.FC<{
  src: string;
  theme: Theme;
  /** độ tối scrim giữa khung (annotate cần ảnh rõ hơn → thấp) */
  midScrim?: number;
  /**
   * seed [0,1) biến thể Ken Burns: <0.5 zoom-in, ≥0.5 zoom-out + đảo hướng pan
   * (quy tắc skill: các shot liên tiếp nên luân phiên chiều zoom).
   */
  seed?: number;
}> = ({ src, theme, midScrim = 0.42, seed = 0 }) => {
  const frame = useCurrentFrame();
  const zoomOut = seed >= 0.5;
  // Ken Burns: zoom chậm + trôi chéo nhẹ, clamp để scene dài không lố
  const zoom = interpolate(
    frame,
    [0, 360],
    zoomOut ? [1.14, 1.06] : [1.06, 1.14],
    { extrapolateRight: "clamp" }
  );
  const pan = interpolate(frame, [0, 360], [0, zoomOut ? 28 : -28], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={asSrc(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${zoom}) translate(${pan}px, ${pan * 0.6}px)`,
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
      {/* scrim: đậm 2 đầu (vùng chữ), nhẹ ở giữa để ảnh vẫn "thật" */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg,
            ${theme.bgBase}E8 0%,
            ${theme.bgBase}${Math.round(midScrim * 255)
              .toString(16)
              .padStart(2, "0")} 34%,
            ${theme.bgBase}${Math.round(midScrim * 255)
              .toString(16)
              .padStart(2, "0")} 62%,
            ${theme.bgBase}F0 100%)`,
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

import React from "react";
import { Img, staticFile } from "remotion";
import { VideoSpec, WIDTH } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";

const asSrc = (file: string) =>
  file.startsWith("http") ? file : staticFile(file);

/**
 * Watermark overlay tĩnh toàn video: text hoặc ảnh, đặt theo tâm (x,y tỷ lệ),
 * opacity + scale do admin/creator cấu hình. Không animation để không tranh
 * thị giác với nội dung.
 */
export const Watermark: React.FC<{
  watermark: NonNullable<VideoSpec["style"]["watermark"]>;
  theme: Theme;
}> = ({ watermark, theme }) => {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${watermark.x * 100}%`,
    top: `${watermark.y * 100}%`,
    transform: "translate(-50%, -50%)",
    opacity: watermark.opacity,
    pointerEvents: "none",
  };

  if (watermark.kind === "image" && watermark.image) {
    return (
      <Img
        src={asSrc(watermark.image)}
        style={{ ...style, width: WIDTH * watermark.scale }}
      />
    );
  }

  if (watermark.kind === "text" && watermark.text) {
    return (
      <div
        style={{
          ...style,
          ...type.label,
          fontSize: WIDTH * watermark.scale * 0.14,
          whiteSpace: "nowrap",
          color: theme.text,
          textShadow: theme.isDark
            ? "0 1px 8px rgba(0,0,0,0.6)"
            : "0 1px 8px rgba(255,255,255,0.6)",
        }}
      >
        {watermark.text}
      </div>
    );
  }

  return null;
};

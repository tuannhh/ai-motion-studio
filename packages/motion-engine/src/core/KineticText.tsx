import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { evolvePath } from "@remotion/paths";
import { popSpring } from "./motion";
import { smartLines, wordsIn } from "./viText";
import { fitBox } from "./fit";
import { type } from "../style/fonts";

/**
 * Kinetic typography: hiện từng từ bằng spring (mask-reveal + pop),
 * kèm drift sin nhẹ sau khi vào để chữ "thở" thay vì đứng chết.
 */
export const KineticText: React.FC<{
  text: string;
  color: string;
  accent?: string;
  /** những từ cần tô accent (so khớp không phân biệt hoa thường) */
  emphasis?: string[];
  fontSize: number;
  delay?: number;
  align?: "left" | "center";
  maxCharsPerLine?: number;
  fontWeight?: number;
  /** tắt glow ở preset flat/paper */
  glow?: boolean;
  /** nếu có: tự co cỡ chữ để text gói trong maxWidth × maxLines (không tràn) */
  maxWidth?: number;
  maxLines?: number;
  /** màu "quầng tách nền": vẽ halo cùng màu nền quanh chữ → chữ nổi rõ trên ẢNH
   * phức tạp; trên nền phẳng trùng màu nền nên vô hình (truyền theme.bgBase). */
  haloColor?: string;
}> = ({
  text,
  color,
  accent,
  emphasis = [],
  fontSize,
  delay = 6,
  align = "left",
  maxCharsPerLine = 18,
  fontWeight = 800,
  glow = true,
  maxWidth,
  maxLines = 3,
  haloColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Chia dòng TRƯỚC, rồi fit theo ĐÚNG số dòng thực tế (không phải maxLines) — đảm bảo
  // mỗi dòng vừa bề rộng để dùng nowrap mà không tràn.
  const lines = smartLines(text, maxCharsPerLine, maxLines);
  const size = maxWidth
    ? fitBox(text, maxWidth, lines.length, { max: fontSize, min: Math.round(fontSize * 0.55), fontWeight })
    : fontSize;
  const emphasisSet = new Set(emphasis.map((w) => w.toLocaleLowerCase("vi-VN")));

  let wordIndex = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: size * 0.12 }}>
      {lines.map((line, li) => (
        <div
          key={li}
          style={{
            display: "flex",
            // nowrap: điểm xuống dòng đã do smartLines quyết định — cấm engine tự bẻ
            // dòng giữa chừng gây từ mồ côi (đã fit cỡ chữ để mỗi dòng vừa khung)
            flexWrap: "nowrap",
            gap: `0 ${size * 0.24}px`,
            justifyContent: align === "center" ? "center" : "flex-start",
          }}
        >
          {wordsIn(line).map((word, wi) => {
            const d = delay + li * 6 + wordIndex * 3;
            wordIndex += 1;
            const p = popSpring({ frame, fps, delay: d });
            const drift = Math.sin((frame - d) / 26 + wordIndex) * 2.2;
            const isAccent =
              accent &&
              emphasisSet.has(word.replace(/[.,!?:;"']/g, "").toLocaleLowerCase("vi-VN"));
            // Quầng tách nền: dùng VIỀN CHỮ (text-stroke) cùng màu nền — rẻ về mặt
            // render (không blur từng frame như text-shadow) mà vẫn tách chữ khỏi ảnh
            // phức tạp. paint-order: stroke trước → viền nằm SAU nét chữ, không ăn nét.
            // (Bài học: halo bằng 3 lớp text-shadow blur khiến render chậm gấp nhiều lần.)
            const accentGlow = isAccent && glow ? `0 0 44px ${accent}66` : undefined;
            return (
              <span
                key={wi}
                style={{
                  ...type.headline,
                  fontWeight,
                  fontSize: size,
                  color: isAccent ? accent : color,
                  display: "inline-block",
                  opacity: Math.min(1, p * 1.8),
                  transform: `translateY(${(1 - p) * size * 0.55 + (frame > d ? drift : 0)}px) scale(${0.82 + p * 0.18})`,
                  textShadow: accentGlow,
                  ...(haloColor
                    ? {
                        WebkitTextStrokeWidth: `${Math.max(3, size * 0.05)}px`,
                        WebkitTextStrokeColor: haloColor,
                        paintOrder: "stroke fill" as const,
                      }
                    : {}),
                  whiteSpace: "pre",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/**
 * Gạch chân accent kiểu VẼ TAY: một nét bút dạ hơi lượn, tự vẽ trái→phải theo
 * độ dài đường thật (evolvePath) — thay cho thanh scaleX phẳng. Nét dày, đầu bo
 * tròn, có glow ở preset tối → khoảnh khắc "chữ ký" khiến người xem tâm đắc.
 */
export const AccentUnderline: React.FC<{
  color: string;
  width: number;
  delay?: number;
  glow?: boolean;
}> = ({ color, width, delay = 20, glow = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 80, mass: 0.7 },
  });
  const h = 22;
  // đường lượn nhẹ như quẹt bút dạ (không thẳng đơ)
  const d = `M 4 ${h * 0.62} Q ${width * 0.3} ${h * 0.12}, ${width * 0.54} ${h * 0.5} T ${width - 4} ${h * 0.4}`;
  const evolved = evolvePath(p, d);
  return (
    <svg
      width={width}
      height={h + 10}
      viewBox={`0 0 ${width} ${h + 10}`}
      style={{
        marginTop: 30,
        overflow: "visible",
        filter: glow ? `drop-shadow(0 0 16px ${color}aa)` : undefined,
      }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={evolved.strokeDasharray}
        strokeDashoffset={evolved.strokeDashoffset}
      />
    </svg>
  );
};

import React from "react";
import * as lucide from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { SAFE_BOTTOM, SAFE_TOP, SAFE_X, WIDTH } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { floatY, riseIn, sceneExitStyle } from "./motion";
import { fitBox } from "./fit";
import { RichText, stripMarkup } from "./RichText";
import { SurfaceKind, SurfaceOverlay } from "./surfaces";

/** bề rộng nội dung trong safe area (dùng để tự co headline) */
const SAFE_W = WIDTH - SAFE_X * 2;

/** Vùng nội dung nằm trong safe area 9:16 */
export const SafeArea: React.FC<{
  children: React.ReactNode;
  justify?: React.CSSProperties["justifyContent"];
}> = ({ children, justify = "center" }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const exit = sceneExitStyle(frame, durationInFrames);
  // Idle breathing: sau 2s đứng yên, cả lớp nội dung trôi dọc ±3px rất chậm
  const idle = frame > fps * 2 ? floatY(frame - fps * 2) : 0;
  return (
    <AbsoluteFill
      style={{
        paddingLeft: SAFE_X,
        paddingRight: SAFE_X,
        paddingTop: SAFE_TOP,
        paddingBottom: SAFE_BOTTOM,
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        opacity: exit.opacity,
        transform: `translateY(${idle + exit.y}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Icon lucide theo tên; tên sai → chấm tròn accent (không bao giờ vỡ render) */
export const Icon: React.FC<{
  name?: string;
  size?: number;
  color: string;
  strokeWidth?: number;
}> = ({ name, size = 44, color, strokeWidth = 2.4 }) => {
  const Cmp =
    name && name in lucide
      ? (lucide as unknown as Record<string, React.FC<lucide.LucideProps>>)[name]
      : null;
  if (!Cmp) {
    return (
      <div
        style={{
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: "50%",
          background: color,
        }}
      />
    );
  }
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} absoluteStrokeWidth />;
};

/** Chip icon — glow ở preset tối, nét phẳng ở preset flat */
export const IconChip: React.FC<{
  name?: string;
  theme: Theme;
  size?: number;
  style?: React.CSSProperties;
}> = ({ name, theme, size = 96, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * (theme.flat ? 0.22 : 0.32),
      background: theme.accentSoft,
      border: `2px solid ${theme.accent}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: theme.flat ? undefined : `0 0 44px ${theme.accentSoft}`,
      flexShrink: 0,
      ...style,
    }}
  >
    <Icon name={name} size={size * 0.48} color={theme.accent} />
  </div>
);

/**
 * Card surface chuẩn — glass ở preset tối, viền mực phẳng ở preset flat.
 * `surface` (P4): phủ 1 bề mặt hiệu ứng (viền chạy/pha lê/vi mạch) cho KHỐI TIÊU
 * ĐIỂM — chỉ hiện ở preset tối (SurfaceOverlay tự trả null khi flat). Chọn ở scene
 * bằng surfaceFor(seed) và chỉ áp cho 1 khối nổi bật/scene (tiết chế).
 */
export const Glass: React.FC<{
  theme: Theme;
  children: React.ReactNode;
  style?: React.CSSProperties;
  surface?: SurfaceKind | null;
  surfaceSeed?: string;
}> = ({ theme, children, style, surface, surfaceSeed }) => {
  const radius = theme.flat ? 18 : 32;
  return (
    <div
      style={
        theme.flat
          ? {
              position: "relative",
              background: theme.surface,
              border: `2px solid ${theme.surfaceBorder}`,
              borderRadius: radius,
              boxShadow: "0 2px 0 rgba(35,32,28,0.25)",
              ...style,
            }
          : {
              position: "relative",
              background: theme.surface,
              border: `1.5px solid ${theme.surfaceBorder}`,
              borderRadius: radius,
              backdropFilter: "blur(18px)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              ...style,
            }
      }
    >
      {children}
      {surface ? (
        <SurfaceOverlay kind={surface} theme={theme} radius={radius} seedKey={surfaceSeed} />
      ) : null}
    </div>
  );
};

/** Nhãn nhỏ mono uppercase phía trên tiêu đề scene */
export const Kicker: React.FC<{
  theme: Theme;
  children: React.ReactNode;
  delay?: number;
}> = ({ theme, children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        ...type.label,
        fontSize: 28,
        color: theme.accent,
        marginBottom: 26,
        display: "flex",
        alignItems: "center",
        gap: 18,
        ...riseIn({ frame, fps, delay }),
      }}
    >
      <div style={{ width: 56, height: 4, background: theme.accent, borderRadius: 2 }} />
      {children}
    </div>
  );
};

/** Header 2 tầng chuẩn ainius: title sans đậm + sub serif nghiêng */
export const SceneHeader: React.FC<{
  theme: Theme;
  kicker?: string;
  title?: string;
  sub?: string;
  size?: number;
}> = ({ theme, kicker, title, sub, size = 66 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!title && !kicker && !sub) return null;
  return (
    <div style={{ marginBottom: 48 }}>
      {kicker ? <Kicker theme={theme}>{kicker}</Kicker> : null}
      {title ? (
        <h2
          style={{
            ...type.headline,
            // Chính: đậm hơn, hàng khít lại để khối tiêu đề nổi bật rõ so với phụ
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: "-0.01em",
            fontSize: fitBox(stripMarkup(title), SAFE_W, 3, { max: size, min: Math.round(size * 0.6) }),
            color: theme.text,
            margin: 0,
            ...riseIn({ frame, fps, delay: 4 }),
          }}
        >
          <RichText text={title} accent={theme.accent} />
        </h2>
      ) : null}
      {sub ? (
        <p
          style={{
            ...type.sub,
            // Phụ: nhỏ hơn + nhẹ hơn + mờ hơn → tách bậc rõ với tiêu đề chính
            fontSize: 32,
            fontWeight: 400,
            color: theme.textDim,
            margin: 0,
            marginTop: 18,
            ...riseIn({ frame, fps, delay: 10 }),
          }}
        >
          <RichText text={sub} accent={theme.accent} />
        </p>
      ) : null}
    </div>
  );
};

/** Chip tiến trình "01 / 08" (+ tên serie) góc trên trái — ngoài SafeArea */
export const ProgressChip: React.FC<{
  theme: Theme;
  index: number;
  total: number;
  series?: { name: string; episode: number; total?: number };
}> = ({ theme, index, total, series }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: SAFE_X,
        right: SAFE_X,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        ...riseIn({ frame, fps, delay: 0 }),
      }}
    >
      {/* Bộ đếm trang "01 / 08" đã BỎ theo phản hồi (quá nhỏ, khó nhìn, gây rối);
          giữ lại chip serie khi video thuộc một serie. Span rỗng để flex canh phải. */}
      <span />
      {series ? (
        <span
          style={{
            ...type.label,
            fontSize: 24,
            color: theme.textDim,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {series.name} · tập {series.episode}
          {series.total ? (
            <span style={{ display: "flex", gap: 6 }}>
              {Array.from({ length: Math.min(series.total, 8) }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background:
                      i < series.episode ? theme.accent : "transparent",
                    border: `2px solid ${
                      i < series.episode ? theme.accent : theme.textDim
                    }`,
                  }}
                />
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
};

/** Tiêu đề scene dùng chung (giữ cho tương thích cũ) */
export const SceneTitle: React.FC<{
  theme: Theme;
  children: React.ReactNode;
  delay?: number;
  size?: number;
}> = ({ theme, children, delay = 4, size = 72 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fitted =
    typeof children === "string"
      ? fitBox(children, SAFE_W, 3, { max: size, min: Math.round(size * 0.6) })
      : size;
  return (
    <h2
      style={{
        ...type.headline,
        fontSize: fitted,
        color: theme.text,
        margin: 0,
        marginBottom: 52,
        ...riseIn({ frame, fps, delay }),
      }}
    >
      {children}
    </h2>
  );
};

import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * 3 transition tự dựng học từ remotion-motion-graphics skill (mục 14
 * motion-patterns.md) — bổ sung cho bộ slide/fade/wipe của @remotion/transitions
 * để video đa dạng nhịp chuyển cảnh:
 * - whipPan: quăng máy ngang + motion blur, cắt giấu giữa cú quăng
 * - scaleThrough: cảnh cũ phóng to mờ đi, cảnh mới từ nhỏ hiện lên phía sau
 * - maskWipe: dải màu accent quét ngang, cảnh mới lộ ra sau mép quét
 * - fadeThroughBg: fade cắt qua nền (thay fade() chồng thẳng của @remotion/transitions)
 */

type WhipProps = { direction: 1 | -1 };

const WhipPanPresentation: React.FC<
  TransitionPresentationComponentProps<WhipProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const dir = passedProps.direction;
  const p = presentationProgress;
  // blur đạt đỉnh giữa cú quăng — hai cảnh cùng blur nên vết cắt vô hình
  const blur = Math.sin(p * Math.PI) * 14;
  const x =
    presentationDirection === "exiting"
      ? interpolate(p, [0, 1], [0, -1500 * dir])
      : interpolate(p, [0, 1], [1500 * dir, 0]);
  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${x}px)`,
        filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const whipPan = (
  props: WhipProps = { direction: 1 }
): TransitionPresentation<WhipProps> => ({
  component: WhipPanPresentation,
  props,
});

const ScaleThroughPresentation: React.FC<
  TransitionPresentationComponentProps<Record<string, never>>
> = ({ children, presentationProgress, presentationDirection }) => {
  const p = presentationProgress;
  const style: React.CSSProperties =
    presentationDirection === "exiting"
      ? {
          transform: `scale(${interpolate(p, [0, 1], [1, 1.28])})`,
          opacity: interpolate(p, [0, 0.7], [1, 0], {
            extrapolateRight: "clamp",
          }),
        }
      : {
          transform: `scale(${interpolate(p, [0, 1], [0.86, 1])})`,
          opacity: interpolate(p, [0.15, 0.8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

export const scaleThrough = (): TransitionPresentation<
  Record<string, never>
> => ({
  component: ScaleThroughPresentation,
  props: {},
});

type MaskWipeProps = { accent: string };

const MaskWipePresentation: React.FC<
  TransitionPresentationComponentProps<MaskWipeProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const p = presentationProgress;
  // Scene của engine TRONG SUỐT (nền là Background chung) nên không dùng
  // clipPath lộ dần — thay bằng: dải accent rộng quét ngang che khung,
  // cảnh cũ tắt / cảnh mới bật đúng lúc dải phủ giữa màn (cắt giấu sau dải).
  const opacity =
    presentationDirection === "exiting"
      ? interpolate(p, [0.3, 0.5], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(p, [0.45, 0.65], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  // Dải rộng 130% trượt từ ngoài trái sang ngoài phải, chéo nhẹ
  const barX = interpolate(p, [0, 1], [-160, 160]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
      {presentationDirection === "entering" ? (
        <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              top: "-10%",
              height: "120%",
              width: "130%",
              left: `${barX}%`,
              background: passedProps.accent,
              transform: "skewX(-8deg)",
            }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

export const maskWipe = (
  props: MaskWipeProps
): TransitionPresentation<MaskWipeProps> => ({
  component: MaskWipePresentation,
  props,
});

/**
 * blurZoom: cảnh cũ lùi + nhoè, cảnh mới ập tới từ 1.18× kèm blur tan dần —
 * cú "kéo nét" điện ảnh, khác hẳn slide/fade.
 */
const BlurZoomPresentation: React.FC<
  TransitionPresentationComponentProps<Record<string, never>>
> = ({ children, presentationProgress, presentationDirection }) => {
  const p = presentationProgress;
  const style: React.CSSProperties =
    presentationDirection === "exiting"
      ? {
          transform: `scale(${interpolate(p, [0, 1], [1, 0.92])})`,
          opacity: interpolate(p, [0, 0.6], [1, 0], { extrapolateRight: "clamp" }),
          filter: `blur(${p * 10}px)`,
        }
      : {
          transform: `scale(${interpolate(p, [0, 1], [1.18, 1])})`,
          opacity: interpolate(p, [0.2, 0.8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          filter: `blur(${(1 - p) * 12}px)`,
        };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

export const blurZoom = (): TransitionPresentation<Record<string, never>> => ({
  component: BlurZoomPresentation,
  props: {},
});

/**
 * iris: cảnh mới lộ ra qua vòng tròn mở rộng từ tâm (clip-path circle) — vì scene
 * trong suốt trên Background chung, clip lộ đúng nội dung. Cảnh cũ mờ đi phía dưới.
 */
const IrisPresentation: React.FC<
  TransitionPresentationComponentProps<Record<string, never>>
> = ({ children, presentationProgress, presentationDirection }) => {
  const p = presentationProgress;
  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill
        style={{
          opacity: interpolate(p, [0.35, 0.7], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {children}
      </AbsoluteFill>
    );
  }
  const r = interpolate(p, [0, 1], [0, 135]);
  return (
    <AbsoluteFill style={{ clipPath: `circle(${r}% at 50% 50%)` }}>
      {children}
    </AbsoluteFill>
  );
};

export const iris = (): TransitionPresentation<Record<string, never>> => ({
  component: IrisPresentation,
  props: {},
});

/**
 * pushDiagonal: hai cảnh trượt CÙNG hướng chéo (cảnh cũ đẩy ra, cảnh mới đẩy vào)
 * — cảm giác "lật trang" động hơn slide thẳng.
 */
type PushProps = { dx: number; dy: number };

const PushPresentation: React.FC<
  TransitionPresentationComponentProps<PushProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const p = presentationProgress;
  const { dx, dy } = passedProps;
  const pos =
    presentationDirection === "exiting"
      ? { x: interpolate(p, [0, 1], [0, -dx]), y: interpolate(p, [0, 1], [0, -dy]) }
      : { x: interpolate(p, [0, 1], [dx, 0]), y: interpolate(p, [0, 1], [dy, 0]) };
  return (
    <AbsoluteFill style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

export const pushDiagonal = (
  props: PushProps = { dx: 1120, dy: 380 }
): TransitionPresentation<PushProps> => ({
  component: PushPresentation,
  props,
});

/**
 * fadeThroughBg: thay cho fade() phẳng của @remotion/transitions — fade() cũ chồng
 * THẲNG cảnh cũ và cảnh mới (cả hai cùng cỡ, cùng vị trí, không mờ/không lệch), nên
 * giữa chừng 2 scene chữ dày đặc (vd hook → rank) chữ 2 bên đọc chồng lên nhau, KHÔNG
 * đọc nổi (lỗi thật — bắt được từ ảnh chụp giữa chuyển cảnh, phản hồi 2026-09-03).
 * Fix: cắt qua nền chung — cảnh cũ mờ dần hết TRƯỚC KHI cảnh mới bắt đầu hiện, chừa
 * một khoảng ngắn (~15% thời lượng chuyển cảnh) chỉ thấy nền, không bao giờ có 2 lớp
 * chữ chồng nhau tại cùng một thời điểm.
 */
const FadeThroughBgPresentation: React.FC<
  TransitionPresentationComponentProps<Record<string, never>>
> = ({ children, presentationProgress, presentationDirection }) => {
  const p = presentationProgress;
  const opacity =
    presentationDirection === "exiting"
      ? interpolate(p, [0, 0.42], [1, 0], { extrapolateRight: "clamp" })
      : interpolate(p, [0.58, 1], [0, 1], { extrapolateLeft: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const fadeThroughBg = (): TransitionPresentation<
  Record<string, never>
> => ({
  component: FadeThroughBgPresentation,
  props: {},
});

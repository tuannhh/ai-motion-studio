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

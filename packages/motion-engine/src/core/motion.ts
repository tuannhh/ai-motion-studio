import type { CSSProperties } from "react";
import { interpolate, spring } from "remotion";

/**
 * Bộ chuyển động chuẩn của engine — mọi scene dùng chung để video có "chữ ký"
 * chuyển động nhất quán: vào bằng spring nảy nhẹ, chữ trồi từ dưới, stagger đều.
 */

type SpringArgs = { frame: number; fps: number; delay?: number };

/** Spring mềm cho khối lớn (card, node) */
export const enterSpring = ({ frame, fps, delay = 0 }: SpringArgs) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 90, mass: 0.9 },
  });

/** Spring nảy cho phần tử nhỏ (icon, badge) */
export const popSpring = ({ frame, fps, delay = 0 }: SpringArgs) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.6 },
  });

/** Kiểu vào chuẩn: trồi lên + hiện dần */
export const riseIn = (args: SpringArgs) => {
  const p = enterSpring(args);
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * 46}px)`,
  };
};

/** Kiểu vào cho icon/chip: phóng to từ 0.4 với overshoot nhẹ */
export const popIn = (args: SpringArgs) => {
  const p = popSpring(args);
  return {
    opacity: Math.min(1, p * 2),
    transform: `scale(${0.4 + p * 0.6})`,
  };
};

/** Delay stagger tiêu chuẩn giữa các item trong list/diagram (frame) */
export const STAGGER = 9;

/**
 * Delay reveal RẢI ĐỀU theo độ dài scene: item hiện dần trong lúc voiceover đang
 * đọc ("nói tới đâu hiện tới đó") thay vì hiện dồn hết trong ~1 giây đầu. Trải từ
 * ~8% tới ~62% thời lượng scene (xong sớm trước khi hết cảnh để người xem kịp đọc
 * mục cuối). Bước giữa các item được kẹp [12,58] frame để không dồn cục / không lê
 * quá chậm. Trả về mảng delay (frame) theo từng item.
 */
export const spreadDelays = (
  count: number,
  sceneFrames: number,
  startFrac = 0.08,
  endFrac = 0.62
): number[] => {
  const start = Math.round(sceneFrames * startFrac);
  if (count <= 1) return [start];
  const rawStep = (sceneFrames * endFrac - start) / (count - 1);
  const step = Math.min(Math.max(rawStep, 12), 58);
  return Array.from({ length: count }, (_, i) => Math.round(start + i * step));
};

/** Vẽ đường theo tiến độ 0→1 (stroke-dashoffset) */
export const drawProgress = ({ frame, fps, delay = 0 }: SpringArgs) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 60, stiffness: 60, mass: 1 },
  });

/** Hiện từng từ của headline (kinetic typography) */
export const wordDelay = (wordIndex: number) => wordIndex * 4;

/** Trôi chậm liên tục cho nền (không lặp giật) */
export const slowDrift = (frame: number, speed: number, amplitude: number) =>
  Math.sin((frame / 30) * speed) * amplitude;

/** Fade-out nhẹ cuối scene để bàn giao cho transition */
export const sceneExit = (frame: number, durationInFrames: number) =>
  interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/**
 * Exit chuẩn remotion-skill: NHANH hơn entrance (~10 frame), trồi lên + mờ dần.
 * Transition vẫn phủ lên trên nên chỉ cần vừa đủ để scene "chủ động rời đi".
 */
export const sceneExitStyle = (
  frame: number,
  durationInFrames: number
): { opacity: number; y: number } => {
  const range: [number, number] = [durationInFrames - 12, durationInFrames - 2];
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  return {
    opacity: interpolate(frame, range, [1, 0.55], clamp),
    y: interpolate(frame, range, [0, -26], clamp),
  };
};

/**
 * Hash FNV-1a chuỗi → [0,1) ổn định — nguồn biến thể chuyển động theo
 * video/scene (Math.random bị cấm: mỗi frame render lại phải y hệt nhau).
 */
export const seedOf = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    // Math.imul bắt buộc: nhân thường vượt 2^53 làm mất bit thấp → hash bất biến
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  // Finalizer kiểu murmur3: FNV avalanche yếu — đổi 1 ký tự cuối chỉ xê dịch
  // bit thấp, khiến các seed "…-1"/"…-2" gần như trùng nhau nếu thiếu bước này
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 8) / 16777216;
};

/** Chọn 1 phần tử theo seed chuỗi — cùng input luôn cùng kết quả */
export const pickBySeed = <T,>(key: string, options: readonly T[]): T =>
  options[Math.floor(seedOf(key) * options.length) % options.length];

/**
 * Kiểu XUẤT HIỆN của 1 khối (item/card) — để list scene không luôn trượt y hệt
 * một kiểu. Chọn theo seed(scene.id) nên mỗi scene một "tính cách" chuyển động
 * khác nhau, còn trong 1 scene các item vẫn đồng nhất (đọc dễ). p là tiến độ 0→1.
 */
export type RevealStyle = "rise" | "slideL" | "slideR" | "pop" | "clipUp" | "zoomBlur";
export const REVEAL_STYLES: readonly RevealStyle[] = [
  "rise",
  "slideL",
  "slideR",
  "pop",
  "clipUp",
  "zoomBlur",
];
/** Chọn kiểu reveal cho scene theo seed (đổi id → đổi tính cách chuyển động) */
export const revealStyleOf = (sceneId: string): RevealStyle =>
  pickBySeed(`${sceneId}-reveal`, REVEAL_STYLES);

/** CSS transform/opacity/clip cho 1 khối theo kiểu reveal + tiến độ p (0→1) */
export const entrance = (style: RevealStyle, p: number): CSSProperties => {
  const inv = 1 - p;
  switch (style) {
    case "slideL":
      return { opacity: p, transform: `translateX(${inv * -110}px)` };
    case "slideR":
      return { opacity: p, transform: `translateX(${inv * 110}px)` };
    case "pop":
      return { opacity: p, transform: `scale(${0.72 + p * 0.28})` };
    case "clipUp":
      return {
        opacity: Math.min(1, p * 1.4),
        clipPath: `inset(${inv * 100}% 0% 0% 0%)`,
        transform: `translateY(${inv * 26}px)`,
      };
    case "zoomBlur":
      return {
        opacity: p,
        transform: `scale(${1.12 - p * 0.12})`,
        filter: p < 0.98 ? `blur(${inv * 10}px)` : undefined,
      };
    default: // rise
      return { opacity: p, transform: `translateY(${inv * 44}px)` };
  }
};

/** Idle breathing (quy tắc skill: phần tử đứng yên >2s phải thở) — scale quanh 1 */
export const breathe = (frame: number, amplitude = 0.012) =>
  1 + Math.sin(frame / 22) * amplitude;

/** Trôi dọc nhẹ liên tục (px) cho lớp nội dung */
export const floatY = (frame: number, px = 3) => Math.sin(frame / 30) * px;

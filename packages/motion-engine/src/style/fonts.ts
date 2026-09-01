import { loadFont as loadBeVietnam } from "@remotion/google-fonts/BeVietnamPro";
import { loadFont as loadLora } from "@remotion/google-fonts/Lora";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

/**
 * Trio typography (học từ ainius/diagram-video-tool):
 * - Sans: Be Vietnam Pro — headline/nội dung, dựng riêng cho tiếng Việt
 * - Serif nghiêng: Lora — subtitle biên tập ("giọng bình luận")
 * - Mono: JetBrains Mono — eyebrow/label/credit/số liệu
 */

const beVietnam = loadBeVietnam("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "vietnamese"],
});

const lora = loadLora("italic", {
  weights: ["500", "600"],
  subsets: ["latin", "vietnamese"],
});

const mono = loadMono("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "vietnamese"],
});

export const FONT = beVietnam.fontFamily;
export const FONT_SERIF = lora.fontFamily;
export const FONT_MONO = mono.fontFamily;

export const type = {
  headline: {
    fontFamily: FONT,
    fontWeight: 800 as const,
    letterSpacing: "-0.02em",
    lineHeight: 1.12,
  },
  title: {
    fontFamily: FONT,
    fontWeight: 700 as const,
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
  },
  body: {
    fontFamily: FONT,
    fontWeight: 500 as const,
    lineHeight: 1.4,
  },
  /** subtitle biên tập — serif nghiêng */
  sub: {
    fontFamily: FONT_SERIF,
    fontStyle: "italic" as const,
    fontWeight: 500 as const,
    lineHeight: 1.35,
  },
  /** eyebrow/label kỹ thuật — mono tracking rộng */
  label: {
    fontFamily: FONT_MONO,
    fontWeight: 500 as const,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
  },
  /** số liệu/credit — mono thường */
  mono: {
    fontFamily: FONT_MONO,
    fontWeight: 500 as const,
    lineHeight: 1.3,
  },
};

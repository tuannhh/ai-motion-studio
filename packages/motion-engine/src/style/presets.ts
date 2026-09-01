import { StylePreset } from "../schema/spec";

export type Theme = {
  /** màu blob gradient nền (3 màu, chuyển động chậm) — bỏ qua khi flat */
  bgBase: string;
  blobs: [string, string, string];
  text: string;
  textDim: string;
  accent: string;
  accentSoft: string;
  /** nền card */
  surface: string;
  surfaceBorder: string;
  danger: string;
  good: string;
  isDark: boolean;
  /**
   * flat = editorial paper mode (học từ diagram-video-tool/ainius paper):
   * KHÔNG glow, KHÔNG blur, KHÔNG shadow đậm, nền phẳng, viền nét rõ.
   */
  flat: boolean;
};

export const THEMES: Record<StylePreset, Theme> = {
  /** tối xanh đêm + electric blue — video công nghệ/AI (glow tiết chế) */
  midnight: {
    bgBase: "#070B14",
    blobs: ["#12275e", "#0b3a5c", "#1a1440"],
    text: "#F4F7FF",
    textDim: "rgba(244,247,255,0.62)",
    accent: "#4D8DFF",
    accentSoft: "rgba(77,141,255,0.16)",
    surface: "rgba(255,255,255,0.055)",
    surfaceBorder: "rgba(255,255,255,0.14)",
    danger: "#FF6B6B",
    good: "#3DDC97",
    isDark: true,
    flat: false,
  },
  /** tối tím-teal cực quang */
  aurora: {
    bgBase: "#0A0714",
    blobs: ["#2b1460", "#0b4a44", "#3a1050"],
    text: "#F7F4FF",
    textDim: "rgba(247,244,255,0.62)",
    accent: "#9B7BFF",
    accentSoft: "rgba(155,123,255,0.16)",
    surface: "rgba(255,255,255,0.055)",
    surfaceBorder: "rgba(255,255,255,0.14)",
    danger: "#FF6B9D",
    good: "#4AE3B5",
    isDark: true,
    flat: false,
  },
  /** editorial paper: kem + mực + cam đất — chuẩn "AI Agents 101"/diagram-video-tool */
  paper: {
    bgBase: "#F4EFE6",
    blobs: ["#F4EFE6", "#F4EFE6", "#F4EFE6"],
    text: "#23201C",
    textDim: "rgba(35,32,28,0.60)",
    accent: "#E4572E",
    accentSoft: "rgba(228,87,46,0.12)",
    surface: "#FDFBF7",
    surfaceBorder: "rgba(35,32,28,0.55)",
    danger: "#C0392B",
    good: "#1E8E5A",
    isDark: false,
    flat: true,
  },
  /** gần đen + đỏ báo chí — chuẩn "AI News dark evidence" */
  noir: {
    bgBase: "#0C0A0A",
    blobs: ["#2a0d0d", "#1a1212", "#120a18"],
    text: "#F5F2F2",
    textDim: "rgba(245,242,242,0.60)",
    accent: "#E5484D",
    accentSoft: "rgba(229,72,77,0.16)",
    surface: "rgba(255,255,255,0.05)",
    surfaceBorder: "rgba(255,255,255,0.14)",
    danger: "#E5484D",
    good: "#46C68F",
    isDark: true,
    flat: false,
  },
};

export const resolveTheme = (
  preset: StylePreset,
  accentOverride?: string
): Theme => {
  const t = THEMES[preset];
  if (!accentOverride) return t;
  return {
    ...t,
    accent: accentOverride,
    accentSoft: hexToRgba(accentOverride, t.flat ? 0.12 : 0.16),
  };
};

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

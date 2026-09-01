import { fitText, measureText } from "@remotion/layout-utils";
import { FONT } from "../style/fonts";

/**
 * Tự co cỡ chữ để KHÔNG bao giờ tràn/cắt — nền tảng chất lượng vô hình:
 * headline tiếng Việt dài tới đâu cũng vừa khung, ngắn thì giữ cỡ thiết kế.
 * Đo bằng @remotion/layout-utils (đo thật trong trình duyệt render). Lỗi đo
 * (font chưa kịp nạp) → trả cỡ tối đa (an toàn, không chặn render).
 */

type FitOpts = {
  max: number;
  min?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  letterSpacing?: string;
};

/** Cỡ chữ 1 DÒNG vừa bề rộng cho phép (dùng cho cụm từ lớn, nhãn, số liệu). */
export const fitOneLine = (
  text: string,
  maxWidth: number,
  opts: FitOpts
): number => {
  const {
    max,
    min = Math.round(max * 0.45),
    fontFamily = FONT,
    fontWeight = 800,
    letterSpacing = "-0.02em",
  } = opts;
  try {
    const { fontSize } = fitText({
      text,
      withinWidth: maxWidth,
      fontFamily,
      fontWeight,
      letterSpacing,
    });
    return Math.max(min, Math.min(max, Math.floor(fontSize)));
  } catch {
    return max;
  }
};

/**
 * Cỡ chữ headline NHIỀU DÒNG: giữ cỡ max nếu gói gọn trong maxLines dòng,
 * dài hơn thì co theo tỉ lệ (bề rộng chữ ∝ cỡ chữ) để lấp vừa maxLines dòng.
 */
export const fitBox = (
  text: string,
  maxWidth: number,
  maxLines: number,
  opts: FitOpts
): number => {
  const {
    max,
    min = Math.round(max * 0.5),
    fontFamily = FONT,
    fontWeight = 800,
    letterSpacing = "-0.02em",
  } = opts;
  try {
    const { width } = measureText({
      text,
      fontFamily,
      fontWeight,
      fontSize: max,
      letterSpacing,
    });
    if (width <= 0) return max;
    const fitted = (max * (maxLines * maxWidth)) / width;
    return Math.max(min, Math.min(max, Math.floor(fitted)));
  } catch {
    return max;
  }
};

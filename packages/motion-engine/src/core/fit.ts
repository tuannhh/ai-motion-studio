import { fitText, measureText } from "@remotion/layout-utils";
import { FONT } from "../style/fonts";
import { wordsIn } from "./viText";

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

/** Đo bề rộng 1 từ ở cỡ chữ `max` (dùng để cân dòng theo bề rộng thật ở viText.ts
 * và để tính fitLines bên dưới — cùng 1 cỡ tham chiếu nên tỉ lệ nhất quán). */
export const wordWidthAt = (word: string, fontSize: number, opts: FitOpts): number => {
  const { fontFamily = FONT, fontWeight = 800, letterSpacing = "-0.02em" } = opts;
  try {
    return measureText({ text: word, fontFamily, fontWeight, fontSize, letterSpacing }).width;
  } catch {
    return word.length * fontSize * 0.6; // ước lượng thô nếu đo lỗi (font chưa nạp)
  }
};

/**
 * Cỡ chữ cho headline ĐÃ CHIA DÒNG SẴN (`lines`, vd từ smartLines): đo bề rộng
 * thật của TỪNG dòng ở cỡ `max` (tổng bề rộng từ + khoảng cách flex `gap` giữa
 * các từ, khớp đúng cách KineticText render) rồi co theo dòng RỘNG NHẤT — đảm
 * bảo dòng nào cũng vừa `maxWidth`, không như fitBox (đo trung bình cả câu gộp,
 * có thể để lọt 1 dòng cụ thể tràn khung dù trung bình vẫn "vừa").
 */
export const fitLines = (lines: string[], maxWidth: number, opts: FitOpts): number => {
  const {
    max,
    min = Math.round(max * 0.5),
    fontFamily = FONT,
    fontWeight = 800,
    letterSpacing = "-0.02em",
  } = opts;
  try {
    const gap = max * 0.24; // khớp `gap: size * 0.24` giữa các <span> từ trong KineticText
    let widest = 0;
    for (const line of lines) {
      const words = wordsIn(line);
      if (words.length === 0) continue;
      const total =
        words.reduce((sum, w) => sum + wordWidthAt(w, max, { max, fontFamily, fontWeight, letterSpacing }), 0) +
        gap * (words.length - 1);
      widest = Math.max(widest, total);
    }
    if (widest <= 0) return max;
    const fitted = (max * maxWidth) / widest;
    return Math.max(min, Math.min(max, Math.floor(fitted)));
  } catch {
    return max;
  }
};

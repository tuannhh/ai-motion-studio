/**
 * Ngắt dòng headline tiếng Việt theo ngữ nghĩa (kế thừa ý tưởng headline-layout.ts
 * của ai-video-studio, nâng cấp thành auto-balancer): chia 1-3 dòng cân đối,
 * không để dòng kết thúc bằng từ nối, không mồ côi 1 từ.
 */

const TRAILING_CONNECTORS = new Set([
  "của", "và", "hay", "hoặc", "là", "với", "cho", "để", "từ", "trong", "về",
  "theo", "một", "các", "những", "khi", "nếu", "mà", "bằng", "trên", "dưới",
]);

export const wordsIn = (value: string): string[] =>
  value.trim().split(/\s+/).filter(Boolean);

/** Đo "độ dài" 1 từ để cân dòng — mặc định đếm ký tự; truyền measureWord (đo
 * bề rộng pixel thật, vd từ fit.ts) để cân theo bề rộng thật, chính xác hơn vì
 * chữ tiếng Việt có dấu và các ký tự (i, m, w...) rộng hẹp khác nhau rõ rệt. */
type Measure = (word: string) => number;
const charLen: Measure = (w) => w.length;
const lineLen = (words: string[], measure: Measure) =>
  words.reduce((sum, w) => sum + measure(w), 0) + (words.length - 1) * measure(" ");

/**
 * Chia words thành n dòng CÂN ĐỐI THEO BỀ RỘNG (measure) — mỗi dòng xấp xỉ nhau
 * về bề rộng nên không lòi 1 dòng quá dài khiến engine tự xuống dòng lung tung
 * (mồ côi "con", "sự"...). Tôn trọng quy tắc không kết dòng bằng từ nối.
 */
const splitBalanced = (words: string[], lines: number, measure: Measure): string[][] => {
  if (lines <= 1) return [words];
  const target = lineLen(words, measure) / lines; // bề rộng mục tiêu mỗi dòng
  const result: string[][] = [];
  let rest = [...words];
  for (let ln = 0; ln < lines - 1; ln++) {
    const linesLeft = lines - ln;
    const maxTake = rest.length - (linesLeft - 1); // chừa ≥1 từ cho mỗi dòng sau
    let take = 1;
    let len = measure(rest[0]);
    // gộp thêm từ khi còn khiến dòng GẦN target hơn (greedy tối thiểu độ lệch)
    while (take < maxTake) {
      const nextLen = len + measure(" ") + measure(rest[take]);
      if (Math.abs(nextLen - target) >= Math.abs(len - target)) break;
      len = nextLen;
      take += 1;
    }
    // lùi điểm cắt nếu kết dòng bằng từ nối (tối đa lùi 2 từ, vẫn giữ ≥1 từ)
    let guard = 0;
    while (
      take > 1 &&
      guard < 2 &&
      TRAILING_CONNECTORS.has(rest[take - 1].toLocaleLowerCase("vi-VN"))
    ) {
      take -= 1;
      guard += 1;
    }
    result.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  result.push(rest);
  return result;
};

/**
 * Trả về headline đã chia dòng. Ưu tiên: người dùng tự đánh dấu bằng "\n";
 * nếu không, tự chia theo độ dài (≤ maxChars/dòng, ước lượng SỐ dòng cần) và cân
 * đối theo bề rộng thật (measureWord, nếu có) — tối đa maxLines dòng.
 */
export const smartLines = (
  text: string,
  maxChars = 20,
  maxLines = 3,
  measureWord?: Measure
): string[] => {
  if (text.includes("\n")) {
    return text.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  const words = wordsIn(text);
  if (words.length <= 1) return [words.join(" ")];
  // Số dòng ước lượng vẫn theo đếm ký tự (chỉ cần thô để chọn 1/2/3 dòng);
  // ĐIỂM CẮT giữa các dòng mới cần chính xác nên dùng measure thật ở splitBalanced.
  const total = lineLen(words, charLen);
  const lines = Math.min(maxLines, words.length, Math.max(1, Math.ceil(total / maxChars)));
  const split = splitBalanced(words, lines, measureWord ?? charLen);
  // chống mồ côi: dòng cuối chỉ 1 từ mà có ≥2 dòng → nhập từ của dòng trước xuống
  const last = split[split.length - 1];
  if (split.length > 1 && last.length === 1) {
    const prev = split[split.length - 2];
    if (prev.length > 2) {
      last.unshift(prev.pop() as string);
    }
  }
  return split.map((l) => l.join(" ")).filter(Boolean);
};

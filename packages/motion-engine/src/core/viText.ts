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

const lineLen = (words: string[]) => words.join(" ").length;

/** Chia words thành n dòng cân đối, tôn trọng quy tắc từ nối */
const splitBalanced = (words: string[], lines: number): string[][] => {
  if (lines === 1) return [words];
  const target = Math.ceil(words.length / lines);
  const result: string[][] = [];
  let rest = [...words];
  for (let i = 0; i < lines - 1; i++) {
    let cut = Math.min(target, rest.length - (lines - 1 - i));
    // lùi điểm cắt nếu kết dòng bằng từ nối (tối đa lùi 2 từ)
    let guard = 0;
    while (
      cut > 1 &&
      guard < 2 &&
      TRAILING_CONNECTORS.has(rest[cut - 1].toLocaleLowerCase("vi-VN"))
    ) {
      cut -= 1;
      guard += 1;
    }
    result.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  result.push(rest);
  return result;
};

/**
 * Trả về headline đã chia dòng. Ưu tiên: người dùng tự đánh dấu bằng "\n";
 * nếu không, tự chia theo độ dài (≤ maxChars/dòng) và cân đối.
 */
export const smartLines = (text: string, maxChars = 20): string[] => {
  if (text.includes("\n")) {
    return text.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  const words = wordsIn(text);
  const total = lineLen(words);
  const lines = Math.min(3, Math.max(1, Math.ceil(total / maxChars)));
  let split = splitBalanced(words, lines);
  // chống mồ côi: dòng cuối chỉ 1 từ mà có ≥2 dòng → nhập từ của dòng trước xuống
  const last = split[split.length - 1];
  if (split.length > 1 && last.length === 1) {
    const prev = split[split.length - 2];
    if (prev.length > 2) {
      last.unshift(prev.pop() as string);
    }
  }
  return split.map((l) => l.join(" "));
};

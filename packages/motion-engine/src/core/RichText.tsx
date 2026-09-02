import React from "react";

/**
 * Cú pháp nhấn từ khoá trong chữ trên hình (headline/title do AI viết):
 * **từ** → tô accent + gạch chân; ~~từ~~ → giảm nhấn (mờ). Markup lẻ (dấu không
 * khép cặp) tự strip ký hiệu, hiện chữ thường — không bao giờ để lộ ký hiệu vỡ hình.
 *
 * (P6 VOX từng có biến thể "marker" — dải bút dạ phủ nửa dưới chữ — nhưng phản hồi
 * thiết kế thực tế 2026-09-02 cho là tương phản yếu (~3:1, dưới ngưỡng đọc rõ) và rối
 * mắt. Đã bỏ, quay về accent màu + gạch chân cho MỌI flavor — tương phản cao hơn hẳn
 * (accent trên nền theme, không phải trên chính accent).
 */

type EmphasisParse = { text: string; accentWords: string[]; dimWords: string[] };

const ACCENT_RE = /\*\*(.+?)\*\*/g;
const DIM_RE = /~~(.+?)~~/g;

/** Tách markup khỏi chữ, trả chữ sạch + danh sách từ accent/dim (chữ thường, để so khớp) */
export const parseEmphasisMarkup = (raw: string): EmphasisParse => {
  const accentWords: string[] = [];
  const dimWords: string[] = [];
  let text = raw.replace(ACCENT_RE, (_match, inner: string) => {
    accentWords.push(...inner.trim().toLocaleLowerCase("vi-VN").split(/\s+/).filter(Boolean));
    return inner;
  });
  text = text.replace(DIM_RE, (_match, inner: string) => {
    dimWords.push(...inner.trim().toLocaleLowerCase("vi-VN").split(/\s+/).filter(Boolean));
    return inner;
  });
  // Ký hiệu lẻ còn sót (không khép cặp) → strip, không để lộ "**"/"~~" trên hình
  text = text.replace(/\*\*/g, "").replace(/~~/g, "");
  return { text, accentWords, dimWords };
};

/** Chữ sạch không markup — dùng để đo fitBox/fitOneLine (không tính ký hiệu vào bề rộng) */
export const stripMarkup = (raw: string): string => parseEmphasisMarkup(raw).text;

type Token = { text: string; kind: "plain" | "accent" | "dim" };

const tokenize = (raw: string): Token[] => {
  const tokens: Token[] = [];
  const re = /\*\*(.+?)\*\*|~~(.+?)~~/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    if (m.index > last) tokens.push({ text: raw.slice(last, m.index), kind: "plain" });
    if (m[1] !== undefined) tokens.push({ text: m[1], kind: "accent" });
    else if (m[2] !== undefined) tokens.push({ text: m[2], kind: "dim" });
    last = re.lastIndex;
  }
  if (last < raw.length) tokens.push({ text: raw.slice(last), kind: "plain" });
  // Ký hiệu lẻ còn sót trong phần "plain" → strip cho an toàn
  return tokens.map((t) => (t.kind === "plain" ? { ...t, text: t.text.replace(/\*\*/g, "").replace(/~~/g, "") } : t));
};

/**
 * Render chữ có markup accent/dim thành span tô màu/gạch chân. Không có markup →
 * trả JSX y hệt chữ thường (không đổi hành vi các scene chưa dùng cú pháp).
 */
export const RichText: React.FC<{
  text: string;
  accent: string;
  underline?: boolean;
}> = ({ text, accent, underline = true }) => {
  const tokens = tokenize(text);
  if (tokens.length === 1 && tokens[0].kind === "plain") return <>{tokens[0].text}</>;
  return (
    <>
      {tokens.map((t, i) => {
        if (t.kind === "accent") {
          return (
            <span
              key={i}
              style={{
                color: accent,
                textDecorationLine: underline ? "underline" : "none",
                textDecorationColor: accent,
                textDecorationThickness: 4,
                textUnderlineOffset: 8,
              }}
            >
              {t.text}
            </span>
          );
        }
        if (t.kind === "dim") {
          return (
            <span key={i} style={{ opacity: 0.55 }}>
              {t.text}
            </span>
          );
        }
        return <React.Fragment key={i}>{t.text}</React.Fragment>;
      })}
    </>
  );
};

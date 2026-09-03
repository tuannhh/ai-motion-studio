import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { terminalSceneSchema } from "../schema/spec";
import { accentOn, Theme } from "../style/presets";
import { FONT_MONO } from "../style/fonts";
import { riseIn } from "../core/motion";
import { SafeArea } from "../core/ui";

/**
 * Cửa sổ terminal giả lập: mac chrome + dòng lệnh gõ dần (typewriter),
 * output hiện theo sau, dòng highlight tô accent. Nhịp: mỗi dòng cmd gõ
 * ~2 ký tự/frame, dòng out/comment hiện sau dòng trước 6 frame.
 */
export const TerminalScene: React.FC<{
  scene: z.infer<typeof terminalSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // frame bắt đầu của từng dòng: cmd chiếm text.length/2 frame gõ, dòng khác 6 frame
  const starts: number[] = [];
  let cursor = Math.round(fps * 0.4);
  for (const line of scene.lines) {
    starts.push(cursor);
    cursor += line.kind === "cmd" ? Math.ceil(line.text.length / 2) + 10 : 6;
  }

  const windowBg = theme.isDark ? "rgba(10,14,24,0.92)" : "#1C1A17";
  const chromeBg = theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)";
  const bodyText = "#E8ECF4";
  const dimText = "rgba(232,236,244,0.5)";
  // Cửa sổ terminal LUÔN nền tối (chuẩn terminal thật, không đổi theo preset) — accent
  // dùng làm chữ ở đây phải tương phản với nền TỐI đó, không phải theme.bgBase (khác
  // hẳn ở preset "paper" nền sáng, nếu dùng theme.accentText sẽ bị tối màu SAI hướng).
  const terminalAccent = accentOn(theme.isDark ? "#0A0E18" : "#1C1A17", theme.accent);

  // con trỏ nhấp nháy đặt ở dòng cmd đang gõ (hoặc dòng cmd cuối đã xong)
  let activeIdx = -1;
  for (let i = 0; i < starts.length; i++) if (frame >= starts[i]) activeIdx = i;

  return (
    <SafeArea>
      <div
        style={{
          width: 920,
          borderRadius: 22,
          overflow: "hidden",
          background: windowBg,
          border: `1.5px solid ${theme.isDark ? theme.surfaceBorder : "rgba(35,32,28,0.7)"}`,
          boxShadow: theme.flat ? "none" : "0 30px 80px rgba(0,0,0,0.45)",
          ...riseIn({ frame, fps, delay: 0 }),
        }}
      >
        {/* thanh chrome mac */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 26px",
            background: chromeBg,
          }}
        >
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
          ))}
          {scene.title ? (
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 26,
                color: dimText,
                marginLeft: 16,
              }}
            >
              {scene.title}
            </span>
          ) : null}
        </div>

        {/* thân terminal */}
        <div style={{ padding: "34px 40px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          {scene.lines.map((line, i) => {
            const local = frame - starts[i];
            if (local < 0) return <div key={i} style={{ height: 40 }} />;
            const typed =
              line.kind === "cmd"
                ? line.text.slice(0, Math.max(0, Math.floor(local * 2)))
                : line.text;
            const isTyping = line.kind === "cmd" && typed.length < line.text.length;
            const showCursor =
              line.kind === "cmd" &&
              (isTyping || (i === activeIdx && Math.floor(frame / 16) % 2 === 0));
            const color = line.highlight
              ? terminalAccent
              : line.kind === "cmd"
                ? bodyText
                : line.kind === "comment"
                  ? dimText
                  : "rgba(232,236,244,0.78)";
            return (
              <div
                key={i}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 34,
                  lineHeight: 1.2,
                  color,
                  display: "flex",
                  gap: 18,
                  opacity: line.kind === "cmd" ? 1 : Math.min(1, local / 8),
                }}
              >
                {line.kind === "cmd" ? (
                  <span style={{ color: terminalAccent, fontWeight: 700 }}>$</span>
                ) : null}
                <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "normal" }}>
                  {line.kind === "comment" ? `# ${typed}` : typed}
                  {showCursor ? (
                    <span
                      style={{
                        display: "inline-block",
                        width: 18,
                        height: 34,
                        marginLeft: 4,
                        verticalAlign: "-4px",
                        background: terminalAccent,
                      }}
                    />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SafeArea>
  );
};

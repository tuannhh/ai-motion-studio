import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { pointsSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import {
  entrance,
  enterSpring,
  popIn,
  revealStyleOf,
  pickBySeed,
  spreadDelays,
} from "../core/motion";
import { Glass, IconChip, SafeArea, SceneHeader } from "../core/ui";

/**
 * Điểm chính — KHÔNG cố định một kiểu ô chữ nhật xếp dọc. Bố cục + kiểu xuất hiện
 * chọn theo seed(scene.id) để mỗi scene một dáng khác:
 *  - "cards": thẻ Glass có icon (dày dặn, hợp preset tối).
 *  - "bignum": số thứ tự CỠ LỚN kiểu editorial + gạch phân cách mảnh, không ô
 *    (thoáng, hợp preset paper/ainius) — phá thế "toàn hộp chữ nhật".
 * Kiểu xuất hiện (trượt trái/phải, pop, clip, zoom-blur) cũng đổi theo scene.
 */
export const PointsScene: React.FC<{
  scene: z.infer<typeof pointsSceneSchema>;
  theme: Theme;
  sceneFrames?: number;
}> = ({ scene, theme, sceneFrames = 150 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delays = spreadDelays(scene.items.length, sceneFrames);
  const style = revealStyleOf(scene.id);
  // preset phẳng (paper) nghiêng về editorial; còn lại nghiêng về thẻ — vẫn để seed quyết định
  const layout = pickBySeed(`${scene.id}-layout`, theme.flat
    ? (["bignum", "bignum", "cards"] as const)
    : (["cards", "cards", "bignum"] as const));

  return (
    <SafeArea>
      <SceneHeader
        theme={theme}
        kicker={scene.title ? "Điểm chính" : undefined}
        title={scene.title}
        sub={scene.sub}
      />

      {layout === "bignum" ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {scene.items.map((item, i) => {
            const p = enterSpring({ frame, fps, delay: delays[i] });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 34,
                  padding: "26px 6px",
                  borderTop: i === 0 ? "none" : `2px solid ${theme.surfaceBorder}`,
                  ...entrance(style, p),
                }}
              >
                <span
                  style={{
                    ...type.mono,
                    fontSize: 112,
                    lineHeight: 0.9,
                    fontWeight: 800,
                    color: theme.accent,
                    minWidth: 150,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    ...type.title,
                    fontWeight: 700,
                    fontSize: 48,
                    color: theme.text,
                    flex: 1,
                    alignSelf: "center",
                  }}
                >
                  {item.text}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          {scene.items.map((item, i) => {
            const p = enterSpring({ frame, fps, delay: delays[i] });
            return (
              <Glass
                key={i}
                theme={theme}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 36,
                  padding: "34px 40px",
                  ...entrance(style, p),
                }}
              >
                <div style={popIn({ frame, fps, delay: delays[i] + 5 })}>
                  <IconChip name={item.icon} theme={theme} size={104} />
                </div>
                <span
                  style={{
                    ...type.body,
                    fontWeight: 600,
                    fontSize: 44,
                    color: theme.text,
                  }}
                >
                  {item.text}
                </span>
              </Glass>
            );
          })}
        </div>
      )}
    </SafeArea>
  );
};

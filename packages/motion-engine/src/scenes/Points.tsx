import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { pointsSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import {
  drawProgress,
  entrance,
  enterSpring,
  popIn,
  popSpring,
  revealStyleOf,
  pickBySeed,
  spreadDelays,
} from "../core/motion";
import { Glass, Icon, IconChip, SafeArea, SceneHeader } from "../core/ui";

/**
 * Điểm chính — KHÔNG cố định một kiểu ô chữ nhật xếp dọc. Bố cục + kiểu xuất hiện
 * chọn theo seed(scene.id) để mỗi scene một dáng khác (7 dáng):
 *  - "cards": thẻ Glass có icon (dày dặn, hợp preset tối).
 *  - "bignum": số thứ tự CỠ LỚN kiểu editorial + gạch phân cách mảnh, không ô.
 *  - "grid": lưới 2 cột — nén nội dung, hợp 3-5 mục ngắn.
 *  - "checklist": tick tròn nảy vào từng dòng, không ô — cảm giác "làm được".
 *  - "zigzag": thẻ so le trái/phải quanh 1 trục dọc giữa, có mốc nối.
 *  - "numbered-rail": ray dọc bên trái + mốc tròn đánh số.
 * scene.layout (mặc định "auto") có thể ép 1 dáng cụ thể — chỉ dùng để chỉnh
 * tay/debug, AI KHÔNG được dạy trường này (thẩm mỹ thuộc về engine).
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
  const AUTO_LAYOUTS = theme.flat
    ? (["bignum", "bignum", "cards", "checklist", "zigzag", "numbered-rail", "grid"] as const)
    : (["cards", "cards", "bignum", "checklist", "zigzag", "numbered-rail", "grid"] as const);
  const layout =
    scene.layout !== "auto" ? scene.layout : pickBySeed(`${scene.id}-layout`, AUTO_LAYOUTS);

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
                    color: theme.accentText,
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
      ) : layout === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {scene.items.map((item, i) => {
            const p = enterSpring({ frame, fps, delay: delays[i] });
            return (
              <Glass
                key={i}
                theme={theme}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 18,
                  padding: "36px 22px",
                  ...entrance(style, p),
                }}
              >
                <div style={popIn({ frame, fps, delay: delays[i] + 5 })}>
                  <IconChip name={item.icon} theme={theme} size={84} />
                </div>
                <span style={{ ...type.body, fontWeight: 600, fontSize: 32, color: theme.text }}>
                  {item.text}
                </span>
              </Glass>
            );
          })}
        </div>
      ) : layout === "checklist" ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {scene.items.map((item, i) => {
            const p = enterSpring({ frame, fps, delay: delays[i] });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 30,
                  padding: "22px 4px",
                  borderTop: i === 0 ? "none" : `2px solid ${theme.surfaceBorder}`,
                  ...entrance(style, p),
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: `3px solid ${theme.good}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    ...popIn({ frame, fps, delay: delays[i] + 6 }),
                  }}
                >
                  <Icon name="Check" size={34} color={theme.good} strokeWidth={3.5} />
                </div>
                <span style={{ ...type.body, fontWeight: 600, fontSize: 44, color: theme.text }}>
                  {item.text}
                </span>
              </div>
            );
          })}
        </div>
      ) : layout === "zigzag" ? (
        <div style={{ position: "relative" }}>
          {/* trục dọc giữa — các thẻ so le quanh trục này */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 6,
              bottom: 6,
              width: 5,
              borderRadius: 3,
              background: `linear-gradient(${theme.accent}, ${theme.accent}22)`,
              transform: `translateX(-50%) scaleY(${drawProgress({ frame, fps, delay: 6 })})`,
              transformOrigin: "top",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {scene.items.map((item, i) => {
              const isLeft = i % 2 === 0;
              const p = enterSpring({ frame, fps, delay: delays[i] });
              const dot = popSpring({ frame, fps, delay: delays[i] + 8 });
              return (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    display: "flex",
                    justifyContent: isLeft ? "flex-start" : "flex-end",
                  }}
                >
                  {/* mốc nối trên trục — pop tại đúng tâm dọc của thẻ */}
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: theme.accentText,
                      boxShadow: theme.flat ? undefined : `0 0 20px ${theme.accent}99`,
                      transform: `translate(-50%, -50%) scale(${Math.min(1, dot * 1.3)})`,
                      opacity: Math.min(1, dot * 2),
                    }}
                  />
                  <Glass
                    theme={theme}
                    style={{
                      width: "58%",
                      display: "flex",
                      alignItems: "center",
                      gap: 24,
                      padding: "26px 28px",
                      ...entrance(style, p),
                    }}
                  >
                    <IconChip name={item.icon} theme={theme} size={78} />
                    <span
                      style={{ ...type.body, fontWeight: 600, fontSize: 34, color: theme.text }}
                    >
                      {item.text}
                    </span>
                  </Glass>
                </div>
              );
            })}
          </div>
        </div>
      ) : layout === "numbered-rail" ? (
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 30,
              top: 10,
              bottom: 10,
              width: 5,
              borderRadius: 3,
              background: `linear-gradient(${theme.accent}, ${theme.accent}22)`,
              transform: `translateX(-50%) scaleY(${drawProgress({ frame, fps, delay: 8 })})`,
              transformOrigin: "top",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {scene.items.map((item, i) => {
              const p = enterSpring({ frame, fps, delay: delays[i] });
              const dot = popSpring({ frame, fps, delay: delays[i] - 2 });
              return (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 28, ...entrance(style, p) }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: theme.bgBase,
                      border: `4px solid ${theme.accentText}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: `scale(${Math.min(1, dot)})`,
                    }}
                  >
                    <span style={{ ...type.mono, fontSize: 24, fontWeight: 700, color: theme.text }}>
                      {i + 1}
                    </span>
                  </div>
                  <span
                    style={{ ...type.body, fontWeight: 600, fontSize: 44, color: theme.text, flex: 1 }}
                  >
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
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

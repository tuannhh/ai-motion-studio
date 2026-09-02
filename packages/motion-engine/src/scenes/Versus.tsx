import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { versusSceneSchema } from "../schema/spec";
import { bestTextOn, Theme } from "../style/presets";
import { type } from "../style/fonts";
import { enterSpring, popSpring } from "../core/motion";
import { Glass, Icon, SafeArea, SceneHeader } from "../core/ui";

/**
 * Đối đầu 2 phía kiểu "so găng": mỗi bên 1 giá trị/cụm chốt duy nhất, huy hiệu VS
 * tròn ở giữa đè lên đường nối 2 thẻ. Khác "compare" (bảng ưu/nhược nhiều điểm) —
 * versus là 1 cú đấm ngắn, dùng cho đối lập rõ 1 con số/câu mỗi bên.
 */
export const VersusScene: React.FC<{
  scene: z.infer<typeof versusSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const badgeP = popSpring({ frame, fps, delay: 14 });

  const column = (
    side: "left" | "right",
    data: { label: string; value: string; detail?: string; icon?: string }
  ) => {
    const isLeft = side === "left";
    const delay = isLeft ? 6 : 12;
    const p = enterSpring({ frame, fps, delay });
    return (
      <Glass
        theme={theme}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "52px 26px",
          gap: 20,
          opacity: p,
          transform: `translateX(${(1 - p) * (isLeft ? -90 : 90)}px)`,
        }}
      >
        {data.icon ? <Icon name={data.icon} size={56} color={theme.textDim} /> : null}
        <span
          style={{
            ...type.label,
            fontSize: 28,
            color: theme.textDim,
          }}
        >
          {data.label}
        </span>
        <span
          style={{
            ...type.headline,
            fontSize: 64,
            lineHeight: 1.1,
            color: theme.text,
          }}
        >
          {data.value}
        </span>
        {data.detail ? (
          <span style={{ ...type.body, fontSize: 29, lineHeight: 1.4, color: theme.textDim }}>
            {data.detail}
          </span>
        ) : null}
      </Glass>
    );
  };

  return (
    <SafeArea>
      <SceneHeader theme={theme} kicker={scene.title ? "Đối đầu" : undefined} title={scene.title} size={60} />
      <div style={{ position: "relative", display: "flex", gap: 20, alignItems: "stretch" }}>
        {column("left", scene.left)}
        {column("right", scene.right)}
        {/* Huy hiệu VS đè lên đường nối giữa 2 thẻ */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 128,
            height: 128,
            borderRadius: "50%",
            background: theme.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: theme.flat ? "0 4px 0 rgba(35,32,28,0.25)" : `0 0 60px ${theme.accent}88`,
            border: theme.flat ? `3px solid ${theme.surfaceBorder}` : "none",
            transform: `translate(-50%, -50%) scale(${Math.min(1, badgeP * 1.15)})`,
          }}
        >
          <span
            style={{
              ...type.headline,
              fontSize: 40,
              // Tương phản tính thật theo luminance của accent, không suy đoán qua
              // preset — huy hiệu là nền ĐẶC 1 màu nên cần chọn đúng chữ đen/trắng.
              color: bestTextOn(theme.accent),
            }}
          >
            VS
          </span>
        </div>
      </div>
    </SafeArea>
  );
};

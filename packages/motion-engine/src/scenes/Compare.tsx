import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { compareSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { STAGGER, enterSpring, popIn } from "../core/motion";
import { Glass, Icon, SafeArea, SceneHeader } from "../core/ui";

/** So sánh 2 cột: trái (cũ/nhược) đỏ nhạt, phải (mới/ưu) xanh — trượt vào từ 2 phía */
export const CompareScene: React.FC<{
  scene: z.infer<typeof compareSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const column = (
    side: "left" | "right",
    data: { label: string; points: string[] }
  ) => {
    const isLeft = side === "left";
    const color = isLeft ? theme.danger : theme.good;
    const iconName = isLeft ? "X" : "Check";
    const baseDelay = isLeft ? 10 : 16;
    const p = enterSpring({ frame, fps, delay: baseDelay });
    return (
      <Glass
        theme={theme}
        style={{
          flex: 1,
          padding: "36px 32px",
          borderTop: `6px solid ${color}`,
          opacity: p,
          transform: `translateX(${(1 - p) * (isLeft ? -80 : 80)}px)`,
        }}
      >
        <div
          style={{
            ...type.title,
            fontSize: 40,
            color,
            marginBottom: 28,
            textAlign: "center",
          }}
        >
          {data.label}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {data.points.map((pt, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                ...popIn({ frame, fps, delay: baseDelay + 12 + i * STAGGER }),
              }}
            >
              <div style={{ marginTop: 6, flexShrink: 0 }}>
                <Icon name={iconName} size={34} color={color} strokeWidth={3.5} />
              </div>
              <span style={{ ...type.body, fontSize: 34, color: theme.text }}>
                {pt}
              </span>
            </div>
          ))}
        </div>
      </Glass>
    );
  };

  return (
    <SafeArea>
      <SceneHeader
        theme={theme}
        kicker={scene.title ? "So sánh" : undefined}
        title={scene.title}
        sub={scene.sub}
        size={60}
      />
      <div style={{ display: "flex", gap: 28, alignItems: "stretch" }}>
        {column("left", scene.left)}
        {column("right", scene.right)}
      </div>
    </SafeArea>
  );
};

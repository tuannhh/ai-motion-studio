import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { flowSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { drawProgress, enterSpring, entrance, popIn, revealStyleOf, spreadDelays } from "../core/motion";
import { Glass, IconChip, SafeArea, SceneHeader } from "../core/ui";

/**
 * Diagram luồng dọc: node hiện tuần tự, connector trực giao vẽ dần,
 * có hạt sáng chạy dọc đường nối. Node emphasis được viền accent + glow.
 * v1 render theo thứ tự mảng nodes (chuỗi dọc) — nhãn edge lấy từ cặp kề nhau.
 */
export const FlowScene: React.FC<{
  scene: z.infer<typeof flowSceneSchema>;
  theme: Theme;
  sceneFrames?: number;
}> = ({ scene, theme, sceneFrames = 180 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Node hiện dần theo nhịp đọc; bước giữa node dùng cho cả delay connector
  const delays = spreadDelays(scene.nodes.length, sceneFrames);
  const stepStagger = delays.length > 1 ? delays[1] - delays[0] : 18;
  // Kiểu xuất hiện đổi theo scene (không phải video nào cũng trượt y hệt)
  const style = revealStyleOf(scene.id);
  const edgeLabel = (fromIdx: number) => {
    const from = scene.nodes[fromIdx]?.id;
    const to = scene.nodes[fromIdx + 1]?.id;
    return scene.edges.find((e) => e.from === from && e.to === to)?.label;
  };

  const n = scene.nodes.length;
  const nodePad = n >= 5 ? 20 : 28;
  const iconSize = n >= 5 ? 76 : 92;
  const fontSize = n >= 5 ? 38 : 42;
  const connH = n >= 5 ? 54 : 76;

  return (
    <SafeArea>
      <SceneHeader
        theme={theme}
        kicker={scene.title ? "Cách hoạt động" : undefined}
        title={scene.title}
        sub={scene.sub}
        size={62}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
        {scene.nodes.map((node, i) => {
          const delay = delays[i];
          const p = enterSpring({ frame, fps, delay });
          const connDelay = delay + stepStagger * 0.55;
          const connP = drawProgress({ frame, fps, delay: connDelay });
          const pulseY = interpolate(
            (frame - connDelay - 10 + i * 13) % 46,
            [0, 46],
            [0, 1],
            { extrapolateLeft: "clamp" }
          );
          const label = edgeLabel(i);

          return (
            <React.Fragment key={node.id}>
              <Glass
                theme={theme}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 32,
                  padding: `${nodePad}px 36px`,
                  ...entrance(style, p),
                  ...(node.emphasis
                    ? {
                        border: `2.5px solid ${theme.accent}`,
                        boxShadow: `0 0 60px ${theme.accentSoft}, 0 24px 60px rgba(0,0,0,0.3)`,
                        background: theme.accentSoft,
                      }
                    : {}),
                }}
              >
                <div style={popIn({ frame, fps, delay: delay + 4 })}>
                  <IconChip name={node.icon} theme={theme} size={iconSize} />
                </div>
                <span
                  style={{
                    ...type.title,
                    fontSize,
                    color: theme.text,
                    flex: 1,
                  }}
                >
                  {node.label}
                </span>
                <span
                  style={{
                    ...type.label,
                    fontSize: 26,
                    color: node.emphasis ? theme.accent : theme.textDim,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </Glass>

              {i < n - 1 ? (
                <div
                  style={{
                    height: connH,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: "78%",
                      borderRadius: 3,
                      background: `linear-gradient(${theme.accent}, ${theme.accent}44)`,
                      transform: `scaleY(${connP})`,
                      transformOrigin: "top",
                    }}
                  />
                  {/* hạt sáng chạy dọc connector */}
                  {connP > 0.9 ? (
                    <div
                      style={{
                        position: "absolute",
                        top: `${8 + pulseY * 70}%`,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: theme.accent,
                        boxShadow: `0 0 18px ${theme.accent}`,
                        opacity: 0.9,
                      }}
                    />
                  ) : null}
                  {label ? (
                    <span
                      style={{
                        ...type.label,
                        position: "absolute",
                        left: "58%",
                        fontSize: 25,
                        color: theme.textDim,
                        background: theme.surface,
                        border: `1.5px solid ${theme.surfaceBorder}`,
                        borderRadius: 999,
                        padding: "8px 22px",
                        opacity: connP,
                      }}
                    >
                      {label}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </SafeArea>
  );
};

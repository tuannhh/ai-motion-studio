import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { rankSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { drawProgress, enterSpring, spreadDelays } from "../core/motion";
import { SafeArea, SceneHeader } from "../core/ui";

const formatValue = (v: number): string =>
  v.toLocaleString("vi-VN", {
    maximumFractionDigits: Number.isInteger(v) ? 0 : 1,
  });

/** Bar ngang xếp hạng (benchmark style AI News): 1-2 dòng highlight accent */
export const RankScene: React.FC<{
  scene: z.infer<typeof rankSceneSchema>;
  theme: Theme;
  sceneFrames?: number;
}> = ({ scene, theme, sceneFrames = 180 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...scene.items.map((i) => i.value), 1);
  const delays = spreadDelays(scene.items.length, sceneFrames);

  return (
    <SafeArea>
      <SceneHeader
        theme={theme}
        kicker="Bảng xếp hạng"
        title={scene.title}
        sub={scene.sub}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {scene.items.map((item, i) => {
          const delay = delays[i];
          const p = enterSpring({ frame, fps, delay });
          const bar = drawProgress({ frame, fps, delay: delay + 6 });
          const color = item.highlight ? theme.accentText : theme.textDim;
          return (
            <div
              key={i}
              style={{ opacity: p, transform: `translateX(${(1 - p) * 60}px)` }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    ...type.body,
                    fontWeight: item.highlight ? 700 : 600,
                    fontSize: 40,
                    color: item.highlight ? theme.text : theme.textDim,
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    ...type.mono,
                    fontWeight: 700,
                    fontSize: 40,
                    color,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatValue(item.value * Math.min(1, bar))}
                  {item.unit ?? ""}
                </span>
              </div>
              <div
                style={{
                  height: item.highlight ? 26 : 20,
                  borderRadius: theme.flat ? 6 : 13,
                  background: theme.flat
                    ? "rgba(35,32,28,0.10)"
                    : "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(item.value / max) * 100}%`,
                    borderRadius: theme.flat ? 6 : 13,
                    background: item.highlight
                      ? theme.accentText
                      : theme.flat
                        ? "rgba(35,32,28,0.35)"
                        : "rgba(255,255,255,0.30)",
                    transform: `scaleX(${bar})`,
                    transformOrigin: "left",
                    boxShadow:
                      item.highlight && !theme.flat
                        ? `0 0 26px ${theme.accent}88`
                        : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {scene.source ? (
        <div
          style={{
            ...type.mono,
            fontSize: 22,
            color: theme.textDim,
            marginTop: 32,
            opacity: enterSpring({ frame, fps, delay: 32 }),
          }}
        >
          Nguồn: {scene.source}
        </div>
      ) : null}
    </SafeArea>
  );
};

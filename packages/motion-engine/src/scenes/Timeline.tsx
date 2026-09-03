import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { timelineSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { drawProgress, enterSpring, popSpring, spreadDelays } from "../core/motion";
import { SafeArea, SceneHeader } from "../core/ui";

/** Timeline dọc: trục vẽ dần, mốc tròn pop + card nội dung trượt vào */
export const TimelineScene: React.FC<{
  scene: z.infer<typeof timelineSceneSchema>;
  theme: Theme;
  sceneFrames?: number;
}> = ({ scene, theme, sceneFrames = 180 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delays = spreadDelays(scene.steps.length, sceneFrames);
  const stepStagger = delays.length > 1 ? delays[1] - delays[0] : 18;

  return (
    <SafeArea>
      <SceneHeader
        theme={theme}
        kicker={scene.title ? "Lộ trình" : undefined}
        title={scene.title}
        sub={scene.sub}
        size={62}
      />

      <div style={{ position: "relative", paddingLeft: 76 }}>
        {/* trục dọc */}
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 10,
            bottom: 10,
            width: 5,
            borderRadius: 3,
            background: `linear-gradient(${theme.accent}, ${theme.accent}22)`,
            transform: `scaleY(${drawProgress({ frame, fps, delay: 10 })})`,
            transformOrigin: "top",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 46 }}>
          {scene.steps.map((step, i) => {
            const delay = delays[i];
            const p = enterSpring({ frame, fps, delay });
            const dot = popSpring({ frame, fps, delay: delay - 2 });
            return (
              <div key={i} style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -76 + 24 - 13,
                    top: 16,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: theme.bgBase,
                    border: `5px solid ${theme.accentText}`,
                    boxShadow: `0 0 26px ${theme.accent}88`,
                    transform: `scale(${Math.min(1, dot)})`,
                  }}
                />
                <div
                  style={{
                    opacity: p,
                    transform: `translateX(${(1 - p) * 70}px)`,
                  }}
                >
                  {step.time ? (
                    <div
                      style={{
                        ...type.label,
                        fontSize: 28,
                        color: theme.accentText,
                        marginBottom: 8,
                      }}
                    >
                      {step.time}
                    </div>
                  ) : null}
                  <div style={{ ...type.title, fontSize: 46, color: theme.text }}>
                    {step.label}
                  </div>
                  {step.desc ? (
                    <div
                      style={{
                        ...type.body,
                        fontSize: 36,
                        color: theme.textDim,
                        marginTop: 8,
                      }}
                    >
                      {step.desc}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SafeArea>
  );
};

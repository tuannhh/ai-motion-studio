import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { pointsSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { enterSpring, popIn, spreadDelays } from "../core/motion";
import { Glass, IconChip, SafeArea, SceneHeader } from "../core/ui";

export const PointsScene: React.FC<{
  scene: z.infer<typeof pointsSceneSchema>;
  theme: Theme;
  sceneFrames?: number;
}> = ({ scene, theme, sceneFrames = 150 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delays = spreadDelays(scene.items.length, sceneFrames);

  return (
    <SafeArea>
      <SceneHeader
        theme={theme}
        kicker={scene.title ? "Điểm chính" : undefined}
        title={scene.title}
        sub={scene.sub}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        {scene.items.map((item, i) => {
          const delay = delays[i];
          const p = enterSpring({ frame, fps, delay });
          return (
            <Glass
              key={i}
              theme={theme}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 36,
                padding: "34px 40px",
                opacity: p,
                transform: `translateX(${(1 - p) * 90}px)`,
              }}
            >
              <div style={popIn({ frame, fps, delay: delay + 5 })}>
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
    </SafeArea>
  );
};

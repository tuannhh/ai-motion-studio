import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { quoteSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { popIn, riseIn } from "../core/motion";
import { KineticText } from "../core/KineticText";
import { Icon, SafeArea } from "../core/ui";

export const QuoteScene: React.FC<{
  scene: z.infer<typeof quoteSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <SafeArea>
      <div style={{ marginBottom: 36, ...popIn({ frame, fps, delay: 2 }) }}>
        <Icon name="Quote" size={110} color={theme.accent} strokeWidth={2} />
      </div>
      <KineticText
        text={scene.text}
        color={theme.text}
        fontSize={68}
        fontWeight={700}
        delay={8}
        maxCharsPerLine={22}
      />
      {scene.author ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: 52,
            ...riseIn({ frame, fps, delay: 30 }),
          }}
        >
          <div style={{ width: 64, height: 4, background: theme.accent, borderRadius: 2 }} />
          <span style={{ ...type.body, fontSize: 40, color: theme.textDim }}>
            {scene.author}
          </span>
        </div>
      ) : null}
    </SafeArea>
  );
};

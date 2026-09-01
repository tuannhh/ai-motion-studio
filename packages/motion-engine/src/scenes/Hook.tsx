import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { hookSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { popIn, riseIn } from "../core/motion";
import { KineticText, AccentUnderline } from "../core/KineticText";
import { SafeArea } from "../core/ui";

export const HookScene: React.FC<{
  scene: z.infer<typeof hookSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <SafeArea>
      {scene.badge ? (
        <div style={{ marginBottom: 44 }}>
          <span
            style={{
              ...type.label,
              display: "inline-block",
              fontSize: 30,
              color: theme.accent,
              background: theme.accentSoft,
              border: `2px solid ${theme.accent}`,
              borderRadius: 999,
              padding: "16px 36px",
              ...popIn({ frame, fps, delay: 2 }),
            }}
          >
            {scene.badge}
          </span>
        </div>
      ) : null}

      <KineticText
        text={scene.headline}
        color={theme.text}
        accent={theme.accent}
        fontSize={104}
        delay={8}
        glow={!theme.flat}
        maxCharsPerLine={16}
        maxWidth={912}
        maxLines={4}
      />
      <AccentUnderline color={theme.accent} width={300} delay={26} glow={!theme.flat} />

      {scene.sub ? (
        <p
          style={{
            ...type.sub,
            fontSize: 42,
            color: theme.textDim,
            margin: 0,
            marginTop: 44,
            maxWidth: 820,
            ...riseIn({ frame, fps, delay: 30 }),
          }}
        >
          {scene.sub}
        </p>
      ) : null}
    </SafeArea>
  );
};

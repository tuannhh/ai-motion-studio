import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { outroSceneSchema } from "../schema/spec";
import { bestTextOn, Theme } from "../style/presets";
import { type } from "../style/fonts";
import { popIn, riseIn } from "../core/motion";
import { KineticText, AccentUnderline } from "../core/KineticText";
import { SafeArea } from "../core/ui";

export const OutroScene: React.FC<{
  scene: z.infer<typeof outroSceneSchema>;
  theme: Theme;
  /** Tên kênh lấy từ watermark dạng chữ của video (ưu tiên hơn handle AI tự bịa) */
  channelHandle?: string;
}> = ({ scene, theme, channelHandle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // #3: frame cuối hiện đúng kênh của người dùng (watermark text), KHÔNG để AI bịa handle
  const handle = channelHandle ?? scene.handle;

  return (
    <SafeArea>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <KineticText
          text={scene.headline}
          color={theme.text}
          accent={theme.accent}
          fontSize={88}
          delay={4}
          align="center"
          glow={!theme.flat}
          maxCharsPerLine={16}
          maxWidth={912}
          maxLines={3}
          haloColor={theme.bgBase}
        />
        <AccentUnderline color={theme.accent} width={240} delay={18} glow={!theme.flat} />

        {scene.cta ? (
          <div style={{ marginTop: 64, ...popIn({ frame, fps, delay: 24 }) }}>
            <span
              style={{
                ...type.title,
                display: "inline-block",
                fontSize: 46,
                // Tương phản tính thật theo luminance của accent, không suy đoán qua
                // preset tối/sáng (accent override có thể sáng/tối khác preset).
                color: bestTextOn(theme.accent),
                background: theme.accent,
                borderRadius: 999,
                padding: "28px 64px",
                boxShadow: `0 0 70px ${theme.accent}77`,
              }}
            >
              {scene.cta}
            </span>
          </div>
        ) : null}

        {handle ? (
          <div
            style={{
              ...type.label,
              fontSize: 34,
              color: theme.textDim,
              marginTop: 56,
              ...riseIn({ frame, fps, delay: 34 }),
            }}
          >
            {handle}
          </div>
        ) : null}
      </div>
    </SafeArea>
  );
};

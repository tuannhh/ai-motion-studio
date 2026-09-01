import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { bigwordSceneSchema, sceneDurationInFrames } from "../schema/spec";
import { Theme } from "../style/presets";
import { popSpring } from "../core/motion";
import { KineticText } from "../core/KineticText";
import { SafeArea } from "../core/ui";
import { fitOneLine, fitBox } from "../core/fit";
import { type } from "../style/fonts";

/**
 * Chuỗi từ/cụm đắt giá chiếm trọn màn, hiện lần lượt theo beat đều nhau
 * (nhịp "đặt cược — mọi bước — mỗi lần" của AI News). Cụm accent được
 * đóng khung màu accent như highlight bút dạ.
 */
export const BigWordScene: React.FC<{
  scene: z.infer<typeof bigwordSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = sceneDurationInFrames(scene);
  const beat = total / scene.phrases.length;
  const idx = Math.min(
    scene.phrases.length - 1,
    Math.floor(frame / beat)
  );
  const phrase = scene.phrases[idx];
  const local = frame - idx * beat;
  const p = popSpring({ frame: local, fps, delay: 2 });

  // Tự co để cụm từ lớn KHÔNG tràn: accent là 1 dòng (trừ padding), còn lại gói 2 dòng.
  const accentSize = fitOneLine(phrase.text, 800, { max: 120, min: 60 });
  const plainSize = fitBox(phrase.text, 880, 2, { max: 120, min: 66 });

  return (
    <SafeArea justify="center">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          opacity: Math.min(1, p * 1.6),
          transform: `scale(${0.86 + p * 0.14})`,
        }}
      >
        {phrase.accent ? (
          <span
            style={{
              ...type.headline,
              fontSize: accentSize,
              lineHeight: 1.15,
              color: theme.flat ? theme.surface : theme.text,
              background: theme.accent,
              padding: "10px 44px 22px",
              whiteSpace: "nowrap",
              borderRadius: theme.flat ? 8 : 20,
              boxShadow: theme.flat ? undefined : `0 0 80px ${theme.accent}66`,
            }}
          >
            {phrase.text}
          </span>
        ) : (
          <KineticText
            text={phrase.text}
            color={theme.text}
            fontSize={plainSize}
            delay={2}
            align="center"
            maxCharsPerLine={12}
            maxWidth={960}
            maxLines={3}
            haloColor={theme.bgBase}
          />
        )}
        <div
          style={{
            ...type.mono,
            fontSize: 26,
            color: theme.textDim,
            marginTop: 60,
            display: "flex",
            gap: 12,
          }}
        >
          {scene.phrases.map((_, i) => (
            <span
              key={i}
              style={{
                width: 40,
                height: 6,
                borderRadius: 3,
                background: i <= idx ? theme.accent : theme.textDim + "44",
              }}
            />
          ))}
        </div>
      </div>
    </SafeArea>
  );
};

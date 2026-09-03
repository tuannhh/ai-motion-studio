import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { quoteSceneSchema, WIDTH, SAFE_X } from "../schema/spec";
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
        <Icon name="Quote" size={110} color={theme.accentText} strokeWidth={2} />
      </div>
      <KineticText
        text={scene.text}
        color={theme.text}
        fontSize={68}
        fontWeight={700}
        delay={8}
        maxCharsPerLine={18}
        maxLines={5}
        // co chữ để LUÔN nằm trong safe area (trước đây thiếu maxWidth → câu dài
        // tràn sát lề trái/phải); trừ thêm 12px mỗi bên cho thoáng
        maxWidth={WIDTH - SAFE_X * 2 - 24}
        // trên nền ẢNH (bgImage) chữ cần quầng tách nền cùng màu preset
        haloColor={theme.bgBase}
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
          <div style={{ width: 64, height: 4, background: theme.accentText, borderRadius: 2 }} />
          <span
            style={{
              ...type.body,
              fontSize: 40,
              color: theme.textDim,
              ...(scene.bgImage
                ? {
                    WebkitTextStrokeWidth: "3px",
                    WebkitTextStrokeColor: theme.bgBase,
                    paintOrder: "stroke fill" as const,
                  }
                : {}),
            }}
          >
            {scene.author}
          </span>
        </div>
      ) : null}
    </SafeArea>
  );
};

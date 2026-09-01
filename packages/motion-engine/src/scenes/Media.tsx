import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { mediaSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { enterSpring } from "../core/motion";
import { SafeArea, SceneHeader } from "../core/ui";

const asSrc = (file: string) =>
  file.startsWith("http") ? file : staticFile(file);

/**
 * Evidence card kiểu ainius: ảnh tư liệu dạng polaroid nghiêng nhẹ xoay thẳng,
 * caption + dòng credit mono (nguồn/giấy phép). Ảnh drift chậm (Ken Burns nhẹ).
 */
export const MediaScene: React.FC<{
  scene: z.infer<typeof mediaSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterSpring({ frame, fps, delay: 8 });
  const rotate = interpolate(p, [0, 1], [-6, -1.5]);
  const drift = interpolate(frame, [0, 300], [1, 1.06], {
    extrapolateRight: "clamp",
  });

  return (
    <SafeArea>
      <SceneHeader theme={theme} kicker="Tư liệu" title={scene.title} sub={scene.sub} />
      <div
        style={{
          background: theme.flat ? "#FDFBF7" : "#F7F4EC",
          borderRadius: 14,
          padding: "26px 26px 30px",
          border: theme.flat ? `2px solid ${theme.surfaceBorder}` : undefined,
          boxShadow: theme.flat
            ? "0 3px 0 rgba(35,32,28,0.25)"
            : "0 30px 70px rgba(0,0,0,0.45)",
          opacity: p,
          transform: `rotate(${rotate}deg) translateY(${(1 - p) * 70}px)`,
          alignSelf: "center",
          width: "92%",
          position: "relative",
        }}
      >
        {/* băng dính góc trên — chi tiết scrapbook */}
        <div
          style={{
            position: "absolute",
            top: -20,
            left: "50%",
            width: 170,
            height: 44,
            marginLeft: -85,
            background: theme.accentSoft,
            border: `1.5px solid ${theme.accent}55`,
            transform: "rotate(-4deg)",
          }}
        />
        <div style={{ overflow: "hidden", borderRadius: 6 }}>
          <Img
            src={asSrc(scene.image)}
            style={{
              width: "100%",
              maxHeight: 900,
              objectFit: "cover",
              display: "block",
              transform: `scale(${drift})`,
            }}
          />
        </div>
        {scene.caption ? (
          <p
            style={{
              ...type.sub,
              fontSize: 34,
              color: "#3A352E",
              margin: "24px 6px 0",
            }}
          >
            {scene.caption}
          </p>
        ) : null}
        {scene.credit ? (
          <p
            style={{
              ...type.mono,
              fontSize: 22,
              color: "rgba(58,53,46,0.55)",
              margin: "14px 6px 0",
            }}
          >
            {scene.credit}
          </p>
        ) : null}
      </div>
    </SafeArea>
  );
};

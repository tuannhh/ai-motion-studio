import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { HEIGHT, SAFE_TOP, SAFE_X, WIDTH, annotateSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { drawProgress, enterSpring, popSpring } from "../core/motion";
import { PhotoBackdrop } from "../core/PhotoBackdrop";
import { Kicker } from "../core/ui";

/**
 * "Ảnh thật + chú thích đỏ" — pattern chủ lực của AI News: ảnh full-bleed
 * Ken Burns, headline trên, hộp note màu accent với mũi tên vẽ dần chỉ vào
 * điểm focus trên ảnh + vòng ring pulse tại điểm đó.
 */
export const AnnotateScene: React.FC<{
  scene: z.infer<typeof annotateSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headIn = enterSpring({ frame, fps, delay: 4 });
  const noteIn = popSpring({ frame, fps, delay: 22 });
  const arrow = drawProgress({ frame, fps, delay: 30 });
  const ringIn = popSpring({ frame, fps, delay: 34 });
  const pulse = 1 + Math.sin(Math.max(0, frame - 40) / 9) * 0.06;

  const fx = scene.fx * WIDTH;
  const fy = scene.fy * HEIGHT;
  // note đặt phía đối diện điểm focus theo trục dọc để không che nó
  const noteAbove = scene.fy >= 0.5;
  const noteY = noteAbove ? HEIGHT * 0.32 : HEIGHT * 0.68;
  const noteX = WIDTH / 2;

  // mũi tên cong nhẹ từ mép note tới focus
  const startY = noteAbove ? noteY + 90 : noteY - 90;
  const midX = (noteX + fx) / 2 + (fx > noteX ? 60 : -60);
  const midY = (startY + fy) / 2;
  const path = `M ${noteX} ${startY} Q ${midX} ${midY} ${fx} ${fy}`;
  const dash = 1400;

  return (
    <AbsoluteFill>
      {scene.image ? (
        <PhotoBackdrop src={scene.image} theme={theme} midScrim={0.28} />
      ) : null}

      {/* header trên vùng safe */}
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP,
          left: SAFE_X,
          right: SAFE_X,
          opacity: headIn,
          transform: `translateY(${(1 - headIn) * 40}px)`,
        }}
      >
        {scene.kicker ? <Kicker theme={theme}>{scene.kicker}</Kicker> : null}
        {scene.headline ? (
          <h2
            style={{
              ...type.title,
              fontSize: 62,
              lineHeight: 1.14,
              color: theme.text,
              margin: "14px 0 0",
              textShadow: theme.flat ? undefined : "0 4px 30px rgba(0,0,0,0.6)",
            }}
          >
            {scene.headline}
          </h2>
        ) : null}
      </div>

      {/* mũi tên + ring focus */}
      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", inset: 0 }}
      >
        <path
          d={path}
          fill="none"
          stroke={theme.accent}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={dash * (1 - arrow)}
        />
        {arrow > 0.96 ? (
          <circle
            cx={fx}
            cy={fy}
            r={30 * ringIn * pulse}
            fill="none"
            stroke={theme.accent}
            strokeWidth={6}
          />
        ) : null}
      </svg>

      {/* hộp chú thích accent */}
      <div
        style={{
          position: "absolute",
          top: noteY,
          left: "50%",
          transform: `translate(-50%, -50%) rotate(-1.5deg) scale(${noteIn})`,
          background: theme.accent,
          color: "#FFFFFF",
          padding: "26px 34px",
          borderRadius: 12,
          maxWidth: WIDTH - SAFE_X * 2 - 60,
          boxShadow: theme.flat
            ? "0 3px 0 rgba(0,0,0,0.3)"
            : "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        <p
          style={{
            ...type.body,
            fontSize: 40,
            fontWeight: 700,
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {scene.note}
        </p>
      </div>
    </AbsoluteFill>
  );
};

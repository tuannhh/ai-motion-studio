import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { HEIGHT, SAFE_TOP, SAFE_X, WIDTH, annotateSceneSchema } from "../schema/spec";
import { Theme, bestTextOn } from "../style/presets";
import { type } from "../style/fonts";
import { drawProgress, enterSpring, popSpring } from "../core/motion";
import { PhotoBackdrop } from "../core/PhotoBackdrop";
import { Kicker } from "../core/ui";
import { RichText, stripMarkup } from "../core/RichText";
import { fitBox } from "../core/fit";

/** Hash chuỗi → số (để wobble tất định cho vòng khoanh vẽ tay VOX). */
const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Đường ellipse "vẽ tay": lấy mẫu quanh cung có nhiễu bán kính nhỏ + overshoot 1 vòng. */
const roughEllipse = (cx: number, cy: number, rx: number, ry: number, seed: number): string => {
  const N = 46;
  const start = -0.4;
  const end = Math.PI * 2 + 0.5;
  let d = "";
  for (let i = 0; i <= N; i++) {
    const t = start + (end - start) * (i / N);
    const j = 1 + Math.sin(i * 2.7 + seed) * 0.035;
    const x = cx + Math.cos(t) * rx * j;
    const y = cy + Math.sin(t) * ry * j;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return d.trim();
};

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

  const vox = theme.flavor === "vox";
  const headIn = enterSpring({ frame, fps, delay: 4 });
  const noteIn = popSpring({ frame, fps, delay: 22 });
  const arrow = drawProgress({ frame, fps, delay: 30 });
  const ringIn = popSpring({ frame, fps, delay: 34 });
  const pulse = 1 + Math.sin(Math.max(0, frame - 40) / 9) * 0.06;
  const ellipseDraw = drawProgress({ frame, fps, delay: 30 });
  const dashE = 1150;

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
        // annotate cần điểm focus đứng yên cho mũi tên chỉ đúng → mặc định zoom-in
        // (giữ hành vi cũ), chỉ đổi khi AI chỉ định motion khác
        <PhotoBackdrop
          src={scene.image}
          theme={theme}
          midScrim={0.28}
          motion={scene.motion === "auto" ? "zoom-in" : scene.motion}
        />
      ) : null}

      {/* scrim riêng sau lưng khối chữ đầu — đảm bảo đọc rõ dù ảnh nền bận chi tiết
          (midScrim của PhotoBackdrop chỉ phủ đều toàn khung, không đủ tối riêng vùng chữ) */}
      {scene.headline || scene.kicker ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: SAFE_TOP + 340,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.32) 60%, transparent 100%)",
          }}
        />
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
        {scene.headline
          ? (() => {
              const displayHeadline = vox
                ? scene.headline.toLocaleUpperCase("vi-VN")
                : scene.headline;
              const fontSize = fitBox(stripMarkup(displayHeadline), WIDTH - SAFE_X * 2, 2, {
                max: 62,
                min: 40,
                fontWeight: vox ? 900 : 700,
                letterSpacing: vox ? "-0.02em" : "-0.01em",
              });
              return (
                <h2
                  style={{
                    ...type.title,
                    fontSize,
                    fontWeight: vox ? 900 : 700,
                    letterSpacing: vox ? "-0.02em" : "-0.01em",
                    lineHeight: vox ? 1.14 : 1.2,
                    color: theme.text,
                    margin: "22px 0 0",
                    textShadow: theme.flat ? undefined : "0 4px 30px rgba(0,0,0,0.6)",
                  }}
                >
                  <RichText text={displayHeadline} accent={theme.accentText} />
                </h2>
              );
            })()
          : null}
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
          stroke={theme.accentText}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={dash}
          strokeDashoffset={dash * (1 - arrow)}
        />
        {vox ? (
          // VOX: khoanh tròn "vẽ tay" quanh điểm focus (thay vòng ring sạch)
          <path
            d={roughEllipse(fx, fy, 172, 122, hashStr(scene.id))}
            fill="none"
            stroke={theme.accentText}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={dashE}
            strokeDashoffset={dashE * (1 - ellipseDraw)}
          />
        ) : arrow > 0.96 ? (
          <circle
            cx={fx}
            cy={fy}
            r={30 * ringIn * pulse}
            fill="none"
            stroke={theme.accentText}
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
          transform: `translate(-50%, -50%) rotate(${vox ? -2.5 : -1.5}deg) scale(${noteIn})`,
          background: theme.accent,
          color: bestTextOn(theme.accent),
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
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {scene.note}
        </p>
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { statSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { enterSpring, popIn, riseIn } from "../core/motion";
import { Icon, SafeArea } from "../core/ui";
import { CircuitTraces, CrystalFacets, surfaceFor } from "../core/surfaces";

const formatValue = (v: number): string => {
  const abs = Math.abs(v);
  const decimals = Number.isInteger(v) ? 0 : abs < 10 ? 1 : 0;
  return v.toLocaleString("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/** Con số lớn đếm tăng dần + vòng cung tiến độ + nhãn */
export const StatScene: React.FC<{
  scene: z.infer<typeof statSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const countP = interpolate(frame, [8, 8 + fps * 1.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // ease-out cubic cho cảm giác "hãm phanh" ở cuối
  const eased = 1 - Math.pow(1 - countP, 3);
  const value = formatValue(scene.value * eased);
  const scaleP = enterSpring({ frame, fps, delay: 4 });

  const R = 330;
  const C = 2 * Math.PI * R;
  // P4: bề mặt trang trí SAU con số (pha lê/vi mạch) — chỉ preset tối, z dưới số
  const discSurface = surfaceFor(scene.id, theme, ["crystal", "circuit"]);

  return (
    <SafeArea>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            width: R * 2 + 60,
            height: R * 2 + 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${0.9 + scaleP * 0.1})`,
            opacity: scaleP,
          }}
        >
          <svg
            width={R * 2 + 60}
            height={R * 2 + 60}
            style={{ position: "absolute", transform: "rotate(-90deg)" }}
          >
            <circle
              cx={R + 30}
              cy={R + 30}
              r={R}
              fill="none"
              stroke={theme.surfaceBorder}
              strokeWidth={10}
            />
            <circle
              cx={R + 30}
              cy={R + 30}
              r={R}
              fill="none"
              stroke={theme.accentText}
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - eased)}
              style={{ filter: `drop-shadow(0 0 22px ${theme.accent})` }}
            />
          </svg>
          {discSurface ? (
            <div
              style={{
                position: "absolute",
                width: R * 2,
                height: R * 2,
                borderRadius: "50%",
                overflow: "hidden",
                zIndex: 0,
              }}
            >
              {discSurface === "crystal" ? (
                <CrystalFacets theme={theme} radius="50%" seedKey={scene.id} />
              ) : (
                <CircuitTraces theme={theme} radius="50%" />
              )}
            </div>
          ) : null}
          <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
            <div
              style={{
                ...type.headline,
                fontSize: 170,
                color: theme.text,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {value}
              {scene.unit ? (
                <span style={{ fontSize: 96, color: theme.accentText }}>
                  {scene.unit}
                </span>
              ) : null}
            </div>
            {scene.trend ? (
              <div style={{ marginTop: 18, ...popIn({ frame, fps, delay: 34 }) }}>
                <Icon
                  name={scene.trend === "up" ? "TrendingUp" : "TrendingDown"}
                  size={72}
                  color={scene.trend === "up" ? theme.good : theme.danger}
                  strokeWidth={3}
                />
              </div>
            ) : null}
          </div>
        </div>

        <p
          style={{
            ...type.body,
            fontWeight: 600,
            fontSize: 48,
            color: theme.text,
            textAlign: "center",
            maxWidth: 800,
            margin: 0,
            marginTop: 48,
            ...riseIn({ frame, fps, delay: 22 }),
          }}
        >
          {scene.label}
        </p>
        {scene.source ? (
          <p
            style={{
              ...type.mono,
              fontSize: 24,
              color: theme.textDim,
              margin: 0,
              marginTop: 20,
              ...riseIn({ frame, fps, delay: 34 }),
            }}
          >
            Nguồn: {scene.source}
          </p>
        ) : null}
      </div>
    </SafeArea>
  );
};

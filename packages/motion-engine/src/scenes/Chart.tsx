import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { chartSceneSchema } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import { STAGGER, drawProgress, enterSpring, popSpring } from "../core/motion";
import { SafeArea, SceneHeader } from "../core/ui";

const formatValue = (v: number): string =>
  v.toLocaleString("vi-VN", {
    maximumFractionDigits: Number.isInteger(v) ? 0 : 1,
  });

/** Vùng vẽ cố định (bên trong SafeArea) — 9:16 dọc nên plot cao vừa phải */
const PLOT_W = 912;
const PLOT_H = 640;
const LABEL_H = 64;

/**
 * Biểu đồ cột dọc / đường xu hướng single-series theo phương pháp dataviz:
 * 1 trục duy nhất, không legend (title đặt tên series), mark mảnh, grid lặng,
 * nhãn số CHỌN LỌC (chỉ điểm highlight — không rải số lên mọi điểm),
 * màu series trung tính + accent dành cho focal (đồng quy ước với Rank).
 */
export const ChartScene: React.FC<{
  scene: z.infer<typeof chartSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...scene.points.map((p) => p.value), 1);
  const n = scene.points.length;
  const hasHighlight = scene.points.some((p) => p.highlight);

  const gridColor = theme.flat ? "rgba(35,32,28,0.14)" : "rgba(255,255,255,0.10)";
  const baseColor = theme.flat ? "rgba(35,32,28,0.45)" : "rgba(255,255,255,0.30)";
  const barColor = theme.flat ? "rgba(35,32,28,0.35)" : "rgba(255,255,255,0.30)";

  // Lưới ngang lặng: baseline + 2 mức tham chiếu (không trục y đầy đủ — giữ recessive)
  const gridLevels = [0.5, 1];

  const valueLabel = (p: { value: number; unit?: string }, progress: number) =>
    `${formatValue(p.value * Math.min(1, progress))}${scene.unit ?? ""}`;

  return (
    <SafeArea>
      <SceneHeader
        theme={theme}
        kicker="Số liệu"
        title={scene.title}
        sub={scene.sub}
      />
      <div style={{ position: "relative", width: PLOT_W, height: PLOT_H + LABEL_H }}>
        {/* Lưới tham chiếu + nhãn mức mono nhỏ */}
        {gridLevels.map((lv) => {
          const g = enterSpring({ frame, fps, delay: 6 });
          return (
            <div
              key={lv}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: PLOT_H * (1 - lv),
                borderTop: `${lv === 0 ? 0 : 2}px ${theme.flat ? "solid" : "dashed"} ${gridColor}`,
                opacity: g,
              }}
            >
              {lv < 1 ? (
                // Mức trên cùng chỉ giữ vạch — nhãn số dễ trùng với nhãn điểm highlight
                <span
                  style={{
                    ...type.mono,
                    fontSize: 24,
                    color: theme.textDim,
                    position: "absolute",
                    right: 0,
                    top: -34,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatValue(max * lv)}
                  {scene.unit ?? ""}
                </span>
              ) : null}
            </div>
          );
        })}
        {/* Baseline */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: PLOT_H,
            borderTop: `3px solid ${baseColor}`,
          }}
        />

        {scene.variant === "line" ? (
          <LinePlot scene={scene} theme={theme} frame={frame} fps={fps} max={max} />
        ) : (
          // Bar: cột mảnh, đầu bo 6px neo baseline, mọc từ dưới có stagger
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: PLOT_H,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 18,
              padding: "0 6px",
            }}
          >
            {scene.points.map((p, i) => {
              const delay = 14 + i * (STAGGER + 2);
              const grow = drawProgress({ frame, fps, delay });
              const h = Math.max(6, (p.value / max) * (PLOT_H - 60) * grow);
              const showLabel = p.highlight || (!hasHighlight && i === n - 1);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: "100%",
                  }}
                >
                  {showLabel ? (
                    <span
                      style={{
                        ...type.mono,
                        fontWeight: 700,
                        fontSize: 34,
                        color: p.highlight ? theme.accent : theme.text,
                        marginBottom: 12,
                        opacity: grow,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {valueLabel(p, grow)}
                    </span>
                  ) : null}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 96,
                      height: h,
                      borderRadius: "6px 6px 0 0",
                      background: p.highlight ? theme.accent : barColor,
                      boxShadow:
                        p.highlight && !theme.flat
                          ? `0 0 26px ${theme.accent}88`
                          : undefined,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Nhãn trục x mono nhỏ */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: PLOT_H + 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            padding: "0 6px",
          }}
        >
          {scene.points.map((p, i) => {
            const delay = 14 + i * (STAGGER + 2);
            const a = enterSpring({ frame, fps, delay });
            return (
              <span
                key={i}
                style={{
                  ...type.mono,
                  fontSize: 26,
                  color: p.highlight ? theme.text : theme.textDim,
                  fontWeight: p.highlight ? 700 : 500,
                  flex: 1,
                  textAlign: "center",
                  opacity: a,
                }}
              >
                {p.label}
              </span>
            );
          })}
        </div>
      </div>
      {scene.source ? (
        <div
          style={{
            ...type.mono,
            fontSize: 22,
            color: theme.textDim,
            marginTop: 28,
            opacity: enterSpring({ frame, fps, delay: 30 }),
          }}
        >
          Nguồn: {scene.source}
        </div>
      ) : null}
    </SafeArea>
  );
};

/** Đường xu hướng: stroke 5px vẽ dần, marker ≥16px pop theo stagger, area soft */
const LinePlot: React.FC<{
  scene: z.infer<typeof chartSceneSchema>;
  theme: Theme;
  frame: number;
  fps: number;
  max: number;
}> = ({ scene, theme, frame, fps, max }) => {
  const n = scene.points.length;
  const hasHighlight = scene.points.some((p) => p.highlight);
  const pad = 40;
  const xs = scene.points.map(
    (_, i) => pad + (i * (PLOT_W - pad * 2)) / (n - 1)
  );
  const ys = scene.points.map(
    (p) => PLOT_H - 30 - (p.value / max) * (PLOT_H - 110)
  );
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const areaPath = `${path} L${xs[n - 1]},${PLOT_H} L${xs[0]},${PLOT_H} Z`;
  // Ước lượng độ dài path để vẽ dần (đường gấp khúc — tính chính xác được)
  let len = 0;
  for (let i = 1; i < n; i++) {
    len += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  const draw = drawProgress({ frame, fps, delay: 14 });

  return (
    <svg
      width={PLOT_W}
      height={PLOT_H}
      viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
    >
      <path
        d={areaPath}
        fill={theme.accentSoft}
        opacity={Math.min(1, draw * 1.2) * (theme.flat ? 0.9 : 0.7)}
      />
      <path
        d={path}
        fill="none"
        stroke={theme.accent}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - draw)}
      />
      {scene.points.map((p, i) => {
        const delay = 16 + i * (STAGGER + 1);
        const pop = popSpring({ frame, fps, delay });
        const r = (p.highlight ? 13 : 9) * Math.min(1, pop);
        const showLabel = p.highlight || (!hasHighlight && i === n - 1);
        return (
          <g key={i}>
            <circle
              cx={xs[i]}
              cy={ys[i]}
              r={r}
              fill={p.highlight ? theme.accent : theme.flat ? theme.bgBase : "#fff"}
              stroke={theme.accent}
              strokeWidth={4}
            />
            {showLabel ? (
              <text
                x={xs[i]}
                y={ys[i] - 26}
                textAnchor="middle"
                style={{
                  ...(type.mono as object),
                  fontSize: 34,
                  fontWeight: 700,
                }}
                fill={p.highlight ? theme.accent : theme.text}
                opacity={Math.min(1, pop)}
              >
                {formatValue(p.value)}
                {scene.unit ?? ""}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
};

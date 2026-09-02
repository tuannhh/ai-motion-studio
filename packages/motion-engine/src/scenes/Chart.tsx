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

type ChartScene = z.infer<typeof chartSceneSchema>;
type ChartPoint = ChartScene["points"][number];

/** Tỉ lệ đầy 0–1 cho variant 1-giá-trị (target trống ⇒ value là % trên thang 100). */
const pctOf = (value: number, target?: number): number => {
  const t = target && target > 0 ? target : 100;
  return Math.max(0, Math.min(1, value / t));
};

/** Màu lưới/nền lùi + màu track (phần chưa đầy) — thống nhất giữa các variant. */
const chartColors = (theme: Theme) => ({
  grid: theme.flat ? "rgba(35,32,28,0.14)" : "rgba(255,255,255,0.10)",
  base: theme.flat ? "rgba(35,32,28,0.45)" : "rgba(255,255,255,0.30)",
  track: theme.flat ? "rgba(35,32,28,0.12)" : "rgba(255,255,255,0.12)",
  muted: theme.flat ? "rgba(35,32,28,0.32)" : "rgba(255,255,255,0.24)",
});

/**
 * Bộ chart 1-accent theo phương pháp dataviz: 1 focal, nhãn CHỌN LỌC, lưới lùi nền,
 * animate fill/vẽ dần. Số KPI luôn dùng `theme.text` (đọc rõ), accent chỉ cho phần đổ
 * đầy/mark — tránh chữ-accent-trên-nền-tối khó đọc (lưu ý tương phản của chủ dự án).
 *   • bar/line — chuỗi nhiều điểm (trục)         • donut/gauge/thermometer/waffle — 1 giá trị
 *   • spark — sparkline + số lớn                 • duo — 2 cột accent vs muted
 */
export const ChartScene: React.FC<{
  scene: ChartScene;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = scene.variant;
  const axis = v === "bar" || v === "line";
  const contentH = axis ? PLOT_H + LABEL_H : PLOT_H;

  return (
    <SafeArea>
      <SceneHeader theme={theme} kicker="Số liệu" title={scene.title} sub={scene.sub} />
      <div style={{ position: "relative", width: PLOT_W, height: contentH }}>
        {axis ? (
          <AxisChart scene={scene} theme={theme} frame={frame} fps={fps} />
        ) : v === "donut" ? (
          <DonutPlot scene={scene} theme={theme} frame={frame} fps={fps} />
        ) : v === "gauge" ? (
          <GaugePlot scene={scene} theme={theme} frame={frame} fps={fps} />
        ) : v === "thermometer" ? (
          <ThermometerPlot scene={scene} theme={theme} frame={frame} fps={fps} />
        ) : v === "waffle" ? (
          <WafflePlot scene={scene} theme={theme} frame={frame} fps={fps} />
        ) : v === "spark" ? (
          <SparkPlot scene={scene} theme={theme} frame={frame} fps={fps} />
        ) : (
          <DuoPlot scene={scene} theme={theme} frame={frame} fps={fps} />
        )}
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

/** Số KPI lớn + đơn vị + caption — số luôn theme.text để đọc rõ trên mọi nền. */
const BigMetric: React.FC<{
  theme: Theme;
  value: number;
  unit?: string;
  label?: string;
  progress: number;
  size?: number;
}> = ({ theme, value, unit, label, progress, size = 128 }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    <span
      style={{
        ...type.mono,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        color: theme.text,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formatValue(value * Math.min(1, progress))}
      {unit ?? ""}
    </span>
    {label ? (
      <span
        style={{ ...type.label, fontSize: 28, color: theme.textDim, textAlign: "center", maxWidth: 560 }}
      >
        {label}
      </span>
    ) : null}
  </div>
);

/* ─────────────────────────── donut ─────────────────────────── */
const DonutPlot: React.FC<PlotProps> = ({ scene, theme, frame, fps }) => {
  const c = chartColors(theme);
  const p0 = scene.points[0];
  const pct = pctOf(p0.value, scene.target);
  const draw = drawProgress({ frame, fps, delay: 10 });
  const cx = PLOT_W / 2;
  const cy = 300;
  const R = 188;
  const sw = 54;
  const C = 2 * Math.PI * R;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        width={PLOT_W}
        height={PLOT_H}
        viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={c.track} strokeWidth={sw} />
          <circle
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={theme.accent}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct * draw)}
            style={theme.flat ? undefined : { filter: `drop-shadow(0 0 12px ${theme.accent}55)` }}
          />
        </g>
      </svg>
      <div style={{ position: "absolute", left: cx, top: cy, transform: "translate(-50%, -50%)" }}>
        <BigMetric
          theme={theme}
          value={p0.value}
          unit={scene.unit}
          label={p0.label}
          progress={draw}
          size={132}
        />
      </div>
    </div>
  );
};

/* ─────────────────────────── gauge ─────────────────────────── */
const GaugePlot: React.FC<PlotProps> = ({ scene, theme, frame, fps }) => {
  const c = chartColors(theme);
  const p0 = scene.points[0];
  const pct = pctOf(p0.value, scene.target);
  const draw = drawProgress({ frame, fps, delay: 10 });
  const cx = PLOT_W / 2;
  const cy = 440;
  const R = 250;
  const sw = 46;
  // Nửa cung TRÊN từ trái (180°) sang phải (0°)
  const arc = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  const len = Math.PI * R;
  const endLabel = (txt: string, x: number) => (
    <span
      style={{
        ...type.mono,
        fontSize: 24,
        color: theme.textDim,
        position: "absolute",
        left: x,
        top: cy + 16,
        transform: "translateX(-50%)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {txt}
    </span>
  );
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        width={PLOT_W}
        height={PLOT_H}
        viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
      >
        <path d={arc} fill="none" stroke={c.track} strokeWidth={sw} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={theme.accent}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - pct * draw)}
          style={theme.flat ? undefined : { filter: `drop-shadow(0 0 12px ${theme.accent}55)` }}
        />
      </svg>
      <div style={{ position: "absolute", left: cx, top: cy - 118, transform: "translate(-50%, 0)" }}>
        <BigMetric theme={theme} value={p0.value} unit={scene.unit} label={p0.label} progress={draw} size={120} />
      </div>
      {endLabel("0", cx - R)}
      {endLabel(`${formatValue(scene.target ?? 100)}${scene.unit ?? ""}`, cx + R)}
    </div>
  );
};

/* ─────────────────────── thermometer ─────────────────────── */
const ThermometerPlot: React.FC<PlotProps> = ({ scene, theme, frame, fps }) => {
  const c = chartColors(theme);
  const p0 = scene.points[0];
  const pct = pctOf(p0.value, scene.target);
  const draw = drawProgress({ frame, fps, delay: 10 });
  const tubeH = 460;
  const tubeW = 88;
  const bulb = 132;
  const fillH = tubeH * pct * draw;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 88,
      }}
    >
      <div style={{ position: "relative", width: bulb, height: tubeH + bulb, display: "flex", justifyContent: "center" }}>
        {/* Ống */}
        <div
          style={{
            position: "absolute",
            top: 0,
            width: tubeW,
            height: tubeH + tubeW / 2,
            borderRadius: tubeW,
            background: c.track,
          }}
        />
        {/* Bầu */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            width: bulb,
            height: bulb,
            borderRadius: "50%",
            background: theme.accent,
            boxShadow: theme.flat ? undefined : `0 0 26px ${theme.accent}66`,
          }}
        />
        {/* Cột đổ đầy */}
        <div
          style={{
            position: "absolute",
            bottom: bulb / 2,
            width: tubeW,
            height: fillH,
            borderRadius: tubeW,
            background: theme.accent,
          }}
        />
      </div>
      <BigMetric theme={theme} value={p0.value} unit={scene.unit} label={p0.label} progress={draw} size={128} />
    </div>
  );
};

/* ─────────────────────────── waffle ─────────────────────────── */
const WafflePlot: React.FC<PlotProps> = ({ scene, theme, frame, fps }) => {
  const c = chartColors(theme);
  const p0 = scene.points[0];
  const pct = pctOf(p0.value, scene.target);
  const filled = Math.round(pct * 100);
  const cell = 44;
  const gap = 8;
  const draw = drawProgress({ frame, fps, delay: 8 });
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 10; r++) {
    for (let col = 0; col < 10; col++) {
      const order = (9 - r) * 10 + col; // đổ đầy từ hàng dưới lên, trái→phải
      const on = order < filled;
      const a = enterSpring({ frame, fps, delay: 8 + order * 0.5 });
      cells.push(
        <div
          key={`${r}-${col}`}
          style={{
            width: cell,
            height: cell,
            borderRadius: 8,
            background: on ? theme.accent : c.muted,
            opacity: on ? a : 0.5 * a,
            transform: `scale(${0.6 + 0.4 * a})`,
          }}
        />
      );
    }
  }
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: `repeat(10, ${cell}px)`, gap }}>{cells}</div>
      <BigMetric theme={theme} value={p0.value} unit={scene.unit} label={p0.label} progress={draw} size={96} />
    </div>
  );
};

/* ─────────────────────────── spark ─────────────────────────── */
const SparkPlot: React.FC<PlotProps> = ({ scene, theme, frame, fps }) => {
  const pts = scene.points;
  const focal = pts.find((p) => p.highlight) ?? pts[pts.length - 1];
  const draw = drawProgress({ frame, fps, delay: 12 });
  const numProg = enterSpring({ frame, fps, delay: 6 });

  const n = pts.length;
  const max = Math.max(...pts.map((p) => p.value), 1);
  const min = Math.min(...pts.map((p) => p.value), 0);
  const span = Math.max(1, max - min);
  const x0 = 30;
  const y0 = 360;
  const w = PLOT_W - 60;
  const h = 220;
  const xs = pts.map((_, i) => x0 + (n > 1 ? (i * w) / (n - 1) : w / 2));
  const ys = pts.map((p) => y0 + h - ((p.value - min) / span) * (h - 30));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const areaPath = n > 1 ? `${path} L${xs[n - 1]},${y0 + h} L${xs[0]},${y0 + h} Z` : "";
  let len = 0;
  for (let i = 1; i < n; i++) len += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: PLOT_W / 2, top: 150, transform: "translate(-50%, -50%)" }}>
        <BigMetric theme={theme} value={focal.value} unit={scene.unit} label={focal.label} progress={numProg} size={168} />
      </div>
      {n > 1 ? (
        <svg
          width={PLOT_W}
          height={PLOT_H}
          viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
          style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
        >
          <path d={areaPath} fill={theme.accentSoft} opacity={Math.min(1, draw * 1.2) * (theme.flat ? 0.8 : 0.55)} />
          <path
            d={path}
            fill="none"
            stroke={theme.accent}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - draw)}
          />
          {draw > 0.9 ? (
            <circle cx={xs[n - 1]} cy={ys[n - 1]} r={12} fill={theme.accent} />
          ) : null}
        </svg>
      ) : null}
    </div>
  );
};

/* ──────────────────────────── duo ──────────────────────────── */
const DuoPlot: React.FC<PlotProps> = ({ scene, theme, frame, fps }) => {
  const c = chartColors(theme);
  const two = scene.points.slice(0, 2);
  const max = Math.max(...two.map((p) => p.value), 1);
  const anyHi = two.some((p) => p.highlight);
  const maxH = PLOT_H - 150;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 70,
          height: maxH,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 120,
        }}
      >
        {two.map((p, i) => {
          const accent = anyHi ? p.highlight : i === 0;
          const grow = drawProgress({ frame, fps, delay: 14 + i * 8 });
          const barH = Math.max(8, (p.value / max) * maxH * grow);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
              <span
                style={{
                  ...type.mono,
                  fontWeight: 800,
                  fontSize: 56,
                  color: theme.text,
                  marginBottom: 16,
                  opacity: grow,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatValue(p.value * Math.min(1, grow))}
                {scene.unit ?? ""}
              </span>
              <div
                style={{
                  width: 220,
                  height: barH,
                  borderRadius: "14px 14px 0 0",
                  background: accent ? theme.accent : c.muted,
                  boxShadow: accent && !theme.flat ? `0 0 30px ${theme.accent}66` : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Nhãn dưới + baseline */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 62, borderTop: `3px solid ${c.base}` }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 8,
          display: "flex",
          justifyContent: "center",
          gap: 120,
        }}
      >
        {two.map((p, i) => (
          <span key={i} style={{ ...type.mono, fontSize: 30, color: theme.text, width: 220, textAlign: "center" }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ─────────────────── bar + line (trục, giữ nguyên) ─────────────────── */
type PlotProps = { scene: ChartScene; theme: Theme; frame: number; fps: number };

const AxisChart: React.FC<PlotProps> = ({ scene, theme, frame, fps }) => {
  const c = chartColors(theme);
  const max = Math.max(...scene.points.map((p) => p.value), 1);
  const n = scene.points.length;
  const hasHighlight = scene.points.some((p) => p.highlight);
  const gridLevels = [0.5, 1];
  const valueLabel = (p: ChartPoint, progress: number) =>
    `${formatValue(p.value * Math.min(1, progress))}${scene.unit ?? ""}`;

  return (
    <>
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
              borderTop: `${lv === 0 ? 0 : 2}px ${theme.flat ? "solid" : "dashed"} ${c.grid}`,
              opacity: g,
            }}
          >
            {lv < 1 ? (
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
      <div style={{ position: "absolute", left: 0, right: 0, top: PLOT_H, borderTop: `3px solid ${c.base}` }} />

      {scene.variant === "line" ? (
        <LinePlot scene={scene} theme={theme} frame={frame} fps={fps} max={max} />
      ) : (
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
                    background: p.highlight ? theme.accent : c.muted,
                    boxShadow: p.highlight && !theme.flat ? `0 0 26px ${theme.accent}88` : undefined,
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
    </>
  );
};

/** Đường xu hướng: stroke 5px vẽ dần, marker ≥16px pop theo stagger, area soft */
const LinePlot: React.FC<PlotProps & { max: number }> = ({ scene, theme, frame, fps, max }) => {
  const n = scene.points.length;
  const hasHighlight = scene.points.some((p) => p.highlight);
  const pad = 40;
  const xs = scene.points.map((_, i) => pad + (n > 1 ? (i * (PLOT_W - pad * 2)) / (n - 1) : (PLOT_W - pad * 2) / 2));
  const ys = scene.points.map((p) => PLOT_H - 30 - (p.value / max) * (PLOT_H - 110));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const areaPath = `${path} L${xs[n - 1]},${PLOT_H} L${xs[0]},${PLOT_H} Z`;
  let len = 0;
  for (let i = 1; i < n; i++) len += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  const draw = drawProgress({ frame, fps, delay: 14 });

  return (
    <svg
      width={PLOT_W}
      height={PLOT_H}
      viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
    >
      <path d={areaPath} fill={theme.accentSoft} opacity={Math.min(1, draw * 1.2) * (theme.flat ? 0.9 : 0.7)} />
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
                style={{ ...(type.mono as object), fontSize: 34, fontWeight: 700 }}
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

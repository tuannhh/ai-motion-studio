import React from "react";
import { useCurrentFrame } from "remotion";
import { Theme } from "../style/presets";
import { pickBySeed, seedOf } from "./motion";

/**
 * P4 — Thư viện "bề mặt" hiệu ứng khối cho 1 KHỐI TIÊU ĐIỂM mỗi scene (tiết chế).
 * NGUYÊN TẮC:
 *  - Chỉ bật ở preset TỐI (gate theo `theme.flat` — paper luôn phẳng, trả null).
 *  - Deterministic: chọn bằng seed, animate bằng `frame % chu-kỳ` (không Math.random).
 *  - RẺ về render: chỉ `transform`/`opacity`/`stroke-dashoffset`/gradient — KHÔNG
 *    backdrop-blur, KHÔNG chồng nhiều lớp text-shadow blur (bài học: treo >10 phút).
 *  - An toàn tương phản: hiệu ứng nằm ở VIỀN/quét sáng mỏng/hoạ tiết mờ — KHÔNG tô
 *    đặc phía sau chữ, giữ nền–chữ luôn đọc được.
 */

export type SurfaceKind = "running-border" | "glass-sweep" | "crystal" | "circuit";

const ALL: SurfaceKind[] = ["running-border", "glass-sweep", "crystal", "circuit"];

/**
 * Chọn 1 bề mặt theo seed. Preset phẳng (paper) → null (không hiệu ứng lung linh).
 * pool giới hạn tập bề mặt phù hợp ngữ cảnh (ví dụ node chỉ nên viền/pha lê).
 */
export const surfaceFor = (
  key: string,
  theme: Theme,
  pool: SurfaceKind[] = ALL
): SurfaceKind | null => {
  if (theme.flat) return null;
  return pickBySeed(`${key}-surface`, pool);
};

/**
 * Viền line ánh sáng chạy quanh chu vi khối (stroke-dashoffset trên rounded rect).
 * 3 nét SVG: ring nền mờ + underglow rộng mờ + "sao chổi" sáng chạy — KHÔNG filter
 * blur (underglow làm bằng nét rộng mờ, rẻ hơn drop-shadow từng frame).
 */
export const RunningBorder: React.FC<{
  theme: Theme;
  radius?: number;
  loopFrames?: number;
}> = ({ theme, radius = 30, loopFrames = 96 }) => {
  const frame = useCurrentFrame();
  if (theme.flat) return null;
  const offset = -((frame % loopFrames) / loopFrames) * 100;
  const dash = "20 80";
  const geom = {
    x: 0,
    y: 0,
    width: "100%",
    height: "100%",
    rx: radius,
    ry: radius,
    fill: "none",
    pathLength: 100,
  } as const;
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      <rect {...geom} stroke={theme.accent} strokeOpacity={0.2} strokeWidth={2} />
      <rect
        {...geom}
        stroke={theme.accent}
        strokeOpacity={0.28}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={offset}
      />
      <rect
        {...geom}
        stroke={theme.accent}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={offset}
      />
    </svg>
  );
};

/**
 * Quét specular kính: 1 vệt sáng chéo trượt qua bề mặt rồi nghỉ (nửa sau chu kỳ đỗ
 * ngoài khung). mixBlendMode screen + opacity thấp → chỉ ánh lên, KHÔNG che chữ.
 */
export const GlassSweep: React.FC<{
  theme: Theme;
  radius?: number | string;
  loopFrames?: number;
  intensity?: number;
}> = ({ theme, radius = 20, loopFrames = 150, intensity = 0.18 }) => {
  const frame = useCurrentFrame();
  if (theme.flat) return null;
  const t = (frame % loopFrames) / loopFrames;
  // trượt trong nửa đầu chu kỳ, nửa sau đỗ ngoài mép phải (x=130%)
  const progress = t < 0.5 ? t / 0.5 : 1;
  const x = -30 + progress * 160;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-20%",
          bottom: "-20%",
          left: `${x}%`,
          width: "26%",
          background: `linear-gradient(100deg, transparent, rgba(255,255,255,${intensity}), transparent)`,
          transform: "skewX(-16deg)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
};

/** Low-poly facet cố định (toạ độ 0..100) — pha lê hoá; stretch theo khối. */
const FACET_PTS = {
  a: [0, 0], b: [50, 0], c: [100, 0],
  d: [0, 50], e: [53, 46], f: [100, 54],
  g: [0, 100], h: [47, 100], i: [100, 100],
} as const;
const FACETS: Array<[keyof typeof FACET_PTS, keyof typeof FACET_PTS, keyof typeof FACET_PTS]> = [
  ["a", "b", "e"], ["a", "e", "d"], ["b", "c", "e"], ["c", "f", "e"],
  ["d", "e", "h"], ["d", "h", "g"], ["e", "f", "h"], ["f", "i", "h"],
];

/**
 * Overlay pha lê: các mặt tam giác cố định, cạnh sáng mảnh + fill accent RẤT mờ,
 * mỗi mặt lấp lánh lệch pha (opacity sin theo frame). Clip trong bo góc khối.
 */
export const CrystalFacets: React.FC<{
  theme: Theme;
  radius?: number | string;
  seedKey?: string;
}> = ({ theme, radius = 20, seedKey = "cf" }) => {
  const frame = useCurrentFrame();
  if (theme.flat) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        {FACETS.map((tri, i) => {
          const phase = seedOf(`${seedKey}-${i}`) * Math.PI * 2;
          const twinkle = 0.05 + (Math.sin(frame / 24 + phase) * 0.5 + 0.5) * 0.09;
          const pts = tri.map((k) => FACET_PTS[k].join(",")).join(" ");
          return (
            <polygon
              key={i}
              points={pts}
              fill={theme.accent}
              fillOpacity={twinkle}
              stroke={theme.accent}
              strokeOpacity={0.28}
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
};

/** Điểm trên polyline theo tham số 0..1 (nội suy theo tổng độ dài đoạn). */
const pointAt = (pts: Array<[number, number]>, t: number): [number, number] => {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const len = Math.hypot(dx, dy);
    segs.push(len);
    total += len;
  }
  let dist = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (dist <= segs[i]) {
      const f = segs[i] === 0 ? 0 : dist / segs[i];
      return [
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f,
      ];
    }
    dist -= segs[i];
  }
  return pts[pts.length - 1];
};

/** Trace vi mạch trực giao cố định (toạ độ 0..100) — line ngang/dọc giữ vuông khi stretch. */
const TRACES: Array<Array<[number, number]>> = [
  [[6, 24], [40, 24], [40, 62], [94, 62]],
  [[94, 20], [58, 20], [58, 78], [10, 78]],
];

/**
 * Vi mạch: trace trực giao mờ + node ở đầu mút + hạt xung sáng chạy dọc trace.
 * Line ngang/dọc giữ vuông góc khi stretch (scale không đều chỉ dịch trục) → sạch.
 */
export const CircuitTraces: React.FC<{
  theme: Theme;
  radius?: number | string;
  loopFrames?: number;
}> = ({ theme, radius = 20, loopFrames = 110 }) => {
  const frame = useCurrentFrame();
  if (theme.flat) return null;
  const t = (frame % loopFrames) / loopFrames;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        {TRACES.map((pts, ti) => {
          const poly = pts.map((p) => p.join(",")).join(" ");
          // hạt xung lệch pha giữa các trace
          const pulse = pointAt(pts, (t + ti * 0.5) % 1);
          return (
            <g key={ti}>
              <polyline
                points={poly}
                fill="none"
                stroke={theme.accent}
                strokeOpacity={0.28}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {[pts[0], pts[pts.length - 1]].map((p, k) => (
                <circle
                  key={k}
                  cx={p[0]}
                  cy={p[1]}
                  r={1.6}
                  fill={theme.accent}
                  fillOpacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/* hạt xung: 2 vòng (glow rộng mờ + lõi sáng), không filter */}
              <circle cx={pulse[0]} cy={pulse[1]} r={3.4} fill={theme.accent} fillOpacity={0.22} vectorEffect="non-scaling-stroke" />
              <circle cx={pulse[0]} cy={pulse[1]} r={1.6} fill={theme.accent} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/** Dispatcher: render 1 bề mặt theo kind (dùng trong Glass hoặc scene focal block). */
export const SurfaceOverlay: React.FC<{
  kind: SurfaceKind;
  theme: Theme;
  radius?: number;
  seedKey?: string;
}> = ({ kind, theme, radius = 30, seedKey = "sf" }) => {
  switch (kind) {
    case "running-border":
      return <RunningBorder theme={theme} radius={radius} />;
    case "glass-sweep":
      return <GlassSweep theme={theme} radius={radius} />;
    case "crystal":
      return <CrystalFacets theme={theme} radius={radius} seedKey={seedKey} />;
    case "circuit":
      return <CircuitTraces theme={theme} radius={radius} />;
  }
};

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { diagramSceneSchema, WIDTH, SAFE_X } from "../schema/spec";
import { Theme } from "../style/presets";
import { type } from "../style/fonts";
import {
  breathe,
  drawProgress,
  enterSpring,
  entrance,
  popIn,
  revealStyleOf,
  spreadDelays,
} from "../core/motion";
import { Icon, SafeArea, SceneHeader } from "../core/ui";
import { RunningBorder } from "../core/surfaces";
import { fitBox } from "../core/fit";
import { Pt, pointAtPolyline, polyLength, toPolyPoints } from "../core/geometry";

/**
 * P5 — Sơ đồ node/edge có CHUYỂN ĐỘNG BÊN TRONG (thứ tool tham chiếu editorial cố
 * tình không có). Engine tự lo TẤT CẢ bố cục & thẩm mỹ (AI chỉ đưa nodes + edges,
 * KHÔNG toạ độ):
 *  - Dàn tầng (layered): level = đường dài nhất từ gốc → mỗi cạnh luôn đi XUỐNG tầng
 *    sâu hơn ⇒ định tuyến vuông góc luôn hướng xuống, sạch, không rối.
 *  - Cạnh tự vẽ dần (stroke-dashoffset theo drawProgress), mũi tên ở đầu.
 *  - HẠT SÁNG chạy dọc cạnh (nội suy điểm theo frame) sau khi cạnh vẽ xong.
 *  - Node tiêu điểm ĐẬP nhẹ (breathe) + viền chạy (RunningBorder, chỉ preset tối).
 *  - Nhãn cạnh có nền che (mask) — line không xuyên qua chữ (mượn từ reference).
 */

const CANVAS_W = WIDTH - SAFE_X * 2; // 912
const CANVAS_H = 1040;

type NodeIn = z.infer<typeof diagramSceneSchema>["nodes"][number];
type Laid = NodeIn & { cx: number; cy: number; w: number; h: number };

/** Dàn tầng + tính toạ độ px cho từng node trong canvas. */
const layoutNodes = (
  nodes: NodeIn[],
  edges: z.infer<typeof diagramSceneSchema>["edges"]
): { laid: Laid[]; levelOf: Map<string, number> } => {
  const level = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  // Relaxation longest-path: cạnh from→to ⇒ level[to] ≥ level[from]+1. Lặp tối đa
  // n vòng (đủ hội tụ cho DAG; guard chống lặp vô hạn nếu lỡ có chu trình).
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      if (e.from === e.to) continue;
      const lf = level.get(e.from);
      const lt = level.get(e.to);
      if (lf === undefined || lt === undefined) continue;
      if (lt < lf + 1) {
        level.set(e.to, lf + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const maxLevel = Math.max(...nodes.map((n) => level.get(n.id)!));
  const rows: NodeIn[][] = Array.from({ length: maxLevel + 1 }, () => []);
  nodes.forEach((n) => rows[level.get(n.id)!].push(n));
  const maxCols = Math.max(...rows.map((r) => r.length));

  const gapX = 36;
  const rowH = CANVAS_H / rows.length;
  const boxW = Math.max(190, Math.min(340, (CANVAS_W - gapX) / maxCols - gapX));
  const boxH = Math.min(148, rowH * 0.6);

  const laid: Laid[] = [];
  rows.forEach((row, r) => {
    row.forEach((n, c) => {
      const cx = ((c + 0.5) * CANVAS_W) / row.length;
      const cy = (r + 0.5) * rowH;
      const isHub = n.kind === "hub";
      const w = isHub ? Math.min(boxW, boxH) : boxW;
      const h = boxH;
      laid.push({ ...n, cx, cy, w, h });
    });
  });
  return { laid, levelOf: level };
};

/** Định tuyến vuông góc HƯỚNG XUỐNG giữa 2 node (bố cục đảm bảo to sâu hơn from). */
const routeEdge = (a: Laid, b: Laid): Pt[] => {
  const sy = a.cy + a.h / 2; // ra ở đáy source
  const ty = b.cy - b.h / 2; // vào ở đỉnh target
  if (Math.abs(a.cx - b.cx) < 2) return [{ x: a.cx, y: sy }, { x: b.cx, y: ty }];
  const midY = (sy + ty) / 2;
  return [
    { x: a.cx, y: sy },
    { x: a.cx, y: midY },
    { x: b.cx, y: midY },
    { x: b.cx, y: ty },
  ];
};

/** Tam giác mũi tên ở đầu cuối polyline, xoay theo hướng đoạn cuối. */
const arrowHead = (pts: Pt[], size: number): string => {
  const tip = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const ang = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const back = ang + Math.PI;
  const spread = 0.42;
  const p1 = { x: tip.x + Math.cos(back - spread) * size, y: tip.y + Math.sin(back - spread) * size };
  const p2 = { x: tip.x + Math.cos(back + spread) * size, y: tip.y + Math.sin(back + spread) * size };
  return toPolyPoints([tip, p1, p2]);
};

export const DiagramScene: React.FC<{
  scene: z.infer<typeof diagramSceneSchema>;
  theme: Theme;
  sceneFrames?: number;
}> = ({ scene, theme, sceneFrames = 240 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { laid } = layoutNodes(scene.nodes, scene.edges);
  const byId = new Map(laid.map((n) => [n.id, n]));
  const nodeDelays = spreadDelays(laid.length, sceneFrames, 0.06, 0.5);
  const delayOfNode = new Map(laid.map((n, i) => [n.id, nodeDelays[i]]));
  const revealStyle = revealStyleOf(scene.id);

  const validEdges = scene.edges.filter(
    (e) => e.from !== e.to && byId.has(e.from) && byId.has(e.to)
  );

  return (
    <SafeArea>
      <SceneHeader
        theme={theme}
        kicker={scene.title ? "Sơ đồ" : undefined}
        title={scene.title}
        sub={scene.sub}
        size={60}
      />

      <div style={{ position: "relative", width: CANVAS_W, height: CANVAS_H, margin: "0 auto" }}>
        {/* Lớp CẠNH: vẽ dần + mũi tên + hạt sáng chạy (SVG, dưới node) */}
        <svg
          width={CANVAS_W}
          height={CANVAS_H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {validEdges.map((e, i) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const pts = routeEdge(a, b);
            const len = polyLength(pts);
            // Cạnh vẽ SAU khi node nguồn hiện; drawProgress mượt 0→1
            const delay = (delayOfNode.get(e.from) ?? 0) + 8;
            const draw = drawProgress({ frame, fps, delay });
            const drawn = draw > 0.9;
            // Hạt sáng: chạy vòng lặp 1.4s sau khi cạnh vẽ xong
            const period = 42;
            const localT = ((frame - delay) % period) / period;
            const dot = drawn ? pointAtPolyline(pts, localT) : null;
            return (
              <g key={i}>
                <polyline
                  points={toPolyPoints(pts)}
                  fill="none"
                  stroke={theme.accentText}
                  strokeOpacity={0.85}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={e.dashed ? "2 10" : `${len}`}
                  strokeDashoffset={e.dashed ? 0 : len * (1 - draw)}
                  style={theme.flat ? undefined : { filter: `drop-shadow(0 0 4px ${theme.accent}66)` }}
                />
                {drawn ? (
                  <polygon points={arrowHead(pts, 16)} fill={theme.accentText} />
                ) : null}
                {dot ? (
                  <>
                    {!theme.flat ? (
                      <circle cx={dot.x} cy={dot.y} r={11} fill={theme.accent} fillOpacity={0.22} />
                    ) : null}
                    <circle cx={dot.x} cy={dot.y} r={5} fill={theme.flat ? theme.accentText : "#FFFFFF"} />
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>

        {/* Nhãn cạnh (HTML chip che line dưới chữ) */}
        {validEdges.map((e, i) => {
          if (!e.label) return null;
          const a = byId.get(e.from)!;
          const b = byId.get(e.to)!;
          const mid = pointAtPolyline(routeEdge(a, b), 0.5);
          const delay = (delayOfNode.get(e.from) ?? 0) + 8;
          const draw = drawProgress({ frame, fps, delay });
          return (
            <div
              key={`lbl-${i}`}
              style={{
                position: "absolute",
                left: mid.x,
                top: mid.y,
                transform: "translate(-50%, -50%)",
                ...type.label,
                fontSize: 22,
                color: theme.textDim,
                background: theme.surface,
                border: `1.5px solid ${theme.surfaceBorder}`,
                borderRadius: 999,
                padding: "6px 18px",
                whiteSpace: "nowrap",
                opacity: draw,
              }}
            >
              {e.label}
            </div>
          );
        })}

        {/* Lớp NODE (HTML, trên cùng). Tách 2 lớp: NGOÀI định vị + căn tâm + đập
            nhẹ (breathe); TRONG là thẻ có animation vào (entrance dùng transform
            riêng nên KHÔNG được đặt chung với translate căn tâm). */}
        {laid.map((n) => {
          const delay = delayOfNode.get(n.id) ?? 0;
          const p = enterSpring({ frame, fps, delay });
          const isHub = n.kind === "hub";
          const radius = isHub ? n.w / 2 : n.kind === "pill" ? n.h / 2 : 22;
          const pulse = n.emphasis && p > 0.95 ? breathe(frame - delay, 0.02) : 1;
          const contentW = n.w - (isHub ? 28 : n.icon ? 84 : 44);
          const labelSize = fitBox(n.label, contentW, 2, {
            max: isHub ? 26 : 32,
            min: 18,
          });
          return (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: n.cx,
                top: n.cy,
                width: n.w,
                height: n.h,
                transform: `translate(-50%, -50%) scale(${pulse})`,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: isHub ? "column" : "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: isHub ? 6 : 16,
                  padding: isHub ? "0 12px" : "0 22px",
                  borderRadius: radius,
                  background: n.emphasis ? theme.accentSoft : theme.surface,
                  border: `2px solid ${n.emphasis ? theme.accentText : theme.surfaceBorder}`,
                  boxShadow: theme.flat
                    ? "0 2px 0 rgba(35,32,28,0.25)"
                    : n.emphasis
                      ? `0 0 50px ${theme.accentSoft}, 0 18px 44px rgba(0,0,0,0.3)`
                      : "0 16px 40px rgba(0,0,0,0.28)",
                  backdropFilter: theme.flat ? undefined : "blur(12px)",
                  ...entrance(revealStyle, p),
                }}
              >
                {n.icon ? (
                  <div style={popIn({ frame, fps, delay: delay + 4 })}>
                    <Icon name={n.icon} size={isHub ? 38 : 42} color={theme.accentText} />
                  </div>
                ) : null}
                <span
                  style={{
                    ...type.title,
                    fontSize: labelSize,
                    color: theme.text,
                    textAlign: isHub || !n.icon ? "center" : "left",
                    lineHeight: 1.12,
                  }}
                >
                  {n.label}
                </span>
                {n.emphasis ? <RunningBorder theme={theme} radius={radius} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </SafeArea>
  );
};

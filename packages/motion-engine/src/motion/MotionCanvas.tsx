import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { getLength, getPointAtLength } from "@remotion/paths";
import { SFX, pick } from "../core/sfx";
import type { MotionDocument, MotionNode } from "./schema";
import { nodeValue } from "./interpolate";
const soundPools = {
  whoosh: SFX.transition,
  ding: SFX.positive,
  pop: SFX.listReveal,
  impact: SFX.statImpact,
  paper: SFX.paper,
};
export const MotionCanvas: React.FC<{
  document: MotionDocument;
  volume?: number;
  durationInFrames?: number;
}> = ({ document: doc, volume = 1, durationInFrames }) => {
  const frame = useCurrentFrame(),
    ratio = (durationInFrames ?? doc.durationSec * 30) / (doc.durationSec * 30),
    t = frame / 30 / ratio;
  const renderNode = (n: MotionNode): React.ReactNode => {
    if (t < n.start || t >= (n.end ?? doc.durationSec)) return null;
    const v = (k: string, f: number) => Number(nodeValue(n, k, t, f));
    const fill = String(nodeValue(n, "fill", t, n.fill)),
      stroke = String(nodeValue(n, "stroke", t, n.stroke));
    const opacity = Math.max(0, Math.min(1, v("opacity", 1))),
      draw = Math.max(0, Math.min(1, v("draw", 1)));
    let x = v("x", 0),
      y = v("y", 0);
    if (n.followPath) {
      const p = getPointAtLength(
        n.followPath,
        getLength(n.followPath) * Math.max(0, Math.min(1, v("progress", 0))),
      );
      x += p.x;
      y += p.y;
    }
    const common = {
      fill,
      stroke,
      strokeWidth: n.strokeWidth,
      strokeDasharray: n.strokeDasharray,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };
    let shape: React.ReactNode;
    if (n.kind === "group")
      shape = doc.nodes.filter((p) => p.parent === n.id).map(renderNode);
    else if (n.kind === "rect")
      shape = (
        <rect
          x={-n.width / 2}
          y={-n.height / 2}
          width={n.width}
          height={n.height}
          rx={n.radius}
          {...common}
        />
      );
    else if (n.kind === "ellipse")
      shape = (
        <ellipse
          rx={n.radius || n.width / 2}
          ry={n.radius || n.height / 2}
          {...common}
        />
      );
    else if (n.kind === "path")
      shape = (
        <path
          d={n.path}
          pathLength={draw < 1 ? 1 : undefined}
          {...common}
          strokeDasharray={draw < 1 ? "1" : n.strokeDasharray}
          strokeDashoffset={draw < 1 ? 1 - draw : undefined}
        />
      );
    else {
      const text = n.text.slice(
        0,
        Math.round(n.text.length * Math.max(0, Math.min(1, v("reveal", 1)))),
      );
      const lines = text.split("\n");
      shape = (
        <text
          {...common}
          textAnchor={n.align}
          fontSize={n.fontSize}
          fontWeight={n.fontWeight}
          fontFamily={
            n.fontFamily === "mono"
              ? "monospace"
              : n.fontFamily === "serif"
                ? "Georgia, serif"
                : '"Be Vietnam Pro", sans-serif'
          }
        >
          {n.spans?.length ? (
            <tspan x="0" y={n.fontSize * 0.34}>
              {n.spans.map((span, i) => (
                <tspan key={i} fill={span.fill}>
                  {span.text}
                </tspan>
              ))}
            </tspan>
          ) : (
            lines.map((line, i) => (
              <tspan
                key={i}
                x="0"
                y={
                  (i - (lines.length - 1) / 2) * n.fontSize * 1.22 +
                  n.fontSize * 0.34
                }
              >
                {line}
              </tspan>
            ))
          )}
        </text>
      );
    }
    return (
      <g
        key={n.id}
        opacity={opacity}
        transform={`translate(${x} ${y}) rotate(${v("rotation", 0)}) scale(${v("scale", 1)})`}
        style={{
          filter: `blur(${Math.max(0, v("blur", 0))}px)${n.glow ? ` drop-shadow(0 0 ${n.glow}px ${stroke === "none" ? fill : stroke})` : ""}`,
        }}
      >
        <g
          style={{
            transform: `perspective(900px) rotateX(${v("rotateX", 0)}deg) rotateY(${v("rotateY", 0)}deg)`,
            transformOrigin: "0px 0px",
          }}
        >
          {shape}
        </g>
      </g>
    );
  };
  return (
    <AbsoluteFill style={{ background: doc.background }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${doc.width} ${doc.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "hidden" }}
      >
        {doc.nodes.filter((n) => !n.parent).map(renderNode)}
      </svg>
      {doc.cues.map((c, i) => (
        <Sequence key={i} from={Math.round(c.at * 30 * ratio)}>
          <Audio
            src={staticFile(pick(soundPools[c.kind], `motion-${c.kind}-${i}`))}
            volume={c.volume * volume}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

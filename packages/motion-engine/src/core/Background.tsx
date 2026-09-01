import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";
import { Theme } from "../style/presets";
import { HEIGHT, WIDTH } from "../schema/spec";

/**
 * Nền động: 3 blob gradient lớn trôi theo NHIỄU PERLIN (organic, không lặp giật)
 * + shimmer sáng/tối rất chậm + grain + vignette. Nhiễu 2D cho quỹ đạo trôi tự
 * nhiên như khói/aurora thay vì dao động sin đều đều → chiều sâu điện ảnh.
 */
export const Background: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();

  // Flat (editorial paper): nền phẳng sạch + grain rất nhẹ — không blob/lưới/vignette
  if (theme.flat) {
    return (
      <AbsoluteFill style={{ backgroundColor: theme.bgBase }}>
        <AbsoluteFill style={{ opacity: 0.5 }}>
          <svg width="100%" height="100%">
            <filter id="grain-flat">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.05" />
              </feComponentTransfer>
            </filter>
            <rect width="100%" height="100%" filter="url(#grain-flat)" />
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const blob = (
    color: string,
    cx: number,
    cy: number,
    r: number,
    speed: number,
    phase: number
  ): React.CSSProperties => {
    const t = frame * 0.006 * speed;
    // quỹ đạo trôi theo nhiễu Perlin (biên độ lớn hơn sin cũ, mượt & không lặp)
    const nx = noise2D(`bx-${phase}`, t, phase * 0.11) * 120;
    const ny = noise2D(`by-${phase}`, t * 0.85 + 10, phase * 0.11) * 150;
    // shimmer độ sáng rất chậm cho cảm giác "thở" như aurora
    const base = theme.isDark ? 0.85 : 0.9;
    const shimmer = base + noise2D(`op-${phase}`, frame * 0.01, 0) * 0.12;
    return {
      position: "absolute",
      left: cx - r + nx,
      top: cy - r + ny,
      width: r * 2,
      height: r * 2,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      opacity: Math.max(0.6, Math.min(1, shimmer)),
    };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bgBase, overflow: "hidden" }}>
      <div style={blob(theme.blobs[0], WIDTH * 0.15, HEIGHT * 0.12, 620, 0.5, 0)} />
      <div style={blob(theme.blobs[1], WIDTH * 0.95, HEIGHT * 0.45, 560, 0.35, 200)} />
      <div style={blob(theme.blobs[2], WIDTH * 0.3, HEIGHT * 0.95, 640, 0.42, 480)} />

      {/* lưới chấm mờ tạo cảm giác "kỹ thuật" */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${
            theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"
          } 1.5px, transparent 1.5px)`,
          backgroundSize: "44px 44px",
        }}
      />

      {/* grain */}
      <AbsoluteFill style={{ opacity: theme.isDark ? 0.35 : 0.22 }}>
        <svg width="100%" height="100%">
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.14" />
            </feComponentTransfer>
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>

      {/* vignette */}
      <AbsoluteFill
        style={{
          background: theme.isDark
            ? "radial-gradient(ellipse at 50% 42%, transparent 55%, rgba(0,0,0,0.5) 100%)"
            : "radial-gradient(ellipse at 50% 42%, transparent 60%, rgba(60,40,20,0.18) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

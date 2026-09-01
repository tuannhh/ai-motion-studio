import React from 'react';
import {Audio} from '@remotion/media';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import '@fontsource/fraunces/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';

export const FPS = 30;

export type NodeKind = 'input' | 'focal' | 'store' | 'service' | 'optional';

export type DiagramNode = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly kind?: NodeKind;
};

export type DiagramEdge = {
  readonly points: readonly (readonly [number, number])[];
  readonly label?: string;
  readonly accent?: boolean;
};

export type DiagramScene = {
  readonly title: string;
  readonly subtitle?: string;
  readonly durationSeconds: number;
  readonly nodes: readonly DiagramNode[];
  readonly edges?: readonly DiagramEdge[];
  readonly takeaway?: string;
};

export type DiagramVideoSpec = {
  readonly title: string;
  readonly subtitle?: string;
  readonly voiceSrc?: string;
  readonly scenes: readonly DiagramScene[];
};

export const durationInFramesFor = (spec: DiagramVideoSpec) =>
  Math.max(
    FPS,
    Math.round(spec.scenes.reduce((total, scene) => total + scene.durationSeconds * FPS, 0)),
  );

const D = {
  paper: '#FFF8F4',
  paper2: '#FFF0EA',
  ink: '#252525',
  muted: '#6D6764',
  rule: 'rgba(37,37,37,0.2)',
  accent: '#D95C45',
  accentTint: 'rgba(217,92,69,0.13)',
  link: '#4A76A8',
  linkTint: 'rgba(74,118,168,0.1)',
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const reveal = (frame: number, start: number, duration = 18) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const edgePath = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');

const nodeStyle = (kind: NodeKind) => {
  if (kind === 'focal') {
    return {border: D.accent, fill: D.accentTint, title: D.accent, subtitle: D.ink};
  }
  if (kind === 'store') {
    return {border: D.link, fill: D.linkTint, title: D.ink, subtitle: D.link};
  }
  if (kind === 'input') {
    return {border: D.muted, fill: 'rgba(37,37,37,0.045)', title: D.ink, subtitle: D.muted};
  }
  if (kind === 'optional') {
    return {border: D.muted, fill: 'rgba(37,37,37,0.02)', title: D.ink, subtitle: D.muted, dashed: true};
  }
  return {border: D.rule, fill: D.paper2, title: D.ink, subtitle: D.muted};
};

const Node: React.FC<{node: DiagramNode; delay: number}> = ({node, delay}) => {
  const frame = useCurrentFrame();
  const p = reveal(frame, delay);
  const style = nodeStyle(node.kind ?? 'service');
  const width = node.width ?? 340;
  const height = node.height ?? 152;
  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width,
        height,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 28px',
        border: `2px ${style.dashed ? 'dashed' : 'solid'} ${style.border}`,
        borderRadius: 8,
        backgroundColor: style.fill,
        opacity: p,
        translate: `0 ${interpolate(p, [0, 1], [20, 0])}px`,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 700,
          fontSize: 37,
          lineHeight: 1.25,
          letterSpacing: '-0.035em',
          color: style.title,
        }}
      >
        {node.title}
      </div>
      {node.subtitle ? (
        <div
          style={{
            marginTop: 8,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 20,
            lineHeight: 1.25,
            color: style.subtitle,
          }}
        >
          {node.subtitle}
        </div>
      ) : null}
    </div>
  );
};

const Edges: React.FC<{edges: readonly DiagramEdge[]}> = ({edges}) => {
  const frame = useCurrentFrame();
  return (
    <svg
      viewBox="0 0 1080 1920"
      aria-hidden="true"
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}
    >
      <defs>
        <marker id="diagram-arrow" markerWidth="11" markerHeight="9" refX="10" refY="4.5" orient="auto">
          <path d="M0 0L11 4.5L0 9Z" fill={D.muted} />
        </marker>
        <marker id="diagram-arrow-accent" markerWidth="11" markerHeight="9" refX="10" refY="4.5" orient="auto">
          <path d="M0 0L11 4.5L0 9Z" fill={D.accent} />
        </marker>
      </defs>
      {edges.map((edge, index) => {
        const p = reveal(frame, 64 + index * 22);
        const color = edge.accent ? D.accent : D.muted;
        const midpoint = edge.points[Math.floor(edge.points.length / 2)];
        return (
          <React.Fragment key={`${index}-${edgePath(edge.points)}`}>
            <path
              d={edgePath(edge.points)}
              fill="none"
              stroke={color}
              strokeWidth={edge.accent ? 4 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={p}
              markerEnd={edge.accent ? 'url(#diagram-arrow-accent)' : 'url(#diagram-arrow)'}
            />
            {edge.label && midpoint ? (
              <>
                <rect
                  x={midpoint[0] - edge.label.length * 7 - 12}
                  y={midpoint[1] - 42}
                  width={edge.label.length * 14 + 24}
                  height={34}
                  rx={4}
                  fill={D.paper}
                  opacity={p}
                />
                <text
                  x={midpoint[0]}
                  y={midpoint[1] - 18}
                  textAnchor="middle"
                  fill={color}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="19"
                  opacity={p}
                >
                  {edge.label}
                </text>
              </>
            ) : null}
          </React.Fragment>
        );
      })}
    </svg>
  );
};

const Scene: React.FC<{scene: DiagramScene; index: number; videoTitle: string}> = ({scene, index, videoTitle}) => {
  const frame = useCurrentFrame();
  const header = reveal(frame, 0, 20);
  const takeaway = reveal(frame, 124, 20);
  return (
    <AbsoluteFill style={{backgroundColor: D.paper, color: D.ink, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 64, right: 64, top: 80, height: 1, backgroundColor: D.rule}} />
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 112,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 20,
          lineHeight: 1.25,
          letterSpacing: '0.1em',
          color: D.muted,
          opacity: header,
        }}
      >
        {String(index + 1).padStart(2, '0')} · {videoTitle.toUpperCase()}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          top: 190,
          fontFamily: 'Fraunces, serif',
          fontWeight: 700,
          fontSize: 86,
          lineHeight: 1.25,
          letterSpacing: '-0.05em',
          color: D.ink,
          opacity: header,
          translate: `0 ${interpolate(header, [0, 1], [24, 0])}px`,
        }}
      >
        {scene.title}
      </div>
      {scene.subtitle ? (
        <div
          style={{
            position: 'absolute',
            left: 64,
            right: 64,
            top: 332,
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 500,
            fontSize: 30,
            lineHeight: 1.25,
            color: D.muted,
            opacity: header,
          }}
        >
          {scene.subtitle}
        </div>
      ) : null}
      <Edges edges={scene.edges ?? []} />
      {scene.nodes.map((node, nodeIndex) => (
        <Node key={node.id} node={node} delay={26 + nodeIndex * 20} />
      ))}
      {scene.takeaway ? (
        <div
          style={{
            position: 'absolute',
            left: 64,
            right: 64,
            bottom: 116,
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 500,
            fontSize: 30,
            lineHeight: 1.25,
            color: D.muted,
            textAlign: 'center',
            opacity: takeaway,
          }}
        >
          {scene.takeaway}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const DiagramVideo: React.FC<DiagramVideoSpec> = (spec) => {
  let start = 0;
  return (
    <AbsoluteFill>
      {spec.voiceSrc ? <Audio src={staticFile(spec.voiceSrc)} volume={1} /> : null}
      {spec.scenes.map((scene, index) => {
        const from = start;
        const durationInFrames = Math.round(scene.durationSeconds * FPS);
        start += durationInFrames;
        return (
          <Sequence
            key={`${index}-${scene.title}`}
            from={from}
            durationInFrames={durationInFrames}
            premountFor={FPS}
          >
            <Scene scene={scene} index={index} videoTitle={spec.title} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

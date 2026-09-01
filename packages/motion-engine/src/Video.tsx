import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import {
  TransitionSeries,
  linearTiming,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import {
  FPS,
  Scene,
  TRANSITION_FRAMES,
  VideoSpec,
  sceneDurationInFrames,
} from "./schema/spec";
import { resolveTheme, Theme } from "./style/presets";
import { Background } from "./core/Background";
import { KaraokeCaption } from "./core/Captions";
import { Watermark } from "./core/Watermark";
import { ProgressChip } from "./core/ui";
import { HookScene } from "./scenes/Hook";
import { PointsScene } from "./scenes/Points";
import { FlowScene } from "./scenes/Flow";
import { TimelineScene } from "./scenes/Timeline";
import { CompareScene } from "./scenes/Compare";
import { StatScene } from "./scenes/Stat";
import { QuoteScene } from "./scenes/Quote";
import { RankScene } from "./scenes/Rank";
import { ChartScene } from "./scenes/Chart";
import { MediaScene } from "./scenes/Media";
import { BigWordScene } from "./scenes/BigWord";
import { OutroScene } from "./scenes/Outro";
import { AnnotateScene } from "./scenes/Annotate";
import { TerminalScene } from "./scenes/Terminal";
import { ScreenshotScene } from "./scenes/Screenshot";
import { PhotoBackdrop } from "./core/PhotoBackdrop";
import { maskWipe, scaleThrough, whipPan } from "./core/transitions";
import { seedOf } from "./core/motion";

const SceneRenderer: React.FC<{
  scene: Scene;
  theme: Theme;
  channelHandle?: string;
}> = ({ scene, theme, channelHandle }) => {
  switch (scene.type) {
    case "hook":
      return <HookScene scene={scene} theme={theme} />;
    case "points":
      return <PointsScene scene={scene} theme={theme} />;
    case "flow":
      return <FlowScene scene={scene} theme={theme} />;
    case "timeline":
      return <TimelineScene scene={scene} theme={theme} />;
    case "compare":
      return <CompareScene scene={scene} theme={theme} />;
    case "stat":
      return <StatScene scene={scene} theme={theme} />;
    case "quote":
      return <QuoteScene scene={scene} theme={theme} />;
    case "rank":
      return <RankScene scene={scene} theme={theme} />;
    case "chart":
      return <ChartScene scene={scene} theme={theme} />;
    case "media":
      return <MediaScene scene={scene} theme={theme} />;
    case "bigword":
      return <BigWordScene scene={scene} theme={theme} />;
    case "annotate":
      return <AnnotateScene scene={scene} theme={theme} />;
    case "terminal":
      return <TerminalScene scene={scene} theme={theme} />;
    case "screenshot":
      return <ScreenshotScene scene={scene} theme={theme} />;
    case "outro":
      return <OutroScene scene={scene} theme={theme} channelHandle={channelHandle} />;
  }
};

/** file trong spec là đường dẫn tương đối trong publicDir (đã được stage) */
const asSrc = (file: string) =>
  file.startsWith("http") ? file : staticFile(file);

/**
 * SFX tự động của engine (assets/sfx do scripts/gen-sfx.ts sinh, license-free):
 * whoosh seeded ở mỗi lần vào cảnh, thump nhấn thêm cho cảnh số liệu lớn.
 */
const AUTO_WHOOSH = ["sfx/whoosh-a.wav", "sfx/whoosh-b.wav"];
const THUMP_TYPES = new Set(["stat", "bigword", "chart"]);
/** scene lấy CHỮ làm trung tâm → cần scrim đậm hơn khi có ảnh nền để chữ nổi rõ */
const TEXT_HEAVY_TYPES = new Set(["hook", "bigword", "quote", "outro"]);

/** Frame bắt đầu của từng scene trong TransitionSeries (mỗi transition chồng lấn TRANSITION_FRAMES) */
const sceneStartFrames = (spec: VideoSpec): number[] => {
  const starts: number[] = [];
  let cursor = 0;
  spec.scenes.forEach((scene, i) => {
    starts.push(cursor);
    cursor += sceneDurationInFrames(scene) - (i < spec.scenes.length - 1 ? TRANSITION_FRAMES : 0);
  });
  return starts;
};

/**
 * Sidechain ducking: nhạc nền tự nhún xuống khi voiceover đang nói
 * (ramp 10 frame vào/ra, giữ ~28% mức gốc trong lúc nói).
 */
export const buildMusicVolume = (spec: VideoSpec): ((frame: number) => number) => {
  const starts = sceneStartFrames(spec);
  const ranges = spec.scenes.flatMap((scene, i) =>
    scene.voiceover
      ? [{ from: starts[i], to: starts[i] + Math.round((scene.voiceover.durationMs / 1000) * FPS) }]
      : []
  );
  const RAMP = 10;
  const DUCK = 0.28;
  return (frame: number) => {
    let env = 0;
    for (const r of ranges) {
      if (frame < r.from - RAMP || frame > r.to + RAMP) continue;
      const rise = Math.min(1, Math.max(0, (frame - (r.from - RAMP)) / RAMP));
      const fall = Math.min(1, Math.max(0, ((r.to + RAMP) - frame) / RAMP));
      env = Math.max(env, Math.min(rise, fall));
    }
    return spec.audio.musicVolume * (1 - (1 - DUCK) * env);
  };
};

/**
 * Transition chọn theo seed (slug + vị trí): mỗi video một chuỗi chuyển cảnh
 * riêng nhưng render lại luôn y hệt (deterministic). Palette 8 kiểu gồm 3
 * transition tự dựng theo remotion-skill (whip pan, scale-through, mask wipe).
 */
const transitionFor = (
  slug: string,
  index: number,
  theme: Theme
): TransitionPresentation<any> => {
  const palette: Array<() => TransitionPresentation<any>> = [
    () => slide({ direction: "from-bottom" }),
    () => slide({ direction: "from-right" }),
    () => fade(),
    () => wipe({ direction: "from-left" }),
    () => whipPan({ direction: seedOf(`${slug}-whip-${index}`) > 0.5 ? 1 : -1 }),
    () => scaleThrough(),
    () => maskWipe({ accent: theme.accent }),
    () => slide({ direction: "from-left" }),
  ];
  const pick = Math.floor(seedOf(`${slug}-t-${index}`) * palette.length) % palette.length;
  return palette[pick]();
};

export const Video: React.FC<{ spec: VideoSpec }> = ({ spec }) => {
  const theme = resolveTheme(spec.style.preset, spec.style.accent);
  const total = spec.scenes.length;

  return (
    <AbsoluteFill>
      {/* Nền bền vững xuyên suốt — transition chỉ áp lên lớp nội dung */}
      <Background theme={theme} />

      <TransitionSeries>
        {spec.scenes.map((scene, i) => {
          const elements = [
            <TransitionSeries.Sequence
              key={scene.id}
              durationInFrames={sceneDurationInFrames(scene)}
            >
              {scene.voiceover ? (
                <Audio src={asSrc(scene.voiceover.file)} />
              ) : null}
              {scene.sfx.map((cue, ci) => (
                <Sequence key={ci} from={cue.atFrame}>
                  <Audio src={asSrc(cue.file)} volume={cue.volume} />
                </Sequence>
              ))}
              {spec.audio.autoSfx && i > 0 ? (
                <Audio
                  src={staticFile(
                    AUTO_WHOOSH[
                      Math.floor(
                        seedOf(`${spec.meta.slug}-sfx-${i}`) * AUTO_WHOOSH.length
                      ) % AUTO_WHOOSH.length
                    ]
                  )}
                  volume={spec.audio.sfxVolume}
                />
              ) : null}
              {spec.audio.autoSfx && THUMP_TYPES.has(scene.type) ? (
                <Sequence from={TRANSITION_FRAMES}>
                  <Audio
                    src={staticFile("sfx/thump.wav")}
                    volume={spec.audio.sfxVolume * 0.9}
                  />
                </Sequence>
              ) : null}
              {scene.bgImage && scene.type !== "annotate" ? (
                <PhotoBackdrop
                  src={scene.bgImage}
                  theme={theme}
                  seed={seedOf(`${spec.meta.slug}-kb-${scene.id}`)}
                  // scene nhiều CHỮ LỚN → scrim đậm hơn để headline luôn đọc được
                  midScrim={TEXT_HEAVY_TYPES.has(scene.type) ? 0.6 : 0.42}
                />
              ) : null}
              <SceneRenderer
                scene={scene}
                theme={theme}
                channelHandle={
                  spec.style.watermark?.kind === "text"
                    ? spec.style.watermark.text
                    : undefined
                }
              />
              {spec.style.progress && scene.type !== "hook" && scene.type !== "outro" ? (
                <ProgressChip
                  theme={theme}
                  index={i}
                  total={total}
                  series={spec.meta.series}
                />
              ) : null}
              {/* Outro có headline/CTA riêng — caption karaoke ở đáy chỉ gây rối
                  (frame cuối trước đây lòi ra text "theo dõi kênh" thừa) */}
              {spec.style.captions && scene.type !== "outro" ? (
                <KaraokeCaption scene={scene} theme={theme} />
              ) : null}
            </TransitionSeries.Sequence>,
          ];
          if (i < spec.scenes.length - 1) {
            elements.push(
              <TransitionSeries.Transition
                key={`t-${scene.id}`}
                presentation={transitionFor(spec.meta.slug, i, theme)}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />
            );
          }
          return elements;
        })}
      </TransitionSeries>

      {spec.style.watermark ? (
        <Watermark watermark={spec.style.watermark} theme={theme} />
      ) : null}

      {spec.audio.music ? (
        <Audio
          src={asSrc(spec.audio.music)}
          volume={buildMusicVolume(spec)}
          loop
        />
      ) : null}
    </AbsoluteFill>
  );
};

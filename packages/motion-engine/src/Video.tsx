import React from "react";
import { MotionCanvas } from "./motion/MotionCanvas";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import {
  TransitionSeries,
  linearTiming,
  type TransitionPresentation,
} from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import {
  FPS,
  Scene,
  TRANSITION_FRAMES,
  VideoSpec,
  sceneDurationInFrames,
  totalDurationInFrames,
} from "./schema/spec";
import { resolveTheme, Theme } from "./style/presets";
import { Background } from "./core/Background";
import { KaraokeCaption } from "./core/Captions";
import { Watermark } from "./core/Watermark";
import { ProgressChip } from "./core/ui";
import { HookScene } from "./scenes/Hook";
import { PointsScene } from "./scenes/Points";
import { FlowScene } from "./scenes/Flow";
import { DiagramScene } from "./scenes/Diagram";
import { TimelineScene } from "./scenes/Timeline";
import { CompareScene } from "./scenes/Compare";
import { VersusScene } from "./scenes/Versus";
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
import {
  blurZoom,
  fadeThroughBg,
  iris,
  maskWipe,
  pushDiagonal,
  scaleThrough,
  whipPan,
} from "./core/transitions";
import { seedOf } from "./core/motion";
import { isMoneyUnit, pick, SFX } from "./core/sfx";

const SceneRenderer: React.FC<{
  scene: Scene;
  theme: Theme;
  channelHandle?: string;
  motionVolume?: number;
}> = ({ scene, theme, channelHandle, motionVolume }) => {
  // Thời lượng scene (frame) để rải reveal item theo nhịp đọc ("nói tới đâu hiện tới đó")
  const sceneFrames = sceneDurationInFrames(scene);
  switch (scene.type) {
    case "motion":
      return (
        <MotionCanvas
          document={scene.document}
          volume={motionVolume}
          durationInFrames={sceneFrames}
        />
      );
    case "hook":
      return <HookScene scene={scene} theme={theme} />;
    case "points":
      return (
        <PointsScene scene={scene} theme={theme} sceneFrames={sceneFrames} />
      );
    case "flow":
      return (
        <FlowScene scene={scene} theme={theme} sceneFrames={sceneFrames} />
      );
    case "diagram":
      return (
        <DiagramScene scene={scene} theme={theme} sceneFrames={sceneFrames} />
      );
    case "timeline":
      return (
        <TimelineScene scene={scene} theme={theme} sceneFrames={sceneFrames} />
      );
    case "compare":
      return <CompareScene scene={scene} theme={theme} />;
    case "versus":
      return <VersusScene scene={scene} theme={theme} />;
    case "stat":
      return <StatScene scene={scene} theme={theme} />;
    case "quote":
      return <QuoteScene scene={scene} theme={theme} />;
    case "rank":
      return (
        <RankScene scene={scene} theme={theme} sceneFrames={sceneFrames} />
      );
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
      return (
        <OutroScene scene={scene} theme={theme} channelHandle={channelHandle} />
      );
  }
};

/** file trong spec là đường dẫn tương đối trong publicDir (đã được stage) */
const asSrc = (file: string) =>
  file.startsWith("http") ? file : staticFile(file);

/**
 * SFX tự động của engine (thư viện Mixkit thật — xem core/sfx.ts): whoosh
 * seeded ở mỗi lần vào cảnh, impact nhấn thêm cho cảnh số liệu lớn.
 */
const THUMP_TYPES = new Set(["stat", "bigword", "chart"]);
/** Preset chất "công nghệ" → dùng bộ UI/tech riêng cho screenshot/terminal thay vì bộ UI thường */
const TECH_PRESETS = new Set(["midnight", "aurora"]);
/** Số frame riser build-up chạy TRƯỚC khi vào 1 scene số liệu/chữ lớn (~0.7s @30fps) */
const BUILD_UP_LEAD = 20;
/** scene lấy CHỮ làm trung tâm → cần scrim đậm hơn khi có ảnh nền để chữ nổi rõ */
const TEXT_HEAVY_TYPES = new Set(["hook", "bigword", "quote", "outro"]);
/**
 * Scene mà nội dung CHÍNH đã là chữ lớn được đọc → tắt karaoke caption đáy màn:
 * để cả chữ lớn + caption cùng hiện gây cảm giác "đọc/hiện đôi". (outro có
 * headline/CTA riêng, quote là câu trích, bigword là cụm chữ theo beat.)
 */
const NO_CAPTION_TYPES = new Set(["outro", "quote", "bigword", "motion"]);

/**
 * SFX nhấn theo NHỊP REVEAL của từng loại scene — đa dạng hoá âm thanh thay vì
 * chỉ 1 tiếng whoosh mỗi lần chuyển cảnh. tick/pop = từng mục danh sách/khối
 * chữ hiện; ding = khoảnh khắc chốt (số liệu, dòng highlight, accent). Mỗi cue
 * pick() theo seed riêng (scene.id + tag + số thứ tự gọi trong core/sfx.ts) nên
 * không lặp đúng 1 âm thanh xuyên suốt video như engine cũ. Preset "paper"
 * (editorial giấy) đổi hẳn sang bộ SFX.paper cho đồng nhất chất liệu hình ảnh.
 * Trả cue theo frame TƯƠNG ĐỐI trong scene; volume đã nhân sfxVolume. Nhịp bám
 * theo stagger reveal của scene (xem delay trong từng scene component).
 */
const ENTRY = TRANSITION_FRAMES + 6;
const autoRevealCues = (
  scene: Scene,
  sfxVol: number,
  theme: Theme,
  isTechPreset: boolean,
): { file: string; from: number; volume: number }[] => {
  const cues: { file: string; from: number; volume: number }[] = [];
  let seq = 0;
  const tickPool = theme.flat ? SFX.paper : SFX.listReveal;
  const popPool = theme.flat ? SFX.paper : SFX.listReveal;
  const dingPool = theme.flat ? SFX.paper : SFX.positive;
  const tick = (from: number, v = 0.5) =>
    cues.push({
      file: pick(tickPool, `${scene.id}-tick-${seq++}`),
      from,
      volume: sfxVol * v,
    });
  const pop = (from: number, v = 0.7) =>
    cues.push({
      file: pick(popPool, `${scene.id}-pop-${seq++}`),
      from,
      volume: sfxVol * v,
    });
  const ding = (from: number, v = 0.85) =>
    cues.push({
      file: pick(dingPool, `${scene.id}-ding-${seq++}`),
      from,
      volume: sfxVol * v,
    });
  switch (scene.type) {
    case "points":
      scene.items.forEach((_, i) => tick(ENTRY + i * 10));
      break;
    case "timeline":
      scene.steps.forEach((_, i) => tick(ENTRY + i * 11));
      break;
    case "rank":
      scene.items.forEach((it, i) =>
        it.highlight ? ding(ENTRY + i * 10) : tick(ENTRY + i * 10),
      );
      break;
    case "flow":
      scene.nodes.forEach((node, i) =>
        node.emphasis ? pop(ENTRY + i * 12, 0.5) : tick(ENTRY + i * 12),
      );
      break;
    case "diagram":
      scene.nodes.forEach((node, i) =>
        node.emphasis ? pop(ENTRY + i * 11, 0.5) : tick(ENTRY + i * 11),
      );
      break;
    case "compare": {
      const pool = theme.flat ? SFX.paper : SFX.compare;
      cues.push({
        file: pick(pool, `${scene.id}-cmp-${seq++}`),
        from: ENTRY,
        volume: sfxVol * 0.55,
      });
      cues.push({
        file: pick(pool, `${scene.id}-cmp-${seq++}`),
        from: ENTRY + 12,
        volume: sfxVol * 0.55,
      });
      break;
    }
    case "versus": {
      const pool = theme.flat ? SFX.paper : SFX.compare;
      cues.push({
        file: pick(pool, `${scene.id}-versus-${seq++}`),
        from: ENTRY + 14,
        volume: sfxVol * 0.7,
      });
      break;
    }
    case "terminal": {
      let f = ENTRY;
      for (const ln of scene.lines) {
        if (ln.kind === "cmd") {
          tick(f);
          f += 16;
        } else f += 8;
      }
      break;
    }
    case "screenshot": {
      const pool = theme.flat
        ? SFX.paper
        : isTechPreset
          ? SFX.uiScreenTech
          : SFX.uiScreen;
      if (scene.markers.length) {
        scene.markers.forEach((_, i) =>
          cues.push({
            file: pick(pool, `${scene.id}-ui-${seq++}`),
            from: ENTRY + i * 14,
            volume: sfxVol * 0.5,
          }),
        );
      } else {
        cues.push({
          file: pick(pool, `${scene.id}-ui-${seq++}`),
          from: ENTRY,
          volume: sfxVol * 0.6,
        });
      }
      break;
    }
    case "stat": {
      const pool = theme.flat
        ? SFX.paper
        : isMoneyUnit(scene.unit)
          ? SFX.moneyGrowth
          : SFX.positive;
      cues.push({
        file: pick(pool, `${scene.id}-ding-${seq++}`),
        from: ENTRY + 8,
        volume: sfxVol * 0.85,
      });
      break;
    }
    case "chart":
      ding(ENTRY + 10);
      break;
    case "bigword":
      scene.phrases.forEach((p, i) =>
        p.accent ? ding(ENTRY + i * 18) : pop(ENTRY + i * 18, 0.55),
      );
      break;
    case "quote":
      pop(ENTRY, 0.5);
      break;
    case "annotate":
      pop(ENTRY + 16, 0.5);
      break;
    default:
      break;
  }
  return cues;
};

/** Frame bắt đầu của từng scene trong TransitionSeries (mỗi transition chồng lấn TRANSITION_FRAMES) */
const sceneStartFrames = (spec: VideoSpec): number[] => {
  const starts: number[] = [];
  let cursor = 0;
  spec.scenes.forEach((scene, i) => {
    starts.push(cursor);
    cursor +=
      sceneDurationInFrames(scene) -
      (i < spec.scenes.length - 1 ? TRANSITION_FRAMES : 0);
  });
  return starts;
};

/**
 * Sidechain ducking: nhạc nền tự nhún xuống khi voiceover đang nói
 * (ramp 10 frame vào/ra, giữ ~42% mức gốc trong lúc nói).
 * + Fade in/out toàn cục 1s đầu/cuối video (phản hồi 2026-09-03: nhạc cắt cụt lúc
 * mở/kết thúc nghe hụt) — nhân thêm vào cùng envelope, không ảnh hưởng ducking.
 */
const MUSIC_FADE_FRAMES = FPS; // 1 giây
export const buildMusicVolume = (
  spec: VideoSpec,
): ((frame: number) => number) => {
  const starts = sceneStartFrames(spec);
  const ranges = spec.scenes.flatMap((scene, i) =>
    scene.voiceover
      ? [
          {
            from: starts[i],
            to:
              starts[i] + Math.round((scene.voiceover.durationMs / 1000) * FPS),
          },
        ]
      : [],
  );
  const RAMP = 10;
  const DUCK = 0.42;
  const total = totalDurationInFrames(spec);
  return (frame: number) => {
    let env = 0;
    for (const r of ranges) {
      if (frame < r.from - RAMP || frame > r.to + RAMP) continue;
      const rise = Math.min(1, Math.max(0, (frame - (r.from - RAMP)) / RAMP));
      const fall = Math.min(1, Math.max(0, (r.to + RAMP - frame) / RAMP));
      env = Math.max(env, Math.min(rise, fall));
    }
    const fadeIn = Math.min(1, Math.max(0, frame / MUSIC_FADE_FRAMES));
    const fadeOut = Math.min(
      1,
      Math.max(0, (total - frame) / MUSIC_FADE_FRAMES),
    );
    const fade = Math.min(fadeIn, fadeOut);
    return spec.audio.musicVolume * (1 - (1 - DUCK) * env) * fade;
  };
};

/**
 * Transition chọn theo seed (slug + vị trí): mỗi video một chuỗi chuyển cảnh
 * riêng nhưng render lại luôn y hệt (deterministic). Palette 8 kiểu gồm 3
 * transition tự dựng theo remotion-skill (whip pan, scale-through, mask wipe).
 */
/** Bảng chuyển cảnh (11 kiểu) — mỗi phần tử nhận theme để đổi màu accent nếu cần */
const TRANSITIONS: Array<
  (slug: string, index: number, theme: Theme) => TransitionPresentation<any>
> = [
  () => slide({ direction: "from-bottom" }),
  () => slide({ direction: "from-right" }),
  () => fadeThroughBg(),
  () => wipe({ direction: "from-left" }),
  (slug, index) =>
    whipPan({ direction: seedOf(`${slug}-whip-${index}`) > 0.5 ? 1 : -1 }),
  () => scaleThrough(),
  (_slug, _index, theme) => maskWipe({ accent: theme.accent }),
  () => slide({ direction: "from-left" }),
  () => blurZoom(),
  () => iris(),
  (slug, index) =>
    pushDiagonal({
      dx: 1120,
      dy: seedOf(`${slug}-push-${index}`) > 0.5 ? 380 : -380,
    }),
];

/**
 * P6 VOX: pool con CHỈ gồm transition dứt khoát/năng lượng cao (bỏ slide/fade/wipe
 * êm) — "cắt cảnh nhanh gọn" đặc trưng explainer VOX. KHÔNG đụng TRANSITION_FRAMES
 * (thời lượng chuyển cảnh) vì hằng số đó chi phối toàn bộ phép tính duration/cue —
 * chỉ đổi KIỂU cắt, giữ nguyên nhịp thời gian đã kiểm chứng.
 */
const VOX_TRANSITION_IDX: number[] = [4, 5, 6, 8, 9, 10];

/**
 * Chọn transition theo seed nhưng KHÔNG lặp lại đúng kiểu vừa dùng ở scene trước
 * (trước đây 2 cảnh liền nhau có thể trùng transition → cảm giác "đơn điệu").
 */
const transitionFor = (
  slug: string,
  index: number,
  theme: Theme,
): TransitionPresentation<any> => {
  const pool: number[] =
    theme.flavor === "vox" ? VOX_TRANSITION_IDX : TRANSITIONS.map((_, i) => i);
  const n = pool.length;
  let pick = pool[Math.floor(seedOf(`${slug}-t-${index}`) * n) % n];
  if (index > 0) {
    const prev = pool[Math.floor(seedOf(`${slug}-t-${index - 1}`) * n) % n];
    if (pick === prev) pick = pool[(pool.indexOf(pick) + 1) % n];
  }
  return TRANSITIONS[pick](slug, index, theme);
};

const explicitTransition = (
  name: string,
  theme: Theme,
): TransitionPresentation<any> => {
  switch (name) {
    case "fade":
      return fadeThroughBg();
    case "whip":
      return whipPan({ direction: 1 });
    case "zoom":
      return scaleThrough();
    case "wipe":
      return maskWipe({ accent: theme.accent });
    case "iris":
      return iris();
    default:
      return slide({ direction: "from-right" });
  }
};

export const Video: React.FC<{ spec: VideoSpec }> = ({ spec }) => {
  const theme = resolveTheme(
    spec.style.preset,
    spec.style.accent,
    spec.style.flavor,
  );
  const total = spec.scenes.length;
  const isTechPreset = TECH_PRESETS.has(spec.style.preset);

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
              // Premount 1s trước khi scene vào khung nhìn: font/layout đã "dựng sẵn"
              // ở lần render đầu nên frame đầu tiên không bị "pop" chữ/khối.
              premountFor={FPS}
            >
              {scene.voiceover ? (
                <Audio src={asSrc(scene.voiceover.file)} />
              ) : null}
              {spec.audio.autoSfx &&
              scene.soundDesign &&
              !["auto", "none"].includes(scene.soundDesign) ? (
                <Sequence from={TRANSITION_FRAMES}>
                  <Audio
                    src={staticFile(
                      pick(
                        scene.soundDesign === "ding"
                          ? SFX.positive
                          : scene.soundDesign === "pop"
                            ? SFX.listReveal
                            : scene.soundDesign === "impact"
                              ? SFX.statImpact
                              : scene.soundDesign === "paper"
                                ? SFX.paper
                                : SFX.transition,
                        scene.id,
                      ),
                    )}
                    volume={spec.audio.sfxVolume}
                  />
                </Sequence>
              ) : null}
              {scene.sfx.map((cue, ci) => (
                <Sequence key={ci} from={cue.atFrame}>
                  <Audio src={asSrc(cue.file)} volume={cue.volume} />
                </Sequence>
              ))}
              {spec.audio.autoSfx &&
              (!scene.soundDesign || scene.soundDesign === "auto") &&
              i > 0 ? (
                <Audio
                  src={staticFile(
                    pick(SFX.transition, `${spec.meta.slug}-sfx-${i}`),
                  )}
                  volume={spec.audio.sfxVolume}
                />
              ) : null}
              {spec.audio.autoSfx &&
              (!scene.soundDesign || scene.soundDesign === "auto") &&
              THUMP_TYPES.has(scene.type) ? (
                <Sequence from={TRANSITION_FRAMES}>
                  <Audio
                    src={staticFile(
                      pick(
                        isMoneyUnit(
                          scene.type === "stat" ? scene.unit : undefined,
                        )
                          ? SFX.moneyGrowth
                          : SFX.statImpact,
                        `${scene.id}-thump`,
                      ),
                    )}
                    volume={spec.audio.sfxVolume * 0.9}
                  />
                </Sequence>
              ) : null}
              {spec.audio.autoSfx &&
              (!scene.soundDesign || scene.soundDesign === "auto") &&
              i < total - 1 &&
              THUMP_TYPES.has(spec.scenes[i + 1].type) ? (
                <Sequence
                  from={Math.max(
                    0,
                    sceneDurationInFrames(scene) - BUILD_UP_LEAD,
                  )}
                >
                  <Audio
                    src={staticFile(pick(SFX.buildUp, `${scene.id}-buildup`))}
                    volume={spec.audio.sfxVolume * 0.6}
                  />
                </Sequence>
              ) : null}
              {spec.audio.autoSfx &&
              (!scene.soundDesign || scene.soundDesign === "auto")
                ? autoRevealCues(
                    scene,
                    spec.audio.sfxVolume,
                    theme,
                    isTechPreset,
                  ).map((c, ci) => (
                    <Sequence key={`rev-${ci}`} from={c.from}>
                      <Audio src={staticFile(c.file)} volume={c.volume} />
                    </Sequence>
                  ))
                : null}
              {scene.bgImage && scene.type !== "annotate" ? (
                <PhotoBackdrop
                  src={scene.bgImage}
                  theme={theme}
                  seed={seedOf(`${spec.meta.slug}-kb-${scene.id}`)}
                  motion={scene.motion}
                  // scene nhiều CHỮ LỚN → scrim đậm hơn để headline luôn đọc được
                  midScrim={TEXT_HEAVY_TYPES.has(scene.type) ? 0.7 : 0.52}
                />
              ) : null}
              <SceneRenderer
                motionVolume={spec.audio.sfxVolume}
                scene={scene}
                theme={theme}
                channelHandle={
                  spec.style.watermark?.kind === "text"
                    ? spec.style.watermark.text
                    : undefined
                }
              />
              {spec.style.progress &&
              scene.type !== "hook" &&
              scene.type !== "outro" ? (
                <ProgressChip
                  theme={theme}
                  index={i}
                  total={total}
                  series={spec.meta.series}
                />
              ) : null}
              {/* Tắt caption karaoke ở scene mà chữ lớn CHÍNH đã là lời được đọc
                  (quote/bigword/outro) — nếu không, chữ lớn + caption đáy cùng hiện
                  gây cảm giác "hiện/đọc đôi". */}
              {spec.style.captions && !NO_CAPTION_TYPES.has(scene.type) ? (
                <KaraokeCaption scene={scene} theme={theme} />
              ) : null}
            </TransitionSeries.Sequence>,
          ];
          if (i < spec.scenes.length - 1) {
            elements.push(
              <TransitionSeries.Transition
                key={`t-${scene.id}`}
                presentation={
                  scene.transition && scene.transition !== "auto"
                    ? explicitTransition(scene.transition, theme)
                    : transitionFor(spec.meta.slug, i, theme)
                }
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
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

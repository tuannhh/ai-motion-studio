import {
  videoSpecSchema,
  sceneDurationInFrames,
  TRANSITION_FRAMES,
  FPS,
} from "@ams/motion-engine/src/schema/spec";
export const SCENE_LABELS: Record<string, string> = {
  motion: "Chuyển động riêng",
  hook: "Mở đầu",
  points: "Ý chính",
  flow: "Quy trình",
  diagram: "Sơ đồ",
  timeline: "Dòng thời gian",
  compare: "So sánh",
  versus: "Đối chiếu",
  stat: "Số liệu",
  quote: "Trích dẫn",
  rank: "Xếp hạng",
  chart: "Biểu đồ",
  media: "Tư liệu",
  bigword: "Chữ động",
  annotate: "Chú thích",
  terminal: "Terminal",
  screenshot: "Giao diện",
  outro: "Kết thúc",
};
export const headlineOf = (sc: any) =>
  sc?.headline ||
  sc?.title ||
  sc?.label ||
  sc?.text ||
  sc?.phrases?.map((p: any) => p.text).join(" ") ||
  SCENE_LABELS[sc?.type] ||
  "Cảnh mới";
export function previewOf(plan: any, renderedSpec?: any, renderedPlan?: any) {
  const pending: string[] = [];
  const spec = videoSpecSchema.parse({
    version: 1,
    meta: { title: plan.title, slug: plan.slug, language: "vi" },
    style: {
      preset: plan.preset,
      flavor: plan.flavor,
      captions: plan.studio?.captions ?? true,
      progress: true,
      accent: plan.studio?.accent,
      watermark: renderedSpec?.style?.watermark,
    },
    audio: {
      music: renderedSpec?.audio?.music,
      autoSfx: plan.studio?.autoSfx ?? true,
      sfxVolume: plan.studio?.sfxVolume ?? 0.35,
      musicVolume: plan.studio?.musicVolume ?? 0.25,
    },
    scenes: plan.scenes.map((sc: any) => {
      const ready = renderedSpec?.scenes?.find((s: any) => s.id === sc.id);
      const original = renderedPlan?.scenes?.find((s: any) => s.id === sc.id);
      const sameVoice = original?.narration === sc.narration;
      const sameImage =
        original?.imagePrompt === sc.imagePrompt &&
        original?.image === sc.image;
      const sameBg =
        original?.bgImagePrompt === sc.bgImagePrompt &&
        original?.bgImage === sc.bgImage;
      const result = {
        ...sc,
        voiceover: sameVoice ? ready?.voiceover : undefined,
        image: sameImage ? ready?.image : undefined,
        bgImage: sameBg ? ready?.bgImage : undefined,
        sfx: [],
        durationInFrames: sc.durationInFrames,
      };
      if (!result.voiceover && !result.durationInFrames)
        result.durationInFrames = Math.round(
          Math.max(3, (sc.narration?.split(/\s+/).length || 15) / 3.4 + 0.6) *
            FPS,
        );
      if (
        ["media", "screenshot", "annotate"].includes(sc.type) &&
        !result.image
      ) {
        pending.push(sc.id);
        return {
          ...result,
          type: "hook",
          badge: "ẢNH CHƯA ĐƯỢC TẠO",
          headline: headlineOf(sc).slice(0, 90),
          sub: "Ảnh sẽ xuất hiện sau bước dựng video.",
        };
      }
      return result;
    }),
  });
  let cursor = 0;
  const starts = spec.scenes.map((s) => {
    const start = cursor;
    cursor += sceneDurationInFrames(s) - TRANSITION_FRAMES;
    return start;
  });
  return { spec, starts, pending, total: cursor + TRANSITION_FRAMES };
}
export const timecode = (frames: number) =>
  `${Math.floor(frames / 30 / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor((frames / 30) % 60)
    .toString()
    .padStart(2, "0")}`;

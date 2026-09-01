/**
 * API module dùng chung cho CLI (run.ts) và apps/server:
 * sinh kịch bản → spec → TTS → render. Không đọc argv, không process.exit.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateJson, VoiceProfile } from "./gemini";
import { generateSceneImage, generateUiImage } from "./images";
import { buildPlansPrompt, buildRepairPrompt, Plan, plansSchema } from "./prompts";
import { generateVoiceover } from "./tts";
import {
  styleProfileToPromptBlock,
  type StyleProfile,
} from "./template";
import { parseSpec } from "@ams/motion-engine/src/schema/validate";
import type { VideoSpec } from "@ams/motion-engine/src/schema/spec";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** repo root của monorepo (nơi có pnpm-workspace.yaml) */
export const repoRoot = path.resolve(__dirname, "../../..");

export type GeneratePlansOptions = {
  idea: string;
  mode: "angles" | "series";
  count: number;
  /** text tư liệu đã ingest (đưa vào <SOURCES_DATA>) */
  sourcesText?: string;
  presetHint?: string;
  durationSec?: number;
  /** style profile từ template-from-video — ép preset/nhịp/tông theo video mẫu */
  styleProfile?: StyleProfile;
  /** pipeline/workflow kịch bản (bản creator sửa, hoặc mặc định của profile) */
  scriptPipeline?: string[];
  /** bật google_search grounding để AI tự tìm tư liệu web (source_mode ai/combine) */
  webSearch?: boolean;
  /** serie manager: tên + số tập bắt đầu + ngữ cảnh tập trước */
  series?: { name: string; startEpisode: number; context?: string };
};

/** Tách plan → spec engine (bỏ narration) + map sceneId → narration */
export const planToSpec = (
  plan: Plan
): { spec: VideoSpec; narrations: Map<string, string> } => {
  const narrations = new Map<string, string>();
  const scenes = plan.scenes.map((s) => {
    // imagePrompt/bgImagePrompt là chỉ dẫn cho generateSpecImages, không thuộc spec engine
    const { narration, imagePrompt, bgImagePrompt, ...scene } = s as any;
    narrations.set(scene.id, narration);
    return scene;
  });
  const spec: VideoSpec = {
    version: 1,
    meta: {
      title: plan.title,
      slug: plan.slug,
      language: "vi",
      series: plan.series,
    },
    style: { preset: plan.preset, captions: true, progress: true },
    audio: { musicVolume: 0.12, autoSfx: true, sfxVolume: 0.4 },
    scenes,
  };
  return { spec, narrations };
};

/** Bóc JSON khỏi phần bao ngoài: khi bật google_search, model không ép được
 * responseMimeType=json nên có thể trả kèm ```json fences hoặc lời dẫn. Lấy đoạn
 * từ '[' hoặc '{' đầu tiên tới ']'/'}' cuối cùng. */
const extractJson = (raw: string): string => {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const firstArr = s.indexOf("[");
  const firstObj = s.indexOf("{");
  const start =
    firstArr === -1
      ? firstObj
      : firstObj === -1
        ? firstArr
        : Math.min(firstArr, firstObj);
  if (start > 0) {
    const lastArr = s.lastIndexOf("]");
    const lastObj = s.lastIndexOf("}");
    const end = Math.max(lastArr, lastObj);
    if (end > start) s = s.slice(start, end + 1);
  }
  return s;
};

export const validatePlans = (
  raw: string
): { plans: Plan[]; errors: string[] } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (e) {
    return { plans: [], errors: [`JSON không parse được: ${(e as Error).message}`] };
  }
  const result = plansSchema.safeParse(parsed);
  if (!result.success) {
    return {
      plans: [],
      errors: result.error.issues
        .slice(0, 20)
        .map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  const errors: string[] = [];
  for (const plan of result.data) {
    try {
      const { spec } = planToSpec(plan);
      // Ảnh sinh SAU vòng validate — điền placeholder cho annotate có imagePrompt
      // để lint "annotate thiếu ảnh" không chặn oan plan hợp lệ.
      for (let i = 0; i < spec.scenes.length; i++) {
        const scene = spec.scenes[i] as any;
        if (
          (scene.type === "annotate" || scene.type === "screenshot") &&
          !scene.image &&
          (plan.scenes[i] as any).imagePrompt
        ) {
          scene.image = "__pending__";
        }
      }
      const { issues } = parseSpec(spec);
      for (const issue of issues.filter((i) => i.level === "error")) {
        errors.push(
          `[${plan.slug}${issue.sceneId ? `/${issue.sceneId}` : ""}] ${issue.message}`
        );
      }
    } catch (e) {
      errors.push(`[${plan.slug}] ${(e as Error).message}`);
    }
  }
  return { plans: errors.length ? [] : result.data, errors };
};

/** Sinh N plan từ ý tưởng + tư liệu, có 1 vòng tự sửa nếu chưa đạt schema/lint */
export const generatePlans = async (
  opts: GeneratePlansOptions
): Promise<Plan[]> => {
  let raw = await generateJson(
    buildPlansPrompt({
      idea: opts.idea,
      mode: opts.mode,
      count: opts.count,
      sources: opts.sourcesText || undefined,
      presetHint: opts.presetHint,
      durationSec: opts.durationSec,
      styleBlock: opts.styleProfile
        ? styleProfileToPromptBlock(opts.styleProfile)
        : undefined,
      scriptPipeline: opts.scriptPipeline,
      series: opts.series,
    }),
    { webSearch: opts.webSearch }
  );
  let { plans, errors } = validatePlans(raw);
  if (!plans.length) {
    raw = await generateJson(buildRepairPrompt(raw, errors), {
      webSearch: opts.webSearch,
    });
    ({ plans, errors } = validatePlans(raw));
    if (!plans.length) {
      throw new Error(`Kịch bản không đạt schema sau vòng sửa:\n${errors.join("\n")}`);
    }
  }
  return plans;
};

/** narration.md để người dùng duyệt kịch bản */
export const planToNarrationMd = (plan: Plan): string =>
  [
    `# ${plan.title}`,
    `Góc nhìn: ${plan.angle} · Preset: ${plan.preset}`,
    "",
    ...plan.scenes.map(
      (s: any, i: number) =>
        `## Scene ${i + 1} — ${s.type} (${s.id})\n**Lời thoại:** ${s.narration}`
    ),
  ].join("\n");

export type ImageProgress = (done: number, total: number, sceneId: string) => void;

/**
 * Sinh ảnh cho spec theo imagePrompt/bgImagePrompt trong plan (Gemini image
 * + cổng chất lượng), lưu vào jobDir/images/, gán đường dẫn tương đối vào
 * scene.image / scene.bgImage. Ảnh annotate hỏng → ném lỗi (fail-closed,
 * scene không có ảnh sẽ vô nghĩa); ảnh NỀN hỏng → bỏ qua kèm cảnh báo
 * (scene vẫn đẹp trên nền preset).
 */
export const generateSpecImages = async (
  plan: Plan,
  spec: VideoSpec,
  jobDir: string,
  onProgress?: ImageProgress
): Promise<string[]> => {
  const warnings: string[] = [];
  const tasks: Array<{
    sceneIndex: number;
    kind: "image" | "uiImage" | "bgImage";
    prompt: string;
  }> = [];
  plan.scenes.forEach((s: any, i) => {
    if (s.imagePrompt && spec.scenes[i].type === "annotate") {
      tasks.push({ sceneIndex: i, kind: "image", prompt: s.imagePrompt });
    }
    if (s.imagePrompt && spec.scenes[i].type === "screenshot") {
      tasks.push({ sceneIndex: i, kind: "uiImage", prompt: s.imagePrompt });
    }
    if (s.bgImagePrompt) {
      tasks.push({ sceneIndex: i, kind: "bgImage", prompt: s.bgImagePrompt });
    }
  });

  let done = 0;
  for (const task of tasks) {
    const scene = spec.scenes[task.sceneIndex] as any;
    const suffix = task.kind === "bgImage" ? "bg" : "main";
    const rel = `images/${scene.id}-${suffix}`;
    try {
      const generated =
        task.kind === "uiImage"
          ? await generateUiImage(
              task.prompt,
              path.join(jobDir, rel),
              scene.frame === "phone" ? "9:16" : "4:3"
            )
          : await generateSceneImage(task.prompt, path.join(jobDir, rel));
      scene.image = task.kind === "bgImage" ? scene.image : path.relative(jobDir, generated.file);
      if (task.kind === "bgImage") scene.bgImage = path.relative(jobDir, generated.file);
      // Ảnh best-effort (chưa đạt cổng chất lượng nhưng vẫn dùng để không chặn video)
      if (generated.requiresReview) {
        warnings.push(
          `[${scene.id}] Ảnh scene ${scene.type} chưa đạt chuẩn (có thể mờ/chữ méo) — đã dùng ảnh tốt nhất, bấm "Render lại" nếu muốn thử ảnh khác.`
        );
      }
    } catch (err) {
      // annotate & screenshot bắt buộc có ảnh (fail-closed); ảnh nền hỏng thì bỏ qua
      if (task.kind === "image" || task.kind === "uiImage") {
        throw new Error(
          `[${scene.id}] ${(err as Error).message} — scene ${scene.type} bắt buộc có ảnh.`
        );
      }
      warnings.push(`[${scene.id}] Bỏ ảnh nền: ${(err as Error).message}`);
    }
    done += 1;
    onProgress?.(done, tasks.length, scene.id);
  }
  return warnings;
};

export type TtsProgress = (done: number, total: number, sceneId: string) => void;

/**
 * TTS từng scene của spec (ghi audio/<sceneId>.wav vào jobDir), gán voiceover
 * (file + durationMs + words) vào spec tại chỗ. Trả về danh sách cảnh báo.
 */
export const synthesizeSpecAudio = async (
  spec: VideoSpec,
  narrations: Map<string, string>,
  jobDir: string,
  profile: VoiceProfile,
  onProgress?: TtsProgress
): Promise<string[]> => {
  const warnings: string[] = [];
  let done = 0;
  for (const scene of spec.scenes) {
    const narration = narrations.get(scene.id);
    done += 1;
    if (!narration) continue;
    const vo = await generateVoiceover(narration, scene.id, jobDir, profile);
    scene.voiceover = { file: vo.file, durationMs: vo.durationMs, words: vo.words };
    if (vo.requiresReview) {
      warnings.push(`[${scene.id}] ${vo.warnings.join("; ")}`);
    }
    onProgress?.(done, spec.scenes.length, scene.id);
  }
  return warnings;
};

/**
 * Render spec.json → video.mp4 qua motion-engine (tiến trình con, không block
 * event loop). stdout/stderr gộp trả về khi lỗi để chẩn đoán.
 */
export const renderSpecFile = (
  specPath: string,
  outMp4: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["--filter", "@ams/motion-engine", "render", specPath, "--out", outMp4],
      { cwd: repoRoot }
    );
    let tail = "";
    const keep = (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-4000);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Render thất bại (exit ${code}):\n${tail}`));
    });
  });

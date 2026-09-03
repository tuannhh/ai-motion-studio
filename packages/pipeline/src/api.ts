/**
 * API module dùng chung cho CLI (run.ts) và apps/server:
 * sinh kịch bản → spec → TTS → render. Không đọc argv, không process.exit.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateJson, VoiceProfile } from "./gemini";
import {
  describeImageForRedraw,
  generateSceneImage,
  generateUiImage,
  reviewImageSafety,
} from "./images";
import { searchWebImage } from "./webimage";
import { buildPlansPrompt, buildRepairPrompt, buildResearchPrompt, Plan, plansSchema } from "./prompts";
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
  /** ảnh thật người dùng tải lên (index + caption) để AI chèn 'userimg:N'; fromDocument =
   * ảnh tự trích từ chính file tư liệu (bằng chứng thật, khác ảnh tải lên rời rạc);
   * isFullPage = ảnh TOÀN TRANG (render từ pdf) — AI nên cắt vùng, không dùng nguyên trang */
  userImages?: { index: number; caption: string; fromDocument?: boolean; isFullPage?: boolean }[];
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
    style: { preset: plan.preset, flavor: plan.flavor, captions: true, progress: true },
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

/**
 * Sinh N plan từ ý tưởng + tư liệu, có 1 vòng tự sửa nếu chưa đạt schema/lint.
 *
 * webSearch=true: KHÔNG gắn tool google_search vào lệnh sinh JSON chính (đã kiểm
 * chứng thực nghiệm: model bỏ qua tool khi phải đồng thời tuân theo schema JSON
 * dài/phức tạp — xem buildResearchPrompt). Thay vào đó chạy MỘT bước nghiên cứu
 * riêng, ngắn gọn, ép search chạy đáng tin cậy, rồi gộp kết quả vào sourcesText
 * như một nguồn tư liệu bình thường trước khi sinh kịch bản (JSON mode ổn định).
 */
export const generatePlans = async (
  opts: GeneratePlansOptions
): Promise<Plan[]> => {
  let sourcesText = opts.sourcesText;
  if (opts.webSearch) {
    const research = await generateJson(
      buildResearchPrompt(opts.idea, sourcesText),
      { webSearch: true }
    );
    sourcesText = [
      sourcesText,
      `--- Nguồn: Google Search (Gemini tự tra cứu) ---\n${research}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  let raw = await generateJson(
    buildPlansPrompt({
      idea: opts.idea,
      mode: opts.mode,
      count: opts.count,
      sources: sourcesText || undefined,
      presetHint: opts.presetHint,
      durationSec: opts.durationSec,
      styleBlock: opts.styleProfile
        ? styleProfileToPromptBlock(opts.styleProfile)
        : undefined,
      scriptPipeline: opts.scriptPipeline,
      series: opts.series,
      userImages: opts.userImages,
    })
  );
  let { plans, errors } = validatePlans(raw);
  if (!plans.length) {
    raw = await generateJson(buildRepairPrompt(raw, errors));
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

/**
 * Chạy fn cho từng phần tử với TỐI ĐA `limit` việc song song (giữ thứ tự kết quả).
 * Dùng để tăng tốc TTS/sinh ảnh (mỗi scene độc lập) — trước đây chạy tuần tự nên
 * TTS 5 scene mất ~90s; song song 3 luồng rút còn ~1/3. Giới hạn để tránh 429.
 */
const mapPool = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
};

/** Số việc AI song song (TTS/ảnh) — chỉnh qua env, mặc định 3 (an toàn với hạn mức) */
const aiPoolSize = (): number => {
  const n = Number(process.env.AI_STAGE_CONCURRENCY);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : 3;
};

export type ImageProgress = (done: number, total: number, sceneId: string) => void;

/**
 * Cắt một vùng (fraction 0-1, gốc trên-trái) từ ảnh chụp toàn trang tài liệu bằng
 * ffmpeg — giữ nguyên nội dung ảnh chụp thật (không AI vẽ lại). ffprobe lấy kích
 * thước gốc để quy đổi fraction → pixel; toạ độ được kẹp trong biên ảnh.
 */
const cropImageToFile = (
  srcPath: string,
  destPath: string,
  box: { x0: number; y0: number; x1: number; y1: number }
): void => {
  const probe = spawnSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=s=x:p=0",
    srcPath,
  ]);
  const [wStr, hStr] = (probe.stdout?.toString().trim() || "").split("x");
  const w = Number(wStr);
  const h = Number(hStr);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 2 || h < 2) {
    throw new Error("Không đọc được kích thước ảnh gốc để cắt.");
  }
  const cw = Math.min(w, Math.max(2, Math.round((box.x1 - box.x0) * w)));
  const ch = Math.min(h, Math.max(2, Math.round((box.y1 - box.y0) * h)));
  const cx = Math.min(w - cw, Math.max(0, Math.round(box.x0 * w)));
  const cy = Math.min(h - ch, Math.max(0, Math.round(box.y0 * h)));
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const run = spawnSync("ffmpeg", [
    "-y",
    "-i",
    srcPath,
    "-vf",
    `crop=${cw}:${ch}:${cx}:${cy}`,
    destPath,
  ]);
  if (run.status !== 0) {
    throw new Error(`Cắt ảnh lỗi: ${run.stderr?.toString().slice(0, 300) || run.error?.message || "ffmpeg thất bại"}`);
  }
};

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
  onProgress?: ImageProgress,
  /** ảnh THẬT người dùng tải lên (index → file trên đĩa) để giải 'userimg:N' */
  userImages?: { index: number; storedPath: string; caption: string }[]
): Promise<string[]> => {
  const warnings: string[] = [];
  const tasks: Array<{
    sceneIndex: number;
    kind: "image" | "uiImage" | "bgImage" | "webImage" | "webBg" | "userImage" | "userBg";
    prompt: string;
    /** với userImage/userBg: file gốc + có vẽ lại (redraw) hay dùng nguyên ảnh, hoặc cắt 1 vùng */
    ref?: {
      storedPath: string;
      redraw: boolean;
      crop?: { x0: number; y0: number; x1: number; y1: number };
    };
  }> = [];
  // Tiền tố "web:" trong imagePrompt/bgImagePrompt (hoặc media.image) = dùng ẢNH THẬT
  // từ internet (Openverse CC) thay vì ảnh AI — phần sau "web:" là truy vấn (tiếng Anh).
  const webQuery = (v: unknown): string | null =>
    typeof v === "string" && v.trim().toLowerCase().startsWith("web:")
      ? v.trim().slice(4).trim()
      : null;
  // Tiền tố "userimg:N", "userimg:N:redraw" hoặc "userimg:N:crop:x0,y0,x1,y1" = ảnh
  // THẬT người dùng đã tải lên. crop cắt 1 vùng (fraction 0-1) khỏi ảnh chụp toàn
  // trang tài liệu — cú pháp crop không hợp lệ (thiếu số/quá nhỏ) coi như KHÔNG khớp
  // để rơi về sinh ảnh AI bình thường, thay vì lỡ dùng nguyên cả trang xấu.
  const userRef = (
    v: unknown
  ): { storedPath: string; redraw: boolean; crop?: { x0: number; y0: number; x1: number; y1: number } } | null => {
    if (typeof v !== "string") return null;
    const raw = v.trim().toLowerCase();
    const m = raw.match(/^userimg:(\d+)(?::redraw|:crop:([\d.]+),([\d.]+),([\d.]+),([\d.]+))?$/);
    if (!m) return null;
    const src = userImages?.find((u) => u.index === Number(m[1]));
    if (!src) return null;
    if (raw.includes(":crop:")) {
      const [x0, y0, x1, y1] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
      const valid =
        [x0, y0, x1, y1].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
        x1 - x0 >= 0.03 &&
        y1 - y0 >= 0.03 &&
        x1 > x0 &&
        y1 > y0;
      if (!valid) return null;
      return { storedPath: src.storedPath, redraw: false, crop: { x0, y0, x1, y1 } };
    }
    return { storedPath: src.storedPath, redraw: raw.includes(":redraw") };
  };
  plan.scenes.forEach((s: any, i) => {
    const type = spec.scenes[i].type;
    // media: ưu tiên ảnh thật người dùng, rồi ảnh thật internet, cuối cùng mới ảnh AI
    if (type === "media") {
      const uref = userRef(s.image);
      const mediaWeb = webQuery(s.image);
      if (uref) tasks.push({ sceneIndex: i, kind: "userImage", prompt: "", ref: uref });
      else if (mediaWeb) tasks.push({ sceneIndex: i, kind: "webImage", prompt: mediaWeb });
    }
    if (s.imagePrompt && type === "annotate") {
      const uref = userRef(s.imagePrompt);
      const wq = webQuery(s.imagePrompt);
      tasks.push(
        uref
          ? { sceneIndex: i, kind: "userImage", prompt: "", ref: uref }
          : wq
            ? { sceneIndex: i, kind: "webImage", prompt: wq }
            : { sceneIndex: i, kind: "image", prompt: s.imagePrompt }
      );
    }
    if (s.imagePrompt && type === "screenshot") {
      tasks.push({ sceneIndex: i, kind: "uiImage", prompt: s.imagePrompt });
    }
    if (s.bgImagePrompt) {
      const uref = userRef(s.bgImagePrompt);
      const wq = webQuery(s.bgImagePrompt);
      tasks.push(
        uref
          ? { sceneIndex: i, kind: "userBg", prompt: "", ref: uref }
          : wq
            ? { sceneIndex: i, kind: "webBg", prompt: wq }
            : { sceneIndex: i, kind: "bgImage", prompt: s.bgImagePrompt }
      );
    }
  });

  let done = 0;
  // Song song (mỗi ảnh độc lập). Task ảnh bắt buộc (annotate/screenshot) hỏng → ném
  // lỗi để mapPool dừng cả cụm (fail-closed); ảnh nền hỏng chỉ cảnh báo.
  await mapPool(tasks, aiPoolSize(), async (task) => {
    const scene = spec.scenes[task.sceneIndex] as any;
    const isBg = task.kind === "bgImage" || task.kind === "webBg" || task.kind === "userBg";
    const rel = `images/${scene.id}-${isBg ? "bg" : "main"}`;
    try {
      if (task.kind === "userImage" || task.kind === "userBg") {
        // Ảnh THẬT người dùng tải lên: qua cổng an toàn nội dung (guardrail áp cho
        // cả ảnh của chính user). redraw = AI vẽ lại theo mô tả; crop = cắt 1 vùng
        // bằng ffmpeg (giữ nguyên nội dung ảnh chụp thật, không AI can thiệp);
        // ngược lại dùng nguyên ảnh (copy vào jobDir).
        const { storedPath, redraw, crop } = task.ref!;
        const buf = fs.readFileSync(storedPath);
        const ext = (path.extname(storedPath) || ".jpg").toLowerCase();
        const mime =
          ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        if (!(await reviewImageSafety(buf, mime))) {
          throw new Error("ảnh của bạn không qua cổng an toàn nội dung (bản đồ/cờ/lãnh đạo/chính trị...)");
        }
        if (crop) {
          const dest = path.join(jobDir, `${rel}.png`);
          cropImageToFile(storedPath, dest, crop);
          if (isBg) scene.bgImage = path.relative(jobDir, dest);
          else {
            scene.image = path.relative(jobDir, dest);
            if (scene.type === "media" && !scene.credit) scene.credit = "Ảnh: tư liệu của bạn";
          }
        } else if (redraw) {
          const desc = await describeImageForRedraw(buf, mime);
          const generated = await generateSceneImage(desc, path.join(jobDir, rel));
          // Ảnh nền KHÔNG bắt buộc — nếu cổng chất lượng từ chối cả 3 lần (thường vì
          // vẫn còn chữ/UI/chart nhúng, đúng thứ sẽ đè lên headline gây "chữ chồng chữ"),
          // bỏ hẳn thay vì dùng ảnh hỏng làm nền: nền preset sạch còn hơn ảnh có chữ lạ.
          if (isBg && !generated.requiresReview) {
            scene.bgImage = path.relative(jobDir, generated.file);
          } else if (isBg) {
            warnings.push(
              `[${scene.id}] Bỏ ảnh nền vẽ lại: vẫn có chữ/UI nhúng sau 3 lần thử — dùng nền preset để đảm bảo tương phản.`
            );
          } else {
            scene.image = path.relative(jobDir, generated.file);
            if (generated.requiresReview) {
              warnings.push(`[${scene.id}] Ảnh vẽ lại chưa thật đạt — đã dùng bản tốt nhất, có thể "Render lại".`);
            }
          }
        } else {
          const dest = path.join(jobDir, rel + ext);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(storedPath, dest);
          if (isBg) scene.bgImage = path.relative(jobDir, dest);
          else {
            scene.image = path.relative(jobDir, dest);
            if (scene.type === "media" && !scene.credit) scene.credit = "Ảnh: tư liệu của bạn";
          }
        }
      } else if (task.kind === "webImage" || task.kind === "webBg") {
        // Ảnh THẬT internet (CC) — tải về jobDir, qua cổng an toàn nội dung; gắn credit
        const web = await searchWebImage(task.prompt, path.join(jobDir, rel), (buf, mime) =>
          reviewImageSafety(buf, mime)
        );
        if (isBg) scene.bgImage = path.relative(jobDir, web.file);
        else {
          scene.image = path.relative(jobDir, web.file);
          if (scene.type === "media" && !scene.credit) scene.credit = web.credit;
        }
      } else {
        const generated =
          task.kind === "uiImage"
            ? await generateUiImage(
                task.prompt,
                path.join(jobDir, rel),
                scene.frame === "phone" ? "9:16" : "4:3"
              )
            : await generateSceneImage(task.prompt, path.join(jobDir, rel));
        // Ảnh nền KHÔNG bắt buộc — nếu cổng chất lượng từ chối cả 3 lần (thường vì vẫn
        // còn chữ/dashboard/chart nhúng, đúng thứ sẽ đè lên headline gây "chữ chồng chữ",
        // lỗi thật bắt được từ ảnh chụp video 2026-09-03), bỏ hẳn thay vì dùng ảnh hỏng —
        // nền preset sạch còn hơn ảnh có chữ lạ cạnh tranh với text chính.
        if (isBg && !generated.requiresReview) {
          scene.bgImage = path.relative(jobDir, generated.file);
        } else if (isBg) {
          warnings.push(
            `[${scene.id}] Bỏ ảnh nền: vẫn có chữ/UI/chart nhúng sau 3 lần thử — dùng nền preset để đảm bảo tương phản.`
          );
        } else {
          scene.image = path.relative(jobDir, generated.file);
          if (generated.requiresReview) {
            warnings.push(
              `[${scene.id}] Ảnh scene ${scene.type} chưa đạt chuẩn (có thể mờ/chữ méo) — đã dùng ảnh tốt nhất, bấm "Render lại" nếu muốn thử ảnh khác.`
            );
          }
        }
      }
    } catch (err) {
      // Ảnh CHÍNH bắt buộc (annotate/screenshot/media-web) hỏng → fail-closed;
      // ảnh nền (bg/webBg) hỏng → chỉ cảnh báo, scene vẫn đẹp trên nền preset.
      if (!isBg) {
        throw new Error(
          `[${scene.id}] ${(err as Error).message} — scene ${scene.type} bắt buộc có ảnh.`
        );
      }
      warnings.push(`[${scene.id}] Bỏ ảnh nền: ${(err as Error).message}`);
    }
    done += 1;
    onProgress?.(done, tasks.length, scene.id);
  });
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
  // Song song TTS từng scene (mỗi scene 1 file WAV độc lập, giọng cố định theo profile).
  await mapPool(spec.scenes, aiPoolSize(), async (scene) => {
    const narration = narrations.get(scene.id);
    done += 1;
    if (!narration) {
      onProgress?.(done, spec.scenes.length, scene.id);
      return;
    }
    const vo = await generateVoiceover(narration, scene.id, jobDir, profile);
    scene.voiceover = { file: vo.file, durationMs: vo.durationMs, words: vo.words };
    if (vo.requiresReview) {
      warnings.push(`[${scene.id}] ${vo.warnings.join("; ")}`);
    }
    onProgress?.(done, spec.scenes.length, scene.id);
  });
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

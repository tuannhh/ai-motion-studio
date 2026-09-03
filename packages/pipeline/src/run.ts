/**
 * CLI pipeline end-to-end:
 *   pnpm run run -- --idea "chủ đề" [tùy chọn]
 *
 * Tùy chọn:
 *   --idea "..."          chủ đề video (bắt buộc)
 *   --source <file>       tư liệu: txt/md/docx/pdf/mp3/wav/m4a/mp4/mov (lặp lại được)
 *   --mode angles|series  đa chiều (mặc định) hoặc serie nối tập
 *   --variants N          số kịch bản (mặc định 1, tối đa 5)
 *   --preset <tên>        midnight|aurora|paper|noir (gợi ý cho AI)
 *   --duration N          thời lượng mục tiêu giây (20-120)
 *   --voice male|female         giọng đọc (mặc định female)
 *   --region bac|nam            giọng miền (mặc định bac)
 *   --style thoisu|tintuc|tvc   phong cách đọc (mặc định tintuc)
 *   --mood neutral|cheerful|energetic  tâm trạng giọng đọc (mặc định neutral)
 *   --age thanhnien|trungnien|nguoidilam  độ tuổi chất giọng (mặc định nguoidilam)
 *   --speed 1|1.2               tốc độ đọc (mặc định 1)
 *   --no-images           bỏ sinh ảnh minh họa (Gemini image)
 *   --no-tts              bỏ giọng đọc (render câm, duration mặc định)
 *   --no-render           chỉ sinh kịch bản + spec, không render (để duyệt trước)
 *   --web-search          bật Google Search grounding (AI tự tra cứu web) — kết hợp
 *                         với --source thành "combine", một mình thành "AI tự tìm"
 *
 * Output: out/<slug>/spec.json + narration.md + audio/*.wav + video.mp4
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";
import type { VoiceProfile } from "./gemini";
import { ingestFile } from "./ingest";
import {
  generatePlans,
  generateSpecImages,
  planToNarrationMd,
  planToSpec,
  renderSpecFile,
  repoRoot,
  synthesizeSpecAudio,
} from "./api";

const outRoot = path.join(repoRoot, "out");

loadEnv();

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);
const multi = (name: string): string[] => {
  const values: string[] = [];
  argv.forEach((a, i) => {
    if (a === `--${name}` && argv[i + 1]) values.push(argv[i + 1]);
  });
  return values;
};

const idea = flag("idea");
if (!idea) {
  console.error('Thiếu --idea "chủ đề video".');
  process.exit(1);
}
const mode = (flag("mode") === "series" ? "series" : "angles") as
  | "angles"
  | "series";
const count = Math.min(5, Math.max(1, Number(flag("variants") ?? 1)));
const presetHint = flag("preset");
const durationSec = flag("duration")
  ? Math.min(120, Math.max(20, Number(flag("duration"))))
  : undefined;
const voiceProfile: VoiceProfile = {
  gender: flag("voice") === "male" ? "male" : "female",
  region: flag("region") === "nam" ? "nam" : "bac",
  style:
    flag("style") === "thoisu" ? "thoisu" : flag("style") === "tvc" ? "tvc" : "tintuc",
  mood:
    flag("mood") === "cheerful"
      ? "cheerful"
      : flag("mood") === "energetic"
        ? "energetic"
        : "neutral",
  age:
    flag("age") === "thanhnien"
      ? "thanhnien"
      : flag("age") === "trungnien"
        ? "trungnien"
        : "nguoidilam",
  speed: flag("speed") === "1.2" ? 1.2 : 1,
};
const doTts = !has("no-tts");
const doImages = !has("no-images");
const doRender = !has("no-render");
const webSearch = has("web-search");

const main = async () => {
  // Nạp tư liệu đa định dạng (docx local, pdf/audio/video qua Gemini)
  const sourceBlocks: string[] = [];
  for (const f of multi("source")) {
    console.log(`📎 Nạp tư liệu: ${path.basename(f)}...`);
    const src = await ingestFile(f);
    console.log(`   → ${src.method}, ${src.text.length} ký tự`);
    sourceBlocks.push(`--- Nguồn: ${src.name} ---\n${src.text}`);
  }
  const sources = sourceBlocks.join("\n\n");

  console.log(
    `🧠 Sinh ${count} kịch bản (${mode}) cho: "${idea}"${webSearch ? " [+ Google Search grounding]" : ""}`
  );
  const plans = await generatePlans({
    idea,
    mode,
    count,
    sourcesText: sources || undefined,
    presetHint,
    durationSec,
    webSearch,
  });

  for (const plan of plans) {
    const jobDir = path.join(outRoot, plan.slug);
    fs.mkdirSync(jobDir, { recursive: true });
    const { spec, narrations } = planToSpec(plan);
    fs.writeFileSync(path.join(jobDir, "narration.md"), planToNarrationMd(plan));

    if (doImages) {
      console.log(`🖼  Sinh ảnh cho "${plan.slug}"...`);
      const imgWarnings = await generateSpecImages(plan, spec, jobDir, (d, t, id) =>
        console.log(`   ảnh ${d}/${t} (${id})`)
      );
      for (const w of imgWarnings) console.log(`   ⚠️  ${w}`);
    }

    if (doTts) {
      console.log(`🎙  TTS ${plan.scenes.length} scene cho "${plan.slug}"...`);
      const warnings = await synthesizeSpecAudio(spec, narrations, jobDir, voiceProfile);
      for (const w of warnings) console.log(`   ⚠️  TTS cần review: ${w}`);
    }

    const specPath = path.join(jobDir, "spec.json");
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
    console.log(`📄 ${path.relative(process.cwd(), specPath)}`);

    if (doRender) {
      await renderSpecFile(specPath, path.join(jobDir, "video.mp4"));
      console.log(`🎬 ${path.relative(process.cwd(), path.join(jobDir, "video.mp4"))}`);
    }
  }
  console.log("✅ Pipeline hoàn tất.");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

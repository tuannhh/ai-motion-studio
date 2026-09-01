/**
 * CLI render: đọc spec JSON → validate + lint → stage asset → bundle Remotion
 * → render MP4 (và PNG preview scene đầu nếu --stills-only).
 *
 * Dùng:  pnpm render <spec.json> [--out out/video.mp4] [--stills-only]
 * File audio/sfx trong spec là đường dẫn tương đối so với file spec;
 * script sẽ copy vào publicDir tạm và viết lại thành đường dẫn staticFile.
 */
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSpec } from "../src/schema/validate";
import { FPS, VideoSpec, sceneDurationInFrames } from "../src/schema/spec";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const stillsOnly = args.includes("--stills-only");
const outFlag = args.indexOf("--out");
const specPath = args.find((a) => !a.startsWith("--"));
if (!specPath) {
  console.error("Cách dùng: pnpm render <spec.json> [--out video.mp4] [--stills-only]");
  process.exit(1);
}

const specAbs = path.resolve(specPath);
const specDir = path.dirname(specAbs);
const raw = JSON.parse(fs.readFileSync(specAbs, "utf8"));

const { spec, issues } = parseSpec(raw);
for (const issue of issues) {
  const tag = issue.level === "error" ? "❌" : "⚠️ ";
  console.log(`${tag} ${issue.sceneId ? `[${issue.sceneId}] ` : ""}${issue.message}`);
}
if (issues.some((i) => i.level === "error")) {
  console.error("\nSpec có lỗi bố cục — dừng render.");
  process.exit(2);
}

// Stage asset: copy file audio được tham chiếu vào publicDir tạm.
// Đường dẫn staged nằm trong namespace riêng của lần render này (jobNs) để
// nhiều render dùng chung bundle cache không giẫm file nhau.
const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "ams-public-"));
const jobNs = `job-${process.pid}-${Date.now().toString(36)}`;

const staged: VideoSpec = structuredClone(spec);
const stage = (file: string | undefined): string | undefined => {
  if (!file || file.startsWith("http")) return file;
  const srcAbs = path.isAbsolute(file) ? file : path.join(specDir, file);
  if (!fs.existsSync(srcAbs)) {
    console.error(`❌ Không tìm thấy file asset: ${srcAbs}`);
    process.exit(2);
  }
  const rel = `${jobNs}/assets/${path.basename(srcAbs)}`;
  fs.mkdirSync(path.join(publicDir, jobNs, "assets"), { recursive: true });
  fs.copyFileSync(srcAbs, path.join(publicDir, rel));
  return rel;
};
staged.audio.music = stage(staged.audio.music);
if (staged.style.watermark?.image) {
  staged.style.watermark.image = stage(staged.style.watermark.image);
}
for (const scene of staged.scenes) {
  if (scene.voiceover) scene.voiceover.file = stage(scene.voiceover.file)!;
  if (scene.type === "media") scene.image = stage(scene.image)!;
  if (scene.type === "annotate" && scene.image) scene.image = stage(scene.image);
  if (scene.type === "screenshot" && scene.image) scene.image = stage(scene.image);
  if (scene.bgImage) scene.bgImage = stage(scene.bgImage);
  for (const cue of scene.sfx) cue.file = stage(cue.file)!;
}

const outDir = path.join(pkgRoot, "out");
fs.mkdirSync(outDir, { recursive: true });
const outPath =
  outFlag >= 0 ? path.resolve(args[outFlag + 1]) : path.join(outDir, `${spec.meta.slug}.mp4`);

/**
 * Bundle cache: webpack-bundle Remotion là bước đắt nhất (~10-20s) nhưng chỉ
 * phụ thuộc source engine — cache theo hash nội dung src/** + config; asset
 * từng job được copy vào <bundle>/public/<jobNs> sau khi bundle và dọn khi xong.
 */
const bundleHash = (): string => {
  const h = crypto.createHash("sha1");
  const addFile = (abs: string) => {
    h.update(path.relative(pkgRoot, abs));
    h.update(fs.readFileSync(abs));
  };
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else addFile(abs);
    }
  };
  walk(path.join(pkgRoot, "src"));
  for (const f of ["remotion.config.ts", "package.json"]) {
    const abs = path.join(pkgRoot, f);
    if (fs.existsSync(abs)) addFile(abs);
  }
  return h.digest("hex").slice(0, 16);
};

const jobPublicDirs: string[] = [];

const prepareBundle = async (): Promise<string> => {
  const cacheRoot = path.join(pkgRoot, ".bundle-cache");
  const cacheDir = path.join(cacheRoot, bundleHash());

  if (!fs.existsSync(path.join(cacheDir, "index.html"))) {
    // Build vào thư mục tạm RỒI rename nguyên tử vào cacheDir — hai tiến trình
    // cùng cache-miss (multi-worker) không giẫm lên nhau: kẻ tới sau thấy
    // cacheDir đã tồn tại thì bỏ bản build của mình. (rename atomic trên cùng FS)
    console.log("📦 Đang bundle Remotion (cache miss)...");
    fs.mkdirSync(cacheRoot, { recursive: true });
    const emptyPublic = fs.mkdtempSync(path.join(os.tmpdir(), "ams-empty-public-"));
    const tmpOut = fs.mkdtempSync(path.join(cacheRoot, ".build-"));
    await bundle({
      entryPoint: path.join(pkgRoot, "src/index.ts"),
      publicDir: emptyPublic,
      outDir: tmpOut,
    });
    fs.rmSync(emptyPublic, { recursive: true, force: true });
    try {
      fs.renameSync(tmpOut, cacheDir);
    } catch {
      // tiến trình khác đã rename xong cacheDir trước — dùng của họ, xoá bản mình
      fs.rmSync(tmpOut, { recursive: true, force: true });
    }
    // dọn cache cũ (giữ tối đa 2 bundle gần nhất theo mtime), bỏ qua thư mục .build-* đang dở
    const entries = fs
      .readdirSync(cacheRoot)
      .filter((n) => !n.startsWith(".build-"))
      .map((n) => ({ n, mtime: fs.statSync(path.join(cacheRoot, n)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const e of entries.slice(2)) {
      if (path.join(cacheRoot, e.n) !== cacheDir) {
        fs.rmSync(path.join(cacheRoot, e.n), { recursive: true, force: true });
      }
    }
  } else {
    console.log("⚡ Bundle cache hit — bỏ qua webpack.");
    try {
      fs.utimesSync(cacheDir, new Date(), new Date()); // giữ tươi cho LRU
    } catch {
      // mtime không cập nhật được không sao — chỉ ảnh hưởng thứ tự dọn cache
    }
  }

  // SFX engine (nội dung ổn định) + asset job (namespace riêng) vào public của bundle
  const bundlePublic = path.join(cacheDir, "public");
  const sfxSrcDir = path.join(pkgRoot, "assets/sfx");
  if (fs.existsSync(sfxSrcDir)) {
    fs.mkdirSync(path.join(bundlePublic, "sfx"), { recursive: true });
    for (const f of fs.readdirSync(sfxSrcDir)) {
      fs.copyFileSync(path.join(sfxSrcDir, f), path.join(bundlePublic, "sfx", f));
    }
  }
  if (fs.existsSync(path.join(publicDir, jobNs))) {
    fs.cpSync(path.join(publicDir, jobNs), path.join(bundlePublic, jobNs), { recursive: true });
    jobPublicDirs.push(path.join(bundlePublic, jobNs));
  }
  return cacheDir;
};

const main = async () => {
  const bundled = await prepareBundle();

  const inputProps = { spec: staged };
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "Video",
    inputProps,
  });

  console.log(
    `🎬 ${spec.meta.title} — ${composition.durationInFrames} frame (${(
      composition.durationInFrames / FPS
    ).toFixed(1)}s), ${staged.scenes.length} scene`
  );

  // PNG preview: CHỈ khi --stills-only (duyệt bố cục / pre-warm build). KHÔNG
  // render still trong luồng xuất MP4 — trước đây chụp thừa 1 ảnh/scene mỗi lần
  // render video, phí toàn bộ thời gian đó (15 scene = 15 lần chụp Chrome thừa).
  if (stillsOnly) {
    let cursor = 0;
    for (const scene of staged.scenes) {
      const dur = sceneDurationInFrames(scene);
      const mid = Math.min(cursor + Math.floor(dur * 0.7), composition.durationInFrames - 1);
      const stillPath = path.join(outDir, `${spec.meta.slug}.${scene.id}.png`);
      await renderStill({ composition, serveUrl: bundled, output: stillPath, frame: mid, inputProps });
      console.log(`🖼  ${scene.id} (${scene.type}) → ${path.relative(process.cwd(), stillPath)}`);
      cursor += dur - 14;
    }
    console.log("✅ Xong (chỉ render preview stills).");
    return;
  }

  // Tốc độ render 1 video = số frame song song. Mặc định Remotion chỉ ~nửa số
  // nhân; ép dùng ~75% số nhân (env RENDER_FRAME_CONCURRENCY ghi đè được).
  const frameConcurrency = process.env.RENDER_FRAME_CONCURRENCY
    ? Math.max(1, Number(process.env.RENDER_FRAME_CONCURRENCY))
    : Math.max(2, Math.floor(os.cpus().length * 0.75));

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: outPath,
    inputProps,
    concurrency: frameConcurrency,
    x264Preset: "faster", // nhanh hơn 'medium' mặc định, chất lượng giảm không đáng kể
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 10 === 0) {
        process.stdout.write(`\r⏳ Render ${(progress * 100).toFixed(0)}%   `);
      }
    },
  });
  console.log(`\n✅ Video: ${outPath} (concurrency ${frameConcurrency})`);
};

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    fs.rmSync(publicDir, { recursive: true, force: true });
    for (const d of jobPublicDirs) fs.rmSync(d, { recursive: true, force: true });
  });

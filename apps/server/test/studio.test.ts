import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { pool } from "../src/db";
import { generatePublicId } from "../src/lib/public-id";
import { appConfig, storagePaths } from "../src/config";
import { requireAuth, SESSION_COOKIE } from "../src/middleware/auth";
import { errorHandler } from "../src/middleware/error";
import { studioRoutes } from "../src/routes/studio.routes";
import { scriptRoutes } from "../src/routes/script.routes";
import { musicRoutes } from "../src/routes/music.routes";
import { projectRoutes } from "../src/routes/project.routes";
import {
  getStudio,
  saveStudio,
  restoreStudio,
  validateStudioPlan,
  studioAsset,
} from "../src/services/studio.service";
import {
  createMusic,
  getMusicTrack,
  listMusic,
} from "../src/services/music.service";
import { approveScript, rejectScript } from "../src/services/script.service";
import { sceneDurationInFrames } from "@ams/motion-engine/src/schema/spec";
import { planSchema } from "@ams/pipeline/src/prompts";
import { previewOf } from "../../web/src/studio/preview";
import { generateSpecImages, planToSpec } from "@ams/pipeline/src/api";

test("render resolves background references and never leaves missing tokens as asset paths", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ams-image-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, "source.png");
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1kAAAAASUVORK5CYII=", "base64");
  fs.writeFileSync(source, bytes);
  let safe = true;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ safe }) }] } }],
  }), { status: 200 }));
  const images = [{ index: 4, storedPath: source, caption: "Fixture image" }];
  const make = (fields: Record<string, unknown>) => {
    const plan = structuredClone(fixture);
    plan.scenes = [{ ...plan.scenes[0], ...fields }, plan.scenes.at(-1)!] as any;
    return { plan, spec: planToSpec(plan).spec };
  };
  for (const field of ["bgImage", "bgImagePrompt"]) {
    const { plan, spec } = make({ [field]: "userimg:4" });
    assert.deepEqual(await generateSpecImages(plan, spec, dir, undefined, images), []);
    assert.equal(spec.scenes[0].bgImage, "images/opening-bg.png");
    assert.deepEqual(fs.readFileSync(path.join(dir, spec.scenes[0].bgImage!)), bytes);
    assert.equal((plan.scenes[0] as any)[field], "userimg:4");
  }
  for (const token of ["userimg:99", "userimg:4:crop:0,0,2,1", "userimg:bad"]) {
    const { plan, spec } = make({ bgImage: token });
    assert.equal((await generateSpecImages(plan, spec, dir, undefined, images)).length, 1);
    assert.equal(spec.scenes[0].bgImage, undefined);
  }
  const photo = make({ type: "screenshot", frame: "phone", image: "userimg:4" });
  await generateSpecImages(photo.plan, photo.spec, dir, undefined, images);
  assert.equal((photo.spec.scenes[0] as any).imageAspectRatio, 1);
  assert.equal((photo.spec.scenes[0] as any).real, true);
  safe = false;
  const rejected = make({ bgImage: "userimg:4" });
  assert.equal((await generateSpecImages(rejected.plan, rejected.spec, dir, undefined, images)).length, 1);
  assert.equal(rejected.spec.scenes[0].bgImage, undefined);
  const missingMain = make({ type: "screenshot", frame: "browser", image: "userimg:99" });
  await assert.rejects(generateSpecImages(missingMain.plan, missingMain.spec, dir, undefined, images), /ảnh tư liệu số 99/);
});

const allowed =
  process.env.TEST_ALLOW_LOCAL === "1" &&
  appConfig.DB_NAME === "ams_next" &&
  appConfig.DB_HOST === "127.0.0.1";
if (!allowed)
  throw new Error(
    "Tests require TEST_ALLOW_LOCAL=1 and the isolated local ams_next database.",
  );
const fixture = planSchema.parse(
  JSON.parse(
    fs.readFileSync(path.resolve("../web/src/studio/demo-plan.json"), "utf8"),
  ),
);
const uid = crypto.randomUUID();
const csrf = crypto.randomBytes(24).toString("hex");
const token = crypto.randomBytes(32).toString("hex");
let owner: number,
  other: number,
  project: number,
  script: number,
  job: number,
  music: number;
let base: string;
let server: ReturnType<express.Express["listen"]>;
const auth = {
  cookie: `${SESSION_COOKIE}=${token}`,
  "x-csrf-token": csrf,
  "content-type": "application/json",
};
before(async () => {
  const [u]: any = await pool.query(
    "INSERT INTO users(email,password_hash,display_name) VALUES (?,'unused','Test owner'),(?,'unused','Test other')",
    [`test-${uid}@local.test`, `other-${uid}@local.test`],
  );
  owner = u.insertId;
  other = owner + 1;
  await pool.query(
    "INSERT INTO sessions(user_id,token_hash,csrf_token,expires_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))",
    [owner, crypto.createHash("sha256").update(token).digest("hex"), csrf],
  );
  const [p]: any = await pool.query(
    "INSERT INTO projects(public_id,user_id,idea,source_mode,status) VALUES(?,?,'Integration test studio','user','ready')",
    [generatePublicId(), owner],
  );
  project = p.insertId;
  const [s]: any = await pool.query(
    "INSERT INTO scripts(project_id,variant_index,title,angle,slug,preset,plan_json,narration_md) VALUES(?,1,?,?,?,?,?,'')",
    [
      project,
      fixture.title,
      fixture.angle,
      `test-${uid}`,
      fixture.preset,
      JSON.stringify(fixture),
    ],
  );
  script = s.insertId;
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/v1/scripts", requireAuth, studioRoutes, scriptRoutes);
  app.use("/v1/music", requireAuth, musicRoutes);
  app.use("/v1/projects", requireAuth, projectRoutes);
  app.use(errorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (music) {
    const m = await getMusicTrack(music);
    fs.rmSync(String(m.stored_path), { force: true });
    await pool.query("DELETE FROM music_tracks WHERE id=?", [music]);
  }
  if (owner)
    await pool.query("DELETE FROM users WHERE id IN (?,?)", [owner, other]);
  if (job)
    fs.rmSync(path.join(storagePaths.privateRenders, `job-${job}`), {
      recursive: true,
      force: true,
    });
  await pool.end();
});

test("HTTP requires session, rejects CSRF, and returns the owned studio", async () => {
  assert.equal(
    (await fetch(`${base}/v1/scripts/${script}/studio`)).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${base}/v1/scripts/${script}/studio`, {
        method: "PUT",
        headers: { cookie: auth.cookie, "content-type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (await fetch(`${base}/v1/scripts/${script}/studio`, { headers: auth }))
      .status,
    200,
  );
  await assert.rejects(getStudio(other, script), { status: 404 });
});
test("optimistic save: concurrent edits give one success, one conflict; restore works", async () => {
  const current = await getStudio(owner, script);
  const a = structuredClone(current.plan),
    b = structuredClone(current.plan);
  a.scenes[0].headline = "Bản thử thứ nhất";
  b.scenes[0].headline = "Bản thử thứ hai";
  const results = await Promise.allSettled([
    saveStudio(owner, script, a, current.revision),
    saveStudio(owner, script, b, current.revision),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const failed = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(failed.reason.status, 409);
  const saved = await getStudio(owner, script);
  assert.equal(saved.versions.length, 1);
  const restored = await restoreStudio(
    owner,
    script,
    saved.versions[0].id,
    saved.revision,
  );
  assert.equal(restored.plan.scenes[0].headline, fixture.scenes[0].headline);
});
test("editing rejects arbitrary audio, images, duplicate IDs and path traversal IDs", () => {
  for (const change of [
    (p: any) =>
      (p.scenes[0].voiceover = { file: "/etc/passwd", durationMs: 1000 }),
    (p: any) => (p.scenes[0].bgImage = "file:///etc/passwd"),
    (p: any) => (p.scenes[1].id = p.scenes[0].id),
    (p: any) => (p.scenes[0].id = "../../private"),
  ]) {
    const p = structuredClone(fixture);
    change(p);
    assert.throws(() => validateStudioPlan(p, fixture), { status: 400 });
  }
});
test("narration duration prevents clips even when manual hold is shorter", () => {
  assert.ok(
    sceneDurationInFrames({
      ...fixture.scenes[0],
      durationInFrames: 60,
      voiceover: { file: "speech.wav", durationMs: 8000 },
    } as any) >= 258,
  );
});
test("preview reuses matching voice; edited narration waits for regeneration", () => {
  const generated = structuredClone(fixture);
  const rendered = {
    style: {},
    scenes: [
      {
        ...generated.scenes[0],
        voiceover: { file: "/v1/speech.wav", durationMs: 8000 },
      },
    ],
  };
  assert.ok(previewOf(generated, rendered, generated).spec.scenes[0].voiceover);
  const edited = structuredClone(generated);
  edited.scenes[0].narration = "Lời đọc mới cần được tạo lại.";
  assert.equal(
    previewOf(edited, rendered, generated).spec.scenes[0].voiceover,
    undefined,
  );
});
test("creator music is private and creator upload endpoint works", async () => {
  const wav = Buffer.alloc(2044);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(2000, 40);
  const form = new FormData();
  form.append("name", "Private test track");
  form.append("file", new Blob([wav], { type: "audio/wav" }), "track.wav");
  const res = await fetch(`${base}/v1/music`, {
    method: "POST",
    headers: { cookie: auth.cookie, "x-csrf-token": csrf },
    body: form,
  });
  assert.equal(res.status, 201);
  music = ((await res.json()) as any).data.id;
  assert.ok((await listMusic(owner)).some((m) => m.id === music));
  assert.ok(!(await listMusic(other)).some((m) => m.id === music));
  await assert.rejects(getMusicTrack(music, other), { status: 404 });
});
test("active render blocks saving, duplicate approval, rejection and regeneration", async () => {
  const [j]: any = await pool.query(
    "INSERT INTO render_jobs(script_id,status) VALUES(?,'rendering')",
    [script],
  );
  job = j.insertId;
  const current = await getStudio(owner, script);
  await assert.rejects(
    saveStudio(owner, script, current.plan, current.revision),
    { status: 409 },
  );
  await assert.rejects(approveScript(owner, script), { status: 400 });
  await assert.rejects(rejectScript(owner, script), { status: 400 });
  assert.equal(
    (
      await fetch(`${base}/v1/projects/${project}/generate`, {
        method: "POST",
        headers: auth,
      })
    ).status,
    400,
  );
});
test("render assets enforce ownership, path containment and extensions", async () => {
  const dir = path.join(storagePaths.privateRenders, `job-${job}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "test.wav"), "sample");
  fs.writeFileSync(path.join(dir, "secret.json"), "{}");
  assert.equal(
    await studioAsset(owner, script, job, "test.wav"),
    path.join(dir, "test.wav"),
  );
  await assert.rejects(studioAsset(other, script, job, "test.wav"), {
    status: 404,
  });
  await assert.rejects(studioAsset(owner, script, job, "../job-1/spec.json"), {
    status: 404,
  });
  await assert.rejects(studioAsset(owner, script, job, "secret.json"), {
    status: 404,
  });
});

test("motion document rejects executable markup, unknown paths, cycles and reversed timestamps", async () => {
  const { motionDocumentSchema } = await import(
    "@ams/motion-engine/src/motion/schema"
  );
  const good = {
    version: 1,
    durationSec: 8,
    nodes: [
      {
        id: "dot",
        name: "Hạt sáng",
        kind: "ellipse",
        radius: 12,
        followPath: "M 0 0 C 100 0 100 200 300 200",
        keyframes: [
          { at: 0, progress: 0 },
          { at: 8, progress: 1 },
        ],
      },
    ],
  };
  assert.equal(motionDocumentSchema.safeParse(good).success, true);
  for (const patch of [
    (d: any) => (d.nodes[0].html = "<script>alert(1)</script>"),
    (d: any) => (d.nodes[0].followPath = "javascript:alert(1)"),
    (d: any) => (d.nodes[0].parent = "dot"),
    (d: any) =>
      (d.nodes[0].keyframes = [
        { at: 4, x: 0 },
        { at: 3, x: 2 },
      ]),
    (d: any) => (d.nodes[0].keyframes = [{ at: 9, x: 0 }]),
    (d: any) => d.nodes.push({ ...d.nodes[0] }),
    (d: any) => (d.cues = [{ at: 8, kind: "ding" }]),
    (d: any) => (d.nodes[0].x = Infinity),
  ]) {
    const d = structuredClone(good);
    patch(d);
    assert.equal(motionDocumentSchema.safeParse(d).success, false);
  }
});

test("independent keyframes hold and interpolate without mixing other properties", async () => {
  const { motionNodeSchema } = await import(
    "@ams/motion-engine/src/motion/schema"
  );
  const { nodeValue } = await import(
    "@ams/motion-engine/src/motion/interpolate"
  );
  const node = motionNodeSchema.parse({
    id: "dot",
    name: "dot",
    kind: "ellipse",
    x: 0,
    keyframes: [
      { at: 0, x: 0 },
      { at: 2, x: 0 },
      { at: 3, opacity: 0.5 },
      { at: 4, x: 100, easing: "linear" },
    ],
  });
  assert.equal(nodeValue(node, "x", 1, 0), 0);
  assert.equal(nodeValue(node, "x", 3, 0), 50);
  assert.equal(nodeValue(node, "x", 5, 0), 100);
  assert.equal(nodeValue(node, "opacity", 3, 1), 0.5);
});

test("motion runs enforce ownership, CSRF, one active request and safe artifact access", async () => {
  const { reconstructionRoutes } = await import(
    "../src/routes/reconstruction.routes"
  );
  const { createMotionRun, getMotionRun, motionAsset } = await import(
    "../src/services/reconstruction.service"
  );
  const [t]: any = await pool.query(
    "INSERT INTO templates(public_id,user_id,name,workflow_json) VALUES(?,?,?,?)",
    [generatePublicId(), owner, "Test motion", "{}"],
  );
  const template = t.insertId;
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/motion", requireAuth, reconstructionRoutes);
  app.use(errorHandler);
  const http = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => http.once("listening", r));
  const origin = `http://127.0.0.1:${(http.address() as any).port}`;
  try {
    assert.equal(
      (await fetch(`${origin}/motion/templates/${template}`)).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${origin}/motion/templates/${template}`, {
          method: "POST",
          headers: { cookie: auth.cookie, "content-type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
    await assert.rejects(
      createMotionRun(other, template, {
        startSec: 0,
        durationSec: 8,
        iterations: 1,
        instruction: "",
      }),
      { status: 404 },
    );
    const options = {
      startSec: 0,
      durationSec: 8,
      iterations: 1,
      instruction: "",
    };
    const concurrent = await Promise.allSettled([
      createMotionRun(owner, template, options),
      createMotionRun(owner, template, options),
    ]);
    assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
    const result = (
      concurrent.find(
        (r) => r.status === "fulfilled",
      ) as PromiseFulfilledResult<{ id: number }>
    ).value;
    assert.equal((await getMotionRun(owner, result.id)).status, "queued");
    const { deleteTemplate } = await import("../src/services/template.service");
    await assert.rejects(deleteTemplate(owner, template), { status: 400 });
    await assert.rejects(getMotionRun(other, result.id), { status: 404 });
    await assert.rejects(motionAsset(owner, result.id, "../../.env"), {
      status: 404,
    });
    await assert.rejects(motionAsset(other, result.id, "motion.json"), {
      status: 404,
    });
    assert.equal(
      (await fetch(`${origin}/motion/${result.id}`, { headers: auth })).status,
      200,
    );
    await pool.query("DELETE FROM motion_runs WHERE id=?", [result.id]);
  } finally {
    await new Promise<void>((r) => http.close(() => r()));
    await pool.query("DELETE FROM templates WHERE id=?", [template]);
  }
});

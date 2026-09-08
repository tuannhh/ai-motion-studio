# AI Motion Studio Next — local handover

Vietnamese product walkthrough and local login: see `../HUONG-DAN.md`.

## Isolation

- Original checkout: `/Users/tuanbui/ai-motion-studio`, unchanged.
- This checkout: `outputs/ai-motion-studio-next` under the Codex task directory.
- Web: 4621; API: 4620; MySQL: 3319, database `ams_next`.
- Independent MySQL container `ams-next-mysql`, volume `ams-next-data`.
- Session cookie `ams_next_session` avoids collisions with the original app.
- Dedicated renderer image `ai-motion-studio-next-renderer:local`; transient Docker containers mount engine source, assets and job files. The source app container is not used to render this app's jobs.
- `.env` is ignored and private. Never copy it into frontend assets or publish it.

## Run on this machine

As of 2026-09-08, the persistent local runtime is `ams-next-studio`, defined in `compose.next.yml`. Start Docker Desktop, then `docker start ams-next-mysql ams-next-studio`. Web/API are served together at localhost:4621 (4620 is also mapped for compatibility), with restart policy `unless-stopped`. The container reuses the prepared Linux renderer image and mounts current source, built web and private storage. `STORAGE_ROOT` preserves existing absolute asset paths; rendering runs inside the container without mounting the Docker socket. After frontend edits, run `pnpm build`; after backend edits, restart the studio container when no jobs are active. Rebuild the image if dependency manifests change. The host development instructions below require stopping this container first to free the ports.

Node 20+ (validated with Node 24), pnpm 9.15, Docker Desktop, ffmpeg/ffprobe, and Poppler are required. Existing dependencies, database and local admin are prepared.

```sh
pnpm dev
```

The command starts the independent MySQL container if stopped and launches both API and Vite. It checks ports first and refuses to replace existing processes. Ctrl+C stops the web/API processes. MySQL remains available for the next run.

For a fresh local installation:

```sh
cp .env.next.example .env
# Fill GEMINI_API_KEY and review local database credentials in .env.
pnpm install --frozen-lockfile
pnpm setup:local
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-your-own-password' pnpm --filter @ams/server seed
pnpm renderer:build
pnpm dev
```

`setup:local` explicitly applies the baseline and ordered migrations to **ams_next:3319 only**. Server startup verifies schema; it does not auto-migrate. For existing databases, apply 010, 011, 012, 013 explicitly. Never point these scripts at the source project's database.

`Dockerfile.renderer` is a standalone rebuild recipe with Chromium and font caches. Standard local `docker build` uses Docker's normal cache directory. Under a restricted workspace, build with a writable `DOCKER_CONFIG` directory and the authorized Docker socket via `DOCKER_HOST`.

## Implementation

The Vue app mounts the exact React/Remotion composition in `@remotion/player`. Preview and export share scene schemas, transitions and layout. Estimated durations are replaced by real speech durations after a render; changing narration invalidates only that scene's preview speech. Main images not yet generated have a visible placeholder.

`useStudio.ts` manages optimistic revisions, scoped local drafts, scene ordering, duplication, deletion, AI suggestions and render progress. Desktop and mobile/tablet use separate compositions. Scene content uses existing MDS controls and registered icons.

`studio.service.ts` enforces ownership and transactional edits. Each save snapshots the previous plan. A SHA-256 revision prevents a stale browser from overwriting a newer plan. Active render jobs block plan/settings changes, repeated approvals and rejection. Regenerating a project retains all prior scripts and exports.

Research, creative writing and editorial checking are separate Gemini calls. Actual grounding metadata is stored with each generated script; it is not reconstructed from text. The editorial pass applies text fields only and validates the result again. It reduces unsupported claims; it is not a guarantee of factual correctness.

Model defaults: Gemini 3.8 Flash for content/vision/OCR, Gemini 3.1 Flash TTS Preview for speech, Gemini 3.1 Flash Image for generated illustration. All use one server-side key. The 3.8 model was probed successfully and OCR verified against a rendered Vietnamese frame. See Google's [model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).

Templates include timestamped observations, uncertainty labels, sound design, tone and editable workflow. Files above the inline limit are transcoded to 640px/18fps before analysis, so very fast visual details may be lost. No arbitrary AI-generated HTML/JavaScript is executed: the model directs typed scene compositions with a constrained JSON plan.

Creator-uploaded music is private; admin-uploaded music is shared. Music and watermark files are copied into each render job to preserve exported versions. All original audio/image/video downloads and preview assets require authenticated ownership. Custom filesystem/audio URLs are rejected from scene edits and generated plans.

## Programmable reconstruction

`/tai-dung/:templateId` offers paired source/render playback, layers/keyframes, sound cues, JSON/TSX exports, version history and instruction-based AI revisions. `packages/pipeline/src/reconstruction.ts` crops a selected 2–30 second segment, observes it through Gemini at 8 fps, composes a validated MotionDocument, renders real MP4 and compares both videos. One to three bounded iterations retain all results and select the highest model-rated visual score. These scores are subjective model judgments, not objective fidelity measurements.

`packages/motion-engine/src/motion/` implements deterministic SVG shapes, rich text, parent groups, paths, follow-path particles, stroke drawing, typewriter reveal, color interpolation, blur/glow, perspective rotations and timed SFX. All preview/export paths share this engine. Strict schemas reject executable properties, arbitrary URLs, invalid SVG paths, duplicate IDs, non-ancestor parents and out-of-range times. Documents contain up to 100 nodes, 40 keyframes per node and 40 sound cues. No generated JavaScript is executed. Exported TSX references the shared MotionCanvas and belongs in this project's Remotion environment.

Migration 013 adds `motion_runs`. Ownership, CSRF, private asset containment, transactional single-active-run limits and active-run template deletion guards protect the new endpoints. The worker retains failures and recovers interrupted jobs as failed with a retry instruction. It is a local bounded worker, without a distributed scheduler or cancel UI.

A chosen document can be saved to a template as `motionBlueprint`. When enabled, the generation pipeline rewrites its choreography for each editorially reviewed scene's new content and narration. Motion timing follows actual speech duration; in-document captions are edited as text layers and do not receive duplicate engine karaoke. Reanalyzing a template retains its learned blueprint. Disabling it restores normal scene generation.

Main routes: GET/POST `/v1/motion-runs/templates/:id`, GET `/v1/motion-runs/:id`, POST `/:id/revise`, POST `/:id/use`, GET `/:id/assets/:file` (the latter three under `/v1/motion-runs`). Native-layout phone/tablet views are separate from the desktop three-pane workspace.

Evidence: see `../qa/MOTION-VALIDATION.md`. Verified examples cover vector diagrams; footage extraction, full character rigs, arbitrary WebGL/3D and exact reconstruction of all unknown effects are not implemented. Model observations and generated motion require review.

## Validation

```sh
pnpm typecheck
TEST_ALLOW_LOCAL=1 pnpm test
pnpm build
git diff --check
```

The integration suite uses disposable users/projects and an ephemeral HTTP server against the isolated local database; its guard refuses any other database. It checks session + CSRF enforcement, cross-user access, optimistic concurrent writes + restore, malformed scene/path/audio injection, narration duration, preview invalidation, creator music privacy, active-job lifecycle guards and asset path containment. Test cleanup touches only its fixtures.

Browser checks covered 1280×720, 1440×900, 390×844, 768×1024. The mobile/tablet UI tree was exercised in-browser; actual MISA native host behavior is unverified. The production build has a large Remotion bundle warning; it is functional but not optimized for slow mobile networks. No production load, deployment or Drive export test was performed.

## References and provenance

Inspected all 13 supplied clips through sampled frames. The three imported template profiles are from the user's Paper/tech/news reference clips. See `memory-bank/02-next-build.md` for the grouped visual findings. Existing project media assets and their attribution files were retained; no claim is made that every inherited asset is commercially cleared.

Reviewed [huytranvan2010/AI-auto-generate-video](https://github.com/huytranvan2010/AI-auto-generate-video), commit `15c0103`, for separation of scene planning, reusable visual templates, sound choices and rendering stages. Its source remains in the task's `work/` research folder; this app extends the user's own code rather than copying that repo.

Rendering behavior is based on [Remotion Player](https://www.remotion.dev/docs/player) and deterministic frame compositions. Video interpretation uses [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding). The AI Agent demo was checked against the supplied brief and [Anthropic's explanation of agentic systems](https://www.anthropic.com/engineering/building-effective-agents); it remains an illustrative educational example.

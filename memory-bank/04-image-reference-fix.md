# Fix unresolved source image backgrounds

User reported renderer job 13 failing on `userimg:4`. The archived plan/spec show scene-1 `bgImage: userimg:4` and scene-5 `bgImage: userimg:1` unchanged, while the screenshot image resolved correctly. `generateSpecImages` handled `bgImagePrompt` but skipped direct `bgImage` references.

The image preparation pass now resolves direct source/web background references, clearing the planning token before processing. Optional missing/rejected backgrounds fall back to the preset with a warning. Main source image references fail early when missing or malformed; they cannot silently become generation prompts or filesystem paths. Explicit main images in annotate scenes also use the shared resolver. Project-scoped source lookup and existing image review remain enforced. The archived plan is not mutated.

Regression test verifies direct and prompt-based backgrounds, byte-for-byte source copying, plan preservation, missing source IDs, malformed tokens/crops, review rejection and missing required main images. All 12 tests and server/web TypeScript checks passed. Logs are in `../qa/image-reference-tests.txt` and `../qa/image-reference-typecheck.txt` relative to the project root.

Local app restarted with the fix. Script 12 (project 11, user 1) was resubmitted through authenticated/CSRF-protected approve API, creating job 15. Original failed job 13 is retained as history.

Job 15 completed successfully (done, 100%). Its final spec resolves both backgrounds to archived JPEGs (`images/scene-1-bg.jpg`, `images/scene-5-bg.jpg`) and the screenshot to `images/scene-2-main.jpg`; no source reference is left as a renderer path. Output is 1413 frames at 30fps. The resulting MP4 is also copied to `../ky-nguyen-doanh-nghiep-khong-ngu-da-sua.mp4` for review.

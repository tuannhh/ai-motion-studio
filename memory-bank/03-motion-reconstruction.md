# Motion reconstruction — 2026-09-07

User explicitly requested implementing reference-effect reconstruction after rejecting preset-only imitation. Extended the isolated Next clone; original checkout remains unchanged.

Delivered MotionDocument SVG/keyframe engine, Gemini video observation/composition/comparison/refinement, private motion_runs queue (migration 013), editable desktop and native-layout lab, layer/SFX editing, scoped local drafts, real MP4 and JSON/TSX exports, instruction-based revision, and reusable blueprint generation for new content. See README-NEXT for architecture and ../qa/MOTION-VALIDATION.md (relative to project root) for evidence.

Local reference template 1: Paper · AI Agents 101. Run 2 reconstructs 14–22s (44 layers). Run 5 reconstructs 47–55s over two rounds. Run 8 is the actual browser-triggered AI revision of run 5 and is the final exported comparison (71 layers, 61 keyframes, 4 cues). Template 1 is enabled with run 8's blueprint through the actual UI. Project 8/script 9 demonstrates five new-content motion scenes generated from run 2's blueprint; final render job 10 removes duplicate automatic captions and is the exported new-topic demo.

A 12-second branch attempt (run 4) failed strict validation; its history and analysis remain visible. Repair now receives invalid JSON plus specific schema errors. Two 8-second segments completed; arbitrary clips or all 30-second selections are not guaranteed.

Validation: 11 meaningful integration/schema/interpolation tests pass, TypeScript and web build pass. Browser checked real paired playback, AI revision, blueprint selection, manual edit/draft restore/discard, desktop and phone/tablet layouts. Large frontend bundle remains a build warning. No native host/device, production load or public deployment certification.

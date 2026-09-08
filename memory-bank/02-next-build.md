# Next build — 2026-09-07

## User intent and scope

Clone the Claude Code project before editing. Build an automatic short-video studio: idea + sources + music/watermark → research/script → editable scene storyboard → real render → review/download/revise. Learn reusable style and workflow from supplied clips. Later clarification: reuse Gemini key from prior projects and use Gemini 3.8 Flash. Content/OCR/vision now use 3.8; TTS stays on the supported Gemini 3.1 Flash TTS model with the same key.

## Reference observations

All 13 supplied files were sampled and visually inspected. Grouped findings:

- `6a9922b6cfbac`: dark technology editorial, cyan accents, code/repository UI and numeric focal points.
- `6a9922927ad3a`: light playful editorial, cards and app screenshot inserts.
- `6a9655c7eec53`, `6a96555d27f6e`: paper/cream AI explainers, orange-red keyword emphasis, vector nodes/paths/sliders, restrained layout.
- `6a9654410d960`, `6a96542f676c0`, `FDown...829d`: geographical/history explainers, map movement and labels.
- `6a965418f3ed1`: landscape historical collage with paper textures.
- `6a9653c884880`: illustrated storytelling and characters.
- Four `AI_News...` clips: dark/red editorial news, source evidence, charts and strong text hierarchy.

These are visual observations from sampled frames, not frame-by-frame reverse engineering. Audio style was analyzed through Gemini for the three imported clips. The original video's editing software, exact easing curves and sound filenames cannot be reliably inferred. Named samples in the app reflect observations plus model uncertainty, and are editable.

## Delivered architecture

Shared Remotion Player; full-plan studio edit/revision API; optimistic concurrency and version restore; source evidence per script; constrained AI scene revision; separate mobile editor; creator music uploads; explicit per-scene transition/SFX; audio-safe scene duration; video style observations and profile editor; template compression; local runtime and independent database; Gemini 3.8 defaults and an editorial pass.

New migrations: 010 script_versions; 011 private/shared music; 012 script/project grounding evidence. Original project untouched. Baseline was extended for 010/011 while standalone idempotent migrations remain the upgrade path; 012 is migration-only.

## Material limits / next work

- Superseded for custom vector motion by the programmable reconstruction delivered in `03-motion-reconstruction.md`. Exact arbitrary-video cloning, footage extraction and full 3D/character rigs remain outside the implemented engine. No freeform HTML/JS from models is executed.
- Pipeline editing controls narrative structure and approval gate; it is not a generic visual DAG designer.
- AI imagery, OCR, speech alignment and factual claims need review. Speech duration determines final runtime; initial duration is approximate.
- Mobile/tablet browser layouts verified; native host bridges and real iOS/Android behavior are not certified.
- Production auth/deployment/load/storage lifecycle and Drive integration are outside the validated local handover.
- Runtime artifacts and credentials are ignored. Back up the `ams-next-data` volume together with `apps/server/storage` for actual projects.

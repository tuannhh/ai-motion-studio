# Chỉ dẫn cho Claude Code — AI Motion Studio

Khi bắt đầu phiên hoặc sau context compact, đọc theo thứ tự:
`memory-bank/00-project-brief.md` → `memory-bank/01-progress.md` → `docs/ARCHITECTURE.md` → `docs/ROADMAP.md`.

Quy tắc:
- AI sinh JSON scene-spec, engine sinh hình — không bao giờ để AI sinh code/CSS/filter.
- Spec lỗi = dừng (fail-closed), không render placeholder.
- Sửa thẩm mỹ ở engine (presets/motion/core), không ở prompt.
- Backend (apps/server) BẮT BUỘC theo skill `misa-backend-standard`; UI (apps/web) BẮT BUỘC theo skill `misa-design-system`.
- Không import chéo với `ai-video-studio` — chỉ vendor file (ghi rõ nguồn gốc trong comment đầu file).
- Duration scene lấy từ WAV thật; model Gemini để trong .env, không hard-code.
- Video render thử: `pnpm --filter @ams/motion-engine render examples/demo-ai-workflow.json --stills-only` (nhanh, không tốn API).

# Chỉ dẫn cho Claude Code — AI Motion Studio

Khi bắt đầu phiên hoặc sau context compact, đọc theo thứ tự:
`memory-bank/00-project-brief.md` → `memory-bank/01-progress.md` → `docs/ARCHITECTURE.md` → `docs/ROADMAP.md`.

Quy tắc:
- AI sinh JSON scene-spec. Từ 2026-09-07, scene `motion` cho phép AI thiết kế lớp SVG, toạ độ, đường vẽ, keyframe và cue SFX theo yêu cầu chủ dự án. Engine kiểm tra dữ liệu và biên dịch thành Remotion; có xuất TSX. Không thực thi HTML/JavaScript tuỳ ý.
- Spec lỗi = dừng (fail-closed), không render placeholder.
- Preset truyền thống giữ thẩm mỹ ở engine. Tái dựng clip dùng cả schema chuyển động, chỉ dẫn Gemini và vòng render–đối chiếu; không thay bằng chọn preset gần giống.
- Backend (apps/server) BẮT BUỘC theo skill `misa-backend-standard`; UI (apps/web) BẮT BUỘC theo skill `misa-design-system`.
- Không import chéo với `ai-video-studio` — chỉ vendor file (ghi rõ nguồn gốc trong comment đầu file).
- Duration scene lấy từ WAV thật; model Gemini để trong .env, không hard-code.
- Video render thử: `pnpm --filter @ams/motion-engine render examples/demo-ai-workflow.json --stills-only` (nhanh, không tốn API).

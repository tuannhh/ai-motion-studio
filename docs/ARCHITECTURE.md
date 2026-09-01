# Kiến trúc AI Motion Studio

Ngày lập: 2026-09-01 · Trạng thái: Giai đoạn 1 (engine + pipeline CLI) đã chạy

## Bức tranh tổng

```
Ý tưởng + tư liệu (upload / Drive / AI tự tìm)
        │
        ▼
┌─ TẦNG AI (packages/pipeline) ────────────────────────────────┐
│ 1. Research/ingest tư liệu (bọc <SOURCES_DATA> chống injection)│
│ 2. Gemini sinh N plan (đa chiều / serie) = scene-spec + narration│
│ 3. Zod + lint validate, 1 vòng repair, fail-closed            │
│ 4. NGƯỜI DUYỆT kịch bản (narration.md / UI)                   │
│ 5. TTS normalizer tiếng Việt → Gemini TTS → WAV + duration    │
└──────────────┬───────────────────────────────────────────────┘
               ▼  spec.json (hợp đồng duy nhất giữa 2 tầng)
┌─ TẦNG RENDER (packages/motion-engine) ───────────────────────┐
│ Remotion 4: Background động + 8 scene template + transitions  │
│ Kinetic typography (Be Vietnam Pro) + lucide icons + glass UI │
│ Voiceover/SFX/music mix trong composition → MP4 h264 1080×1920│
└──────────────────────────────────────────────────────────────┘
```

## Quyết định kiến trúc quan trọng

### AD-01 — Remotion thay FFmpeg filter làm renderer
Kế thừa kết luận của ai-video-studio (`docs/10-NGHIEN-CUU-RENDERER-THAM-CHIEU-2026-08-31.md`): FFmpeg filter-graph không thể làm motion graphics nhiều lớp; FFmpeg chỉ còn vai trò encode/mix. Bài bachdyon.com (Diagram Video Tool) xác nhận cùng hướng: AI viết JSON spec → validate → project Remotion → preview → MP4.

### AD-02 — AI chỉ sinh JSON theo schema bounded (kế thừa ADR-003 cũ)
AI không sinh code/JSX/CSS. Schema Zod ở `motion-engine/src/schema/spec.ts` là hợp đồng; `validate.ts` lint bố cục (scene 2–14s, tổng ≤95s, hook mở đầu, flow ≤6 node/≤2 emphasis, edge phải trỏ node tồn tại). Lỗi = dừng, có 1 vòng repair prompt.

### AD-03 — Thẩm mỹ tập trung ở engine, không ở prompt
Preset (`midnight/aurora/paper/ember`) định nghĩa trọn palette, font, motion signature (spring configs trong `core/motion.ts`). Đổi đẹp/xấu = sửa engine 1 chỗ, mọi video hưởng. AI chỉ chọn preset + nội dung.

### AD-04 — Duration lấy từ WAV thật, không ước lượng
Scene có voiceover → duration = WAV ms + 600ms thở (bẫy số 6 của dự án cũ: timeline phải suy từ audio thật). Không voiceover → default theo loại scene.

### AD-05 — Vendor 2 module tiếng Việt từ ai-video-studio
`pipeline/src/vendor/tts-normalizer.ts` (số/ngày/%/số hiệu văn bản → chữ đọc, có trace + requiresReview) và `word-timing.ts` (đọc WAV duration, forced alignment contract — dùng ở giai đoạn karaoke caption). Đã gỡ phụ thuộc NestJS.

### AD-06 — Monorepo pnpm, project độc lập hoàn toàn với ai-video-studio
Copy module thì vendor vào repo này; không import chéo, không chung git.

## Những gì tận dụng từ ai-video-studio (bản đồ tái sử dụng)

| Đã lấy | Sẽ lấy ở giai đoạn 2 | Chỉ học ý tưởng | Bỏ |
|---|---|---|---|
| tts-normalizer.ts | secret-crypto.ts (AES keyring) | Visual QA gate ảnh AI | render-motion.ts (FFmpeg) |
| word-timing.ts | config.ts (Zod env + prod guard) | Progressive disclosure UX (ADR-046/048) | createAss() karaoke |
| Pattern Gemini REST + TTS WAV | SSRF guard (source-ingestion) | Quy trình audit 2-agent | DesktopShell.vue 1018 dòng |
| Pattern prompt chống injection | PG queue FOR UPDATE SKIP LOCKED | VisualBeatPlan (doc 10) | quota/admin nghiệp vụ cũ |
| Ý tưởng headline-layout → viText.ts | MDS components + tokens (web) | audio-mix.ts sidechain ducking | |

## Giai đoạn 2 (kế tiếp) — xem ROADMAP.md

- `apps/server`: API theo **misa-backend-standard** (bắt buộc load skill khi code): auth, project, script approve gate, render queue (PG SKIP LOCKED), quota.
- `apps/web`: Vue 3 + **MDS 2.0** (bắt buộc load skill misa-design-system): màn nhập ý tưởng, duyệt/sửa kịch bản từng scene, theo dõi render, thư viện video.
- Google Drive: OAuth creator, export video lên Drive của họ.
- **Template-from-video**: AI (Gemini vision) phân tích video mẫu → sinh "style profile" (preset màu + nhịp scene + loại scene ưa dùng) + cho phép sửa workflow pipeline từng template.
- SFX/music: kho asset có license + sidechain ducking (copy audio-mix.ts).
- Caption karaoke theo word-timing (forced alignment đã vendor sẵn).

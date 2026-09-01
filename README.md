# AI Motion Studio

Hệ thống tạo video motion-graphics **tự động hoàn toàn bằng AI** (có người duyệt nội dung): người dùng nhập ý tưởng + tư liệu → AI viết kịch bản (đa chiều hoặc serie) → duyệt → render video dọc 1080×1920 với chữ động, sơ đồ, số liệu, hiệu ứng như các kênh giải thích chuyên nghiệp (tham chiếu: ainius.net).

**Khác biệt cốt lõi so với `ai-video-studio` (dự án cũ):** không dùng FFmpeg filter để "vẽ" hình — toàn bộ hình ảnh là **Remotion (React) render**, AI chỉ sinh **JSON scene-spec có schema + lint**, engine đảm nhận 100% thẩm mỹ (font, màu, easing, layout). AI không bao giờ quyết định pixel.

## Cấu trúc

```
packages/motion-engine   Trái tim: Remotion engine. Scene-spec JSON → MP4 1080×1920
packages/pipeline        Tầng AI: ý tưởng → kịch bản (Gemini) → TTS tiếng Việt → gọi engine
apps/server              (giai đoạn 2) API NestJS/Express theo misa-backend-standard
apps/web                 (giai đoạn 2) UI Vue 3 + MDS: nhập ý tưởng, duyệt kịch bản, quản lý video
assets/                  sfx, music, fonts dùng chung
docs/                    kiến trúc, roadmap, scene-spec reference
memory-bank/             trạng thái dự án cho phiên làm việc sau
```

## Chạy nhanh

```bash
pnpm install
cp .env.example .env   # điền GEMINI_API_KEY

# 1. Render thử spec mẫu (không cần API key)
pnpm --filter @ams/motion-engine render examples/demo-ai-workflow.json

# 2. Pipeline AI end-to-end: ý tưởng → kịch bản → TTS → video
pnpm --filter @ams/pipeline run run --idea "chủ đề của bạn" --voice female

# 3. Nhiều kịch bản đa chiều / serie
pnpm --filter @ams/pipeline run run --idea "..." --variants 3 --mode angles
pnpm --filter @ams/pipeline run run --idea "..." --variants 3 --mode series

# 4. Chỉ sinh kịch bản để duyệt (chưa render)
pnpm --filter @ams/pipeline run run --idea "..." --no-render --no-tts

# Xem trước trực quan khi chỉnh engine
pnpm --filter @ams/motion-engine preview
```

Output nằm ở `out/<slug>/`: `narration.md` (kịch bản để duyệt), `spec.json`, `audio/*.wav`, `video.mp4`, và PNG preview từng scene.

## Scene types (v1)

`hook` · `points` · `flow` (sơ đồ luồng) · `timeline` · `compare` · `stat` (số đếm động) · `quote` · `outro` — 4 preset màu: `midnight`, `aurora`, `paper`, `ember`. Chi tiết: [docs/SCENE-SPEC.md](docs/SCENE-SPEC.md).

## Nguyên tắc thiết kế (bất biến)

1. **AI sinh dữ liệu, engine sinh hình** — AI không viết code/CSS/filter; mọi spec qua Zod + lint trước khi render (safe-area, mật độ, thời lượng).
2. **Người duyệt trước khi tốn tiền render/TTS** — flow chuẩn: `--no-render --no-tts` → duyệt `narration.md` → chạy tiếp.
3. **Tiếng Việt là công dân hạng nhất** — font Be Vietnam Pro, ngắt dòng theo từ nối, TTS normalizer số/ngày/% (kế thừa từ ai-video-studio).
4. **Fail-closed** — spec lỗi thì dừng, không render "tạm cho xong" bằng placeholder xấu.

## Chạy full app (server + web)

```bash
# 1. MySQL + schema (lần đầu)
docker compose up -d mysql
docker compose exec -T mysql mysql -h127.0.0.1 -uams -pams_dev_password ams < apps/server/startup/database/schema.sql

# 2. Seed admin (lần đầu)
ADMIN_EMAIL=you@misa.com.vn ADMIN_PASSWORD='matkhau-manh' pnpm --filter @ams/server seed

# 3. Chạy
pnpm --filter @ams/server dev   # API http://localhost:4600
pnpm --filter @ams/web dev      # Web http://localhost:4610 (proxy /v1 → 4600)
```

Luồng: creator nhập ý tưởng + tư liệu (txt/docx/pdf/audio/video) → AI sinh kịch bản → duyệt/sửa lời thoại → render tự động → xem/tải MP4 / xuất Google Drive ngay trên web.

## Chạy bằng Docker (khuyến nghị cho máy khác)

**Máy khác chỉ cần cài đúng 1 phần mềm: [Docker Desktop](https://www.docker.com/products/docker-desktop/).**
Không cần cài Node, pnpm, Chrome, ffmpeg hay font — tất cả đã được **đóng gói sẵn trong image** (xem `Dockerfile`): Node 24, pnpm 9.15, Chrome Headless Shell (Remotion), ffmpeg, font tiếng Việt (Liberation + Noto + Be Vietnam Pro).

```bash
# 1. Điền API key (bắt buộc GEMINI_API_KEY; Google Drive/khoá mã hoá là tuỳ chọn)
cp .env.example .env   # rồi mở .env điền GEMINI_API_KEY, APP_ENCRYPTION_KEY...

# 2. Dựng & chạy toàn bộ (web + API + engine render + MySQL) — Docker tự tải & cài mọi thứ
docker compose up -d --build

# 3. Mở http://localhost:8080  (đăng nhập bằng tài khoản đã seed)
```

Migration DB tự áp khi container khởi động (`docker/entrypoint.sh`). Chi tiết + cách đưa sang **máy offline** (xuất image ra file `.tar.gz` bằng `docker save`, không cần internet để build): [docs/SETUP-MAY-KHAC.md](docs/SETUP-MAY-KHAC.md) và [docs/DEPLOY.md](docs/DEPLOY.md).

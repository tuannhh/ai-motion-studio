# Triển khai AI Motion Studio

App gồm 1 tiến trình Node phục vụ **web tĩnh + API + render engine (Remotion)**
cùng một origin, và 1 MySQL. Render dùng Chrome Headless Shell (Remotion) chạy
ngay trong container — học cách làm từ `auto-video-maker`.

## A. Docker (khuyến nghị — đơn giản, chạy được ngay)

### 1. Chuẩn bị `.env` ở gốc repo
```bash
cp .env.example .env
# Bắt buộc:
#   GEMINI_API_KEY=...            (đã có)
#   APP_ENCRYPTION_KEY=...        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Nếu bật Google Drive, đặt origin theo cổng 8080:
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#   GOOGLE_OAUTH_REDIRECT=http://localhost:8080/v1/integrations/gdrive/callback
#   WEB_BASE_URL=http://localhost:8080
```
> Nhớ vào Google Cloud Console thêm redirect URI `http://localhost:8080/v1/integrations/gdrive/callback`
> (hoặc domain thật) vào OAuth client.

### 2. Chạy toàn bộ
```bash
docker compose up -d --build
```
- MySQL lên trước; container `app` đợi DB khoẻ → tự **áp `schema.sql` + tất cả
  changelog** (idempotent) → khởi động server.
- Mở **http://localhost:8080** — web + API chung origin (cookie phiên & OAuth
  gọn trong 1 domain).

### 3. Tạo tài khoản admin đầu tiên
```bash
docker compose exec -e ADMIN_EMAIL=you@misa.com.vn -e ADMIN_PASSWORD='Matkhau@2026' \
  app pnpm --filter @ams/server seed
```

### 4. Vận hành
```bash
docker compose logs -f app        # xem log
docker compose down               # dừng (giữ dữ liệu trong volume)
docker compose up -d --build      # cập nhật sau khi sửa code
```
Dữ liệu bền nằm ở 2 volume: `ams-mysql-data` (DB) và `ams-storage` (nguồn upload,
video render, nhạc, watermark).

### Ghi chú kỹ thuật
- **Image bake sẵn**: Chrome Headless Shell (`ensureBrowser()`) + bundle Remotion
  + Google Fonts (pre-warm) → render không cần tải gì thêm lúc chạy.
- **Font tiếng Việt**: Be Vietnam Pro nhúng qua `@remotion/google-fonts` (trong
  bundle); thêm `fonts-noto-core` cho ảnh/nhãn hệ thống.
- **RENDER_CONCURRENCY**: số job render song song trong 1 container (mặc định 2).
  Máy càng nhiều vCPU/RAM thì tăng được; mỗi luồng render mở Chrome tốn RAM.

## B. Google Cloud Run (làm được, cần 3 điều chỉnh)

Cùng image trên chạy được trên Cloud Run, nhưng lưu ý bản chất Cloud Run:

| Vấn đề | Cách xử lý |
|---|---|
| **Ổ đĩa tạm, không chia sẻ giữa instance** (chỉ `/tmp` ghi được) | Chuyển `apps/server/storage` sang **GCS** (mount qua Cloud Storage FUSE volume, hoặc viết lớp storage dùng GCS SDK). Trước mắt: đặt `min-instances=1` + 1 instance để dùng ổ tạm, và dựa vào **export Drive** cho video đầu ra. |
| **Render worker chạy nền bị throttle khi scale-to-zero** | `--min-instances=1 --no-cpu-throttling` (CPU always allocated) để worker luôn sống; hoặc tách worker thành Cloud Run **Job** kích bằng Pub/Sub. |
| **Migration DB** | Dùng **Cloud SQL (MySQL)**; đặt `APPLY_MIGRATIONS=0` và chạy migration 1 lần riêng, hoặc để entrypoint tự áp (idempotent). Kết nối qua Cloud SQL connector. |

Ví dụ deploy (sau khi đã có Cloud SQL + secrets trong Secret Manager):
```bash
gcloud run deploy ams-app \
  --source . \
  --region asia-southeast1 \
  --cpu 2 --memory 4Gi \
  --min-instances 1 --no-cpu-throttling \
  --timeout 3600 \
  --set-secrets GEMINI_API_KEY=gemini-key:latest,APP_ENCRYPTION_KEY=enc-key:latest,GOOGLE_CLIENT_SECRET=gdrive-secret:latest \
  --set-env-vars NODE_ENV=production,DB_HOST=...,WEB_BASE_URL=https://<domain>,GOOGLE_OAUTH_REDIRECT=https://<domain>/v1/integrations/gdrive/callback
```
Render 1080×1920 khá nặng: nên ≥2 vCPU/4GB. Nếu gặp lỗi GL/khung đen, thêm
`chromiumOptions: { gl: "angle" }` (hoặc `swiftshader`) trong `renderMedia`
tại `packages/motion-engine/scripts/render.ts` — hiện đang dùng mặc định.

> **Ưu tiên**: chạy Docker (mục A) trước cho gọn/rẻ. Chuyển Cloud Run khi cần
> co giãn nhiều người dùng đồng thời — khi đó làm phần GCS + tách worker.

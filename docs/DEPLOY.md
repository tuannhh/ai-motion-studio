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

## B. Google Cloud Run — ĐÃ DEPLOY THẬT (2026-09-03)

Đang chạy tại **https://ams-app-ksesady2lq-as.a.run.app** (project GCP
`prapplication-479309`, region `asia-southeast1`, cùng chỗ với `amis-event-*`).
Ghi lại đúng cấu hình thật để lần sau redeploy/tái tạo hạ tầng không phải đoán:

| Thành phần | Giá trị |
|---|---|
| Cloud Run service | `ams-app` — 2 vCPU / 4Gi, `--min-instances=1 --max-instances=3 --no-cpu-throttling`, timeout 3600s |
| Cloud SQL | instance `ams-mysql` (MySQL 8.0, `db-g1-small`, zonal), DB `ams`, user `ams`; connect qua **Unix socket** `--add-cloudsql-instances` (không TCP) |
| Storage | bucket `gs://ams-storage-prapplication` mount **GCS FUSE volume** thẳng vào `/app/apps/server/storage` (`--add-volume type=cloud-storage` + `--add-volume-mount`) — **không cần sửa code storage layer**, mọi `fs.*` hiện có tự động ghi/đọc GCS xuyên suốt redeploy |
| Secrets (Secret Manager) | `ams-gemini-api-key`, `ams-encryption-key`, `ams-gdrive-client-secret`, `ams-db-password` — service account `784559735000-compute@developer.gserviceaccount.com` cần role `roles/secretmanager.secretAccessor` (từng secret) VÀ `roles/cloudsql.client` (project-level, cho Cloud SQL Auth Proxy sidecar) |
| Env vars | `NODE_ENV=production`, `DB_SOCKET_PATH=/cloudsql/prapplication-479309:asia-southeast1:ams-mysql`, `DB_USER=ams`, `DB_NAME=ams`, `COOKIE_SECURE=1`, `GOOGLE_CLIENT_ID=...`, `WEB_BASE_URL`/`GOOGLE_OAUTH_REDIRECT` trỏ đúng domain `ams-app-ksesady2lq-as.a.run.app`, **`GEMINI_CONTENT_MODEL`/`GEMINI_TTS_MODEL`/`GEMINI_IMAGE_MODEL`** (xem `.env.example` cho giá trị hiện hành) |

> **Bẫy đã gặp lần 2 (sau khi đã deploy "xong")**: quên truyền 3 biến chọn model Gemini ở
> trên lúc `--set-env-vars` đầu tiên → code fallback về default hard-code CŨ trong
> `packages/pipeline/src/env.ts` (`gemini-2.5-flash` thay vì `gemini-3.7-flash` đang dùng ở
> local) — sinh kịch bản kém tin cậy hơn hẳn (vd lỗi schema `caption` quá 110 ký tự ngay cả
> sau vòng tự sửa). Bài học: khi `--set-env-vars` lúc deploy, đối chiếu ĐỦ danh sách biến
> trong `.env.example` chứ không chỉ nhóm liên quan DB/OAuth — thiếu biến không gây lỗi
> khởi động (có default) nên KHÔNG lộ ra ở bước healthcheck, chỉ lộ khi người dùng thật sự
> dùng tính năng. Sửa nhanh không cần rebuild: `gcloud run services update ams-app --update-env-vars=...`.

Lệnh deploy đầy đủ (image build sẵn qua `gcloud run deploy --source .` rồi
deploy lại bằng `--image=<digest>` cho nhanh khi chỉnh flag, khỏi build lại):
```bash
gcloud run deploy ams-app \
  --source . \
  --project=prapplication-479309 --region=asia-southeast1 --port=8080 \
  --cpu=2 --memory=4Gi --min-instances=1 --max-instances=3 --no-cpu-throttling \
  --timeout=3600 --allow-unauthenticated \
  --add-cloudsql-instances=prapplication-479309:asia-southeast1:ams-mysql \
  --add-volume=name=ams-storage-vol,type=cloud-storage,bucket=ams-storage-prapplication \
  --add-volume-mount=volume=ams-storage-vol,mount-path=/app/apps/server/storage \
  --set-secrets="GEMINI_API_KEY=ams-gemini-api-key:latest,APP_ENCRYPTION_KEY=ams-encryption-key:latest,GOOGLE_CLIENT_SECRET=ams-gdrive-client-secret:latest,DB_PASSWORD=ams-db-password:latest" \
  --set-env-vars="NODE_ENV=production,DB_SOCKET_PATH=/cloudsql/prapplication-479309:asia-southeast1:ams-mysql,DB_USER=ams,DB_NAME=ams,COOKIE_SECURE=1,GOOGLE_CLIENT_ID=<client-id>,WEB_BASE_URL=https://ams-app-ksesady2lq-as.a.run.app,GOOGLE_OAUTH_REDIRECT=https://ams-app-ksesady2lq-as.a.run.app/v1/integrations/gdrive/callback"
```

**Bẫy đã gặp lúc dựng lần đầu** (đỡ mất công debug lại):
- `gcloud run deploy --source .` hay bị Bash tool timeout 2 phút giết tiến trình CLI cục bộ
  giữa chừng — build/deploy vẫn chạy tiếp trên server, chỉ cần `gcloud builds list` /
  `gcloud run services describe` để bắt lại tiến độ thay vì nghĩ là đã hỏng.
- Thiếu `roles/cloudsql.client` → container treo 120s ở bước "Đợi MySQL" rồi exit(1) mà
  KHÔNG rõ lý do (entrypoint.sh cũ nuốt stderr — đã sửa để in lỗi thật).
  Xem log: `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="ams-app" AND resource.labels.revision_name=<rev>' --format="table(timestamp,severity,textPayload)" --order=asc`
- Secret tạo từ file qua `echo "$X" > file.txt` dính thêm `\n` cuối (khác giá trị gốc dùng
  trong lệnh `gcloud sql users create --password=`) → login MySQL báo "Access denied" dù
  đúng mật khẩu. Dùng `printf '%s'` (không xuống dòng) khi ghi secret ra file.
- Seed admin đầu tiên: không exec được vào container Cloud Run như Docker — chạy
  `pnpm --filter @ams/server seed` LOCAL, trỏ qua Cloud SQL Auth Proxy cục bộ
  (`gcloud components install cloud-sql-proxy` → `cloud-sql-proxy --port=3307 --gcloud-auth <connection-name>` →
  `DB_HOST=127.0.0.1 DB_PORT=3307 DB_PASSWORD=... ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @ams/server seed`).
- OAuth Google Drive: đổi domain thật rồi vẫn phải vào Google Cloud Console → OAuth
  client → thêm `https://ams-app-ksesady2lq-as.a.run.app/v1/integrations/gdrive/callback`
  vào Authorized redirect URIs thủ công (gcloud CLI không có lệnh cho việc này).

Render 1080×1920 khá nặng: nên ≥2 vCPU/4GB. Nếu gặp lỗi GL/khung đen, thêm
`chromiumOptions: { gl: "angle" }` (hoặc `swiftshader`) trong `renderMedia`
tại `packages/motion-engine/scripts/render.ts` — hiện đang dùng mặc định.

> **Ưu tiên**: chạy Docker (mục A) trước cho gọn/rẻ. Chuyển Cloud Run khi cần
> co giãn nhiều người dùng đồng thời — khi đó làm phần GCS + tách worker.

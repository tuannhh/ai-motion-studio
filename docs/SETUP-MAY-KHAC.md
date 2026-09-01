# Cài đặt AI Motion Studio trên máy khác

Tài liệu này trả lời: **máy tính khác cần cài thêm gì ngoài Docker?** — và cách
đưa app sang máy không có internet.

## TL;DR

> Máy khác **chỉ cần cài Docker Desktop**. Không cần cài gì thêm.

Toàn bộ phần mềm nền được **đóng gói sẵn trong Docker image** (định nghĩa trong
`Dockerfile`), Docker tự tải và cài khi build:

| Thành phần | Vai trò | Ai cài? |
|---|---|---|
| Node.js 24 | chạy API + engine | **image tự cài** |
| pnpm 9.15 | quản lý gói | **image tự cài** |
| Chrome Headless Shell | Remotion render frame | **image tự cài** (`ensureBrowser`) |
| ffmpeg | ghép frame → MP4, xử lý audio | **image tự cài** (qua @remotion/renderer) |
| Font tiếng Việt | Liberation, Noto, Be Vietnam Pro | **image tự cài** |
| MySQL 8 | cơ sở dữ liệu | **container riêng** (docker compose) |

Người dùng **không phải cài Node/pnpm/Chrome/ffmpeg/MySQL** thủ công.

---

## Cách A — Máy có internet (khuyến nghị)

Cần: **Docker Desktop** + mã nguồn (clone GitHub).

```bash
git clone <repo-url> ai-motion-studio
cd ai-motion-studio

cp .env.example .env
#  Mở .env, điền tối thiểu:
#   GEMINI_API_KEY=...          (bắt buộc — sinh kịch bản, TTS, ảnh)
#   APP_ENCRYPTION_KEY=...      (bắt buộc nếu bật Google Drive; sinh bằng:
#                                node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#   GOOGLE_CLIENT_ID / SECRET   (tuỳ chọn — export Drive)

docker compose up -d --build     # lần đầu build ~5-10 phút (tải base image + Chrome + font)
# Mở http://localhost:8080
```

Lần sau chỉ cần `docker compose up -d` (không `--build`).

Tạo tài khoản admin lần đầu (nếu DB trống): xem README mục seed, hoặc dùng
tài khoản đã có trong DB.

---

## Cách B — Máy KHÔNG có internet (đóng gói 1 file)

Ý tưởng: build image ở máy có mạng, **xuất ra 1 file** rồi copy sang máy kia
(qua USB / Google Drive), máy kia `docker load` là chạy — không cần build lại,
không cần internet.

**Trên máy có mạng (đã build xong image):**

```bash
# Xuất image app thành 1 file nén (~1.6GB). MySQL kéo riêng bên dưới.
docker pull mysql:8.0
docker save ai-motion-studio-app:latest mysql:8.0 | gzip > ai-motion-studio-image.tar.gz
```

Copy 3 thứ sang máy kia: `ai-motion-studio-image.tar.gz`, thư mục mã nguồn
(cần `docker-compose.yml`, `docker/`, `apps/server/startup/database/`), và file
`.env` đã điền key.

**Trên máy offline (đã cài Docker Desktop):**

```bash
docker load < ai-motion-studio-image.tar.gz     # nạp image từ file
cd ai-motion-studio
docker compose up -d                             # KHÔNG --build (dùng image đã nạp)
# Mở http://localhost:8080
```

> Lưu ý: file `.tar.gz` chứa image đã build cho đúng kiến trúc CPU. Máy Apple
> Silicon (M1/M2/M3) và máy Intel/AMD khác kiến trúc — nếu máy đích khác kiến
> trúc thì build lại ở Cách A, hoặc build image đa kiến trúc bằng `docker buildx`.

---

## Cần chuẩn bị gì ở phía dịch vụ ngoài

- **Gemini API key** (bắt buộc): https://aistudio.google.com/apikey
- **Google Drive OAuth** (tuỳ chọn — chỉ khi muốn export lên Drive): tạo OAuth
  client (Web) ở Google Cloud Console, bật Drive API, và **đăng ký Authorized
  redirect URI** đúng origin đang chạy:
  - Docker: `http://localhost:8080/v1/integrations/gdrive/callback`
  - (đổi `localhost:8080` thành domain thật nếu chạy trên máy chủ có tên miền)

## Tăng tốc render

Sửa trong `.env` (hoặc biến môi trường):

- `RENDER_FRAME_CONCURRENCY` — số frame song song khi render **1 video** (mặc
  định ~75% số nhân CPU). Tăng để 1 video render nhanh hơn.
- `RENDER_CONCURRENCY` — số **video** render song song. Đừng để
  `RENDER_CONCURRENCY × RENDER_FRAME_CONCURRENCY` vượt nhiều lần số nhân CPU
  (Chrome nhiều tab sẽ tranh CPU/RAM → chậm hơn và dễ hết RAM).

Máy 8 nhân / 16GB (ví dụ MacBook M1 Pro): `RENDER_CONCURRENCY=2` +
`RENDER_FRAME_CONCURRENCY=6` là cân bằng tốt.

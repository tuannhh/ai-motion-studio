# Roadmap

## GĐ1 — Nền móng sáng tạo (XONG 2026-09-01)
- [x] Monorepo pnpm độc lập tại `/Users/tuanbui/ai-motion-studio`
- [x] motion-engine: 8 scene template, 4 preset, kinetic typography Việt, validator + lint
- [x] CLI render spec → MP4 1080×1920 30fps + PNG preview từng scene
- [x] pipeline: Gemini sinh kịch bản đa chiều/serie → repair loop → TTS (normalizer + WAV duration) → render
- [x] Demo render thành công (demo-ai-workflow.mp4)

## GĐ2 — Sản phẩm dùng được cho creator (XONG 2026-09-01, trừ 2 mục dời GĐ3)
- [x] `apps/server` (misa-backend-standard): Express + MySQL 8 Docker (:3310), auth session+CSRF argon2, RBAC admin/creator, Project/Sources/Script/ApproveGate/RenderJob (MySQL FOR UPDATE SKIP LOCKED), upload tư liệu multipart (txt/docx/pdf/audio/video ≤18MB, extract Gemini), watermark admin (text/ảnh + vị trí/độ mờ/kích thước), quản lý người dùng
- [x] `apps/web` (MDS 2.0): login → tạo video (ý tưởng + tư liệu + chế độ đa chiều/serie + preset + slider thời lượng + voice profile nam-nữ/bắc-nam/thời sự-tin tức/tốc độ) → duyệt kịch bản → theo dõi render → xem/tải video; admin: watermark editor kéo-thả preview 9:16 + người dùng
- [x] Voice thống nhất 1 giọng/clip (locked instruction) + tốc độ 1.2x ffmpeg atempo
- [x] (2026-09-01) SFX synthesis kit license-free (gen-sfx.ts DSP thuần → assets/sfx) + auto-SFX engine + sidechain ducking (nhạc tự nhún 28% khi voiceover nói) — còn thiếu KHO NHẠC nền thật (mục GĐ3)
- [ ] (dời GĐ3) Google Drive OAuth thật: export video vào Drive creator
- [ ] (dời GĐ3) Caption karaoke forced alignment (hiện chia tỷ lệ theo từ)

## GĐ3 — Template & mở rộng sáng tạo (đợt 1 XONG 2026-09-01)
- [x] **Template-from-video**: upload video mẫu (mp4/mov/webm ≤18MB) → Gemini vision phân tích → StyleProfile (preset + accent + palette + nhịp + sceneTypeMix + narrationTone + hookStyle + visualSignatures + doNots) → bảng `templates`, block `<STYLE_PROFILE>` nhúng vào prompt sinh kịch bản, accent áp vào spec lúc render
- [x] Workflow pipeline chỉnh được trong template: mode/số variant/thời lượng/voice profile + **bật/tắt gate duyệt** (tắt = sinh xong tự approve + render); bước research riêng chưa tồn tại nên chưa có toggle
- [x] Scene type `chart` (bar/line single-series theo phương pháp dataviz: 1 trục, nhãn số chọn lọc điểm highlight, grid lặng)
- [x] **Motion v0.3 — variety pack** (học remotion-motion-graphics skill): 3 transition tự dựng (whip-pan blur, scale-through, mask-wipe accent) + palette 8 kiểu chọn theo seed slug/vị trí (mỗi video một chuỗi chuyển cảnh riêng, deterministic); exit nhanh hơn entrance + idle breathing (SafeArea); Ken Burns luân phiên zoom-in/out theo seed; grade soft-light đồng nhất ảnh AI về tông preset; `source` cho stat/rank (chart đã có)
- [x] Scene type `terminal` (cửa sổ mac chrome + lệnh gõ dần typewriter + output + highlight accent — cho nội dung dev/AI tool); screenshot-annotate & image-hero: annotate + bgImage đã phủ, phần còn lại dời GĐ4
- [ ] Đồng bộ beat nhạc (ý tưởng Hyperframes: cắt scene theo framesPerBeat) — chờ kho nhạc
- [x] **Serie manager** (2026-09-01): bảng `series` + projects.series_id (changelog 003), buildSeriesContext (tóm tắt tập trước + narration tập gần nhất → `<SERIES_CONTEXT>`, tập mới đánh số tiếp và hook nối tập trước — ĐÃ test E2E 2 tập), UI CreateView chọn serie/tạo serie mới; còn thiếu: trang quản lý serie riêng + lịch đăng
- [x] **Bundle cache** (2026-09-01): webpack bundle cache theo hash nội dung src/** tại `.bundle-cache/` (giữ 2 bản LRU), asset job vào namespace riêng trong public của bundle → render bỏ qua webpack khi engine không đổi; queue song song multi-worker chưa làm (render farm GĐ4)

## GĐ4 — Hạ tầng & hoàn thiện (đợt 1 + đợt 2 XONG 2026-09-01)

- [x] **Đổi mật khẩu self-service** — `POST /v1/auth/password` (verify mật khẩu hiện tại bằng argon2, băm mới, ĐÁ mọi phiên khác giữ phiên hiện tại) + dialog trong menu user (Shell.vue). ĐÃ test E2E: sai mật khẩu→400, mật khẩu yếu→400, thiếu CSRF→403, đổi thành công đá thiết bị khác (401) nhưng phiên hiện tại còn sống, mật khẩu cũ bị từ chối.
- [x] **Trang quản lý Serie riêng** (`SeriesView.vue` + `GET/PUT /v1/series/:id`) — list serie, drawer chi tiết xem các tập theo thứ tự (số tập, tiêu đề, trạng thái duyệt + render, tiến độ, video xem/tải), đổi tên/mô tả, xoá. ĐÃ test E2E + kiểm chứng UI trên trình duyệt (drawer hiện đúng 2 tập AI 101 với trạng thái "Đã render").
- [x] **Phân trang server-side (keyset)** cho danh sách project — `GET /v1/projects?cursor=&limit=` trả `{items, nextCursor}` (keyset theo p.id giảm dần, không OFFSET), ProjectsView có nút "Tải thêm". ĐÃ test E2E cursor paging. (Series/videos/users list vẫn LIMIT 100 — nhỏ, chưa cần; áp cùng pattern khi cần.)
- [x] **Render multi-worker** — `RENDER_CONCURRENCY` (default 2): worker mở tối đa N luồng song song, mỗi luồng claim job riêng bằng FOR UPDATE SKIP LOCKED; pha ảnh/TTS (I/O Gemini) chồng lấn pha render (CPU) tăng throughput. **Bundle-cache build nguyên tử** (build vào tmp rồi `renameSync` vào đích — 2 process cùng cache-miss không giẫm nhau; kẻ tới sau bỏ bản build của mình). ĐÃ test E2E: 2 job render đồng thời (cùng ở trạng thái 'images'), cả 2 xong có audio; 2 render cache-miss song song → đúng 1 thư mục cache sạch.

### GĐ4 đợt 2 — XONG 2026-09-01 (phiên Fable)
- [x] **Kho nhạc nền** — bảng `music_tracks` (changelog 004) + `music.service.ts` (magic-bytes mp3/wav/m4a/ogg, 20MB) + `/v1/music` (list mọi user, upload/xoá admin, stream `/audio`) + `AdminMusicView.vue` (upload/nghe thử/xoá) + chọn nhạc khi tạo project (`projects.music_track_id`) → render-worker gán `spec.audio.music` (engine đã có ducking). **LƯU Ý Pixabay: API key chỉ cho ẢNH/VIDEO** — endpoint audio trả 403/404; nhạc lấy thủ công 1-click từ pixabay.com/music (CC0) rồi admin upload. ĐÃ test: admin upload→201, magic-bytes giả→400, creator upload→403, stream→200 MP3 hợp lệ; render job có nhạc 73-90dB ducked dưới voice.
- [x] **Forced alignment caption qua Gemini** (KHÔNG cần công cụ ngoài) — `alignWordsToAudio` (gemini-3.7-flash nhận WAV inline base64 + token → timestamps mỗi từ, temperature 0) → `tryForcedAlignment` (tokenize vendor regex, validate qua `buildForcedWordTimings`, lỗi bất kỳ→null→fallback chia tỷ lệ). Bật/tắt bằng `FORCED_ALIGNMENT=1`. Tính chi phí vào Gemini key sẵn có (~8s/scene). ĐÃ kiểm chứng: 12 timestamp đơn điệu cho 12 từ WAV 3400ms, từ cuối kết đúng 3400ms; forced khác proportional có ý nghĩa (loại drift ~400ms).
- [x] **Scene `screenshot`** — ảnh UI dùng **nano banana 2** (`generateUiImage` + `reviewUiImage` NGHỊCH cổng annotate: CHO PHÉP chữ/UI, chỉ loại ảnh méo/nhoè). `Screenshot.tsx` bọc ảnh trong thẻ bo góc sạch (KHÔNG vẽ chrome giả vì nano banana tự thêm chrome → tránh nhân đôi), phone thêm notch; chấm số 1..n neo ĐÚNG điểm (x,y), nhãn xổ sang bên không tràn khung. Demo: `examples/demo-screenshot.json` + `assets/demo-ui-events.jpg`. ĐÃ kiểm chứng ảnh nano banana chất lượng cao (UI AMIS Event tiếng Việt sạch, đọc được) + still render đúng.

### GĐ4 đợt 3 — XONG 2026-09-01 (Google Drive)
- [x] **Google Drive OAuth export** (2026-09-01, phiên Fable) — creator kết nối Drive (OAuth scope `drive.file`, chỉ đụng file app tạo) rồi xuất video render thẳng lên Drive. Changelog `005-integrations.sql` (`gdrive_accounts` token AES-256-GCM, `oauth_states` chống CSRF, `drive_exports`). `lib/crypto.ts` (AES-256-GCM, APP_ENCRYPTION_KEY 32-byte hex — fail-fast nếu bật Drive mà khoá rỗng). `gdrive.service.ts` REST thuần (không googleapis SDK): buildAuthUrl (access_type=offline+prompt=consent), handleCallback (verify state → đổi code → lưu token mã hoá + email), getValidAccessToken (tự refresh), uploadFile (resumable upload), exportJobToDrive (kiểm chủ sở hữu job chống IDOR → upload → upsert drive_exports). Routes `/v1/integrations/gdrive/{status,connect,callback,DELETE}` + `/v1/jobs/:id/export/drive` (GET/POST). Web: menu tài khoản "Google Drive" (kết nối/ngắt, xử lý `?drive=connected|error`), nút "Xuất lên Drive"/"Đã lưu Drive — mở" trong ProjectsView. ĐÃ test backend E2E: status→connected:false, connect→URL Google đúng (client_id/scope/offline/consent/redirect/state), thiếu CSRF→403, export chưa kết nối→400, export job người khác→404 (IDOR), crypto round-trip + GCM phát hiện giả mạo. **Handshake OAuth thật cần user bấm đồng ý trong trình duyệt (tài khoản Google thật).** Config: GOOGLE_CLIENT_ID/SECRET/OAUTH_REDIRECT + WEB_BASE_URL + APP_ENCRYPTION_KEY trong .env.

### Nâng cấp thẩm mỹ engine (2026-09-01, phiên Fable) — thư viện Remotion official
- [x] **4 gói official** (`@remotion/layout-utils`, `paths`, `noise`, `motion-blur` @4.0.290) tích hợp Ở ENGINE (không đụng prompt/spec → mọi video đẹp hơn). (a) **Tự co chữ** `core/fit.ts` (fitText/measureText) → headline/cụm từ tiếng Việt không bao giờ tràn/cắt (áp BigWord, KineticText prop maxWidth, SceneHeader/SceneTitle, Screenshot). (b) **Gạch chân vẽ tay** evolvePath (AccentUnderline) thay thanh scaleX phẳng. (c) **Nền nhiễu Perlin** noise2D (Background) thay dao động sin → sống động không lặp. ĐÃ render kiểm chứng stills 7/7 scene + MP4 6.7s sạch. Gimmick (glitch/wavy/text-warp) CỐ Ý bỏ. Đợt sau nếu muốn: lottie, light-leak overlay, GL transitions (cần gl=angle headless).

### Triển khai (2026-09-01, phiên Fable) — Docker trước, Cloud Run sau
- [x] **Docker 1-container** (web tĩnh + API + render engine cùng origin): `Dockerfile` (node:24-bookworm-slim + libs Chrome Headless Shell + `ensureBrowser()` bake trình duyệt + pre-warm bundle/font; pin pnpm 9.15.0 tránh policy minimumReleaseAge của pnpm 10). Server phục vụ `apps/web/dist` + SPA fallback ở production, honor `PORT`. `docker/entrypoint.sh` đợi MySQL → áp schema+changelogs idempotent → start. `docker-compose.yml` thêm service `app` (+volume ams-storage bền). `docs/DEPLOY.md`. Học cách chạy Remotion headless từ [[auto-video-studio]]/auto-video-maker (ensureBrowser, base64 audio, ffmpeg-static).
- [ ] **Cloud Run**: cùng image chạy được nhưng cần (a) storage→GCS (FS ephemeral), (b) worker always-on (`--min-instances=1 --no-cpu-throttling` hoặc tách Cloud Run Job), (c) có thể cần `chromiumOptions:{gl:"angle"}` nếu lỗi GL. Chi tiết docs/DEPLOY.md mục B. Ưu tiên Docker trước theo yêu cầu user.

### Còn lại — giá trị thấp / tuỳ nhu cầu vận hành:
- [ ] **Beat-sync nhạc** (cắt scene theo framesPerBeat — cần phân tích BPM), **image-hero** (biến thể screenshot toàn màn), **Lịch đăng/scheduler, thống kê usage** (CRUD + cron thuần).

## GĐ5 — VFX & bố cục động (ĐÃ LÊN PLAN 2026-09-02, chưa code)
Đa dạng hoá bố cục/hình khối/chuyển động + hiệu ứng khối + chart đa dạng + diagram có
graphic motion + VOX + nhấn từ khoá. **Plan chi tiết (nguồn chân lý): `docs/VFX-ROADMAP.md`**
— 7 đợt P0→P6 (dễ→khó), bất biến/verify/rủi ro/model/handoff đa tài khoản ghi đầy đủ ở đó.

## Nguyên tắc khi làm GĐ2+
- Backend: load skill `misa-backend-standard` trước khi code
- UI: load skill `misa-design-system` (MDS 2.0) trước khi code
- Không phá hợp đồng scene-spec v1; thêm loại scene = thêm literal mới vào discriminated union (backward compatible)

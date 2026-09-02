# Progress

## 2026-09-02 (tiếp 8) — Sửa thẩm mỹ engine theo phản hồi trực tiếp (VOX + core)

Giám đốc thiết kế xem video "Agentic Enterprise" (render ở tiếp 7) trên điện thoại, chỉ ra
5 lỗi cụ thể trên scene "annotate" + "versus" flavor VOX: (1) tương phản kém — chữ gần đen
trên nền accent bão hoà đọc như "cùng tông"; (2) markup `**...**` hiện RAW ngoài hình (LỖI
THẬT — `AnnotateScene` render `scene.headline` trực tiếp, KHÔNG qua `RichText`/`fitBox` như
mọi scene khác); (3) khối chữ/ảnh đè sát nhau, thiếu giãn dòng; (4) chữ nhỏ khó đọc trên
điện thoại; (5) phụ đề đặt quá thấp (`bottom:150`), dễ bị caption/tên kênh của
TikTok/Reels/Shorts che khi đăng thật.

**Sửa tại engine (đúng CLAUDE.md — không sửa prompt):**
- `Annotate.tsx`: headline giờ qua `fitBox` (tự co cỡ, 2 dòng tối đa, 40-62px) + `RichText`
  (xử lý đúng markup, hết hiện `**`) — bug chính đã fix. Thêm scrim gradient riêng sau lưng
  khối chữ đầu (ảnh nền bận chi tiết vẫn đọc rõ chữ). Note box 40→44px, lineHeight 1.3→1.4.
- `core/RichText.tsx`: **BỎ HẲN** biến thể `marker` (dải bút dạ P6 VOX) — đo lại thấy tương
  phản chữ trắng/nền accent chỉ ~3:1 (sát ngưỡng tối thiểu WCAG cho chữ lớn), lại tạo viền
  cắt nửa dưới chữ gây rối mắt. Quay về accent-màu + gạch chân cho MỌI flavor (đã dùng ổn
  định trước P6) — đúng ý giám đốc thiết kế: "nhấn mạnh bằng bold đậm, đổi màu, không cần
  khung".
- `core/ui.tsx` `Kicker` (biến thể vox): từ thẻ ĐẶC accent + `bestTextOn` (chữ gần đen trên
  nền accent — tương phản đo được ~6.5:1 nhưng NHÌN vẫn như "cùng tông xanh" vì cùng hue) →
  thẻ VIỀN accent + nền `accentSoft` mờ + chữ màu accent (accent luôn nổi trên nền theme tối,
  khác hẳn tông, không còn nhầm). `SceneHeader` bỏ prop `marker` khi gọi `RichText`.
- `Versus.tsx`: card value 58→64px, label 26→28px, detail 26→29px + lineHeight 1.4, padding
  card 48→52px, gap 16→20 (giãn dòng).
- `core/Captions.tsx`: `bottom:150→260`, `fontSize:46→52`, `lineHeight:1.35→1.4` — né vùng
  UI nền tảng short-form khi đăng thật.

**Verify:** `tsc --noEmit` sạch → `pnpm still` render lại 7 scene của CHÍNH spec video đã
giao (không tốn API) → soát bằng mắt scene-1/2/4/5/7: markup hết lộ, kicker/badge đọc rõ,
không còn đè khối, phụ đề cao hơn rõ rệt. Render lại mp4 đầy đủ (đúng 58.2s, cùng
audio/ảnh cũ — chỉ engine đổi) → gửi lại bản mới cho giám đốc thiết kế.

Bài học: `bestTextOn` (WCAG luminance) đúng toán học nhưng KHÔNG bắt được cảm nhận "cùng
tông màu" (hue giống nhau dù độ sáng khác xa) — với nền/badge dùng chính `theme.accent`,
ưu tiên kiểu viền/nhạt (accent nổi trên nền theme) hơn kiểu đặc màu (chữ tương phản nhân tạo
trên chính accent). Cũng là bài học 2: 1 feature mới (P6 marker) có thể bị phản hồi thật đảo
ngược ngay buổi sau — đừng ngại bỏ nếu bằng chứng thị giác rõ ràng, dù mới thêm.

## 2026-09-02 (tiếp 7) — Google Search grounding (AI tự tra cứu web) THẬT SỰ HOẠT ĐỘNG

Bối cảnh: `source_mode: "ai"/"combine"` đã có sẵn ở DB/server/web từ trước, nhưng CLI
(`run.ts`) chưa expose và chưa ai verify grounding có thực sự chạy không. User yêu cầu
thẳng "khai thác triệt để hệ sinh thái Gemini API" → làm cho thật.

**Phát hiện lỗi gốc:** tool `google_search` (đúng format `{google_search:{}}`, đã verify
hoạt động qua probe hỏi trực tiếp 1 câu đơn giản — ra đúng ngày + giá vàng thật). NHƯNG khi
gắn tool này CHUNG với lệnh `generateJson(buildPlansPrompt(...))` (prompt dài, có
CRAFT_RULES + SCHEMA_GUIDE ép JSON schema phức tạp), Gemini **luôn bỏ qua việc gọi tool**,
kể cả khi prompt có hẳn block `<WEB_SEARCH>` ép rõ, kể cả khi KHÔNG có nguồn PDF nào (test
riêng "AI tự tìm thuần"). Kết luận: tool-calling + structured-output phức tạp trong CÙNG 1
lượt gọi không đáng tin cậy với Gemini.

**Fix — tách 2 bước** (`packages/pipeline/src/prompts.ts` thêm `buildResearchPrompt()`,
`api.ts` sửa `generatePlans()`): nếu `webSearch:true`, gọi MỘT lệnh nghiên cứu riêng, ngắn,
không JSON, ép search chạy đáng tin cậy (`generateJson(buildResearchPrompt(idea, sources),
{webSearch:true})`) → gộp kết quả vào `sourcesText` như MỘT NGUỒN bình thường (giống hệt
`--- Nguồn: X ---` của PDF/docx) → đưa vào lệnh sinh JSON chính KHÔNG kèm tool (quay lại
`responseMimeType:application/json` ổn định, bỏ hẳn cơ chế `extractJson` chắp vá trước đó).
`buildPlansPrompt()` bỏ tham số/`<WEB_SEARCH>` block cũ (không còn cần vì search đã xảy ra
trước, nguồn đã có sẵn trong `<SOURCES_DATA>`). API công khai `GeneratePlansOptions.webSearch`
GIỮ NGUYÊN — server/CLI không cần sửa gì thêm.

**Verify thật:** 2 lần test độc lập đều search chạy — probe không nguồn ("AI tự tìm thuần",
idea về Agentic AI VN 2026) ra 4 câu query thật + nguồn Gartner/AWS thật, scene sinh ra có
`source:"Gartner / Diễn đàn Biztech 2025"` v.v. Sau đó render lại video "Agentic Enterprise"
gốc (PDF `Slide chị Quyên_2307.pdf` + `--web-search`, giọng nam/bắc/tintuc, 60s) — log ra
4 query thật (Gartner/McKinsey/Bain/Capgemini) + 5 grounding URL thật; video 58.2s render
sạch (`out/agentic-enterprise-dot-pha-nang-suat/video.mp4`), hook scene lấy đúng thống kê
"95% dự án AI thất bại" (khớp số liệu AI industry phổ biến — không có trong PDF gốc → xác
nhận web search đã thực sự đóng góp nội dung, không chỉ chạy suông).

`pnpm --filter @ams/pipeline exec tsc --noEmit` sạch. Bài học: khi cần Gemini VỪA
tool-call VỪA structured-output, luôn tách 2 lệnh — đừng tin tưởng 1 lệnh làm cả hai.

## 2026-09-02 (tiếp 6, tài khoản mới) — GĐ5 VFX: P6 XONG (VOX) — TOÀN BỘ GĐ5 (P0→P6) HOÀN TẤT

Tiếp nối đúng quy trình bàn giao đa tài khoản: tài khoản trước làm hết P0→P5 (đã commit,
xem log `f65fb16/b514b0f/137e6db/06a1205/0b7a2c0`) rồi bắt đầu P6 thì hết quota, để lại
**8 file sửa CHƯA COMMIT** trên nhánh `vfx` (đã có sẵn 1 spec verify `verify-p6-vox.json`
+ 5 still đã render ở `out/verify-p6-vox.*.png` chứng minh phần lớn đã chạy được). Phiên
này: kiểm tra kỹ code dở → xác nhận đúng hướng, hoàn thiện nốt phần thiếu, verify lại,
rồi commit.

**Đã có sẵn (từ tài khoản trước, giữ nguyên):** `Flavor` type chồng lên preset màu qua
`theme.flavor` (`resolveTheme` thêm tham số flavor, KHÔNG đổi bảng màu — spec cũ không
đổi); `schema/spec.ts` + `prompts.ts` thêm `style.flavor?: "vox"` optional; `SceneHeader`
+ `Kicker` (`core/ui.tsx`) khi vox: tiêu đề HOA/900/nén `scaleX(0.9)` (bù bề rộng qua
fitBox), Kicker → thẻ đặc accent (`bestTextOn` chọn màu chữ tương phản); `RichText` thêm
prop `marker` (vệt bút dạ nền accent phủ 40% dưới chữ, tái dùng markup `**từ**` của P1);
`Annotate.tsx` khoanh tròn vẽ tay "wobble" tất định (`roughEllipse(cx,cy,rx,ry,seed)` +
hash chuỗi) thay vòng ring sạch khi vox.

**Phiên này hoàn thiện thêm (phần còn thiếu so với `docs/VFX-ROADMAP.md` §4 P6):**
- **"Cắt cảnh nhanh gọn"** (`Video.tsx` `transitionFor`): pool con 6 transition "năng
  lượng cao" (whip-pan, scale-through, mask-wipe, blur-zoom, iris, push-diagonal) — bỏ
  slide/fade/wipe êm — CHỈ áp khi `theme.flavor==="vox"`. **CỐ Ý KHÔNG đụng
  `TRANSITION_FRAMES`** (hằng số này chi phối toàn bộ phép tính duration/cue đã kiểm
  chứng ở P0-P5 — đổi nó rủi ro cao, không đáng cho một hiệu ứng thẩm mỹ).
- **Demo chính thức** `examples/demo-vox-explainer.json` (5 scene: hook/points/annotate/
  chart donut/outro, ảnh annotate dùng `demo-ui-events.jpg` có sẵn — an toàn, không dùng
  ảnh nhạy cảm).
- **Verify render ĐẦY ĐỦ 2 preset** (trước đó chỉ có midnight): stills 5/5 scene sạch ở
  CẢ midnight lẫn paper (flat giữ đúng bất biến — khoanh tay/kicker/marker KHÔNG glow
  trên paper). Full mp4 715 frame ≈47s (~0.066s/frame, ngang baseline P0-P5, không treo).
  Contact-sheet (ffmpeg tile mỗi 60 frame) xác nhận transition năng lượng cao chạy mượt
  qua cả 4 lần cắt cảnh, donut animate 0→72% xuyên transition không vỡ. typecheck
  engine+pipeline sạch (2 lỗi kiểu do TS không widen union tuple đã sửa bằng annotation
  `number[]` tường minh).

**TRẠNG THÁI: GĐ5 VFX & bố cục động (P0→P6) HOÀN TẤT.** Đã tick hết ở
`docs/VFX-ROADMAP.md` §3. Còn ĐANG DỞ trên nhánh `vfx`, **CHƯA commit lần cuối** (sẽ
commit ngay sau mục progress này) — CHƯA push GitHub (theo ràng buộc vận hành), CHƯA
merge vào nhánh chính (chờ user duyệt xem video thật).

## 2026-09-02 (tiếp 5) — GĐ5 VFX: P3 XONG (bộ chart dễ đọc), đã verify render 2 preset

Làm theo `docs/VFX-ROADMAP.md` §4 (P3), model Opus 4.8, nhánh `vfx`. Mở rộng `chart` từ
2 variant (bar/line) → **8 variant**. `scenes/Chart.tsx` viết lại thành DISPATCHER +
các plot con; bar/line giữ nguyên (tách `AxisChart`/`LinePlot`).

**6 variant MỚI:**
- 1-giá-trị (chỉ đọc `points[0]`): `donut` (vòng % quét theo góc, stroke-dashoffset),
  `gauge` (nửa cung KPI + nhãn 0/target 2 đầu), `thermometer` (ống + bầu + cột đổ đầy),
  `waffle` (lưới 10×10, đổ đầy từ hàng dưới lên trái→phải, `round(pct*100)` ô).
- `spark` (sparkline + 1 số LỚN, dùng điểm highlight/cuối làm số + caption).
- `duo` (2 cột accent vs muted, so trước/sau) — ĐẶT TÊN `duo` KHÔNG phải `compare` để
  tránh trùng scene type `compare` (bảng ưu/nhược) đã có — footgun cho prompt AI.

**Schema (`spec.ts`):** variant enum mở 8 giá trị; thêm `target?` (mốc 100% cho 4
variant 1-giá-trị — trống ⇒ value là % thang 100, engine tính `value/target` kẹp 0–1);
points `min(1) max(12)` (cũ 3–8) để donut/gauge… chỉ cần 1 điểm; label max 14→18.

**Bất biến GIỮ:** số KPI LỚN luôn `theme.text` (đọc rõ mọi nền), accent CHỈ cho phần đổ
đầy/mark → giải quyết luôn lưu ý tương phản của chủ dự án (không có chữ-accent-trên-nền-
tối). glow/boxShadow (ring donut, bầu thermometer, cột duo) gate `!theme.flat`. Fill
animate bằng `drawProgress`/`enterSpring` (deterministic).

**Lint (`validate.ts`):** cảnh báo theo variant — bar/line <3 điểm, spark <2, duo ≠2,
1-giá-trị có >1 điểm (thừa bị bỏ), value > mốc target (bị kẹp 100%). Fail-closed vẫn
chạy: test đầu bị chặn vì label caption >18 ký tự — đúng như thiết kế.

**Prompt (`prompts.ts`):** viết lại mục "9b. chart" — bảng CHỌN variant theo dạng số
(donut=tỉ trọng %, gauge=KPI thang, thermometer=tiến độ, waffle=bao nhiêu/100, spark=xu
hướng gọn, duo=2 số trước/sau), phân biệt rõ duo vs scene compare/versus.

**Verify render (bắt buộc):** cả 6 variant render sạch ở **midnight + paper**; paper giữ
`theme.flat` (không glow, editorial cream). Full mp4 8 scene 1363 frame ~60s
(~0.041s/frame), NGANG baseline — waffle 100 ô/khung vẫn rẻ, không treo. Không đổi shape
dữ liệu nên `sceneDisplayText` (server) không cần sửa.

Còn lại roadmap: chỉ P6 (VOX) — làm tiếp ngay.

## 2026-09-02 (tiếp 4) — GĐ5 VFX: P5 XONG (diagram có motion bên trong), đã verify render + ĐO thời gian

Làm theo `docs/VFX-ROADMAP.md` §4 (P5), model Opus 4.8, tiếp trên nhánh `vfx`. Đây là
đợt "Khó" cuối trong nhóm P4/P5 — sơ đồ kiến trúc có CHUYỂN ĐỘNG THẬT bên trong (thứ
reference editorial cố tình không có).

**Quyết định kiến trúc:** thêm scene type MỚI `diagram` (KHÔNG nâng cấp `flow`) để giữ
tương thích ngược spec v1 — `flow` vẫn là danh sách bước tuyến tính; `diagram` là
node/edge rẽ nhánh + hội tụ. Engine sở hữu TOÀN BỘ bố cục: AI chỉ đưa `nodes` + `edges`,
KHÔNG toạ độ.

**Dàn tầng tự động (Sugiyama-lite)** — `scenes/Diagram.tsx` `layoutNodes()`: level =
đường dài nhất từ gốc bằng relaxation (`level[to] ≥ level[from]+1`, tối đa n vòng, guard
chu trình) ⇒ MỌI cạnh luôn đi XUỐNG tầng sâu hơn ⇒ định tuyến vuông góc (`routeEdge`)
luôn hướng xuống, sạch, không rối. Nhóm theo level thành hàng, canh tâm mỗi hàng.

**Chuyển động bên trong:**
- Cạnh tự vẽ dần (`stroke-dashoffset` × `drawProgress`), mũi tên tam giác (`arrowHead`)
  xoay theo hướng đoạn cuối, hiện sau khi vẽ xong.
- HẠT SÁNG chạy vòng lặp dọc cạnh (`pointAtPolyline` nội suy điểm theo frame) — lõi
  trắng + quầng accent (glow gate `!theme.flat`).
- Node tiêu điểm ĐẬP nhẹ (`breathe`) + viền chạy (`RunningBorder`, gate `theme.flat`).
- Nhãn cạnh có chip nền che line (mask ở midpoint) — line không xuyên qua chữ.
- Hình học dùng chung tách ra `core/geometry.ts` (`Pt`, `polyLength`,
  `pointAtPolyline`, `toPolyPoints`).

**BẪY đã sửa (centering):** node đặt `left/top` + `transform: translate(-50%,-50%)` để
canh tâm, NHƯNG `...entrance(revealStyle, p)` cũng trả `transform` → GHI ĐÈ translate
canh tâm ⇒ node lệch xuống-phải nửa kích thước, cột phải (`img`) TRÀN mép canvas. Sửa:
tách 2 lớp — lớp NGOÀI định vị + canh tâm + `breathe`(scale); lớp TRONG là thẻ mang
`entrance` animation. Phát hiện qua render still, sửa xong render lại: mọi node canh tâm,
không tràn.

**Schema/validate/prompt:** `schema/spec.ts` thêm `diagramSceneSchema` (nodes 2-7:
id/label≤40/icon?/kind box|pill|hub/emphasis; edges 1-10: from/to/label≤20/dashed),
DEFAULT_SCENE_SECONDS `diagram: 8.5`. `schema/validate.ts` lint: edge trỏ node tồn tại,
cấm self-loop, cảnh báo node cô lập + >2 emphasis. `prompts.ts` scene "3b. diagram"
(rẽ nhánh/hội tụ dùng diagram, tuyến tính dùng flow; AI chỉ nodes+edges KHÔNG toạ độ;
edge nông→sâu). `project.service.ts` sceneDisplayText case diagram.

**Verify render (bắt buộc):** midnight + paper (flat) đều render sạch, canh tâm, không
tràn; paper GIỮ bất biến `theme.flat` (không glow/blur, hạt = accent đặc không quầng,
`RunningBorder` trả null). Contrast đạt: text luôn `theme.text`, accent chỉ cho
viền/connector/icon. Không regression trên `demo-ai-workflow.json` (7 scene, flow s2 giữ
running-border P4).

**Chi phí render — ĐÃ ĐO (bắt buộc đợt Khó):** midnight 428 frame full mp4 = **~21s**
(~0.049s/frame), NGANG baseline P0-P2/P4 (~0.057s/frame). Hình học SVG + hạt per-frame
RẺ, không treo render. Bài học P4 (tránh stacked filter/backdrop-blur) vẫn giữ: dùng
`stroke-dashoffset` + `transform` + `drop-shadow` đơn (gate flat).

Còn lại roadmap: P3 (bộ chart dễ đọc) và P6 (VOX) — chỉ làm khi user yêu cầu.

## 2026-09-02 (tiếp 3) — GĐ5 VFX: P4 XONG (hiệu ứng khối), đã verify render + ĐO thời gian

Làm theo `docs/VFX-ROADMAP.md` §4 (P4), model Opus 4.8, tiếp trên nhánh `vfx`. (P3 —
bộ chart — TẠM BỎ QUA theo yêu cầu user, làm P4 trước; P3 vẫn ☐ trong roadmap.)

**File mới `core/surfaces.tsx`** — thư viện 4 "bề mặt" hiệu ứng khối cho 1 KHỐI TIÊU
ĐIỂM/scene (tiết chế), TẤT CẢ gate theo `theme.flat` (paper → null, không lung linh):
- `RunningBorder`: viền line ánh sáng chạy quanh chu vi (3 nét SVG stroke-dashoffset:
  ring nền mờ + underglow nét rộng mờ + "sao chổi" sáng) — KHÔNG filter blur (underglow
  bằng nét rộng, rẻ hơn drop-shadow từng frame). VIỀN-ONLY → không đè chữ.
- `GlassSweep`: quét specular kính (1 vệt sáng chéo trượt qua rồi đỗ ngoài khung),
  mixBlendMode screen + opacity thấp → chỉ ánh lên, không che chữ.
- `CrystalFacets`: pha lê low-poly (8 tam giác cố định, cạnh sáng mảnh + fill accent
  rất mờ, mỗi mặt lấp lánh lệch pha bằng sin(frame)); clip trong bo góc.
- `CircuitTraces`: vi mạch (trace trực giao mờ + node + hạt xung chạy dọc trace bằng
  nội suy điểm theo frame). Line ngang/dọc giữ vuông khi stretch → sạch.
- `surfaceFor(key, theme, pool)`: chọn theo seed, trả null khi flat. `SurfaceOverlay`
  dispatcher.

**Wiring (1 khối tiêu điểm/scene, chỉ preset tối):**
- `Glass` (`core/ui.tsx`) thêm prop optional `surface?`/`surfaceSeed?` + `position:
  relative` → phủ overlay khi có surface (mặc định off, spec cũ không đổi).
- Flow node emphasis → `running-border` (viền-only, chữ label giữ nét).
- Stat: pha lê/vi mạch SAU con số (seed chọn), z-index dưới số → số luôn đọc rõ.
- BigWord chip accent → `GlassSweep` lướt qua.

**KHÔNG đụng schema/prompts** — bề mặt là thẩm mỹ thuần engine, chọn bằng seed (AI
không điều khiển). Hợp đồng scene-spec v1 nguyên vẹn 100%, chi phí AI = 0. Back-catalogue
tự đẹp hơn khi render lại (demo flow node "duyệt" tự có viền chạy, không đổi spec).

**BẪY tương phản (đúng mối lo user nhắc lại):** `BigWord.tsx` chip accent cũ dùng
`color: theme.flat ? theme.surface : theme.text` → chữ gần-TRẮNG trên nền accent đặc.
Trên noir (accent đỏ #E5484D) chỉ ~3.3:1 (dưới AA). Sửa bằng `bestTextOn(theme.accent)`
(helper WCAG đã thêm ở P2) → chữ gần-đen ~5.6:1. Đây là bug thứ 2 cùng loại với Outro
CTA (P2) — quét lại theo lưu ý user thì lộ ra.

**Chi phí render — ĐÃ ĐO (bắt buộc của P4):** midnight 731 frame full mp4 = **41.4s**
(~0.057s/frame), NGANG baseline P0-P2 (P2: 814 frame ~48s). Bề mặt chỉ dùng
transform/opacity/stroke-dashoffset/gradient — KHÔNG backdrop-blur, KHÔNG chồng
text-shadow blur (bài học treo >10 phút). Không treo, không phình.

**Đã verify render:** stills + full mp4 trên midnight (flow viền chạy + stat circuit +
bigword sweep), noir (chip accent chữ đen trên đỏ + stat crystal), paper (flat — xác
nhận KHÔNG có bề mặt nào: node/stat sạch trơn = invariant giữ). tsc sạch cả 4 package.

Tiếp theo: P3 (bộ chart dễ đọc) hoặc P5 (diagram có motion) — theo chỉ định user.

## 2026-09-02 (tiếp 2) — GĐ5 VFX: P2 XONG (bố cục đa dạng + scene Versus), đã verify render

Làm theo `docs/VFX-ROADMAP.md` §4 (P2), tiếp trên nhánh `vfx`. User lưu ý thêm: hạn
chế chữ tương phản kém (chữ accent-xanh trên nền tối, hoặc chữ đen/trắng sai trên nền
accent đặc) — áp dụng nguyên tắc này xuyên suốt P2 (xem BẪY dưới).

**4 dáng mới cho scene `points`** (`Points.tsx`, cộng "cards"/"bignum" đã có = 7 dáng):
- `grid`: lưới 2 cột, mỗi ô Glass icon+text căn giữa — nén 3-5 mục ngắn.
- `checklist`: tick tròn viền `theme.good` (XANH LÁ, không phải accent) nảy vào từng
  dòng — cố tình đổi hue khỏi accent-xanh-dương để đa dạng, không lặp lại "chữ/viền
  xanh dương" ở mọi nơi.
- `zigzag`: thẻ so le trái/phải quanh 1 trục dọc GIỮA, mốc tròn accent pop đúng tâm
  dọc mỗi thẻ (dùng CSS `top:50%` per-item, không đo DOM — an toàn, không brittle).
- `numbered-rail`: ray dọc trái + mốc tròn viền accent, SỐ bên trong dùng `theme.text`
  (trắng/đen) chứ không phải accent — badge dễ đọc hơn hẳn.
- `scene.layout` (mới, optional, default "auto"): escape-hatch ép 1 dáng cụ thể để
  chỉnh tay/debug — KHÔNG dạy AI trường này trong prompts.ts (thẩm mỹ ở engine).

**Scene mới `versus`** (`Versus.tsx`, `schema/spec.ts`, `Video.tsx`, `prompts.ts`
mục 5b, `project.service.ts` — thiếu case này thì màn duyệt hiện trống "chữ trên
hình"): đối đầu 2 phía kiểu "so găng", mỗi bên 1 giá trị/cụm chốt + huy hiệu VS tròn
đè giữa — khác `compare` (bảng ưu/nhược nhiều điểm).

**BẪY — tương phản chữ trên nền accent đặc (đúng thứ user nhắc):** `Outro.tsx` CTA
cũ chọn màu chữ qua `theme.isDark` (suy đoán theo preset) — tính lại bằng luminance
thật (`bestTextOn()` mới trong `style/presets.ts`, WCAG relative luminance, so
contrast với trắng/đen) thì phát hiện preset "paper" (isDark=false) đang cho chữ
TRẮNG trên nền cam accent chỉ đạt ~3.68:1 (dưới ngưỡng AA 4.5:1), trong khi gần-đen
đạt ~5.33:1 — bug tương phản có thật, đã sửa. `bestTextOn()` dùng lại cho huy hiệu VS
mới. Nguyên tắc áp dụng toàn P2: text nội dung luôn `theme.text` (không bao giờ
`theme.accent`), accent chỉ dùng cho viền/icon/rail/badge nền đặc (có tính contrast
đúng), glow/boxShadow mới đều gate theo `theme.flat`.

**Đã verify render:** stills + full mp4 (27.1s, ~48s, không treo) trên spec ép layout
qua `scene.layout` (grid 4 mục, checklist 3, zigzag 5, numbered-rail 2, versus) ở cả
preset `midnight` (glow) và `paper` (flat — xác nhận không rò glow); render lại
`demo-ai-workflow.json` không lỗi (seed re-map sang layout khác do thêm option mới
vào `pickBySeed` — ĐÚNG theo thiết kế, không phải regression). tsc sạch cả 4 package.

Tiếp theo: P3 (bộ chart dễ đọc: donut/gauge/nhiệt kế/waffle/spark).

## 2026-09-02 (tiếp) — GĐ5 VFX: P0 + P1 XONG, đã verify render

Làm theo `docs/VFX-ROADMAP.md` §4 (P0, P1), nhánh git riêng `vfx`.

**P0 — Nền chuyển động** (`core/motion.ts`, `Video.tsx`):
- `signatureEase = Easing.bezier(0.16, 1, 0.3, 1)` (mượn kỷ luật nhịp từ tool tham
  chiếu, không copy hiệu ứng) — áp vào `sceneExitStyle()` (exit scene mượt hơn thay vì
  interpolate mặc định).
- `premountFor={FPS}` trên mỗi `TransitionSeries.Sequence` — scene dựng sẵn 1s trước
  khi vào khung nhìn, chống "pop" chữ/layout ở frame đầu.

**P1 — Nhấn từ khoá `**từ**`/`~~từ~~`** (`core/RichText.tsx` mới, `core/ui.tsx`,
`core/KineticText.tsx`, `scenes/Hook.tsx`, `prompts.ts`):
- `RichText.tsx`: parse markup `**accent**` (tô màu + gạch chân) / `~~dim~~` (mờ) →
  span; markup lẻ (không khép cặp) tự strip ký hiệu, không vỡ hình. Dùng trong
  `SceneHeader` (title/sub, 7 scene: Points/Flow/Timeline/Compare/Rank/Chart/Media) +
  `Hook.tsx` sub (bypass SceneHeader, phải vá riêng — xem BẪY dưới).
- `KineticText.tsx` (Hook/Outro/Quote/BigWord headline): tự parse markup trong `text`,
  gộp accent-words vào `emphasisSet` sẵn có + thêm `dimSet` (opacity 0.55). Không đổi
  hành vi cũ khi text không có markup.
- `prompts.ts`: dạy AI cú pháp, giới hạn CHỈ dùng trong `headline`/`title` (không
  `sub`/`note`/narration), ≤2 cụm/câu.

**BẪY — comment JSDoc chứa `**/` bị hiểu là đóng comment:** viết docblock mô tả cú
pháp `**accent**/~~dim~~` làm TS parser lỗi hàng loạt (dấu `*/` trong `**/` đóng
comment giữa chừng). Sửa: tránh viết `**word**` sát nhau trong docblock.

**BẪY 2 — `sub` không phải lúc nào cũng qua SceneHeader:** test markup trong
`hook.sub` lộ ra ký hiệu `~~...~~` thô trên hình vì `Hook.tsx` tự render `<p>{scene.sub}</p>`
riêng (không qua `SceneHeader`). Vá bằng cách bọc `<RichText>` y hệt SceneHeader.

**Đã verify render:** `--stills-only` + full mp4 (11.8s, ~25s render, không treo) trên
spec test có markup — accent tô đúng màu+gạch chân, dim mờ đúng, markup lẻ không rò rỉ
ký hiệu; render lại `examples/demo-ai-workflow.json` (không markup) → pixel-equivalent
với trước, không có regression. tsc sạch cả 4 package (motion-engine/pipeline/server/web).

Tiếp theo: P2 (bố cục đa dạng grid/checklist/zigzag/rail/versus).

## 2026-09-02 — GĐ5 VFX & bố cục động: ĐÃ LÊN PLAN (chưa code), sẵn sàng bàn giao đa tài khoản

User yêu cầu đa dạng hoá VFX/bố cục (đang bị "đóng khung" ô chữ nhật xếp dọc): thêm bố
cục mới, hiệu ứng khối (line sáng/thuỷ tinh/pha lê/vi mạch), nhiều kiểu chart dễ đọc,
diagram có graphic motion bên trong, phong cách VOX, nhấn từ khoá. Đã nghiên cứu kỹ tool
tham chiếu `diagram-video-tool-v1.0.0` (hệ editorial tối giản, KHÔNG có sẵn các hiệu ứng
này, KHÔNG license → chỉ mượn kỷ luật nhịp: `Easing.bezier(.16,1,.3,1)`, stagger,
`premountFor`, mask nhãn, marker mũi tên — hiệu ứng trang trí tự dựng mới).

**→ Plan chi tiết = NGUỒN CHÂN LÝ: `docs/VFX-ROADMAP.md`** (7 đợt P0→P6, dễ→khó, có bất
biến/kim chỉ nam/verify/rủi ro từng đợt + khuyến nghị model + cách chạy tiếp trên tài
khoản khác). Bản có hình để duyệt: Artifact "Lộ trình VFX Engine"
(https://claude.ai/code/artifact/bb4d8976-53d7-4a3e-a58f-3a2d1da09f39).

- Thứ tự đã chốt (dễ→khó): **P0** nền chuyển động (premount chống pop chữ + ease chữ ký)
  · **P1** nhấn từ khoá `**từ**` (accent/gạch chân/mờ) · **P2** bố cục đa dạng
  (grid/checklist/zigzag/rail + scene VS) · **P3** bộ chart dễ đọc
  (donut/gauge/nhiệt kế/waffle/spark, 1 accent) · **P4** hiệu ứng khối (line
  sáng/thuỷ tinh/pha lê/vi mạch — rủi ro chi phí render) · **P5** diagram có motion (hạt
  chạy dọc edge/đường tự vẽ/node đập/marker+mask) · **P6** phong cách VOX.
- **Chi phí AI ≈ 0**: gần như toàn bộ là code engine render local; chỉ P1/P3/P6 đụng
  nhẹ `prompts.ts`. → 25$ credit không bị đụng cho VFX.
- **Model:** Sonnet 5 high đủ cho P0–P3, P6; nâng Opus 4.8/5 (hoặc Sonnet 5 xhigh) cho
  P4–P5. Kỷ luật verify-render + giữ bất biến quan trọng hơn sức mạnh model.
- **TRẠNG THÁI: chưa bắt đầu code** — chờ user gật "bắt đầu". Khi làm xong đợt nào →
  tick Status trong `docs/VFX-ROADMAP.md` §3 + thêm mục ngày ở đây kèm "đã verify".
- Ràng buộc còn hiệu lực: KHÔNG Cloud Run (test Docker trước), KHÔNG commit/push nếu
  chưa được bảo, KHÔNG tự nhập mật khẩu máy.

## 2026-09-01 (phiên Fable) — Deploy Docker 1-container (đã chạy E2E :8080)

`Dockerfile` (node:24-bookworm-slim + libs Chrome Headless Shell + `ensureBrowser()` bake, đặt TRƯỚC COPY source để đổi code không tải lại Chromium; pre-warm render 7 scene; **pin pnpm 9.15.0** tránh policy minimumReleaseAge của pnpm 10) + `docker/entrypoint.sh` (đợi MySQL→áp schema+005 changelog idempotent→start) + `docker-compose.yml` service `app` (+volume ams-storage) + `.dockerignore` + `docs/DEPLOY.md`. Server production phục vụ `apps/web/dist` SPA + honor `PORT`; API 404 JSON đặt trước SPA fallback. ĐÃ E2E: `docker compose up -d` → migrations tự áp → :8080 health/web/login/gdrive/render-in-container đều OK.

**BẪY 1 — helmet CSP làm TRẮNG TRANG khi phục vụ HTTP:** `helmet()` mặc định gửi CSP `upgrade-insecure-requests` + HSTS → trên trang http://localhost:8080, trình duyệt ép `/assets/*.js` sang **https** (không có TLS) → script không load → trắng trang. `curl` không thực thi CSP nên tưởng OK (200). SỬA (index.ts): `helmet({ contentSecurityPolicy:{ useDefaults:true, directives:{ "upgrade-insecure-requests":null, "img-src":['self',data:,blob:], "media-src":['self',blob:] }}, strictTransportSecurity:false })`. Lên Cloud Run (HTTPS thật) proxy tự set HSTS. Đã verify header sạch + app render trong trình duyệt.

**BẪY 2 — cwd của Bash tool tự reset về /Users/tuanbui:** `docker compose build` chạy sai thư mục → "no configuration file provided" (im lặng không build) → image không cập nhật dù sửa source. LUÔN dùng `docker compose -f /Users/tuanbui/ai-motion-studio/docker-compose.yml ...` (đường dẫn tuyệt đối).

**BẪY 3 — Docker registry chập chờn:** `docker compose build` báo `DeadlineExceeded: context deadline exceeded` ở bước load metadata base image (không reach docker.io lúc đó). Khắc phục tạm: `docker commit ams-app ai-motion-studio-app:latest` để bake fix vào image (source-of-truth vẫn là Dockerfile — build sạch lại được khi registry thông). Rebuild đúng: `docker compose -f <abs>/docker-compose.yml build app` khi mạng ổn.

## 2026-09-01 (phiên Fable) — Nâng cấp thẩm mỹ engine bằng thư viện Remotion chính chủ

User hỏi tích hợp thư viện từ remotion.dev/docs/resources để video "xuất sắc hơn". Nguyên tắc giữ nguyên: polish nằm ở ENGINE, KHÔNG đụng prompt/spec → mọi video + toàn back-catalogue đẹp hơn khi render lại, hợp đồng scene-spec v1 bất biến. TRÁNH các lib gimmick (glitch/wavy-TikTok/text-warp) vì làm rẻ nội dung MISA. Chọn 4 gói OFFICIAL (render headless tin cậy): `@remotion/layout-utils`, `@remotion/paths`, `@remotion/noise`, `@remotion/motion-blur` (đều @4.0.290).

- **Tự co chữ không bao giờ tràn** (`core/fit.ts` dùng layout-utils `fitText`/`measureText`): `fitOneLine` (1 dòng) + `fitBox` (nhiều dòng, giữ max nếu ≤ maxLines, dài hơn co theo tỉ lệ bề rộng∝cỡ chữ). Lỗi đo (font chưa nạp) → trả max (không chặn render). Áp: BigWord (accent 1 dòng + plain 2 dòng), KineticText (prop `maxWidth`/`maxLines` mới → Hook truyền 912×4), SceneHeader/SceneTitle (ui.tsx, SAFE_W×3), Screenshot headline. ĐÃ kiểm chứng: cụm 8 từ "Tự động hoàn toàn từ đầu đến cuối" vừa khít trong khung accent (trước đây tràn ở fontSize 120 cố định); headline 14 từ co lại nằm gọn không cắt.
- **Gạch chân accent VẼ TAY** (`AccentUnderline` trong KineticText.tsx dùng `@remotion/paths` evolvePath): thay thanh scaleX phẳng bằng nét bút dạ hơi lượn tự vẽ trái→phải theo độ dài đường thật + glow → "khoảnh khắc chữ ký". Dùng dưới headline Hook/Outro (mọi call site hưởng ngay, API giữ nguyên).
- **Nền sống động** (`Background.tsx` dùng `@remotion/noise` noise2D): quỹ đạo 3 blob gradient trôi theo nhiễu Perlin (organic, không lặp giật) thay dao động sin đều; thêm shimmer sáng/tối rất chậm (aurora "thở"). Universal cho mọi preset không-flat.
- **motion-blur** (`@remotion/motion-blur`): đã cài, để dành `<Trail>` cho entrance nếu cần (chưa bật để giữ chi phí render ổn định).
- ĐÃ RENDER kiểm chứng: stills 7/7 scene type OK + full MP4 polish-test 6.7s render sạch (evolvePath vẽ mượt qua frame, noise không nhấp nháy). typecheck engine sạch. Đã gửi user MP4.
- **Chưa tích hợp (đề xuất đợt sau nếu muốn)**: `@remotion/lottie` (micro-animation icon), light-leak overlay (premium, rẻ), GL transitions (cần gl=angle/swiftshader headless — rủi ro Cloud Run), Skia/three (nặng). Nguồn: remotion.dev/docs/resources.

## 2026-09-01 (phiên Fable) — GĐ4 đợt 3: Google Drive OAuth export

User cấp Google OAuth credentials (client id/secret) → làm xong export video lên Drive. **KHÔNG dùng googleapis SDK** (đồng bộ ethos REST thuần của pipeline Gemini).

- **Changelog `005-integrations.sql`** (ĐÃ áp :3310, lại né bẫy tsx-watch reload — server crash verifyTables rồi restart lại OK vì bảng đã có): `gdrive_accounts` (1-1 user, refresh/access token **mã hoá**, access_expires_at, folder_id), `oauth_states` (state 1 lần chống CSRF login, hết hạn 15'), `drive_exports` (PK job_id → idempotent, file_id + web_link). db.ts REQUIRED_TABLES += 3 bảng.
- **`lib/crypto.ts`** — AES-256-GCM (`encryptSecret`/`decryptSecret`), khoá `APP_ENCRYPTION_KEY` (32-byte hex, đã sinh + ghi .env). config.ts fail-fast: bật Drive mà khoá còn mặc định (64 số 0) → từ chối khởi động. Định dạng lưu `iv:tag:ct` hex; GCM tự xác thực toàn vẹn (đã test: giả mạo ciphertext → decrypt ném lỗi).
- **`gdrive.service.ts`** (REST fetch): `buildAuthUrl` (scope `drive.file openid email`, access_type=offline + prompt=consent để chắc có refresh_token, lưu state); `handleCallback` (verify state thuộc đúng user + chưa hết hạn → đổi code lấy token → GET userinfo lấy email → upsert mã hoá); `getValidAccessToken` (còn hạn dùng access token giải mã, sắp hết → refresh bằng refresh_token, lưu lại); `uploadFile` (resumable: POST init lấy Location → PUT bytes, video ngắn đọc buffer 1 lần); `exportJobToDrive` (dùng getJobOwned chống IDOR → upload → upsert drive_exports); `getJobExport`.
- **Routes**: `integrations.routes.ts` `/v1/integrations/gdrive/{status GET, connect POST→authUrl, callback GET→redirect WEB_BASE_URL?drive=connected|error, DELETE}` (mount có requireAuth — callback là GET nên qua CSRF, cookie phiên sameSite=lax gửi kèm khi Google redirect top-level; **cookie không phân biệt port** nên :4600 nhận được cookie set qua proxy :4610). `/v1/jobs/:id/export/drive` GET (link đã có) + POST (export). index.ts mount `/v1/integrations`.
- **Web**: Shell.vue menu tài khoản thêm "Google Drive" (dialog kết nối/ngắt, onMounted đọc `?drive=` toast + dọn URL, `connectDrive` → `window.location=authUrl`). ProjectsView.vue nút "Xuất lên Drive" (cloud-upload) cạnh Tải MP4, sau export đổi thành link "Đã lưu Drive — mở" (external-link, mở tab mới); openDetail tự nạp export sẵn có cho job done. types.ts += GDriveStatus, DriveExport.
- **Config .env**: GOOGLE_CLIENT_ID/SECRET/OAUTH_REDIRECT (`http://localhost:4600/v1/integrations/gdrive/callback`) + WEB_BASE_URL (`http://localhost:4610`) + APP_ENCRYPTION_KEY. Deploy đổi 2 URL + đăng ký redirect trong Google Console.
- **ĐÃ test backend E2E**: status→{connected:false}; connect→URL Google đúng (client_id/scope drive.file+openid email/access_type=offline/prompt=consent/redirect/state); connect thiếu CSRF→403; export chưa kết nối→400 "Chưa kết nối"; export job người khác→404 (IDOR chặn); crypto round-trip match + GCM phát hiện giả mạo; oauth_states row persisted. **Handshake OAuth thật + upload cần user bấm đồng ý trong trình duyệt (tài khoản Google thật) — không tự làm hộ (an toàn credential).** typecheck server+web sạch.

## 2026-09-01 (phiên Fable) — GĐ4 đợt 2 hoàn tất: scene `screenshot` bằng nano banana 2

Trả lời 4 chỉ đạo của user: (1) SFX/nhạc từ Pixabay → đã làm kho nhạc (Pixabay API chỉ ảnh/video, nhạc upload thủ công); (2) Google Drive OAuth → hướng dẫn lấy credentials (xem ROADMAP GĐ4); (3) forced alignment → Gemini audio timestamps, tính vào key sẵn có; (4) screenshot-annotate → **nano banana 2** (gemini-3.1-flash-image). Mục (1)(3) đã xong phiên trước; phiên này chốt (4) + hướng dẫn (2).

**Scene `screenshot` — đường ảnh UI riêng, KHÔNG qua cổng chống-chữ:**
- `images.ts`: `generateUiImage(description, outPathNoExt, "4:3"|"9:16")` + `reviewUiImage` NGHỊCH `reviewImage` — CHO PHÉP chữ/UI/dashboard (đó là mục đích), chỉ loại ảnh méo/nhoè/lỗi render. `buildUiPrompt` yêu cầu screenshot phần mềm sạch, tiếng Việt đọc được. Cùng INTERACTIONS_URL + response_format aspect_ratio như đường ảnh thường.
- `api.ts` generateSpecImages: scene `screenshot` → task `kind:"uiImage"` → generateUiImage (phone→9:16, browser→4:3); annotate & screenshot đều fail-closed nếu thiếu ảnh. validatePlans đặt placeholder `__pending__` cho cả annotate lẫn screenshot có imagePrompt.
- `spec.ts`: `screenshotSceneSchema` (frame browser|phone, kicker?, headline?, url?, image?, markers ≤4 {x,y,label}), thêm vào union, DEFAULT screenshot 6.5s. `Screenshot.tsx`: thẻ bo góc sạch bọc ảnh (KHÔNG vẽ chrome giả — nano banana tự thêm chrome trình duyệt → tránh nhân đôi), phone thêm notch. Chấm số 1..n neo tâm ĐÚNG điểm (x,y), nhãn xổ sang bên (phải nếu điểm nửa trái, trái nếu nửa phải) → không tràn khung. Video.tsx + validate.ts (lint thiếu ảnh) + prompts.ts (guide 11c) đã nối.
- render.ts stage `scene.image` cho screenshot (đường tuyệt đối OK). Demo committed: `examples/demo-screenshot.json` + `examples/assets/demo-ui-events.jpg`.
- ĐÃ KIỂM CHỨNG: generateUiImage sinh ảnh UI AMIS Event tiếng Việt sạch/đọc được (sidebar, card sự kiện, nút "Tạo sự kiện mới", chrome amis.misa.vn/events) trong 27s, qua reviewUiImage. Still render đúng: ảnh trong khung sạch (không double-chrome), 3 chấm số neo đúng menu/list/nút, nhãn không tràn. typecheck engine sạch.

## 2026-09-01 (phiên Opus, đợt 2) — GĐ4 đợt 2: forced alignment Gemini + thư viện nhạc nền

**Forced alignment caption (Gemini, dùng chung GEMINI_API_KEY) — E2E verified:**
- `alignWordsToAudio(wav, tokens)` (gemini.ts): gửi WAV inline base64 + danh sách TỪ HIỂN THỊ → contentModel (gemini-3.7-flash, hỗ trợ audio) trả `{words:[{i,startMs,endMs}]}` JSON temperature 0. Kiểm số phần tử khớp.
- `tryForcedAlignment` (tts.ts): tokenize displayText bằng ĐÚNG regex của word-timing vendor → gọi Gemini → `buildForcedWordTimings` (vendor đã có sẵn! validate đơn điệu/khớp token/phủ kín, stitch contiguous, word[0].start=0, last.end=durationMs). BẤT KỲ lỗi nào (lệch số từ, không đơn điệu, model lỗi) → return null → fallback `buildProportionalWordTimings`. Captions KHÔNG BAO GIỜ vỡ.
- Config `FORCED_ALIGNMENT` (env.ts, default "1", =0 để tắt tiết kiệm 1 call/scene). VoiceoverResult thêm `timingSource`.
- ĐÃ TEST THẬT trên WAV s4 job-4 ("Đây chính là trợ lý số biết tự làm việc cho bạn", 3400ms): Gemini trả 12 mốc đơn điệu, từ cuối "bạn" khớp đúng 3400ms; forced timing lệch rõ vs proportional (vd "bạn" bắt đầu 2700ms vs proportional 3117ms — sửa được 400ms trôi). 1 call ~8s.
- Bẫy đã biết: TTS đọc `ttsText` (đã normalize "3"→"ba") nhưng caption hiện `displayText` — Gemini tự map "1 từ hiển thị có thể đọc thành nhiều tiếng" nên chỉ cần hỏi theo display tokens, không cần trace mapping phức tạp.

**Thư viện nhạc nền (Pixabay KHÔNG có API audio) — E2E verified:**
- Kiểm chứng thực tế: Pixabay API chỉ có ảnh/video; `/api/audio/`→403, `/api/music/`→404. Giải pháp: admin tải file nhạc THỦ CÔNG từ pixabay.com/music (CC0, 1 click, không cần API) vào kho dùng chung.
- Changelog `004-music.sql` (ĐÃ áp :3310): bảng `music_tracks` (name/stored_path/mime/size/credit/created_by) + `projects.music_track_id` (stored proc, ON DELETE SET NULL). db.ts REQUIRED_TABLES += music_tracks. LƯU Ý: lại dính bẫy tsx-watch reload trước khi áp changelog → server crash verifyTables → phải `pkill -f @ams/server` + `nohup pnpm --filter @ams/server dev` lại.
- `music.service.ts`: magic-bytes audio (mp3 ID3/0xFFEx, wav RIFF/WAVE, m4a/aac ftyp, ogg OggS), listMusic (dùng chung), createMusic/deleteMusic/getMusicTrack/assertMusicExists. `music.routes.ts` /v1/music: GET list (mọi user), POST upload + DELETE (**requireAdmin**), GET /:id/audio nghe thử (sendFile Range). 
- project.service: CreateProjectInput += musicTrackId (assertMusicExists), INSERT projects.music_track_id. render-worker: LEFT JOIN music_tracks → `if(music_path && exists) spec.audio.music = stored_path` (tuyệt đối, render.ts stage như asset).
- Web: `AdminMusicView.vue` (nav admin "Nhạc nền" icon speakerphone — tải lên/nghe thử `<audio>`/xoá, link hướng dẫn pixabay.com/music) + CreateView MSelect "Nhạc nền" (optional).
- ĐÃ TEST: admin upload mp3→201, file giả magic-bytes→400, creator upload→403, list mọi user, stream /audio→200 MP3 hợp lệ. Project 7 lưu music_track_id=1. Render CLI job-4-spec + track thật → nhạc 196Hz hiện xuyên suốt 73-90dB (nhỏ dưới voice, to ở intro/gap = ducking đúng).

**⚠️ Phát hiện: cổng chất lượng ảnh (images.ts reviewImage) từ chối ảnh annotate 3 lần → render fail.** Cổng cấm chữ/UI/dashboard trong ảnh (đúng cho ảnh nhiếp ảnh nền) nhưng NGHĨA LÀ scene screenshot/UI KHÔNG dùng được đường sinh ảnh này — cần đường riêng cho phép UI (nano banana 2 render chữ tốt). Xem GĐ4 screenshot scene.

## 2026-09-01 (phiên Opus) — GĐ4 đợt 1: password self-service + trang Serie + phân trang + render multi-worker

Tất cả ĐÃ test E2E (curl + trình duyệt), typecheck sạch server/web/engine.

**1. Đổi mật khẩu self-service** — `changePassword` (auth.service.ts): verify mật khẩu hiện tại (argon2), băm mới, DELETE mọi session khác giữ session hiện tại (theo token_hash). `POST /v1/auth/password` (auth.routes.ts, có requireAuth vì /v1/auth không auth toàn cục) — zod bắt mật khẩu ≥8 có chữ+số, chặn trùng mật khẩu cũ. UI: dialog trong menu user (Shell.vue), MInput type=password. E2E: sai→400, yếu→400, thiếu CSRF→403, đổi OK đá thiết bị khác (401) giữ phiên hiện tại, mật khẩu cũ 401, đã revert về Admin@Ams2026.

**2. Trang quản lý Serie** (`SeriesView.vue` + nav "Serie" icon copy trong Shell) — `getSeriesDetail`/`updateSeries` (series.service.ts) + `GET/PUT /v1/series/:id`. Drawer chi tiết: các tập sắp theo số (từ plan_json.series.episode, fallback thứ tự), badge trạng thái duyệt + render + MProgress + video xem/tải (dùng `/v1/jobs/:jobId/video`, đã thêm jobId vào episode payload). Đổi tên/mô tả (MTextarea), xoá (tập giữ nguyên do ON DELETE SET NULL). Kiểm chứng UI thật: drawer hiện đúng 2 tập serie AI 101, cả 2 "Đã render".

**3. Phân trang keyset** — `listProjects(userId, {cursor, limit})` trả `{items, nextCursor}` (keyset `p.id < cursor` DESC, lấy limit+1 để biết còn trang; limit kẹp 1-50 default 20; KHÔNG OFFSET). Route parse `?cursor&limit`. ProjectsView: `loadMore()` nối trang + nút "Tải thêm" khi nextCursor≠null. E2E: page1 id=6 next=6 → cursor=6 page2 id=5 next=5. (⚠️ Đây là BREAKING shape change: consumer của GET /v1/projects giờ nhận {items,nextCursor} không phải mảng — đã sửa ProjectsView.)

**4. Render multi-worker** (render-worker.ts) — bỏ cờ `running` đơn, thay bằng `activeLanes` mở tối đa `RENDER_CONCURRENCY` (config, default 2) luồng `runLane()` song song; mỗi luồng rút cạn queue bằng claimNextJob (FOR UPDATE SKIP LOCKED sẵn có). kick() tăng luồng đồng bộ (không await → không race trên event loop 1 thread). Lý do concurrency>1 có ích: pha ảnh+TTS là I/O Gemini, chồng lấn được pha render CPU.
- **Bundle-cache nguyên tử** (render.ts): build vào `mkdtemp(.build-*)` rồi `renameSync` vào `.bundle-cache/<hash>`; nếu đích đã tồn tại (process khác thắng) thì xoá bản mình. Dọn LRU giữ 2 bản, bỏ qua `.build-*` đang dở. asset job vẫn namespace `job-<pid>-<ts>` riêng → an toàn đa tiến trình.
- E2E: duyệt 2 script serie → 2 render_job cùng ở 'images' đồng thời (không tuần tự), cả 2 done có audio (149s/159s, chồng thời gian); 2 render cache-miss song song → đúng 1 thư mục cache sạch, không sót .build-*.

**Vận hành:** thêm `RENDER_CONCURRENCY` vào config env (1-8, default 2). `~/.claude/launch.json` ams-web đặt `autoPort:true` (tránh xung đột cổng 4610 giữa các phiên — vite tự nhảy 4611+, proxy /v1→4600 vẫn đúng).

**Còn lại GĐ4 → xem docs/ROADMAP.md:** 3 mục CHẶN bởi tài nguyên user (Drive credentials, file nhạc, tool alignment) + scene screenshot-annotate (rủi ro ảnh UI méo, nên để Fable/ảnh thật) + scheduler.

## 2026-09-01 (khuya, đợt 2) — GĐ3 đợt 2: serie manager + SFX/ducking + bundle cache + scene terminal (phiên Fable cuối trước khi hết credit)

**Serie manager (E2E ĐÃ TEST 2 tập thật):**
- Changelog `003-series.sql` ĐÃ áp (:3310): bảng `series` (name ≤40, user-scoped) + `projects.series_id` (stored proc guard, ON DELETE SET NULL). `db.ts` REQUIRED_TABLES += series. LƯU Ý: áp changelog TRƯỚC khi tsx watch reload, không thì verifyTables fail-fast giết server.
- `series.service.ts`: listSeries/createSeries/deleteSeries (user-scoped chống IDOR) + `buildSeriesContext` → {name, startEpisode, context}: dòng tóm tắt các tập trước + narration_md tập gần nhất (slice 4000, loại script rejected). `series.routes.ts` mount /v1/series.
- `project.service.ts`: createProject nhận seriesId (check owner) hoặc newSeriesName (tự tạo), badRequest nếu mode≠series; generateScripts truyền series context → prompts.ts block `<SERIES_CONTEXT>` + modeText nối tiếp (đánh số từ startEpisode, giữ nguyên tên serie, hook nối tập trước, KHÔNG ghi tổng số tập).
- Web: CreateView MSelect serie + "Serie mới" → MInput tên (hiện khi mode=series); types SeriesRow.
- Kiểm chứng: serie "AI 101" → tập 1 (AI Agent) `series:{name,episode:1}` → tập 2 (RAG) `episode:2`, hook mở đầu "Sau AI Agent, RAG là khái niệm tiếp theo..." (nối đúng tập 1).

**SFX kit + sidechain ducking (không cần asset ngoài — license-free):**
- `scripts/gen-sfx.ts`: DSP thuần Node (PRNG mulberry32 seed cố định, KHÔNG Math.random) sinh WAV 48kHz mono → `assets/sfx/`: whoosh-a/b (noise + lọc one-pole quét cutoff), thump (sine 105→42Hz + tanh), pop, tick. Đã commit file WAV (~140KB).
- Engine tự chèn (KHÔNG qua prompt, đúng nguyên tắc thẩm mỹ-ở-engine): whoosh seeded mỗi lần vào cảnh (i>0), thump thêm cho stat/bigword/chart sau TRANSITION_FRAMES. Schema `audio.autoSfx` (default true) + `audio.sfxVolume` (0.4); pipeline api.ts điền default.
- Ducking: `buildMusicVolume(spec)` (export từ Video.tsx, test được bằng tsx) — tính range voiceover theo sceneStartFrames (nhớ trừ chồng lấn TRANSITION_FRAMES), volume callback ramp 10 frame, giữ 28% khi nói. ĐÃ verify: unit test giá trị chính xác theo frame + render thật soi waveform (nhạc dâng đúng chỗ voice kết thúc).

**Bundle cache (webpack là bước đắt nhất mỗi job):**
- render.ts: hash sha1 nội dung src/** + remotion.config.ts + package.json → `.bundle-cache/<hash>` (bundle với publicDir RỖNG, outDir option của @remotion/bundler); giữ 2 bản LRU; sfx copy vào `<bundle>/public/sfx` (nội dung ổn định); asset job stage vào namespace `job-<pid>-<ts>/assets/...` trong public của bundle rồi XOÁ ở finally → nhiều render song song không giẫm nhau. `.bundle-cache/` đã vào .gitignore.
- Đo: stills 8.8s (miss) → 6.4s (hit); render mp4 từ cache có audio nguyên vẹn.

**Scene `terminal`** (`scenes/Terminal.tsx` + schema + prompt 11b + lint): cửa sổ mac chrome (3 nút + title mono), dòng `cmd` có prompt $ accent + gõ dần 2 ký tự/frame + con trỏ nhấp nháy, `out` hiện sau, `comment` mờ có #, highlight tô accent; nền tối cả trong preset sáng (terminal luôn dark). Lint: >2 highlight warn, không có cmd warn. Đã render still kiểm chứng (spec test /tmp/ams-terminal-test.json).

**Việc còn lại → xem docs/ROADMAP.md mục GĐ4 (đã ghi rõ mục nào Sonnet 5/Opus làm được + mục nào nên chờ model mạnh).**

## 2026-09-01 (khuya) — Motion v0.3: variety pack (học remotion-motion-graphics skill)

User yêu cầu video đa dạng hơn (1 kiểu duy nhất → nhàm) + hình ảnh/số liệu chất lượng. Đã nghiên cứu remotion.dev/docs/ai/skills + github haidrrrry/claude-remotion-skill (clone về scratchpad, đọc SKILL.md + motion-patterns.md — 17 pattern) + hyperframes.heygen.com:

- `core/transitions.tsx` MỚI: whipPan (quăng ngang + blur sin đỉnh giữa cú quăng, 2 cảnh cùng blur giấu vết cắt), scaleThrough (cũ phóng to mờ, mới từ 0.86 lên), maskWipe (dải accent 130% quét ngang, cảnh đổi khi dải phủ giữa màn — LƯU Ý: scene engine TRONG SUỐT trên Background chung nên KHÔNG dùng clipPath lộ dần được).
- `Video.tsx`: transitionFor(slug, index, theme) chọn từ palette 8 kiểu theo seed → mỗi video một chuỗi chuyển cảnh riêng, render lại y hệt (deterministic).
- `core/motion.ts`: seedOf (FNV-1a + **finalizer murmur3 — BẮT BUỘC**: 2 bug thật đã gặp: (1) nhân thường vượt 2^53 mất bit thấp phải dùng Math.imul, (2) FNV avalanche yếu khiến seed "…-0"/"…-1" gần trùng → mọi transition giống nhau), pickBySeed, breathe, floatY, sceneExitStyle (exit 10 frame nhanh hơn entrance: trồi -26px + mờ 0.55).
- `SafeArea` (ui.tsx): idle breathing floatY ±3px sau 2s + exit mới. `PhotoBackdrop`: prop seed → luân phiên Ken Burns zoom-in/out + grade soft-light accent (0.16 dark/0.10 light) đồng nhất ảnh AI về tông preset.
- `source` (nguồn số liệu) thêm cho stat + rank (chart đã có từ trước); prompt bắt AI ghi nguồn khi tư liệu nêu, cấm bịa.
- ĐÃ KIỂM CHỨNG: render mp4 demo-chart + spec test slug tx-33, soi frame giữa transition (whip-pan blur ✓, mask-wipe phủ-quét ✓, scale-through ✓). Test seed bằng node trước khi render để biết slug nào rơi vào transition nào.

Chưa làm (chờ tài nguyên): đồng bộ beat nhạc kiểu Hyperframes (cần kho nhạc), motion-blur package (@remotion/motion-blur chưa cài — whipPan tự blur bằng CSS filter đủ dùng).

## 2026-09-01 (đêm) — GĐ3 đợt 1: template-from-video + scene chart (phiên Claude tài khoản 2)

**Scene `chart`** (motion-engine): bar dọc / line xu hướng single-series, 3-8 điểm, theo dataviz method (1 trục, nhãn số CHỈ ở điểm highlight — không rải, mức lưới trên cùng chỉ giữ vạch không ghi số tránh trùng nhãn highlight, grid lặng, series trung tính + accent focal như Rank). Schema `chartSceneSchema` + lint (highlight ≤2 warn, giá trị âm error) + prompt mục 9b (phân biệt với rank: rank=xếp hạng ngang, chart=diễn biến/phân bố) + `examples/demo-chart.json` — ĐÃ render stills kiểm chứng cả 2 variant.

**Template-from-video** (end-to-end ĐÃ TEST THẬT với video demo-paper-editorial.mp4 — Gemini nhận đúng preset paper, accent #DF5433, karaoke caption):
- `pipeline/src/template.ts`: `styleProfileSchema` (Zod bounded, fail-closed + 1 vòng repair), `analyzeVideoStyle()` (inline base64 ≤18MB, mp4/mov/webm), `styleProfileToPromptBlock()` → buildPlansPrompt nhận `styleBlock` (ưu tiên hơn presetHint).
- DB changelog `002-templates.sql`: bảng `templates` (profile_json + workflow_json + status analyzing/ready/failed) + cột `projects.template_id` (thêm qua stored procedure vì MySQL không có ADD COLUMN IF NOT EXISTS) — ĐÃ áp vào MySQL :3310.
- Server: `template.service.ts` (magic bytes ftyp/EBML, phân tích nền client poll 4s, `workflowSchema` mode/variants/duration/voice/**approveGate**) + `template.routes.ts` CRUD + reanalyze; createProject nhận templateId → khoá preset_hint theo profile; generateScripts nhúng styleProfile + nếu approveGate=false thì tự approve + enqueueRender; render-worker LEFT JOIN templates áp `profile.accent` vào spec.style.accent (profile hỏng không chặn render).
- Web: `TemplatesView.vue` (card list + drawer tạo upload video + drawer Thiết lập workflow có switch gate + dialog xoá, poll khi analyzing), Shell thêm mục "Mẫu video" (icon layout-grid), CreateView thêm MSelect chọn template → prefill workflow + disable preset.
- Đã test thật: CSRF chặn thiếu header, IDOR template 404 (kể cả templateId người khác khi tạo project), PUT workflow, project 4 sinh kịch bản đúng preset paper từ template, UI bấm thật trên trình duyệt (chọn template, drawer, toggle gate, lưu).

**Chưa làm GĐ3 còn lại:** serie manager, render farm, scene screenshot-annotate/terminal, + 3 mục dời từ GĐ2 (nhạc nền/SFX license, Google Drive OAuth, forced alignment) — cần tài nguyên ngoài.

**Lưu ý vận hành:** server API chạy `tsx watch` (trước đó phiên khác chạy `tsx` không watch — sửa code phải restart tay). Test template nhanh: video mẫu lấy ngay `packages/motion-engine/out/*.mp4`.

## 2026-09-01 (tối) — GĐ2 hoàn thành: server + web + watermark + voice profile + ingest đa định dạng

**Backend `apps/server`** (Express + mysql2, theo misa-backend-standard, chạy tsx):
- MySQL 8 Docker (`docker-compose.yml`, cổng **3310** — 3306/3307/33306 đã bị project khác chiếm). Schema baseline `apps/server/startup/database/schema.sql` (7 bảng snake_case: users, sessions, projects, project_sources, scripts, render_jobs, watermark_config) áp THỦ CÔNG qua `docker compose exec -T mysql mysql -h127.0.0.1 -uams -p... ams < ...` (nhớ `-h127.0.0.1`, socket bị access denied); app chỉ `verifyTables()`.
- Auth: argon2 + session cookie httpOnly sameSite=lax (DB lưu SHA-256 của token) + CSRF token per-session gửi qua header `x-csrf-token` cho request ghi. Chống dò email bằng verify hash cố định. RBAC admin/creator; mọi truy vấn project/script/job đều join theo user_id (chống IDOR — đã test thật).
- API /v1: auth (login/logout/me), projects (CRUD + upload sources multipart ≤18MB + generate), scripts (approve → tạo render job / reject), jobs (list/detail/video stream sendFile hỗ trợ Range), admin (watermark GET/PUT + upload ảnh magic-bytes check, users CRUD). Response `{data}`/`{error:{message}}`.
- Render worker in-process: claim FOR UPDATE SKIP LOCKED, tuần tự 1 job, progress 5→50 (TTS) →55 (render) →100; watermark từ `watermark_config` chèn vào `spec.style.watermark` lúc render; restart tự recover job kẹt về queued. CHƯA multi-pod (ghi chú trong file).
- Seed admin: `ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @ams/server seed`. Tài khoản dev local: bmtuan@misa.com.vn / Admin@Ams2026 (admin), creator1@misa.com.vn / Creator@2026.
- Pipeline refactor: logic run.ts tách ra `packages/pipeline/src/api.ts` (generatePlans/planToSpec/synthesizeSpecAudio/renderSpecFile) — server và CLI dùng chung.

**Web `apps/web`** (Vue 3 + Vite + Tailwind 4 + MDS, cổng 4610 proxy → 4600):
- Bộ MDS copy nguyên từ ai-video-studio `src/components/mds/` (37 file) + tokens. Icon CHỈ dùng tên có trong `iconRegistry.generated.js` (không có 'movie'/'video').
- Views: LoginView, Shell (MHeaderBar + MSidebar, admin thêm 2 mục), CreateView (idea + MUpload tư liệu + mode/variants/preset + **RangeField slider thời lượng 20-120s** + 4 radio giọng đọc), ProjectsView (list + detail poll 4s: sources status, duyệt/từ chối kịch bản, MProgress render, phát video inline), VideosView, AdminWatermarkView (**preview 9:16 kéo-thả vị trí**, slider độ mờ/kích thước, text/ảnh), AdminUsersView (bảng + drawer tạo + switch khoá).
- `RangeField.vue`: slider tự dựng theo token (MDS chưa có control slider — có TODO đề xuất).
- Dev server đăng ký trong `~/.claude/launch.json` tên **ams-web** (launch.json đọc từ cwd gốc /Users/tuanbui, không phải repo).

**Đã kiểm chứng thật:** login sai/đúng, CSRF chặn khi thiếu header, creator bị chặn /admin, IDOR 404, upload watermark flow, end-to-end project → generate (Gemini) → duyệt → render job done → video 40s CÓ watermark text "AI MOTION STUDIO" đúng vị trí/độ mờ (soi frame ffmpeg) → phát trong web (206 Range). UI đã bấm/kéo thật trên trình duyệt (drag watermark cập nhật x/y live).

**Chưa làm (GĐ3):** Google Drive export, template-from-video, map/cartoon style, forced alignment caption, nhạc nền/SFX asset, đổi mật khẩu self-service, phân trang server-side (list đang LIMIT 100), git init.

## 2026-09-01 (chiều) — Engine v0.2: học style từ 11 video tham khảo thật

User cung cấp 11 video (ainius.net tải về Downloads) + diagram-video-tool-v1.0.0-portable.zip (bachdyon). Phân tích đầy đủ trong `docs/STYLE-RESEARCH.md` (4 họ style + chữ ký chung). Tool tham chiếu lưu tại `docs/reference/diagram-video-tool-v1.0.0/` (đọc `design-skill/` khi cần quy tắc diagram).

**Đã nâng cấp engine (đã render kiểm chứng cả 2 preset):**
- Trio font: Be Vietnam Pro (sans) + Lora italic (sub biên tập) + JetBrains Mono (label/credit/số) — đều có vietnamese subset.
- Karaoke caption đáy màn (`core/Captions.tsx`): cụm 3-6 từ, từ đang đọc sáng dần, `captionEmphasis` tô accent. Words từ `buildProportionalWordTimings` trên DISPLAY text (pipeline/tts.ts). Nâng cấp sau: forced alignment.
- Preset retune: `paper` → flat editorial kem+cam đất (#F4EFE6/#E4572E, KHÔNG glow/blur — theme.flat); `ember` → `noir` (#0C0A0A + đỏ #E5484D kiểu AI News). Mọi glow/shadow đều điều kiện theo `theme.flat`.
- Header 2 tầng (`SceneHeader`): kicker mono + title sans + sub serif nghiêng; các scene points/flow/timeline/compare/rank/media nhận `sub`.
- `ProgressChip`: "02 / 06" + tên serie + track ô vuông tô theo tập (`meta.series {name, episode, total}`).
- 3 scene mới: `rank` (bar ngang benchmark, ≤2 highlight), `media` (polaroid + băng dính + caption serif + credit mono, ảnh được stage như audio), `bigword` (2-5 cụm đắt theo beat, accent đóng khung).
- Demo mới: `examples/demo-paper-editorial.json` (có words + series). Pipeline prompts đã dạy AI 11 scene + sub + captionEmphasis + series + cách chọn preset.

**Lưu ý khi làm tiếp:** scene `media` chỉ dùng khi có ảnh thật (AI bị cấm bịa đường dẫn); style map (họ A) và cartoon (họ C) chưa làm — GĐ3.

## 2026-09-01 — GĐ1 hoàn thành (phiên khởi tạo, Claude)

**Đã làm và đã kiểm chứng:**
- Monorepo pnpm: `packages/motion-engine` + `packages/pipeline` (apps/server, apps/web là thư mục rỗng chờ GĐ2).
- motion-engine (Remotion 4.0.290, React 18, Be Vietnam Pro, lucide-react):
  - 8 scene: hook, points, flow, timeline, compare, stat, quote, outro
  - 4 preset: midnight, aurora, paper, ember (`style/presets.ts`)
  - Core: `Background.tsx` (blob gradient động + dot grid + grain + vignette), `KineticText.tsx` (per-word spring + drift + emphasis accent), `viText.ts` (ngắt dòng tiếng Việt), `motion.ts` (chữ ký spring chung), `ui.tsx` (SafeArea/Glass/IconChip/Kicker)
  - `scripts/render.ts`: validate → lint → stage asset → bundle → PNG per-scene → MP4; `scripts/validate.ts`
  - ĐÃ RENDER OK: `examples/demo-ai-workflow.json` → 33s MP4 + 7 PNG, typecheck sạch
- pipeline (Gemini REST, không SDK):
  - `prompts.ts`: plan = scene-spec + narration; mode angles/series; SOURCES_DATA chống injection; repair prompt
  - `gemini.ts`: generateJson (responseMimeType json) + TTS vi-VN (PCM→WAV)
  - `tts.ts`: normalizer (vendor) → TTS → WAV duration thật
  - `run.ts` CLI: --idea/--source/--mode/--variants/--preset/--voice/--no-tts/--no-render
  - ĐÃ CHẠY END-TO-END OK: ý tưởng duyệt chi → 7 scene + 7 WAV + video 51s tại `out/tu-dong-hoa-duyet-chi-ai-15-phut/`
- Vendor từ ai-video-studio: `tts-normalizer.ts`, `word-timing.ts` (đã gỡ @nestjs/common)
- `.env` có GEMINI_API_KEY (copy từ dự án cũ) + model 2026: gemini-3.7-flash, gemini-3.1-flash-tts-preview
- Docs: ARCHITECTURE.md (AD-01..06), ROADMAP.md, SCENE-SPEC.md, README.md

**Chưa làm (GĐ2+):** server API, web UI (MDS), nhạc nền/SFX asset thật, Google Drive, template-from-video, karaoke caption, git init (user chưa yêu cầu commit).

**Bẫy đã né (từ dự án cũ):** duration phải lấy từ WAV thật; Remotion bundle không cache giữa job; model ID Gemini luôn để config; fail-closed khi spec lỗi.

**Việc kế tiếp đề xuất:** GĐ2 server + web (load skill misa-backend-standard + misa-design-system), hoặc mở rộng scene types (chart, image-hero) tùy user ưu tiên.

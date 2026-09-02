# VFX & Bố cục động — Lộ trình nâng cấp engine (GĐ5)

> **File này là NGUỒN CHÂN LÝ cho phần nâng cấp VFX.** Bất kỳ phiên nào (kể cả
> đổi sang tài khoản Claude khác khi hết credit) chỉ cần đọc:
> `CLAUDE.md` → `memory-bank/01-progress.md` → **file này** là tiếp tục được ngay.
> Trạng thái từng đợt ghi ở cột **Status** phía dưới — làm xong đợt nào thì tick + ghi
> ngày + 1 dòng "đã verify" vào `memory-bank/01-progress.md`.

Bản plan có hình để duyệt: Artifact `Lộ trình VFX Engine`
(https://claude.ai/code/artifact/bb4d8976-53d7-4a3e-a58f-3a2d1da09f39).

---

## 0. Bối cảnh & lý do

User phản hồi: video đang bị "đóng khung" một kiểu — liệt kê các ô chữ nhật xếp dọc
rồi next ô tiếp theo. Yêu cầu: đa dạng hoá **bố cục / hình khối / chuyển động** cho
text–chart–shape, thêm **hiệu ứng khối** (line ánh sáng chạy, thuỷ tinh, pha lê, vi
mạch), **nhiều kiểu chart dễ đọc** (không loè loẹt nhiều màu — nhiệt kế chỉ là 1 ví
dụ), phong cách **VOX**, và **diagram có graphic motion chuyển động bên trong**.

Đã nghiên cứu tool tham chiếu `/Users/tuanbui/Downloads/diagram-video-tool-v1.0.0`
(bản lưu trong repo: `docs/reference/diagram-video-tool-v1.0.0/`). Kết luận: đó là hệ
**editorial "kỷ luật tối giản"** — CỐ TÌNH không có glow/chart/animated-diagram/line
sáng/thuỷ tinh (thậm chí design rule cấm). **Không có LICENSE** → chỉ MƯỢN kỹ thuật,
không copy nguyên văn. Cụ thể chỉ mượn **kỷ luật thời gian**:
`Easing.bezier(0.16, 1, 0.3, 1)`, index stagger, `premountFor={fps}` (chống pop chữ),
định tuyến edge vuông góc + `<marker>` mũi tên, mask nhãn (rect nền che đường dưới
chữ). Mọi hiệu ứng trang trí/động phải **tự dựng mới**.

## 1. Bất biến BẮT BUỘC giữ (đọc kỹ trước khi code)

- **Thẩm mỹ ở ENGINE, không ở prompt/spec.** Sửa `packages/motion-engine/src/**`,
  không nhét CSS/filter vào AI. (CLAUDE.md)
- **Deterministic — cấm `Math.random`.** Mọi biến thể chọn qua `seedOf()` /
  `pickBySeed()` (`core/motion.ts`). Mỗi frame render lại phải y hệt.
- **Fail-closed.** Spec lỗi = dừng, không render placeholder. Effect lỗi/thiếu dữ liệu
  → fallback về kiểu cơ bản, KHÔNG vỡ render.
- **Preset-aware.** Gate mọi glow/blur/line-sáng/thuỷ tinh theo cờ `theme.flat`
  (`style/presets.ts`): `paper` phẳng editorial (KHÔNG hiệu ứng lung linh);
  `midnight/aurora/noir` mới bật.
- **Không phá hợp đồng scene-spec v1.** Thêm loại scene / variant / bố cục = THÊM
  literal mới vào discriminated union (backward compatible), field mới để optional có
  default. Spec cũ phải render y như trước.
- **Verify bằng render THẬT.** Mỗi đợt: render stills/mp4, soi frame (ffmpeg), đo thời
  gian render. Lệnh nhanh không tốn API:
  `pnpm --filter @ams/motion-engine render examples/<spec>.json --stills-only`
  (hoặc chạy trực tiếp `tsx scripts/render.ts <spec.json> --stills-only` nếu pnpm dính
  EPERM ~/.Trash — dùng binary trực tiếp trong `node_modules/.pnpm/.../tsx`).

## 2. Kim chỉ nam (giàu hiệu ứng NHƯNG có kỷ luật)

1. **Một accent mỗi cảnh.** Không cầu vồng; màu phụ chỉ để nhấn từ khoá. Chart phải
   dễ nhìn, ít màu.
2. **Chuyển động phục vụ hiểu, không trang trí thừa.** Hiệu ứng nào thành nhiễu thì bỏ.
3. **Preset quyết định độ lung linh** (xem bất biến `theme.flat`).
4. **Bất biến & an toàn** (seed, fail-closed, cổng kiểm duyệt ảnh giữ nguyên).
5. **Mượn nhịp, tự dựng hiệu ứng** (xem mục 0).

## 3. Thứ tự thực hiện — DỄ → KHÓ (đã chốt với user)

Chạy tuần tự P0 → P6. Mỗi đợt render kiểm chứng xong mới sang đợt sau. P0+P1 gộp một
mạch (đều "Dễ", bổ trợ nhau).

| # | Đợt | Độ khó | Ước lượng | Status |
|---|-----|--------|-----------|--------|
| P0 | Nền chuyển động (premount + ease chữ ký) | Dễ | ~0.5 buổi | ✅ xong (2026-09-02) |
| P1 | Nhấn từ khoá trong chữ (`**từ**`) | Dễ | ~1 buổi | ✅ xong (2026-09-02) |
| P2 | Bố cục đa dạng (grid/checklist/zigzag/rail/VS) | Vừa | ~2 buổi | ✅ xong (2026-09-02) |
| P3 | Bộ chart dễ đọc (donut/gauge/nhiệt kế/waffle/spark) | Vừa | ~2 buổi | ✅ xong (2026-09-02) |
| P4 | Hiệu ứng khối (line sáng/thuỷ tinh/pha lê/vi mạch) | Khó | ~2.5 buổi | ✅ xong (2026-09-02) |
| P5 | Diagram có graphic motion bên trong | Khó | ~2.5 buổi | ✅ xong (2026-09-02) |
| P6 | Phong cách VOX | Vừa | ~1.5 buổi | ☐ chưa làm |

**Chi phí AI ≈ 0** cho phần lớn: đây là code engine render local. Chỉ P1/P3/P6 đụng
nhẹ `prompts.ts` (dạy AI đánh dấu từ khoá / chọn kiểu chart) → vài token/lần sinh.

---

## 4. Chi tiết từng đợt

### P0 — Nền chuyển động  ·  Dễ
- **Mục tiêu:** chống "pop" chữ/layout khi scene vào (premount font trước), thêm 1 ease
  "chữ ký" mượt dùng chung, gom primitive.
- **Kỹ thuật:** `premountFor = fps` cho mỗi Series.Sequence; hàm `signatureEase()` bọc
  `Easing.bezier(0.16, 1, 0.3, 1)`; dùng lại `entrance()/spreadDelays()` đã có.
- **Chạm vào:** `core/motion.ts`, `Video.tsx` (Series/premount).
- **Verify:** render 1 spec cũ, so frame đầu mỗi scene — chữ không nhảy vị trí.
- **Rủi ro:** Thấp (premount chỉ dựng sớm, không đổi hình).

### P1 — Nhấn từ khoá trong chữ  ·  Dễ
- **Mục tiêu:** tô accent / gạch chân / làm mờ đúng 1–2 từ chốt trong headline & caption
  → tạo "phân cấp chính phụ" mạnh.
- **Kỹ thuật:** markup trong lời thoại: `**nhấn**` (accent, tuỳ chọn gạch chân vẽ tay),
  `~~mờ~~` (giảm nhấn). Component `<RichText>` parse markup → span. AI đánh dấu qua
  prompt. Fallback: markup lỗi → hiện chữ thường (strip ký hiệu).
- **Chạm vào:** `prompts.ts` (dạy AI đánh dấu, ràng ≤2 từ/câu), `core/ui.tsx`
  (SceneHeader dùng RichText), `KineticText.tsx`, `core/Captions.tsx` nếu áp caption.
- **Verify:** render headline có `**từ**` → đúng từ đổi màu, xuống dòng vẫn gọn (còn
  `fitBox`).
- **Rủi ro:** Thấp (chỉ tầng text).

### P2 — Bố cục đa dạng  ·  Vừa
- **Mục tiêu:** thêm dáng cho scene liệt kê ngoài `bignum`/`cards`.
- **Kỹ thuật / dáng mới:** `grid` (2×2 cho 4 mục), `checklist` (tick hiện dần), `zigzag`
  (so le trái/phải + đường nối), `numbered-rail` (ray dọc + mốc đánh số); scene mới
  `versus` (2 phía đối lập + huy hiệu VS). Chọn dáng theo `pickBySeed(scene.id)` + số
  item + preset.
- **Chạm vào:** `scenes/Points.tsx` (thêm nhánh layout), scene mới `scenes/Versus.tsx`,
  `schema/spec.ts` (field bố cục optional + literal `versus` vào union), `Video.tsx`,
  `prompts.ts` + `validate.ts`.
- **Verify:** render spec 2/3/4 mục cho từng dáng — cân đối, không tràn safe-area (dùng
  `fitBox`), reveal "nói tới đâu hiện tới đó".
- **Rủi ro:** Vừa (nhiều item dễ tràn → fitBox + kẹp số item).

### P3 — Bộ chart dễ đọc, ít màu  ·  Vừa
- **Mục tiêu:** mở rộng chart (đang chỉ bar + line) thành bộ 1-accent, sạch, animate
  fill/vẽ dần.
- **Kỹ thuật / variant mới:** `donut` (vòng %, quét theo góc), `gauge` (đồng hồ bán
  nguyệt KPI), `thermometer` (cột đổ đầy), `waffle` (10×10 ô tỉ lệ), `spark` (sparkline
  + số lớn), `compare` (2 cột accent vs muted). Giữ discipline hiện có: nhãn chọn lọc,
  lưới lùi nền.
- **Chạm vào:** `scenes/Chart.tsx` (thêm `variant`), `schema/spec.ts` (mở rộng enum),
  `prompts.ts` (khi nào dùng kiểu nào — donut cho %, gauge cho KPI đơn, thermometer cho
  mức, waffle cho tỉ lệ), `validate.ts`.
- **Verify:** render từng variant với số thật — nhãn đọc được, animate mượt, không rối
  màu.
- **Rủi ro:** Vừa (tự chứa; rủi ro chính = AI chọn sai kiểu → ràng prompt + fallback về
  bar).

### P4 — Hiệu ứng khối  ·  Khó (rủi ro render)
- **Mục tiêu:** thư viện "bề mặt" bật theo preset tối, dùng tiết chế (1 khối tiêu
  điểm/scene).
- **Kỹ thuật:** viền line ánh sáng chạy = `conic-gradient` xoay theo frame HOẶC
  `stroke-dashoffset` chạy quanh chu vi rect (SVG); `glass` = thêm quét specular
  (gradient trượt); `crystal` = overlay facet đa giác + cạnh sáng; `circuit` = pattern
  đường mạch SVG + hạt xung chạy dọc trace.
- **Chạm vào:** mới `core/surfaces.tsx` (các bề mặt tái dùng), `core/ui.tsx` (Glass),
  chọn theo `theme.flat` + seed.
- **Verify:** render + **ĐO THỜI GIAN RENDER**. ⚠️ Bài học cũ: blur/shadow nặng làm
  treo render >10 phút. Ưu tiên `transform`/`opacity`/`conic-gradient`; TRÁNH
  `backdrop-blur` lớn hoặc nhiều lớp filter chồng.
- **Rủi ro:** Cao (chi phí render + nguy cơ "màu mè"). Làm sau khi P0 ổn.

### P5 — Diagram có graphic motion bên trong  ·  Khó
- **Mục tiêu:** sơ đồ mô tả công nghệ có chuyển động thật bên trong (thứ reference
  không có).
- **Kỹ thuật:** hạt sáng chạy dọc edge (`offset-path` / `offsetDistance` nội suy theo
  frame HOẶC nội suy điểm dọc polyline); đường tự vẽ dần (`stroke-dashoffset`, đã có
  `drawProgress`); node tiêu điểm đập nhẹ (`breathe` + glow); định tuyến vuông góc +
  `<marker>` mũi tên + mask nhãn (rect nền `theme.surface` sau chữ, kích theo độ dài
  nhãn) — MƯỢN từ reference.
- **Chạm vào:** nâng `scenes/Flow.tsx` → sơ đồ node/edge tổng quát HOẶC tách
  `scenes/Diagram.tsx`; `schema/spec.ts` (edge có `from/to/label`, node có
  `x/y/kind/emphasis`); `Video.tsx`; `prompts.ts`.
- **Verify:** render sơ đồ 4–6 node — hạt chạy đúng đường, mũi tên & nhãn không đè
  đường.
- **Rủi ro:** Cao (routing tổng quát dễ rối). Khởi đầu với sơ đồ tuyến tính/nhánh đơn,
  chưa làm graph tự do.

### P6 — Phong cách VOX  ·  Vừa
- **Mục tiêu:** một "flavor" explainer kiểu VOX.
- **Kỹ thuật:** tiêu đề sans đậm/nén; ảnh cắt nền chú thích bằng khoanh tròn / mũi tên
  vẽ tay (dùng lại đường annotate); caption kinetic nhấn từ khoá (dùng P1); cắt cảnh
  nhanh. Đóng gói thành preset/flavor chọn được (không phá 4 preset cũ).
- **Chạm vào:** `style/presets.ts` (thêm flavor), scene annotate, dùng lại P1.
- **Verify:** render 1 video flavor VOX — nhận diện được phong cách, vẫn trong khung an
  toàn.
- **Rủi ro:** Vừa (thẩm mỹ chủ quan → làm cuối, tinh chỉnh theo phản hồi user).

---

## 5. Dùng model nào? (Sonnet 5 vs Opus 4.8/5)

Công việc này là **code React/Remotion/TypeScript có spec rõ ràng** (không phải bài toán
suy luận mở). Điều quyết định chất lượng KHÔNG phải "sức mạnh model" mà là **kỷ luật
verify-bằng-render + giữ bất biến** — đã ghi hết trong file này + `CLAUDE.md`, nên model
nào bám theo cũng ra kết quả tốt.

| Đợt | Model đủ dùng | Ghi chú |
|-----|---------------|---------|
| P0, P1 | **Sonnet 5 (high)** | Spec cực rõ, cơ học. Rất tiết kiệm, dư sức. |
| P2, P3 | **Sonnet 5 (high/xhigh)** | Tự chứa, spec rõ. xhigh nếu muốn chắc. |
| P6 | **Sonnet 5 (high)** | Thẩm mỹ, cần vòng chỉnh theo phản hồi hơn là suy luận. |
| P4, P5 | **Opus 4.8 / 5** (ưu tiên) | Cần cân nhắc trade-off chi phí render (P4) và routing tổng quát (P5). Sonnet 5 **xhigh** vẫn làm được nếu tiết kiệm credit, miễn verify render kỹ từng bước. |

**Khuyến nghị gọn:** để tiết kiệm credit, chạy **Sonnet 5 high** cho P0–P3 và P6; nâng
lên **Opus 4.8/5** (hoặc Sonnet 5 xhigh) cho P4–P5. "extra"/xhigh reasoning giúp ở đợt
khó nhưng không bắt buộc — bám plan + render-verify quan trọng hơn.

## 6. Chạy tiếp trên tài khoản Claude khác (khi hết credit)

1. Mở phiên mới **trong repo** `/Users/tuanbui/ai-motion-studio`.
2. Đọc theo thứ tự: `CLAUDE.md` → `memory-bank/00-project-brief.md` →
   `memory-bank/01-progress.md` → **`docs/VFX-ROADMAP.md`** (file này).
3. Xem cột **Status** ở mục 3 để biết đợt nào xong, làm tiếp đợt kế.
4. Giữ nguyên bất biến (mục 1) + kim chỉ nam (mục 2). Verify bằng render sau mỗi đợt.
5. Làm xong 1 đợt: tick Status ở đây + thêm 1 mục ngày vào `memory-bank/01-progress.md`
   (mô tả + "đã verify render"). KHÔNG commit/push nếu user chưa bảo; KHÔNG đẩy Cloud
   Run (user đang test Docker).

## 7. Ràng buộc vận hành đang có hiệu lực
- **KHÔNG** đẩy Cloud Run (user test Docker ổn định trước).
- **KHÔNG** commit/push GitHub khi user chưa nói rõ "push".
- **KHÔNG** tự nhập mật khẩu máy — thao tác cần sudo thì báo user tự làm.

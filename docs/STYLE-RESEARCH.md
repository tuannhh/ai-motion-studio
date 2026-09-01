# Nghiên cứu style từ 11 video tham khảo (ainius.net) — 2026-09-01

Nguồn: 11 video user tải về Downloads + diagram-video-tool-v1.0.0 (bachdyon.com).
Kết luận lớn: các video này là **output của chính app ainius.net** (card outro quảng cáo sản phẩm). Chúng chia thành 4 họ style, dùng chung một bộ "chữ ký" nhận diện.

## Chữ ký chung (mọi họ style — PHẢI CÓ trong engine)

1. **Karaoke caption đáy màn**: lời thoại hiện theo cụm 3–6 từ, chữ đậm trắng/mực, **1–2 từ nhấn bằng màu accent** ("nhưng vẫn *đứng* sau Claude"). Đồng bộ giọng đọc.
2. **Header 2 tầng**: headline UPPERCASE sans đậm (ngắn, giật tít) + subtitle *serif nghiêng* nhỏ bên dưới.
3. **Progress indicator**: "01 / 08" mono nhỏ góc trên; serie có track tiến độ + tên serie ("AI AGENTS 101 · tập 4").
4. **Một ý mỗi beat**: mỗi khung chỉ 1 artifact trung tâm (1 chart / 1 card / 1 cụm diagram nhỏ) — không bao giờ nhồi.
5. **Kỷ luật 1 màu accent** trên nền trung tính; màu phụ chỉ dùng theo ngữ nghĩa (đỏ = nguy, xanh = tốt).
6. **Bằng chứng có nguồn**: ảnh tư liệu dạng polaroid có dòng credit mono ("Wikimedia Commons · Public domain"); screenshot paper có vệt highlight vàng như bút dạ.
7. Motion: reveal mềm ease-out `cubic-bezier(0.16,1,0.3,1)`, stagger ~20 frame/node, edge vẽ sau node.

## 4 họ style

### A. Geo-map explainer (địa chính trị/kinh tế vùng) — sheet 1,2,4
- Nền: bản đồ vệ tinh tối hoặc flat Natural Earth (xanh đêm/teal đậm), vùng chủ đề **outline trắng + fill vàng mờ**.
- Route đứt nét vàng chạy dần, pin marker, vòng tròn radar/pulse quanh điểm nóng.
- Chip icon tròn + nhãn mono nối vào bản đồ bằng đường đứt nét.
- Polaroid tư liệu lịch sử nghiêng nhẹ + credit; pill tag màu ngữ nghĩa (TP.HCM tím/teal/cam).
- Số chương lớn "01" + nhãn. Câu hỏi lớn giữa màn ("NGỚ NGẨN?" đỏ).
- → Engine: cần scene `map` (GeoJSON Natural Earth) — GĐ3.

### B. AI News dark evidence (tin công nghệ) — sheet 6,7,8,9
- Nền gần đen `#0B0A0A` + vignette đỏ mờ hoặc ảnh dim ~15%.
- Accent đỏ `#E5484D`. Headline có **box đỏ highlight** từ đắt ("MÌNH THUA").
- Artifact: bar chart benchmark (1 cột accent), ranked list progress bar, screenshot paper + highlight vàng, checklist ✓, quote card lớn, receipt tổng kết cuối video, nhiệt kế chart.
- → Engine: preset `noir` + scene `rank`, `media`, `bigword`.

### C. Cartoon story (kể chuyện) — sheet 5
- Ảnh AI-gen cartoon flat (nhân vật mặt trắng), mỗi cảnh 1 tranh, motion nhẹ (parallax/zoom).
- → GĐ3+ (cần image-gen + visual QA gate). Không ưu tiên.

### D. Paper editorial minimal (chuỗi "AI Agents 101" TikTok) — sheet 10,11
- **Trùng aesthetic diagram-video-tool của bachdyon**: nền kem `#F2EEE6`, mực `#23201C`, accent cam đất `#E4572E`.
- KHÔNG glow/gradient/shadow. Diagram trừu tượng tối giản: chấm tròn, slider track, hộp đứt nét, khối vuông đánh số; micro-label mono dưới mỗi cụm.
- Slider "WORKFLOW ⟷ AGENT" tái dùng xuyên video như la bàn khái niệm.
- Track serie 5 ô vuông tô dần theo tập.
- → Engine: preset `paper` phải chuyển sang **flat mode** đúng chuẩn này.

## Trio typography (học từ DiagramVideo.tsx + video)
- Title serif (tool dùng Fraunces 700, tracking -0.05em) — tiếng Việt dùng **Lora** (có italic + vietnamese).
- Node/heading sans (Space Grotesk 500/700) — tiếng Việt giữ **Be Vietnam Pro**.
- Label/eyebrow/credit mono (JetBrains Mono, có vietnamese subset), tracking rộng, uppercase.

## Quy tắc thiết kế đáng nhớ từ design-skill (bachdyon)
- Mật độ ~4/10; simplified ≤7 node/≤9 edge; balanced ≤12/16.
- Connector: trực giao, bo elbow, không chéo, không chồng, nhãn có mask nền cách stroke.
- Accent chỉ 1–2 phần tử focal. "Never glow, gradients, shadows, giant pills" (áp cho họ paper; họ midnight/noir được dùng glow tiết chế).
- Lưới 4px, margin ngoài ≥40px (scale 9:16 của mình: 84px).
- Node kind semantics: focal (accent), service (paper), store (link-blue tint), input (muted), optional (dashed).
- Grammar catalog 29 loại diagram + tie-breakers (docs trong scratchpad tool; bản gốc tại Downloads zip).

## Gap của engine v0.1 so với chuẩn này
1. Chưa có karaoke caption (đã có vendor word-timing → làm được ngay bằng proportional).
2. Chưa có sub serif nghiêng + progress indicator + series metadata.
3. Preset paper đang "glass mờ" — sai; phải flat editorial.
4. Thiếu scene: rank (bar list), media (polaroid + credit), bigword (từ đắt full màn).
5. Glow/shadow đang áp cho mọi preset — phải theo theme.flat.
6. Map + cartoon: để GĐ3.

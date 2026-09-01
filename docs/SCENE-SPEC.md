# Scene-Spec v1 — hợp đồng AI ⟷ Engine

File JSON mà tầng AI sinh ra và engine render. Nguồn sự thật: `packages/motion-engine/src/schema/spec.ts` (Zod). Tài liệu này để người đọc nhanh.

## Khung

```jsonc
{
  "version": 1,
  "meta": { "title": "...", "slug": "a-z0-9-", "language": "vi", "series": { "name", "episode", "total" } (tùy chọn) },
  "style": { "preset": "midnight|aurora|paper|noir", "accent": "#RRGGBB (tùy chọn)", "captions": true, "progress": true },
  "audio": { "music": "đường dẫn (tùy chọn)", "musicVolume": 0.12 },
  "scenes": [ /* 1-14 scene */ ]
}
```

Mọi scene có: `id` (duy nhất), `type`, tùy chọn `durationInFrames`, `voiceover {file, durationMs, words[{text,startMs,endMs}]}` (words → karaoke caption đáy màn), `captionEmphasis` (từ tô accent trong caption), `sfx [{file, atFrame, volume}]`. Scene có `title` đều nhận thêm `sub` (subtitle serif nghiêng).
Duration ưu tiên: explicit → voiceover + 600ms → default theo loại. FPS 30, khung 1080×1920, safe-area trên 220 / dưới 320 / ngang 84.

## 11 loại scene

| type | dùng khi | trường chính | giới hạn |
|---|---|---|---|
| `hook` | mở đầu bắt buộc | `headline` ≤90, `badge` ≤28, `sub` ≤120 | 2s đầu quyết định |
| `points` | liệt kê ý | `title` ≤60, `items[{icon,text≤90}]` | 2–5 items |
| `flow` | quy trình/luồng | `nodes[{id,label≤48,icon,emphasis}]`, `edges[{from,to,label≤24}]` | 2–6 node, ≤2 emphasis, edge nối node kề nhau |
| `timeline` | mốc thời gian | `steps[{time≤16,label≤48,desc≤80}]` | 2–5 mốc |
| `compare` | trước/sau, cũ/mới | `left/right {label≤28, points[≤60]}` | left = vế kém, right = vế tốt |
| `stat` | 1 con số đắt | `value`, `unit≤12`, `label≤90`, `trend` | không bịa số liệu |
| `quote` | câu nói đắt | `text≤160`, `author≤48` | |
| `rank` | xếp hạng định lượng | `items[{label≤40,value,unit≤10,highlight}]` | 2–6 dòng, ≤2 highlight, không số âm |
| `media` | ảnh tư liệu có nguồn | `image`, `caption≤110`, `credit≤80` | polaroid + credit mono |
| `bigword` | từ/cụm đắt theo beat | `phrases[{text≤40,accent}]` | 2–5 cụm, accent 1 cụm |
| `outro` | kết + CTA bắt buộc | `headline≤80`, `cta≤60`, `handle≤40` | |

Icon: tên lucide-react PascalCase (`Zap`, `ShieldCheck`...). Tên sai không vỡ render (fallback chấm tròn).

## Lint (validate.ts)

- Lỗi (chặn render): scene <2s; trùng id; edge trỏ node không tồn tại; edge tự trỏ.
- Cảnh báo: scene >14s; tổng >95s; scene đầu không phải hook; >2 node emphasis.

## Lệnh

```bash
pnpm --filter @ams/motion-engine validate <spec.json>
pnpm --filter @ams/motion-engine render <spec.json> [--out x.mp4] [--stills-only]
pnpm --filter @ams/motion-engine preview   # Remotion Studio
```

## Mở rộng loại scene mới

1. Thêm schema literal vào `sceneSchema` (discriminated union) + default duration.
2. Viết component trong `src/scenes/`, dùng chung `core/` (SafeArea, Glass, KineticText, motion.ts) để giữ chữ ký chuyển động.
3. Nối vào `SceneRenderer` (Video.tsx) — switch có exhaustive check.
4. Cập nhật `SCHEMA_GUIDE` trong `pipeline/src/prompts.ts` để AI biết dùng.
5. Thêm scene mẫu vào `examples/` và render stills kiểm tra.

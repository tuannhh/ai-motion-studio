import { z } from "zod";
import { motionDocumentSchema } from "../motion/schema";

/**
 * Scene-spec v1 — hợp đồng giữa tầng AI (sinh kịch bản) và tầng render (Remotion).
 * AI chỉ được sinh JSON theo schema này; mọi quyết định thẩm mỹ (màu, font,
 * easing, layout) nằm trong style preset của engine để video luôn đẹp đồng nhất.
 */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** Lề an toàn 9:16 (tránh UI TikTok/Reels che chữ) */
export const SAFE_X = 84;
export const SAFE_TOP = 220;
export const SAFE_BOTTOM = 320;

export const stylePresetSchema = z.enum([
  "midnight", // nền tối xanh đêm + electric blue (mặc định, video công nghệ/AI)
  "aurora", // tối tím-teal, blob cực quang
  "paper", // editorial kem + mực + cam đất, FLAT — chuẩn "AI Agents 101"
  "noir", // gần đen + đỏ báo chí — chuẩn "AI News dark evidence"
]);
export type StylePreset = z.infer<typeof stylePresetSchema>;

/** Word timing cho karaoke caption (ms tính từ đầu voiceover của scene) */
const captionWordSchema = z.object({
  text: z.string().min(1),
  startMs: z.number().nonnegative(),
  endMs: z.number().positive(),
});

const voiceoverSchema = z.object({
  /** đường dẫn file audio tuyệt đối hoặc tương đối so với spec file */
  file: z.string(),
  durationMs: z.number().positive(),
  /** timing từng từ (proportional hoặc forced alignment) — có thì hiện karaoke caption */
  words: z.array(captionWordSchema).max(120).optional(),
});

const sfxCueSchema = z.object({
  file: z.string(),
  /** frame bắt đầu tính trong scene */
  atFrame: z.number().int().nonnegative(),
  volume: z.number().min(0).max(1).default(0.7),
});

const sceneBase = {
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Scene id chỉ gồm chữ, số, gạch ngang hoặc gạch dưới",
    ),
  transition: z
    .enum(["auto", "fade", "whip", "zoom", "wipe", "iris", "slide"])
    .default("auto"),
  soundDesign: z
    .enum(["auto", "none", "whoosh", "ding", "pop", "impact", "paper"])
    .default("auto"),
  /** Nếu bỏ trống: engine tự tính từ voiceover hoặc default theo loại scene */
  durationInFrames: z.number().int().positive().optional(),
  voiceover: voiceoverSchema.optional(),
  /** từ cần tô accent trong karaoke caption (so khớp không dấu câu, không hoa thường) */
  captionEmphasis: z.array(z.string().max(24)).max(6).default([]),
  sfx: z.array(sfxCueSchema).max(6).default([]),
  /**
   * Ảnh nền nhiếp ảnh full-bleed (stage như audio): engine tự Ken Burns +
   * scrim tối để chữ luôn đọc được — pattern "photo evidence" của AI News.
   */
  bgImage: z.string().optional(),
  /**
   * Chuyển động camera cho ảnh nền/ảnh của scene (Ken Burns). "auto" = engine tự
   * chọn theo seed (luân phiên). AI đặt giá trị cụ thể để tái tạo hiệu ứng đã học
   * từ video mẫu (zoom-in nhấn chủ thể, pan quét không gian, still cho ảnh cần đọc kỹ).
   */
  motion: z
    .enum(["auto", "zoom-in", "zoom-out", "pan-left", "pan-right", "still"])
    .default("auto"),
};

/** subtitle biên tập serif nghiêng dưới tiêu đề */
const subField = z.string().max(110).optional();

export const hookSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("hook"),
  badge: z.string().max(28).optional(),
  headline: z.string().min(1).max(90),
  sub: subField,
});

export const pointsSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("points"),
  title: z.string().max(60).optional(),
  sub: subField,
  items: z
    .array(
      z.object({
        /** tên icon lucide (PascalCase), ví dụ "Zap", "ShieldCheck" */
        icon: z.string().optional(),
        text: z.string().min(1).max(90),
      }),
    )
    .min(2)
    .max(5),
  /**
   * Ép buộc 1 dáng cụ thể — mặc định "auto" (engine tự chọn theo seed, xem
   * Points.tsx). KHÔNG dạy AI dùng trường này (thẩm mỹ thuộc về engine); chỉ để
   * chỉnh tay/debug khi cần.
   */
  layout: z
    .enum([
      "auto",
      "cards",
      "bignum",
      "grid",
      "checklist",
      "zigzag",
      "numbered-rail",
    ])
    .default("auto"),
});

export const flowSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("flow"),
  title: z.string().max(60).optional(),
  sub: subField,
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(48),
        icon: z.string().optional(),
        emphasis: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(6),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().max(24).optional(),
      }),
    )
    .max(6),
});

/**
 * Sơ đồ node/edge tổng quát (P5) — khác "flow" (chuỗi bước tuyến tính dọc): diagram
 * dùng cho kiến trúc/pipeline có NHÁNH & HỘI TỤ. AI chỉ đưa nodes + edges; engine tự
 * dàn tầng (layered layout), định tuyến vuông góc, vẽ cạnh dần + hạt chạy + mũi tên.
 * KHÔNG có toạ độ trong spec (thẩm mỹ/bố cục thuộc engine).
 */
export const diagramSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("diagram"),
  title: z.string().max(60).optional(),
  sub: subField,
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1).max(40),
        icon: z.string().optional(),
        /** box (mặc định), pill (bo tròn), hub (nút tròn trung tâm) */
        kind: z.enum(["box", "pill", "hub"]).default("box"),
        emphasis: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(7),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().max(20).optional(),
        /** đường nét đứt (quan hệ phụ/không bắt buộc) */
        dashed: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(10),
});

export const timelineSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("timeline"),
  title: z.string().max(60).optional(),
  sub: subField,
  steps: z
    .array(
      z.object({
        time: z.string().max(16).optional(),
        label: z.string().min(1).max(48),
        desc: z.string().max(80).optional(),
      }),
    )
    .min(2)
    .max(5),
});

export const compareSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("compare"),
  title: z.string().max(60).optional(),
  sub: subField,
  left: z.object({
    label: z.string().max(28),
    points: z.array(z.string().max(60)).min(1).max(4),
  }),
  right: z.object({
    label: z.string().max(28),
    points: z.array(z.string().max(60)).min(1).max(4),
  }),
});

const versusSideSchema = z.object({
  label: z.string().min(1).max(28),
  /** cụm/số ngắn ĐẠI DIỆN cho phía này — 1 câu chốt, KHÔNG phải danh sách nhiều ý */
  value: z.string().min(1).max(40),
  detail: z.string().max(60).optional(),
  icon: z.string().optional(),
});

/**
 * Đối đầu 2 phía kiểu "so găng" — mỗi bên đúng 1 giá trị/cụm chốt + huy hiệu VS ở
 * giữa. Khác "compare" (bảng ưu/nhược nhiều điểm): versus là 1 cú đấm ngắn, dùng khi
 * chỉ có 1 con số/câu đối lập rõ ràng mỗi bên (ví dụ "3 ngày" vs "5 phút").
 */
export const versusSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("versus"),
  title: z.string().max(60).optional(),
  left: versusSideSchema,
  right: versusSideSchema,
});

export const statSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("stat"),
  value: z.number(),
  /** hiển thị sau con số, ví dụ "%", "x", "tỷ" */
  unit: z.string().max(12).optional(),
  label: z.string().min(1).max(90),
  trend: z.enum(["up", "down"]).optional(),
  /** dòng nguồn số liệu mono nhỏ, ví dụ "Gartner 2026" */
  source: z.string().max(60).optional(),
});

export const quoteSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("quote"),
  text: z.string().min(1).max(160),
  author: z.string().max(48).optional(),
});

/** Xếp hạng/so sánh định lượng — bar ngang, 1 dòng highlight accent (benchmark style) */
export const rankSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("rank"),
  title: z.string().max(60).optional(),
  sub: subField,
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        value: z.number(),
        /** hiển thị sau số, ví dụ "%", "đ" */
        unit: z.string().max(10).optional(),
        highlight: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(6),
  /** dòng nguồn số liệu mono nhỏ */
  source: z.string().max(60).optional(),
});

/** Ảnh tư liệu dạng polaroid + credit nguồn (evidence card) */
export const mediaSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("media"),
  title: z.string().max(60).optional(),
  sub: subField,
  /** đường dẫn ảnh (tương đối so với spec file, được stage như audio) */
  image: z.string(),
  caption: z.string().max(110).optional(),
  /** dòng nguồn/giấy phép mono nhỏ, ví dụ "Wikimedia Commons · Public domain" */
  credit: z.string().max(80).optional(),
});

/**
 * Biểu đồ single-series: cột dọc (so sánh theo nhãn/thời gian) hoặc đường
 * xu hướng. 1 trục duy nhất, nhãn số chỉ ở điểm highlight (dataviz method).
 */
export const chartSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("chart"),
  title: z.string().max(60).optional(),
  sub: subField,
  variant: z
    .enum([
      "bar",
      "line",
      "donut",
      "gauge",
      "thermometer",
      "waffle",
      "spark",
      "duo",
    ])
    .default("bar"),
  /** hiển thị sau số, ví dụ "%", "tỷ" */
  unit: z.string().max(10).optional(),
  /**
   * Mốc 100% cho các variant 1-giá-trị (donut/gauge/thermometer/waffle): value/target
   * = tỉ lệ đầy. BỎ TRỐNG ⇒ mặc định 100 (tức value chính là số phần trăm 0–100).
   */
  target: z.number().positive().optional(),
  points: z
    .array(
      z.object({
        /** nhãn trục x ngắn (năm, quý, tên) — với variant 1-giá-trị là caption dưới số */
        label: z.string().min(1).max(18),
        value: z.number(),
        highlight: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(12),
  /** dòng nguồn số liệu mono nhỏ, ví dụ "Statista 2026" */
  source: z.string().max(60).optional(),
});

/** Chuỗi từ/cụm đắt giá chiếm trọn màn hình, hiện lần lượt theo beat */
export const bigwordSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("bigword"),
  phrases: z
    .array(
      z.object({
        text: z.string().min(1).max(40),
        accent: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(5),
});

/**
 * Ảnh full-bleed + hộp chú thích đỏ có mũi tên chỉ vào điểm focus —
 * pattern "ảnh thật + annotation" của AI News. Ảnh do pipeline sinh
 * (Gemini image) hoặc tư liệu thật; engine Ken Burns + scrim + vẽ callout.
 */
export const annotateSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("annotate"),
  /** kicker mono nhỏ phía trên headline */
  kicker: z.string().max(28).optional(),
  headline: z.string().max(80).optional(),
  /** pipeline điền sau khi sinh ảnh — validate.ts bắt lỗi nếu thiếu lúc render */
  image: z.string().optional(),
  /** nội dung hộp chú thích accent */
  note: z.string().min(1).max(90),
  /** điểm focus mũi tên chỉ vào, theo tỷ lệ khung [0,1] */
  fx: z.number().min(0).max(1).default(0.5),
  fy: z.number().min(0).max(1).default(0.55),
});

/**
 * Cửa sổ terminal/code giả lập — mac window chrome, dòng lệnh gõ dần
 * (typewriter), output hiện sau, dòng highlight tô accent. Dùng cho nội dung
 * dev/AI tool: câu lệnh, prompt, log.
 */
export const terminalSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("terminal"),
  /** tiêu đề thanh cửa sổ, ví dụ "zsh — demo" */
  title: z.string().max(36).optional(),
  lines: z
    .array(
      z.object({
        /** cmd = có prompt "$" + gõ dần; out = kết quả hiện ngay; comment = chú thích mờ */
        kind: z.enum(["cmd", "out", "comment"]).default("out"),
        text: z.string().min(1).max(46),
        highlight: z.boolean().default(false),
      }),
    )
    .min(2)
    .max(8),
});

/**
 * Ảnh chụp màn hình / giao diện sản phẩm trong KHUNG thiết bị (trình duyệt hoặc
 * điện thoại) + các chấm chú thích đánh số chỉ vào chi tiết UI. Ảnh do pipeline
 * sinh bằng Gemini image (nano banana — render UI/chữ tốt) hoặc ảnh thật; engine
 * dựng khung + đánh số + vẽ nhãn. Dùng cho nội dung demo tool/app/hướng dẫn.
 */
export const screenshotSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("screenshot"),
  /** khung: browser = cửa sổ trình duyệt ngang; phone = điện thoại dọc */
  frame: z.enum(["browser", "phone"]).default("browser"),
  kicker: z.string().max(28).optional(),
  headline: z.string().max(80).optional(),
  /** thanh địa chỉ giả (chỉ khung browser), ví dụ "app.misa.vn" */
  url: z.string().max(40).optional(),
  /** pipeline điền sau khi sinh ảnh — validate.ts bắt lỗi nếu thiếu lúc render */
  image: z.string().optional(),
  /** pipeline điền = true khi image là ẢNH CHỤP THẬT từ tư liệu người dùng (userimg:N),
   * không phải ảnh AI vẽ — Screenshot.tsx đổi sang khung thẻ trắng bo góc thay vì khung
   * điện thoại/trình duyệt giả (chrome giả chỉ hợp ảnh AI vẽ sẵn chrome). AI KHÔNG tự set. */
  real: z.boolean().default(false),
  /** Actual source width/height, measured after crop/copy by the pipeline. */
  imageAspectRatio: z.number().positive().finite().optional(),
  /** chấm chú thích đánh số 1..n chỉ vào chi tiết UI (toạ độ theo tỷ lệ ảnh) — CHỈ áp
   * dụng khi ảnh AI vẽ (real=false); ảnh thật render dạng thẻ sạch, không vẽ marker
   * (toạ độ fraction không khớp khi ảnh thật hiển thị object-fit:contain letterbox). */
  markers: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        label: z.string().min(1).max(40),
      }),
    )
    .max(4)
    .default([]),
});

export const outroSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("outro"),
  headline: z.string().min(1).max(80),
  cta: z.string().max(60).optional(),
  handle: z.string().max(40).optional(),
});

export const motionSceneSchema = z.object({
  ...sceneBase,
  type: z.literal("motion"),
  title: z.string().max(120).default("Cảnh tái dựng"),
  document: motionDocumentSchema,
});

export const sceneSchema = z.discriminatedUnion("type", [
  motionSceneSchema,
  hookSceneSchema,
  pointsSceneSchema,
  flowSceneSchema,
  diagramSceneSchema,
  timelineSceneSchema,
  compareSceneSchema,
  versusSceneSchema,
  statSceneSchema,
  quoteSceneSchema,
  rankSceneSchema,
  chartSceneSchema,
  mediaSceneSchema,
  bigwordSceneSchema,
  annotateSceneSchema,
  terminalSceneSchema,
  screenshotSceneSchema,
  outroSceneSchema,
]);
export type Scene = z.infer<typeof sceneSchema>;
export type SceneType = Scene["type"];

export const videoSpecSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    title: z.string().min(1),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, "slug chỉ gồm a-z, 0-9, dấu gạch ngang"),
    language: z.string().default("vi"),
    /** serie: hiện tên + tập ở progress chip */
    series: z
      .object({
        name: z.string().min(1).max(40),
        episode: z.number().int().min(1),
        total: z.number().int().min(1).optional(),
      })
      .optional(),
  }),
  style: z.object({
    preset: stylePresetSchema.default("midnight"),
    /** override màu accent, dạng hex, ví dụ "#6C5CE7" */
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    /**
     * "Flavor" phong cách chồng lên preset màu (KHÔNG đổi bảng màu): "vox" = explainer
     * kiểu VOX — tiêu đề nén/hoa/đậm, nhấn từ khoá kiểu bút dạ, khoanh tròn vẽ tay.
     * Bỏ trống ⇒ phong cách chuẩn.
     */
    flavor: z.enum(["vox"]).optional(),
    /** karaoke caption đáy màn (bật khi voiceover có words) */
    captions: z.boolean().default(true),
    /** progress chip "01 / 08" góc trên */
    progress: z.boolean().default(true),
    /** watermark overlay toàn video */
    watermark: z
      .object({
        kind: z.enum(["text", "image"]),
        /** kind=text: nội dung chữ */
        text: z.string().max(40).optional(),
        /** kind=image: đường dẫn ảnh (stage như audio) */
        image: z.string().optional(),
        /** tâm watermark theo tỷ lệ khung: x,y ∈ [0,1] (0,0 = góc trên trái) */
        x: z.number().min(0).max(1).default(0.5),
        y: z.number().min(0).max(1).default(0.06),
        opacity: z.number().min(0.05).max(1).default(0.5),
        /** kích thước: tỷ lệ theo bề ngang khung (image = width, text = font-size*8) */
        scale: z.number().min(0.03).max(0.6).default(0.16),
      })
      .optional(),
  }),
  audio: z
    .object({
      music: z.string().optional(),
      musicVolume: z.number().min(0).max(1).default(0.5),
      /** SFX tự động của engine (whoosh chuyển cảnh, thump số liệu) */
      autoSfx: z.boolean().default(true),
      sfxVolume: z.number().min(0).max(1).default(0.4),
    })
    .default({ musicVolume: 0.5, autoSfx: true, sfxVolume: 0.4 }),
  scenes: z.array(sceneSchema).min(1).max(14),
});
export type VideoSpec = z.infer<typeof videoSpecSchema>;

/** Thời lượng mặc định (giây) theo loại scene khi không có voiceover */
export const DEFAULT_SCENE_SECONDS: Record<SceneType, number> = {
  motion: 8,
  hook: 3.2,
  points: 6,
  flow: 8,
  diagram: 8.5,
  timeline: 7,
  compare: 6.5,
  versus: 5,
  stat: 4,
  quote: 4.5,
  rank: 6,
  chart: 7,
  media: 5,
  bigword: 4,
  annotate: 6,
  terminal: 7,
  screenshot: 6.5,
  outro: 3.5,
};

/** Số frame chồng lấn giữa 2 scene khi transition */
export const TRANSITION_FRAMES = 14;

export const sceneDurationInFrames = (scene: Scene): number => {
  if (scene.type === "motion" && !scene.voiceover)
    return Math.round(scene.document.durationSec * FPS);
  if (scene.durationInFrames && !scene.voiceover) return scene.durationInFrames;
  if (scene.voiceover) {
    // voiceover + 0.6s thở
    return Math.max(
      scene.type === "motion"
        ? Math.round(scene.document.durationSec * FPS)
        : (scene.durationInFrames ?? 0),
      Math.round(((scene.voiceover.durationMs + 600) / 1000) * FPS),
    );
  }
  return Math.round(DEFAULT_SCENE_SECONDS[scene.type] * FPS);
};

export const totalDurationInFrames = (spec: VideoSpec): number => {
  const scenes = spec.scenes.reduce(
    (acc, s) => acc + sceneDurationInFrames(s),
    0,
  );
  // TransitionSeries: mỗi transition ăn bớt TRANSITION_FRAMES
  return scenes - TRANSITION_FRAMES * (spec.scenes.length - 1);
};

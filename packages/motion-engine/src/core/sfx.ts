import { seedOf } from "./motion";

/**
 * Thư viện SFX thật (Mixkit Sound Effects Free License — CC0/royalty-free
 * thương mại, không cần credit; xem assets/sfx/LICENSE-MIXKIT.txt +
 * SOURCES.csv) do người dùng tải về và phân nhóm theo đúng 9+1 hạng mục đã
 * gợi ý (phản hồi 2026-09-03), thay cho 6 file DSP tự sinh trước đây
 * (gen-sfx.ts — vẫn giữ trong assets/sfx/*.wav gốc làm tư liệu, không xoá).
 * Mỗi nhóm nhiều biến thể → pick() chọn theo seed (KHÔNG Math.random, video
 * render lại luôn y hệt) nên cùng một loại cue không lặp 1 âm thanh duy nhất
 * xuyên suốt video như engine cũ.
 */
export const SFX = {
  /** whoosh/sweep chuyển cảnh — 8 từ Mixkit + 3 transition-*.wav trong bộ
   * 10-technology (cùng chất "cắt cảnh", gộp vào cho đa dạng thêm) */
  transition: [
    "sfx/01-transition/Whoosh.mp3",
    "sfx/01-transition/sweep-metal.wav",
    "sfx/01-transition/sweep-sci-fi.wav",
    "sfx/01-transition/swoosh-soft.wav",
    "sfx/01-transition/whoosh-air.wav",
    "sfx/01-transition/whoosh-deep.wav",
    "sfx/01-transition/whoosh-fast.wav",
    "sfx/01-transition/whoosh-quick.wav",
    "sfx/10-technology/transition-cinematic.wav",
    "sfx/10-technology/transition-slide.wav",
    "sfx/10-technology/transition-sweep.wav",
  ],
  /** tick nhẹ cho từng mục danh sách hiện (points/timeline/rank/flow/diagram) */
  listReveal: [
    "sfx/02-list-reveal/click-bubble.wav",
    "sfx/02-list-reveal/click-device.wav",
    "sfx/02-list-reveal/click-soft.wav",
    "sfx/02-list-reveal/pop-subtle.wav",
    "sfx/02-list-reveal/tap-light.wav",
    "sfx/02-list-reveal/tick-ui.wav",
  ],
  /** đấm/thịch cho số liệu lớn (stat/bigword/chart) */
  statImpact: [
    "sfx/03-stat-impact/impact-bass.wav",
    "sfx/03-stat-impact/impact-blow-fast.wav",
    "sfx/03-stat-impact/impact-heartbeat.wav",
    "sfx/03-stat-impact/impact-punch-fast.wav",
    "sfx/03-stat-impact/impact-punch.wav",
    "sfx/03-stat-impact/thud-wood.wav",
  ],
  /** ding/chime cho điểm chốt tích cực (highlight, ý chính) */
  positive: [
    "sfx/04-positive/bell-notification.wav",
    "sfx/04-positive/chime-bright.wav",
    "sfx/04-positive/ding-notification.wav",
    "sfx/04-positive/ding-success.wav",
    "sfx/04-positive/magic-ring.wav",
    "sfx/04-positive/sparkle-light.wav",
  ],
  /** riser tạo kỳ vọng — đặt cuối scene TRƯỚC 1 scene số liệu/chữ lớn để dẫn vào cú đấm */
  buildUp: [
    "sfx/05-build-up/riser-cinematic.wav",
    "sfx/05-build-up/riser-fast.wav",
    "sfx/05-build-up/riser-tech.wav",
    "sfx/05-build-up/swell-magic.wav",
  ],
  /** UI/màn hình mặc định (screenshot/terminal) — preset paper/noir không kèm tech */
  uiScreen: [
    "sfx/06-ui-screen/camera-shutter.wav",
    "sfx/06-ui-screen/keyboard-mechanical.wav",
    "sfx/06-ui-screen/keyboard-typing.wav",
    "sfx/06-ui-screen/mouse-click.wav",
    "sfx/06-ui-screen/notification-pop.wav",
    "sfx/06-ui-screen/shutter-vintage.wav",
    "sfx/06-ui-screen/typing-smartphone.wav",
  ],
  /** UI/màn hình phong cách công nghệ — preset midnight/aurora (đúng chất bộ 10-technology) */
  uiScreenTech: [
    "sfx/10-technology/robot-click.wav",
    "sfx/10-technology/ui-bleep.wav",
    "sfx/10-technology/ui-click-tech.wav",
    "sfx/10-technology/ui-confirm-bleep.wav",
    "sfx/10-technology/ui-hint.wav",
    "sfx/10-technology/ui-select-digital.wav",
    "sfx/10-technology/ui-zoom-in.wav",
    "sfx/10-technology/ui-zoom-out.wav",
  ],
  /** số liệu tài chính (stat có unit tiền tệ/tỷ/triệu/USD/VNĐ...) */
  moneyGrowth: [
    "sfx/07-money-growth/cash-key.wav",
    "sfx/07-money-growth/coin-clink.wav",
    "sfx/07-money-growth/coin-gold.wav",
    "sfx/07-money-growth/coin-win.wav",
    "sfx/07-money-growth/level-up.wav",
    "sfx/07-money-growth/money-bag-drop.wav",
  ],
  /** đối chiếu đúng/sai, hơn/kém (versus/compare) */
  compare: [
    "sfx/08-compare/confirm-tone.wav",
    "sfx/08-compare/correct-positive.wav",
    "sfx/08-compare/error-buzz.wav",
    "sfx/08-compare/reject-sci-fi.wav",
    "sfx/08-compare/wrong-fail.wav",
  ],
  /** thay THẲNG cho tick/pop/ding ở preset "paper" (editorial giấy — đồng bộ chất liệu) */
  paper: [
    "sfx/09-paper/book-page.wav",
    "sfx/09-paper/page-turn.wav",
    "sfx/09-paper/paper-slide.wav",
    "sfx/09-paper/pencil-scribble.wav",
    "sfx/09-paper/pencil-write.wav",
  ],
} as const;

/** Chọn 1 file trong pool theo seed chuỗi — cùng key luôn ra cùng file (render lại y hệt) */
export const pick = (pool: readonly string[], key: string): string =>
  pool[Math.floor(seedOf(key) * pool.length) % pool.length];

/** Đơn vị số liệu trông như tiền tệ → dùng bộ moneyGrowth thay vì statImpact/positive chung */
const MONEY_UNIT_RE = /(đ|vnđ|vnd|usd|\$|tỷ|triệu|nghìn)/i;
export const isMoneyUnit = (unit?: string): boolean =>
  !!unit && MONEY_UNIT_RE.test(unit);

import {
  FPS,
  Scene,
  VideoSpec,
  sceneDurationInFrames,
  totalDurationInFrames,
  videoSpecSchema,
} from "./spec";

export type LintIssue = {
  level: "error" | "warn";
  sceneId?: string;
  message: string;
};

const MIN_SCENE_SECONDS = 2;
const MAX_SCENE_SECONDS = 14;
const MAX_TOTAL_SECONDS = 95;

/**
 * Lint bố cục — chặn spec hợp lệ về kiểu dữ liệu nhưng sẽ render ra video rối/xấu.
 * Lấy cảm hứng từ nguyên tắc Diagram Video Tool: safe area, mật độ vừa phải,
 * connector trực giao, thời lượng scene có kiểm soát.
 */
export const lintSpec = (spec: VideoSpec): LintIssue[] => {
  const issues: LintIssue[] = [];

  for (const scene of spec.scenes) {
    const sec = sceneDurationInFrames(scene) / FPS;
    if (sec < MIN_SCENE_SECONDS) {
      issues.push({
        level: "error",
        sceneId: scene.id,
        message: `Scene quá ngắn (${sec.toFixed(1)}s < ${MIN_SCENE_SECONDS}s) — người xem không kịp đọc.`,
      });
    }
    if (sec > MAX_SCENE_SECONDS) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: `Scene dài ${sec.toFixed(1)}s — cân nhắc tách đôi để giữ nhịp.`,
      });
    }
    issues.push(...lintScene(scene));
  }

  const ids = spec.scenes.map((s) => s.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of new Set(dup)) {
    issues.push({ level: "error", sceneId: id, message: "Trùng id scene." });
  }

  const totalSec = totalDurationInFrames(spec) / FPS;
  if (totalSec > MAX_TOTAL_SECONDS) {
    issues.push({
      level: "warn",
      message: `Tổng thời lượng ${totalSec.toFixed(0)}s > ${MAX_TOTAL_SECONDS}s — video ngắn dọc nên dưới 90s.`,
    });
  }

  if (spec.scenes[0].type !== "hook") {
    issues.push({
      level: "warn",
      message: "Scene đầu không phải 'hook' — 2 giây đầu quyết định giữ chân người xem.",
    });
  }

  return issues;
};

const lintScene = (scene: Scene): LintIssue[] => {
  const issues: LintIssue[] = [];
  const err = (message: string) =>
    issues.push({ level: "error", sceneId: scene.id, message });

  if (scene.type === "rank") {
    const highlighted = scene.items.filter((i) => i.highlight).length;
    if (highlighted > 2) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: "Quá 2 dòng highlight trong rank — accent chỉ dành cho 1-2 focal.",
      });
    }
    if (scene.items.some((i) => i.value < 0)) {
      err("Rank không hỗ trợ giá trị âm.");
    }
  }

  if (scene.type === "chart") {
    const highlighted = scene.points.filter((p) => p.highlight).length;
    if (highlighted > 2) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: "Quá 2 điểm highlight trong chart — nhãn số chỉ dành cho 1-2 focal.",
      });
    }
    if (scene.points.some((p) => p.value < 0)) {
      err("Chart không hỗ trợ giá trị âm.");
    }
    // Số điểm cần theo variant. Variant 1-giá-trị chỉ đọc points[0]; trục cần chuỗi.
    const single = ["donut", "gauge", "thermometer", "waffle"].includes(scene.variant);
    if (single && scene.points.length > 1) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: `Variant '${scene.variant}' chỉ dùng 1 giá trị (points[0]) — các điểm thừa bị bỏ qua.`,
      });
    }
    if ((scene.variant === "bar" || scene.variant === "line") && scene.points.length < 3) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: `Variant '${scene.variant}' nên có ≥3 điểm để thành chuỗi có nghĩa.`,
      });
    }
    if (scene.variant === "spark" && scene.points.length < 2) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: "Variant 'spark' cần ≥2 điểm để vẽ đường xu hướng.",
      });
    }
    if (scene.variant === "duo" && scene.points.length !== 2) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: "Variant 'duo' so sánh đúng 2 cột — chỉ 2 điểm đầu được dùng.",
      });
    }
    // Variant 1-giá-trị: value vượt mốc 100% → sẽ bị kẹp, cảnh báo để tránh hiểu nhầm.
    if (single) {
      const t = scene.target && scene.target > 0 ? scene.target : 100;
      if (scene.points[0] && scene.points[0].value > t) {
        issues.push({
          level: "warn",
          sceneId: scene.id,
          message: `Variant '${scene.variant}': value (${scene.points[0].value}) > mốc ${t} — bị kẹp ở 100%. Đặt 'target' đúng nếu không phải %.`,
        });
      }
    }
  }

  if (scene.type === "terminal") {
    const highlighted = scene.lines.filter((l) => l.highlight).length;
    if (highlighted > 2) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: "Quá 2 dòng highlight trong terminal — accent chỉ dành cho dòng chốt.",
      });
    }
    if (!scene.lines.some((l) => l.kind === "cmd")) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: "Terminal không có dòng cmd nào — nên có ít nhất 1 lệnh để có nhịp gõ.",
      });
    }
  }

  if (scene.type === "annotate" && !scene.image) {
    err("Scene annotate thiếu ảnh — pipeline phải sinh/gán ảnh trước khi render.");
  }

  if (scene.type === "screenshot" && !scene.image) {
    err("Scene screenshot thiếu ảnh giao diện — pipeline phải sinh/gán ảnh trước khi render.");
  }

  if (scene.type === "flow") {
    const nodeIds = new Set(scene.nodes.map((n) => n.id));
    for (const e of scene.edges) {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
        err(`Edge ${e.from}→${e.to} trỏ tới node không tồn tại.`);
      }
      if (e.from === e.to) err(`Edge tự trỏ vào chính nó: ${e.from}.`);
    }
    const emphasized = scene.nodes.filter((n) => n.emphasis).length;
    if (emphasized > 2) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: "Quá 2 node emphasis — nhấn mạnh tất cả nghĩa là không nhấn mạnh gì.",
      });
    }
  }

  if (scene.type === "diagram") {
    const nodeIds = new Set(scene.nodes.map((n) => n.id));
    for (const e of scene.edges) {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
        err(`Edge ${e.from}→${e.to} trỏ tới node không tồn tại.`);
      }
      if (e.from === e.to) err(`Edge tự trỏ vào chính nó: ${e.from}.`);
    }
    // Mọi node (trừ gốc) nên có ít nhất 1 cạnh vào để dàn tầng đặt đúng chỗ; node
    // cô lập hoàn toàn (không cạnh nào chạm tới) sẽ dồn về tầng 0 gây rối.
    const touched = new Set<string>();
    scene.edges.forEach((e) => {
      touched.add(e.from);
      touched.add(e.to);
    });
    const orphan = scene.nodes.filter((n) => !touched.has(n.id));
    if (orphan.length > 0) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: `Node không có cạnh nào nối tới: ${orphan
          .map((n) => n.id)
          .join(", ")} — mọi node nên nằm trong ít nhất 1 edge.`,
      });
    }
    const emphasized = scene.nodes.filter((n) => n.emphasis).length;
    if (emphasized > 2) {
      issues.push({
        level: "warn",
        sceneId: scene.id,
        message: "Quá 2 node emphasis trong diagram — chỉ nhấn 1-2 nút chốt.",
      });
    }
  }

  return issues;
};

export const parseSpec = (
  raw: unknown
): { spec: VideoSpec; issues: LintIssue[] } => {
  const spec = videoSpecSchema.parse(raw);
  return { spec, issues: lintSpec(spec) };
};

import type { SceneType } from "@ams/motion-engine/src/schema/spec";

/**
 * Danh sách "chữ trên hình" người dùng được sửa tay sau khi AI sinh kịch bản —
 * tách biệt narration (lời thoại TTS, đã sửa được từ trước). Đây là ALLOW-LIST
 * phía server (không tin client gửi field nào) — chỉ các field text thuần tuý,
 * KHÔNG bao gồm field cấu trúc/thẩm mỹ (id, icon, kind, layout, x/y, value số,
 * emphasis, highlight, dashed, image path...) vì đó là quyết định của AI/engine,
 * không phải nội dung. Dùng chung cho updateScriptScenes (server) — validate lại
 * bằng planSchema sau khi merge nên đây chỉ là "được phép chạm", không phải
 * nguồn sự thật cuối cùng về tính hợp lệ.
 */
export type ArrayFieldSpec = { key: string; itemKeys: string[] };
export type ObjectFieldSpec = { key: string; plainKeys: string[]; stringArrayKeys?: string[] };
export type SceneContentSpec = {
  plainKeys: string[];
  arrays?: ArrayFieldSpec[];
  objects?: ObjectFieldSpec[];
};

export const SCENE_CONTENT_FIELDS: Record<SceneType, SceneContentSpec> = {
  motion: { plainKeys: ["title"] },
  hook: { plainKeys: ["badge", "headline", "sub"] },
  points: { plainKeys: ["title", "sub"], arrays: [{ key: "items", itemKeys: ["text"] }] },
  flow: {
    plainKeys: ["title", "sub"],
    arrays: [
      { key: "nodes", itemKeys: ["label"] },
      { key: "edges", itemKeys: ["label"] },
    ],
  },
  diagram: {
    plainKeys: ["title", "sub"],
    arrays: [
      { key: "nodes", itemKeys: ["label"] },
      { key: "edges", itemKeys: ["label"] },
    ],
  },
  timeline: { plainKeys: ["title", "sub"], arrays: [{ key: "steps", itemKeys: ["time", "label", "desc"] }] },
  compare: {
    plainKeys: ["title"],
    objects: [
      { key: "left", plainKeys: ["label"], stringArrayKeys: ["points"] },
      { key: "right", plainKeys: ["label"], stringArrayKeys: ["points"] },
    ],
  },
  versus: {
    plainKeys: ["title"],
    objects: [
      { key: "left", plainKeys: ["label", "value", "detail"] },
      { key: "right", plainKeys: ["label", "value", "detail"] },
    ],
  },
  stat: { plainKeys: ["label", "unit", "source"] },
  quote: { plainKeys: ["text", "author"] },
  rank: { plainKeys: ["title", "sub", "source"], arrays: [{ key: "items", itemKeys: ["label", "unit"] }] },
  chart: { plainKeys: ["title", "sub", "unit", "source"], arrays: [{ key: "points", itemKeys: ["label"] }] },
  media: { plainKeys: ["title", "sub", "caption", "credit"] },
  bigword: { plainKeys: [], arrays: [{ key: "phrases", itemKeys: ["text"] }] },
  annotate: { plainKeys: ["kicker", "headline", "note"] },
  terminal: { plainKeys: ["title"], arrays: [{ key: "lines", itemKeys: ["text"] }] },
  screenshot: { plainKeys: ["kicker", "headline", "url"], arrays: [{ key: "markers", itemKeys: ["label"] }] },
  outro: { plainKeys: ["headline", "cta", "handle"] },
};

const trimIfString = (v: unknown): unknown => (typeof v === "string" ? v.trim() : v);

/**
 * Chiều ngược lại của mergeSceneContent: bóc giá trị HIỆN TẠI của các field
 * cho phép sửa (theo đúng allow-list) ra 1 object gọn — dùng để trả cho client
 * làm giá trị khởi tạo cho form sửa "chữ trên hình" (khác `display`, vốn gộp
 * hết vào 1 chuỗi chỉ để đọc).
 */
export const extractSceneContent = (scene: Record<string, unknown>): Record<string, unknown> => {
  const spec = SCENE_CONTENT_FIELDS[scene.type as SceneType];
  if (!spec) return {};
  const out: Record<string, unknown> = {};

  for (const key of spec.plainKeys) {
    if (scene[key] !== undefined) out[key] = scene[key];
  }

  for (const arr of spec.arrays ?? []) {
    const existing = scene[arr.key];
    if (!Array.isArray(existing)) continue;
    out[arr.key] = existing.map((item: Record<string, unknown>) => {
      const picked: Record<string, unknown> = {};
      for (const itemKey of arr.itemKeys) picked[itemKey] = item?.[itemKey];
      return picked;
    });
  }

  for (const obj of spec.objects ?? []) {
    const existing = scene[obj.key] as Record<string, unknown> | undefined;
    if (!existing) continue;
    const picked: Record<string, unknown> = {};
    for (const key of obj.plainKeys) picked[key] = existing[key];
    for (const key of obj.stringArrayKeys ?? []) picked[key] = existing[key];
    out[obj.key] = picked;
  }

  return out;
};

/**
 * Merge content patch (chỉ chữ trên hình, gửi từ client) vào 1 scene hiện có —
 * CHỈ ghi đè key nằm trong SCENE_CONTENT_FIELDS của đúng loại scene đó, giữ
 * nguyên mọi field khác (id, icon, kind, x/y, value số...). Array field merge
 * THEO VỊ TRÍ (không thay cả mảng) để không làm mất field cấu trúc của phần tử
 * (vd nodes[].id dùng làm tham chiếu cho edges — không được đổi/xoá qua đường
 * sửa text này).
 */
export const mergeSceneContent = (
  scene: Record<string, unknown>,
  content: Record<string, unknown> | undefined
): void => {
  if (!content) return;
  const spec = SCENE_CONTENT_FIELDS[scene.type as SceneType];
  if (!spec) return;

  for (const key of spec.plainKeys) {
    if (content[key] !== undefined) scene[key] = trimIfString(content[key]);
  }

  for (const arr of spec.arrays ?? []) {
    const existing = scene[arr.key];
    const patch = content[arr.key];
    if (!Array.isArray(existing) || !Array.isArray(patch)) continue;
    existing.forEach((item: Record<string, unknown>, i: number) => {
      const p = patch[i];
      if (!p || typeof p !== "object") return;
      for (const itemKey of arr.itemKeys) {
        if ((p as Record<string, unknown>)[itemKey] !== undefined) {
          item[itemKey] = trimIfString((p as Record<string, unknown>)[itemKey]);
        }
      }
    });
  }

  for (const obj of spec.objects ?? []) {
    const existing = scene[obj.key];
    const patch = content[obj.key];
    if (!existing || typeof existing !== "object" || !patch || typeof patch !== "object") continue;
    const existingObj = existing as Record<string, unknown>;
    const patchObj = patch as Record<string, unknown>;
    for (const key of obj.plainKeys) {
      if (patchObj[key] !== undefined) existingObj[key] = trimIfString(patchObj[key]);
    }
    for (const key of obj.stringArrayKeys ?? []) {
      const nextArr = patchObj[key];
      if (Array.isArray(nextArr) && nextArr.every((v) => typeof v === "string")) {
        existingObj[key] = nextArr.map((v: string) => v.trim());
      }
    }
  }
};

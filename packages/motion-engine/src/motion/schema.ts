import { z } from "zod";
import { getLength } from "@remotion/paths";
const num = (min: number, max: number) => z.number().finite().min(min).max(max);
const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/);
const color = z.string().regex(/^(#[0-9a-fA-F]{6}|none)$/);
export const motionValuesSchema = z
  .object({
    x: num(-4000, 4000).optional(),
    y: num(-4000, 4000).optional(),
    scale: num(0, 12).optional(),
    rotation: num(-3600, 3600).optional(),
    rotateX: num(-3600, 3600).optional(),
    rotateY: num(-3600, 3600).optional(),
    opacity: num(0, 1).optional(),
    draw: num(0, 1).optional(),
    blur: num(0, 40).optional(),
    progress: num(0, 1).optional(),
    reveal: num(0, 1).optional(),
    fill: color.optional(),
    stroke: color.optional(),
  })
  .strict();
export const keyframeSchema = motionValuesSchema
  .extend({
    at: num(0, 60),
    easing: z
      .enum(["linear", "ease-in", "ease-out", "ease-in-out", "back", "step"])
      .default("ease-out"),
  })
  .strict();
const svgPath = z
  .string()
  .min(3)
  .max(6000)
  .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\seE]+$/)
  .refine((p) => {
    try {
      return Number.isFinite(getLength(p));
    } catch {
      return false;
    }
  }, "Đường SVG không hợp lệ");
export const motionNodeSchema = z
  .object({
    id,
    name: z.string().max(100),
    parent: id.optional(),
    kind: z.enum(["group", "rect", "ellipse", "text", "path"]),
    x: num(-4000, 4000).default(0),
    y: num(-4000, 4000).default(0),
    width: num(1, 4000).default(100),
    height: num(1, 4000).default(100),
    radius: num(0, 1000).default(0),
    rotation: num(-3600, 3600).default(0),
    rotateX: num(-3600, 3600).default(0),
    rotateY: num(-3600, 3600).default(0),
    scale: num(0, 12).default(1),
    opacity: num(0, 1).default(1),
    fill: color.default("#ffffff"),
    stroke: color.default("none"),
    strokeWidth: num(0, 50).default(0),
    spans: z
      .array(z.object({ text: z.string().max(160), fill: color }))
      .max(40)
      .optional(),
    strokeDasharray: z
      .string()
      .max(80)
      .regex(/^[0-9., ]+$/)
      .optional(),
    text: z.string().max(500).default(""),
    fontSize: num(8, 300).default(48),
    fontWeight: z.enum(["400", "600", "800"]).default("600"),
    fontFamily: z.enum(["sans", "serif", "mono"]).default("sans"),
    align: z.enum(["start", "middle", "end"]).default("middle"),
    path: svgPath.optional(),
    followPath: svgPath.optional(),
    glow: num(0, 40).default(0),
    start: num(0, 60).default(0),
    end: num(0, 60).optional(),
    keyframes: z.array(keyframeSchema).max(40).default([]),
  })
  .strict();
export const motionDocumentSchema = z
  .object({
    version: z.literal(1),
    width: num(240, 2160).default(1080),
    height: num(240, 3840).default(1920),
    durationSec: num(2, 60),
    background: color.default("#f5f2eb"),
    nodes: z.array(motionNodeSchema).min(1).max(100),
    cues: z
      .array(
        z.object({
          at: num(0, 60),
          kind: z.enum(["whoosh", "ding", "pop", "impact", "paper"]),
          volume: num(0, 1).default(0.5),
          reason: z.string().max(140).default(""),
        }),
      )
      .max(40)
      .default([]),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    doc.nodes.forEach((n, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: "custom", path: ["nodes", i], message });
      if (ids.has(n.id)) issue("Trùng id lớp");
      // Parent precedes children: guarantees no cycles, bounded recursion.
      if (n.parent && !ids.has(n.parent))
        issue("Lớp cha phải đứng trước lớp con");
      if (
        n.parent &&
        doc.nodes.find((p) => p.id === n.parent)?.kind !== "group"
      )
        issue("Lớp cha phải là group");
      ids.add(n.id);
      if (n.kind === "path" && !n.path) issue("Lớp path thiếu đường vẽ");
      if (
        n.start >= doc.durationSec ||
        (n.end !== undefined && (n.end <= n.start || n.end > doc.durationSec))
      )
        issue("Mốc lớp vượt thời lượng");
      let prev = -1;
      n.keyframes.forEach((k) => {
        if (k.at <= prev || k.at > doc.durationSec)
          issue("Keyframe phải tăng dần, trong thời lượng");
        prev = k.at;
      });
    });
    doc.cues.forEach((c, i) => {
      if (c.at >= doc.durationSec)
        ctx.addIssue({
          code: "custom",
          path: ["cues", i],
          message: "Cue vượt thời lượng",
        });
    });
  });
export type MotionDocument = z.infer<typeof motionDocumentSchema>;
export type MotionNode = z.infer<typeof motionNodeSchema>;

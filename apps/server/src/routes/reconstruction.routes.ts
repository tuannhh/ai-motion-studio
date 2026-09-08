import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/error";
import { badRequest } from "../http-error";
import { reconstructionOptionsSchema } from "@ams/pipeline/src/reconstruction";
import { motionDocumentSchema } from "@ams/motion-engine/src/motion/schema";
import {
  createMotionRun,
  enableMotionBlueprint,
  getMotionRun,
  listMotionRuns,
  motionAsset,
} from "../services/reconstruction.service";
export const reconstructionRoutes = Router();
const id = (s: string) => {
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) throw badRequest("Id không hợp lệ.");
  return n;
};
reconstructionRoutes.get(
  "/templates/:id",
  asyncHandler(async (req, res) =>
    res.json({ data: await listMotionRuns(req.user!.id, id(req.params.id)) }),
  ),
);
reconstructionRoutes.post(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const parsed = reconstructionOptionsSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0].message);
    res.status(202).json({
      data: await createMotionRun(req.user!.id, id(req.params.id), parsed.data),
    });
  }),
);
reconstructionRoutes.get(
  "/:id",
  asyncHandler(async (req, res) =>
    res.json({ data: await getMotionRun(req.user!.id, id(req.params.id)) }),
  ),
);
reconstructionRoutes.post(
  "/:id/revise",
  asyncHandler(async (req, res) => {
    const parsed = z
      .object({
        document: motionDocumentSchema,
        instruction: z.string().trim().min(5).max(2000).optional(),
        iterations: z.number().int().min(1).max(3).default(1),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0].message);
    const previous = await getMotionRun(req.user!.id, id(req.params.id));
    if (!["done", "failed"].includes(previous.status))
      throw badRequest("Bản trước vẫn đang chạy.");
    res.status(202).json({
      data: await createMotionRun(
        req.user!.id,
        previous.templateId,
        {
          ...previous.options,
          iterations: parsed.data.iterations,
          reviseFirst: Boolean(parsed.data.instruction),
          instruction: parsed.data.instruction ?? previous.options.instruction,
        },
        parsed.data.document,
        previous.state.analysis,
      ),
    });
  }),
);
reconstructionRoutes.post(
  "/:id/use",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ version: z.number().int().min(0).max(2).optional() })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) throw badRequest("Vòng dựng không hợp lệ.");
    res.json({
      data: await enableMotionBlueprint(
        req.user!.id,
        id(req.params.id),
        body.data.version,
      ),
    });
  }),
);
reconstructionRoutes.get(
  "/:id/assets/:file",
  asyncHandler(async (req, res) => {
    const file = await motionAsset(
      req.user!.id,
      id(req.params.id),
      req.params.file,
    );
    if (/\.(json|tsx)$/.test(file)) res.download(file);
    else res.sendFile(file);
  }),
);

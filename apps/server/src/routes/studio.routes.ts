import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/error";
import { badRequest } from "../http-error";
import {
  getStudio,
  saveStudio,
  restoreStudio,
  reviseScene,
  studioAsset,
} from "../services/studio.service";
const id = (raw: string) => {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) throw badRequest("Id không hợp lệ.");
  return n;
};
const check = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const r = schema.safeParse(value);
  if (!r.success) throw badRequest(r.error.issues[0].message);
  return r.data;
};
export const studioRoutes = Router();
studioRoutes.get(
  "/:id/studio",
  asyncHandler(async (req, res) => {
    res.json({ data: await getStudio(req.user!.id, id(req.params.id)) });
  }),
);
studioRoutes.put(
  "/:id/studio",
  asyncHandler(async (req, res) => {
    const v = check(
      z.object({ plan: z.unknown(), revision: z.string().length(64) }),
      req.body,
    );
    res.json({
      data: await saveStudio(
        req.user!.id,
        id(req.params.id),
        v.plan,
        v.revision,
      ),
    });
  }),
);
studioRoutes.post(
  "/:id/versions/:versionId/restore",
  asyncHandler(async (req, res) => {
    const v = check(z.object({ revision: z.string().length(64) }), req.body);
    res.json({
      data: await restoreStudio(
        req.user!.id,
        id(req.params.id),
        id(req.params.versionId),
        v.revision,
      ),
    });
  }),
);
studioRoutes.post(
  "/:id/scenes/:sceneId/revise",
  asyncHandler(async (req, res) => {
    const v = check(
      z.object({ instruction: z.string().trim().min(5).max(800) }),
      req.body,
    );
    res.json({
      data: await reviseScene(
        req.user!.id,
        id(req.params.id),
        req.params.sceneId,
        v.instruction,
      ),
    });
  }),
);
studioRoutes.get(
  "/:id/assets/:jobId/*",
  asyncHandler(async (req, res) => {
    res.sendFile(
      await studioAsset(
        req.user!.id,
        id(req.params.id),
        id(req.params.jobId),
        req.params[0],
      ),
    );
  }),
);

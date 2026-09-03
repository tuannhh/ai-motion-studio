import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { appConfig, storagePaths } from "../config";
import { badRequest } from "../http-error";
import { asyncHandler } from "../middleware/error";
import {
  createTemplate,
  deleteTemplate,
  getTemplateDetail,
  listTemplates,
  reanalyzeTemplate,
  resolveTemplateIdByPublicId,
  updateTemplate,
  workflowSchema,
} from "../services/template.service";

const upload = multer({
  dest: storagePaths.temp,
  limits: { fileSize: appConfig.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
});

const nameSchema = z.string().trim().min(2, "Tên template tối thiểu 2 ký tự.").max(120);

const updateSchema = z.object({
  name: nameSchema.optional(),
  workflow: workflowSchema.optional(),
});

const idParam = (raw: string): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Id không hợp lệ.");
  return id;
};

export const templateRoutes = Router();

templateRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await listTemplates(req.user!.id) });
  })
);

templateRoutes.post(
  "/",
  upload.single("video"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Thiếu video mẫu (field 'video').");
    const name = nameSchema.safeParse(req.body?.name);
    if (!name.success) {
      throw badRequest(name.error.issues[0]?.message ?? "Tên không hợp lệ.");
    }
    const id = await createTemplate(req.user!.id, name.data, req.file);
    res.status(201).json({ data: { id } });
  })
);

/** Tra template theo public_id (URL sub-path /video-template/:slug/:id). */
templateRoutes.get(
  "/public/:publicId",
  asyncHandler(async (req, res) => {
    const id = await resolveTemplateIdByPublicId(req.user!.id, req.params.publicId);
    res.json({ data: await getTemplateDetail(req.user!.id, id) });
  })
);

templateRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: await getTemplateDetail(req.user!.id, idParam(req.params.id)) });
  })
);

templateRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
    }
    await updateTemplate(req.user!.id, idParam(req.params.id), parsed.data);
    res.json({ data: { ok: true } });
  })
);

templateRoutes.post(
  "/:id/reanalyze",
  asyncHandler(async (req, res) => {
    await reanalyzeTemplate(req.user!.id, idParam(req.params.id));
    res.status(202).json({ data: { status: "analyzing" } });
  })
);

templateRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteTemplate(req.user!.id, idParam(req.params.id));
    res.json({ data: { ok: true } });
  })
);

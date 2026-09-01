import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { appConfig, storagePaths } from "../config";
import { badRequest } from "../http-error";
import { asyncHandler } from "../middleware/error";
import {
  addSource,
  createProject,
  deleteSource,
  generateScripts,
  getProjectDetail,
  listProjects,
} from "../services/project.service";

const createSchema = z.object({
  idea: z.string().trim().min(10, "Ý tưởng tối thiểu 10 ký tự.").max(2000),
  mode: z.enum(["angles", "series"]).default("angles"),
  variantCount: z.number().int().min(1).max(5).default(1),
  presetHint: z.enum(["midnight", "aurora", "paper", "noir"]).optional(),
  durationSec: z.number().int().min(20).max(120).optional(),
  voiceGender: z.enum(["male", "female"]).default("female"),
  voiceRegion: z.enum(["bac", "nam"]).default("bac"),
  voiceStyle: z.enum(["thoisu", "tintuc"]).default("tintuc"),
  voiceSpeed: z.union([z.literal(1), z.literal(1.2)]).default(1),
  templateId: z.number().int().positive().optional(),
  seriesId: z.number().int().positive().optional(),
  newSeriesName: z.string().trim().min(2).max(40).optional(),
  musicTrackId: z.number().int().positive().optional(),
  watermarkPresetId: z.number().int().positive().optional(),
});

const ALLOWED_SOURCE_EXT = /\.(txt|md|docx|pdf|mp3|wav|m4a|aac|ogg|flac|mp4|mov|webm)$/i;

const upload = multer({
  dest: storagePaths.temp,
  limits: { fileSize: appConfig.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
});

const idParam = (raw: string): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Id không hợp lệ.");
  return id;
};

export const projectRoutes = Router();

projectRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const cursorRaw = Number(req.query.cursor);
    const limitRaw = Number(req.query.limit);
    res.json({
      data: await listProjects(req.user!.id, {
        cursor: Number.isInteger(cursorRaw) && cursorRaw > 0 ? cursorRaw : undefined,
        limit: Number.isInteger(limitRaw) ? limitRaw : undefined,
      }),
    });
  })
);

projectRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
    }
    const id = await createProject(req.user!.id, parsed.data);
    res.status(201).json({ data: { id } });
  })
);

projectRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: await getProjectDetail(req.user!.id, idParam(req.params.id)) });
  })
);

projectRoutes.post(
  "/:id/sources",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Thiếu file tư liệu (field 'file').");
    if (!ALLOWED_SOURCE_EXT.test(req.file.originalname)) {
      throw badRequest(
        "Định dạng chưa hỗ trợ — dùng txt, md, docx, pdf, mp3, wav, m4a, mp4, mov, webm."
      );
    }
    const sourceId = await addSource(req.user!.id, idParam(req.params.id), req.file);
    res.status(201).json({ data: { id: sourceId } });
  })
);

projectRoutes.delete(
  "/:id/sources/:sourceId",
  asyncHandler(async (req, res) => {
    await deleteSource(
      req.user!.id,
      idParam(req.params.id),
      idParam(req.params.sourceId)
    );
    res.json({ data: { ok: true } });
  })
);

projectRoutes.post(
  "/:id/generate",
  asyncHandler(async (req, res) => {
    await generateScripts(req.user!.id, idParam(req.params.id));
    res.status(202).json({ data: { status: "generating" } });
  })
);

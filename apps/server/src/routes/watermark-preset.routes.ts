import { Router } from "express";
import fs from "node:fs";
import multer from "multer";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";
import { asyncHandler } from "../middleware/error";
import {
  createPreset,
  deletePreset,
  getPresetForRender,
  listPresets,
  presetInputSchema,
  savePresetImage,
  updatePreset,
} from "../services/watermark-preset.service";

/** Thư viện watermark của người đăng nhập (admin & creator) — /v1/watermark-presets */
const upload = multer({
  dest: storagePaths.temp,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
});

const idParam = (raw: string): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Id không hợp lệ.");
  return id;
};

export const watermarkPresetRoutes = Router();

watermarkPresetRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await listPresets(req.user!.id) });
  })
);

watermarkPresetRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = presetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Cấu hình không hợp lệ.");
    }
    const id = await createPreset(req.user!.id, parsed.data);
    res.status(201).json({ data: { id } });
  })
);

watermarkPresetRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = presetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Cấu hình không hợp lệ.");
    }
    await updatePreset(req.user!.id, idParam(req.params.id), parsed.data);
    res.json({ data: { ok: true } });
  })
);

watermarkPresetRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deletePreset(req.user!.id, idParam(req.params.id));
    res.json({ data: { ok: true } });
  })
);

watermarkPresetRoutes.post(
  "/:id/image",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Thiếu file ảnh (field 'file').");
    await savePresetImage(req.user!.id, idParam(req.params.id), req.file.path);
    res.status(201).json({ data: { ok: true } });
  })
);

/** Xem ảnh của 1 preset (dùng làm preview trong thư viện) */
watermarkPresetRoutes.get(
  "/:id/image",
  asyncHandler(async (req, res) => {
    const preset = await getPresetForRender(req.user!.id, idParam(req.params.id));
    if (!preset.imagePath || !fs.existsSync(preset.imagePath)) {
      throw notFound("Preset này chưa có ảnh.");
    }
    res.sendFile(preset.imagePath);
  })
);

import { Router } from "express";
import fs from "node:fs";
import multer from "multer";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";
import { asyncHandler } from "../middleware/error";
import {
  getUserWatermark,
  saveUserWatermarkImage,
  updateUserWatermark,
  userWatermarkUpdateSchema,
} from "../services/watermark.service";

/** Watermark RIÊNG của người đăng nhập (creator/admin đều có) — /v1/watermark */
const upload = multer({
  dest: storagePaths.temp,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
});

export const watermarkRoutes = Router();

watermarkRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const wm = await getUserWatermark(req.user!.id);
    const { imagePath, ...pub } = wm;
    res.json({ data: pub });
  })
);

watermarkRoutes.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = userWatermarkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Cấu hình không hợp lệ.");
    }
    await updateUserWatermark(req.user!.id, parsed.data);
    res.json({ data: { ok: true } });
  })
);

watermarkRoutes.post(
  "/image",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Thiếu file ảnh (field 'file').");
    await saveUserWatermarkImage(req.user!.id, req.file.path);
    res.status(201).json({ data: { ok: true } });
  })
);

watermarkRoutes.get(
  "/image",
  asyncHandler(async (req, res) => {
    const wm = await getUserWatermark(req.user!.id);
    if (!wm.imagePath || !fs.existsSync(wm.imagePath)) {
      throw notFound("Chưa có ảnh watermark.");
    }
    res.sendFile(wm.imagePath);
  })
);

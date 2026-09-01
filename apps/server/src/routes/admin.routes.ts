import { Router } from "express";
import fs from "node:fs";
import multer from "multer";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";
import { asyncHandler } from "../middleware/error";
import { requireAdmin } from "../middleware/auth";
import {
  getWatermark,
  saveWatermarkImage,
  updateWatermark,
  watermarkUpdateSchema,
} from "../services/watermark.service";
import {
  createUser,
  createUserSchema,
  listUsers,
  updateUser,
  updateUserSchema,
} from "../services/user.service";

const upload = multer({
  dest: storagePaths.temp,
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
});

export const adminRoutes = Router();
adminRoutes.use(requireAdmin);

// --- Watermark toàn hệ thống ---
adminRoutes.get(
  "/watermark",
  asyncHandler(async (_req, res) => {
    const wm = await getWatermark();
    const { imagePath, ...pub } = wm;
    res.json({ data: pub });
  })
);

adminRoutes.put(
  "/watermark",
  asyncHandler(async (req, res) => {
    const parsed = watermarkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Cấu hình không hợp lệ.");
    }
    await updateWatermark(parsed.data);
    res.json({ data: { ok: true } });
  })
);

adminRoutes.post(
  "/watermark/image",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Thiếu file ảnh (field 'file').");
    await saveWatermarkImage(req.file.path);
    res.status(201).json({ data: { ok: true } });
  })
);

/** Ảnh watermark hiện tại — cho preview trong editor */
adminRoutes.get(
  "/watermark/image",
  asyncHandler(async (_req, res) => {
    const wm = await getWatermark();
    if (!wm.imagePath || !fs.existsSync(wm.imagePath)) {
      throw notFound("Chưa có ảnh watermark.");
    }
    res.sendFile(wm.imagePath);
  })
);

// --- Quản lý người dùng (creator/admin) ---
adminRoutes.get(
  "/users",
  asyncHandler(async (_req, res) => {
    res.json({ data: await listUsers() });
  })
);

adminRoutes.post(
  "/users",
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
    }
    const id = await createUser(parsed.data);
    res.status(201).json({ data: { id } });
  })
);

adminRoutes.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) throw badRequest("Id không hợp lệ.");
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
    }
    await updateUser(req.user!.id, userId, parsed.data);
    res.json({ data: { ok: true } });
  })
);

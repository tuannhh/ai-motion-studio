import { Router } from "express";
import fs from "node:fs";
import multer from "multer";
import { z } from "zod";
import { storagePaths } from "../config";
import { badRequest, notFound } from "../http-error";
import { asyncHandler } from "../middleware/error";
import { requireAdmin } from "../middleware/auth";
import {
  createMusic,
  deleteMusic,
  getMusicTrack,
  listMusic,
} from "../services/music.service";

/**
 * Nhạc nền: admin tải vào thư viện chung; creator tải nhạc riêng.
 * Chỉ chủ sở hữu hoặc người dùng thư viện chung được nghe/chọn nhạc.
 */
const upload = multer({
  dest: storagePaths.temp,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

const idParam = (raw: string): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Id không hợp lệ.");
  return id;
};

const createSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên bản nhạc.").max(80),
  credit: z.string().trim().max(120).optional(),
});

export const musicRoutes = Router();

musicRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await listMusic(req.user!.id) });
  }),
);

musicRoutes.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("Thiếu file nhạc (field 'file').");
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      fs.rmSync(req.file.path, { force: true });
      throw badRequest(
        parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
      );
    }
    const id = await createMusic(
      req.user!.id,
      parsed.data.name,
      parsed.data.credit,
      req.file,
      req.user!.role === "admin",
    );
    res.status(201).json({ data: { id } });
  }),
);

/** Nghe thử bản nhạc (mọi user đăng nhập) — sendFile hỗ trợ Range cho <audio> */
musicRoutes.get(
  "/:id/audio",
  asyncHandler(async (req, res) => {
    const track = await getMusicTrack(idParam(req.params.id), req.user!.id);
    if (!fs.existsSync(String(track.stored_path))) {
      throw notFound("File nhạc không còn.");
    }
    res.sendFile(String(track.stored_path));
  }),
);

musicRoutes.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteMusic(idParam(req.params.id));
    res.json({ data: { ok: true } });
  }),
);

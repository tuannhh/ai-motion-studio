import { Router } from "express";
import { z } from "zod";
import { badRequest } from "../http-error";
import { asyncHandler } from "../middleware/error";
import {
  createSeries,
  deleteSeries,
  getSeriesDetail,
  listSeries,
  updateSeries,
} from "../services/series.service";

const createSchema = z.object({
  name: z.string().trim().min(2, "Tên serie tối thiểu 2 ký tự.").max(40),
  description: z.string().trim().max(500).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(2, "Tên serie tối thiểu 2 ký tự.").max(40).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

const idParam = (raw: string): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Id không hợp lệ.");
  return id;
};

export const seriesRoutes = Router();

seriesRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await listSeries(req.user!.id) });
  })
);

seriesRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
    }
    const id = await createSeries(req.user!.id, parsed.data.name, parsed.data.description);
    res.status(201).json({ data: { id } });
  })
);

seriesRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: await getSeriesDetail(req.user!.id, idParam(req.params.id)) });
  })
);

seriesRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
    }
    await updateSeries(req.user!.id, idParam(req.params.id), parsed.data);
    res.json({ data: { ok: true } });
  })
);

seriesRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteSeries(req.user!.id, idParam(req.params.id));
    res.json({ data: { ok: true } });
  })
);

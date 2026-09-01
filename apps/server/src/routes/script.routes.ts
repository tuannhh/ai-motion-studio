import { Router } from "express";
import fs from "node:fs";
import { badRequest, notFound } from "../http-error";
import { asyncHandler } from "../middleware/error";
import {
  approveScript,
  getJobOwned,
  getScriptDetail,
  listFinishedJobs,
  rejectScript,
  updateScriptNarration,
} from "../services/script.service";
import { exportJobToDrive, getJobExport } from "../services/gdrive.service";

const idParam = (raw: string): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Id không hợp lệ.");
  return id;
};

export const scriptRoutes = Router();

scriptRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ data: await getScriptDetail(req.user!.id, idParam(req.params.id)) });
  })
);

scriptRoutes.put(
  "/:id/narration",
  asyncHandler(async (req, res) => {
    const edits = req.body?.scenes;
    if (!Array.isArray(edits) || edits.some((e) => typeof e?.id !== "string" || typeof e?.narration !== "string")) {
      throw badRequest("Dữ liệu lời thoại không hợp lệ.");
    }
    await updateScriptNarration(req.user!.id, idParam(req.params.id), edits);
    res.json({ data: { ok: true } });
  })
);

scriptRoutes.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const jobId = await approveScript(req.user!.id, idParam(req.params.id));
    res.status(202).json({ data: { jobId } });
  })
);

scriptRoutes.post(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    await rejectScript(req.user!.id, idParam(req.params.id));
    res.json({ data: { ok: true } });
  })
);

export const jobRoutes = Router();

jobRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: await listFinishedJobs(req.user!.id) });
  })
);

jobRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const job = await getJobOwned(req.user!.id, idParam(req.params.id));
    res.json({
      data: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error_message,
        title: job.title,
        slug: job.slug,
        finishedAt: job.finished_at,
      },
    });
  })
);

/** Stream video kết quả (sendFile hỗ trợ Range cho <video> seek) */
jobRoutes.get(
  "/:id/video",
  asyncHandler(async (req, res) => {
    const job = await getJobOwned(req.user!.id, idParam(req.params.id));
    if (job.status !== "done" || !job.output_path || !fs.existsSync(String(job.output_path))) {
      throw notFound("Video chưa render xong hoặc file không còn.");
    }
    res.sendFile(String(job.output_path));
  })
);

/** Trạng thái export Drive của job (null = chưa export) */
jobRoutes.get(
  "/:id/export/drive",
  asyncHandler(async (req, res) => {
    res.json({ data: await getJobExport(req.user!.id, idParam(req.params.id)) });
  })
);

/** Export video job lên Google Drive của user (upload + lưu link) */
jobRoutes.post(
  "/:id/export/drive",
  asyncHandler(async (req, res) => {
    const job = await getJobOwned(req.user!.id, idParam(req.params.id));
    const result = await exportJobToDrive(req.user!.id, {
      id: Number(job.id),
      status: String(job.status),
      output_path: job.output_path ? String(job.output_path) : null,
      title: job.title ? String(job.title) : null,
      slug: job.slug ? String(job.slug) : null,
    });
    res.status(201).json({ data: result });
  })
);

import { Router } from "express";
import { appConfig } from "../config";
import { badRequest } from "../http-error";
import { asyncHandler } from "../middleware/error";
import {
  buildAuthUrl,
  disconnect,
  getStatus,
  handleCallback,
} from "../services/gdrive.service";

/**
 * Tích hợp ngoài. Hiện có Google Drive: connect (trả URL đồng ý) → callback
 * (Google redirect về, đổi code lấy token) → status/disconnect. Mọi thao tác
 * gắn user hiện tại (chống IDOR); callback verify state (chống CSRF login).
 */
export const integrationRoutes = Router();

integrationRoutes.get(
  "/gdrive/status",
  asyncHandler(async (req, res) => {
    res.json({ data: await getStatus(req.user!.id) });
  })
);

// POST (có side-effect tạo state) → requireAuth đã kiểm CSRF cho method ghi.
integrationRoutes.post(
  "/gdrive/connect",
  asyncHandler(async (req, res) => {
    res.json({ data: { authUrl: await buildAuthUrl(req.user!.id) } });
  })
);

integrationRoutes.delete(
  "/gdrive",
  asyncHandler(async (req, res) => {
    await disconnect(req.user!.id);
    res.json({ data: { ok: true } });
  })
);

/**
 * Callback OAuth — Google điều hướng trình duyệt tới đây (GET, kèm cookie phiên
 * sameSite=lax). Xử lý xong redirect về app web kèm trạng thái, KHÔNG trả JSON.
 */
integrationRoutes.get(
  "/gdrive/callback",
  asyncHandler(async (req, res) => {
    const back = (q: string) => res.redirect(`${appConfig.WEB_BASE_URL}/?${q}`);
    const err = String(req.query.error ?? "");
    if (err) return back(`drive=error&reason=${encodeURIComponent(err)}`);
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    if (!code || !state) throw badRequest("Thiếu code/state từ Google.");
    try {
      await handleCallback(req.user!.id, code, state);
      return back("drive=connected");
    } catch (e) {
      return back(`drive=error&reason=${encodeURIComponent((e as Error).message)}`);
    }
  })
);

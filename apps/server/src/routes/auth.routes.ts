import { Router } from "express";
import { z } from "zod";
import { appConfig } from "../config";
import { badRequest } from "../http-error";
import { asyncHandler } from "../middleware/error";
import { requireAuth, SESSION_COOKIE } from "../middleware/auth";
import {
  changePassword,
  login,
  logout,
  resolveSession,
} from "../services/auth.service";

const loginSchema = z.object({
  email: z.string().trim().email().max(190),
  password: z.string().min(1).max(200),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(8, "Mật khẩu mới tối thiểu 8 ký tự.")
    .max(200)
    .regex(/[a-zA-Z]/, "Mật khẩu mới phải có chữ cái.")
    .regex(/[0-9]/, "Mật khẩu mới phải có chữ số."),
});

export const authRoutes = Router();

authRoutes.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Email hoặc mật khẩu không hợp lệ.");
    const result = await login(parsed.data.email, parsed.data.password);
    res.cookie(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: appConfig.cookieSecure,
      sameSite: "lax",
      maxAge: result.maxAgeMs,
      path: "/",
    });
    res.json({ data: { user: result.user, csrfToken: result.csrfToken } });
  })
);

authRoutes.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await logout(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ data: { ok: true } });
  })
);

/** Đổi mật khẩu tự phục vụ — đá mọi phiên khác, giữ phiên hiện tại */
authRoutes.post(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
    }
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      throw badRequest("Mật khẩu mới phải khác mật khẩu hiện tại.");
    }
    await changePassword(
      req.user!.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      req.cookies?.[SESSION_COOKIE]
    );
    res.json({ data: { ok: true } });
  })
);

/** Khôi phục phiên khi mở lại trang (kèm csrfToken cho các request ghi) */
authRoutes.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const ctx = await resolveSession(req.cookies?.[SESSION_COOKIE]);
    res.json({ data: { user: req.user, csrfToken: ctx?.csrfToken } });
  })
);

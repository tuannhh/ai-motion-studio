import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../http-error";
import { resolveSession, type SessionUser } from "../services/auth.service";

export const SESSION_COOKIE = "ams_next_session";
export const CSRF_HEADER = "x-csrf-token";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Bắt buộc đăng nhập; với request ghi còn đối chiếu CSRF token của phiên
 * (double-submit qua header — cookie sameSite=lax chỉ là lớp phụ).
 */
export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ctx = await resolveSession(req.cookies?.[SESSION_COOKIE]);
    if (!ctx) throw unauthorized();
    if (MUTATING.has(req.method) && req.get(CSRF_HEADER) !== ctx.csrfToken) {
      throw forbidden("CSRF token không hợp lệ — tải lại trang rồi thử lại.");
    }
    req.user = ctx.user;
    next();
  } catch (e) {
    next(e);
  }
};

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== "admin") {
    next(forbidden("Chức năng này chỉ dành cho quản trị viên."));
    return;
  }
  next();
};

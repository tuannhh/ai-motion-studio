import type { NextFunction, Request, Response } from "express";
import { appConfig } from "../config";
import { HttpError } from "../http-error";

/**
 * Error handler cuối chuỗi — response shape thống nhất {error:{message}}
 * (misa-backend-standard 03/06). Lỗi 5xx không lộ chi tiết nội bộ ra client.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }
  console.error("[server] Lỗi không bắt được:", err);
  const message =
    !appConfig.isProduction && err instanceof Error
      ? err.message
      : "Hệ thống gặp lỗi, vui lòng thử lại sau.";
  res.status(500).json({ error: { message } });
};

/** Bọc handler async để lỗi rơi vào errorHandler thay vì làm treo request */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

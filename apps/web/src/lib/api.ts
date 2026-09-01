/**
 * Client API mỏng (port từ ai-video-studio, đổi theo API @ams/server):
 * response shape {data} / {error:{message}}; CSRF token lấy từ login/me,
 * gửi lại qua header x-csrf-token cho mọi request ghi.
 */
let csrfToken = "";

export class ApiError extends Error {}

export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "creator";
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-csrf-token", csrfToken);
  }
  const response = await fetch(path, { ...options, method, headers, credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload?.error?.message || "Không thể hoàn tất yêu cầu.");
  }
  if (payload?.data?.csrfToken) csrfToken = payload.data.csrfToken;
  return payload.data as T;
}

export async function apiForm<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers({ "x-csrf-token": csrfToken });
  const response = await fetch(path, { method: "POST", headers, body: formData, credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload?.error?.message || "Không thể tải file lên.");
  }
  return payload.data as T;
}

export function setCsrfToken(value: string): void {
  csrfToken = value;
}

/** Lỗi nghiệp vụ có mã HTTP — error middleware sẽ trả {error:{message}} đúng mã. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = "Chưa đăng nhập hoặc phiên đã hết hạn.") =>
  new HttpError(401, m);
export const forbidden = (m = "Bạn không có quyền thực hiện thao tác này.") =>
  new HttpError(403, m);
export const notFound = (m = "Không tìm thấy dữ liệu.") => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);
export const badGateway = (m = "Dịch vụ bên ngoài lỗi — thử lại sau.") =>
  new HttpError(502, m);

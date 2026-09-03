import crypto from "node:crypto";

/**
 * Mã công khai 8 ký tự hex (0-9a-f) dùng trong URL /tinh-nang/ten-san-pham/<id>
 * (khác id số tự tăng nội bộ — tránh lộ tổng số bản ghi qua URL). 16^8 ≈ 4.3 tỷ
 * tổ hợp, đủ tránh trùng cho quy mô project/template hiện tại; cột DB có UNIQUE
 * KEY nên trùng (gần như không thể) sẽ ném lỗi rõ ràng thay vì âm thầm đè.
 */
export const generatePublicId = (): string => crypto.randomBytes(4).toString("hex");

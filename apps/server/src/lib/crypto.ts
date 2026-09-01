import crypto from "node:crypto";
import { appConfig } from "../config";

/**
 * Mã hoá đối xứng AES-256-GCM cho token tích hợp (Drive refresh/access token)
 * lưu DB — không bao giờ lưu plaintext. Khoá lấy từ APP_ENCRYPTION_KEY (32 byte
 * hex). Định dạng lưu: `iv:tag:ciphertext` (đều hex). GCM tự xác thực toàn vẹn.
 */

const key = Buffer.from(appConfig.APP_ENCRYPTION_KEY, "hex");

export const encryptSecret = (plaintext: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
};

export const decryptSecret = (stored: string): string => {
  const [ivHex, tagHex, ctHex] = stored.split(":");
  if (!ivHex || !tagHex || !ctHex) throw new Error("Chuỗi mã hoá không hợp lệ.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
};

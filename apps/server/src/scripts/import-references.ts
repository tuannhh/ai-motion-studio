import fs from "node:fs";
import path from "node:path";
import { pool } from "../db";
import { storagePaths } from "../config";
import { createTemplate } from "../services/template.service";
const sourceDir = process.env.REFERENCE_VIDEO_DIR;
if (!sourceDir)
  throw new Error(
    "Đặt REFERENCE_VIDEO_DIR tới thư mục video mẫu trước khi chạy.",
  );
const samples = [
  ["Paper · AI Agents 101", "snapsave.vn_tiktok_6a9655c7eec53.mp4"],
  ["Midnight · Kiến thức công nghệ", "snapsave.vn_facebook_6a9922b6cfbac.mp4"],
  ["Noir · Tin tức AI", "AI_News_-_Tin_t_c_AI_video_no_watermark-3.mp4"],
];
async function main() {
  const [users]: any = await pool.query("SELECT id FROM users WHERE email=?", [
    process.env.ADMIN_EMAIL || "studio@local.test",
  ]);
  if (!users[0]) throw new Error("Tạo tài khoản admin trước.");
  fs.mkdirSync(storagePaths.temp, { recursive: true });
  for (const [name, file] of samples) {
    const [rows]: any = await pool.query(
      "SELECT id FROM templates WHERE name=?",
      [name],
    );
    if (rows.length) continue;
    const dest = path.join(storagePaths.temp, file);
    fs.copyFileSync(path.join(sourceDir!, file), dest);
    const id = await createTemplate(users[0].id, name, {
      originalname: file,
      path: dest,
      size: fs.statSync(dest).size,
    });
    console.log({ id, name });
  }
  const timer = setInterval(async () => {
    const [rows]: any = await pool.query(
      "SELECT id,name,status,error_message FROM templates ORDER BY id",
    );
    console.log(rows);
    if (rows.every((r: any) => r.status !== "analyzing")) {
      clearInterval(timer);
      await pool.end();
    }
  }, 15000);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

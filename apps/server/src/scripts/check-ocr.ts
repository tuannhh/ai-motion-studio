import { ingestFile } from "@ams/pipeline/src/ingest";
import { loadEnv, config } from "@ams/pipeline/src/env";
loadEnv();
async function main() {
  const file = process.argv[2];
  if (!file) throw Error("Truyền đường dẫn ảnh cần kiểm tra OCR.");
  const result = await ingestFile(file);
  console.log(
    JSON.stringify({ model: config().contentModel, result }, null, 2),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

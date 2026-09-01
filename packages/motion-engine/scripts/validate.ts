/** CLI validate: pnpm validate <spec.json> — kiểm tra schema + lint, không render */
import fs from "node:fs";
import path from "node:path";
import { parseSpec } from "../src/schema/validate";
import { FPS, totalDurationInFrames } from "../src/schema/spec";

const specPath = process.argv[2];
if (!specPath) {
  console.error("Cách dùng: pnpm validate <spec.json>");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(path.resolve(specPath), "utf8"));
try {
  const { spec, issues } = parseSpec(raw);
  for (const issue of issues) {
    const tag = issue.level === "error" ? "❌" : "⚠️ ";
    console.log(`${tag} ${issue.sceneId ? `[${issue.sceneId}] ` : ""}${issue.message}`);
  }
  const hasError = issues.some((i) => i.level === "error");
  console.log(
    `${hasError ? "❌ FAIL" : "✅ PASS"} — ${spec.scenes.length} scene, ${(
      totalDurationInFrames(spec) / FPS
    ).toFixed(1)}s`
  );
  process.exit(hasError ? 2 : 0);
} catch (err) {
  console.error("❌ Schema không hợp lệ:");
  console.error(err);
  process.exit(2);
}

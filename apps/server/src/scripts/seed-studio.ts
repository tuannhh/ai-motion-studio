import fs from "node:fs";
import path from "node:path";
import { pool } from "../db";
import { planSchema } from "@ams/pipeline/src/prompts";
import { planToNarrationMd } from "@ams/pipeline/src/api";
import { generatePublicId } from "../lib/public-id";
async function main() {
  const plan = planSchema.parse(
    JSON.parse(
      fs.readFileSync(path.resolve("../web/src/studio/demo-plan.json"), "utf8"),
    ),
  );
  const [existing]: any = await pool.query(
    "SELECT id FROM scripts WHERE slug=?",
    [plan.slug],
  );
  if (existing.length) {
    console.log({ scriptId: existing[0].id });
    await pool.end();
    return;
  }
  const [user]: any = await pool.query("SELECT id FROM users WHERE email=?", [
    "studio@local.test",
  ]);
  const [project]: any = await pool.query(
    "INSERT INTO projects(public_id,user_id,idea,source_mode,preset_hint,status,duration_sec) VALUES(?,?,?,'user',?,'ready',45)",
    [generatePublicId(), user[0].id, "Video mẫu · " + plan.title, plan.preset],
  );
  const [sc]: any = await pool.query(
    "INSERT INTO scripts(project_id,variant_index,title,angle,slug,preset,plan_json,narration_md) VALUES(?,1,?,?,?,?,?,?)",
    [
      project.insertId,
      plan.title,
      plan.angle,
      plan.slug,
      plan.preset,
      JSON.stringify(plan),
      planToNarrationMd(plan),
    ],
  );
  console.log({ projectId: project.insertId, scriptId: sc.insertId });
  await pool.end();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

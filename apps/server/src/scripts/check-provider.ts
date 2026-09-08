import { loadEnv, config } from "@ams/pipeline/src/env";
import { generateJson } from "@ams/pipeline/src/gemini";
loadEnv();
console.log({
  model: config().contentModel,
  tts: config().ttsModel,
  configured: !!config().geminiApiKey,
});
generateJson('Return JSON {"ready":true}')
  .then((s) => console.log(s))
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });

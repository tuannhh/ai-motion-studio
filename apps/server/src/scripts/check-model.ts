import { loadEnv, config } from "@ams/pipeline/src/env";
loadEnv();
async function main() {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models",
    { headers: { "x-goog-api-key": config().geminiApiKey } },
  );
  const data: any = await response.json();
  console.log(
    JSON.stringify(
      {
        status: response.status,
        models: data.models
          ?.filter((m: any) => /3\.8|tts/.test(m.name))
          .map((m: any) => ({
            name: m.name,
            methods: m.supportedGenerationMethods,
          })),
        error: data.error?.message,
      },
      null,
      2,
    ),
  );
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config().geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Trả lời JSON: {"ready":true}' }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  const result: any = await r.json();
  console.log(
    JSON.stringify({
      probe: "gemini-3.8-flash text",
      status: r.status,
      text: result.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text)
        .join(""),
      error: result.error?.message,
    }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

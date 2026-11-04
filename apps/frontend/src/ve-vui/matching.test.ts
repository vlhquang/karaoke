import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { aiSimilarity } from "./matching";
import { PROMPTS } from "./prompts";

const bike = PROMPTS.find(prompt => prompt.answer === "xe đạp")!;
function env(context: TestContext, values: Record<string, string | undefined>) {
  const previous = new Map(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  context.after(() => { for (const [key, value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
}

test("AI is opt-in and does not send requests when disabled or missing credentials", async context => {
  env(context, { DRAWING_AI_PROVIDER: "off", DRAWING_AI_URL: undefined });
  const fetch = context.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  assert.equal(await aiSimilarity("xe hai bánh", bike), null);
  env(context, { DRAWING_AI_PROVIDER: "openai", OPENAI_API_KEY: undefined, DRAWING_AI_KEY: undefined });
  assert.equal(await aiSimilarity("xe hai bánh", bike), null);
  assert.equal(fetch.mock.calls.length, 0);
});

test("custom semantic service uses private auth and validates/clamps guidance", async context => {
  env(context, { DRAWING_AI_PROVIDER: "custom", DRAWING_AI_URL: "https://example.test/similarity", DRAWING_AI_KEY: "test-only-key" });
  context.mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
    assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer test-only-key");
    assert.equal(JSON.parse(options?.body as string).answer, "xe đạp");
    return Response.json({ percent: 120, explanation: "Tương đồng về đặc điểm." });
  });
  const result = await aiSimilarity("xe hai bánh", bike);
  assert.equal(result?.percent, 99);
  assert.equal(result?.source, "ai");
});

test("OpenAI adapter sends structured-output requests and parses Responses output", async context => {
  env(context, { DRAWING_AI_PROVIDER: "openai", OPENAI_API_KEY: "test-only-key", DRAWING_AI_KEY: undefined, DRAWING_AI_MODEL: "test-model", OPENAI_API_ENDPOINT: "https://example.test/responses" });
  context.mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
    const body = JSON.parse(options?.body as string);
    assert.equal(body.model, "test-model");
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(JSON.parse(body.input).guess, "xe hai bánh");
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ percent: 78, explanation: "Chưa xác định loại xe." }) }] }] });
  });
  assert.deepEqual(await aiSimilarity("xe hai bánh", bike), { percent: 78, explanation: "Chưa xác định loại xe.", source: "ai", label: "Có liên quan" });
});

test("AI HTTP errors, incomplete responses and malformed scores fail without manufacturing guidance", async context => {
  env(context, { DRAWING_AI_PROVIDER: "custom", DRAWING_AI_URL: "https://example.test/similarity" });
  const fetch = context.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  await assert.rejects(aiSimilarity("xe", bike), /unavailable/);
  fetch.mock.mockImplementation(async () => Response.json({ percent: "78", explanation: "Sai kiểu dữ liệu" }));
  await assert.rejects(aiSimilarity("xe", bike), /Invalid/);
  env(context, { DRAWING_AI_PROVIDER: "openai", OPENAI_API_KEY: "test-only-key" });
  fetch.mock.mockImplementation(async () => Response.json({ status: "incomplete", output: [] }));
  await assert.rejects(aiSimilarity("xe", bike), /incomplete/);
});

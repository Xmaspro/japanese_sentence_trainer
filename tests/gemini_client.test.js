const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertGeminiApiKey,
  buildModelAttemptList,
  formatGeminiApiError,
  isGeminiRetryableError,
  looksLikeOpenRouterKey,
  normalizeGeminiModel,
  messagesToGeminiPayload,
  DEFAULT_GEMINI_MODEL,
} = require("../tools/gemini_client.js");

test("normalizeGeminiModel maps OpenRouter model names to Gemini default", () => {
  assert.equal(normalizeGeminiModel("openrouter/owl-alpha"), DEFAULT_GEMINI_MODEL);
  assert.equal(normalizeGeminiModel("gemini-2.5-flash"), "gemini-2.5-flash");
});

test("looksLikeOpenRouterKey detects OpenRouter key format", () => {
  assert.equal(looksLikeOpenRouterKey("sk-or-v1-abc"), true);
  assert.equal(looksLikeOpenRouterKey("AIzaSyExample"), false);
});

test("assertGeminiApiKey rejects OpenRouter keys with a helpful message", () => {
  assert.throws(() => assertGeminiApiKey("sk-or-v1-test"), /OpenRouter/);
});

test("formatGeminiApiError maps API_KEY_INVALID to a Chinese hint", () => {
  const body = JSON.stringify({
    error: {
      code: 400,
      message: "API key not valid. Please pass a valid API key.",
      details: [{ reason: "API_KEY_INVALID" }],
    },
  });
  const message = formatGeminiApiError(400, body);
  assert.match(message, /API Key 无效/);
  assert.match(message, /aistudio\.google\.com\/apikey/);
});

test("isGeminiRetryableError detects quota and rate-limit failures", () => {
  assert.equal(isGeminiRetryableError(new Error("Gemini API 配额或速率已用尽")), true);
  assert.equal(isGeminiRetryableError(new Error("Gemini 400: API key not valid")), false);
});

test("buildModelAttemptList deduplicates preferred and fallback models", () => {
  const models = buildModelAttemptList("gemini-2.0-flash", ["gemini-2.5-flash", "gemini-2.0-flash"]);
  assert.deepEqual(models, ["gemini-2.0-flash", "gemini-2.5-flash"]);
});

test("messagesToGeminiPayload extracts system instruction and chat turns", () => {
  const payload = messagesToGeminiPayload([
    { role: "system", content: "你是日语教练" },
    { role: "user", content: "こんにちは" },
    { role: "assistant", content: "いらっしゃいませ" },
  ]);
  assert.match(payload.systemInstruction, /日语教练/);
  assert.equal(payload.contents.length, 2);
  assert.equal(payload.contents[1].role, "model");
});
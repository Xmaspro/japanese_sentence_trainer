const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveGeminiApiKey } = require("../tools/gemini_config.js");

test("resolveGeminiApiKey prefers explicit key, then env, then file", () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "AIza-env-key";
  try {
    assert.equal(resolveGeminiApiKey({ explicitKey: "AIza-page-key" }).source, "explicit");
    assert.equal(resolveGeminiApiKey({ explicitKey: "" }).source, "env");
    assert.equal(resolveGeminiApiKey({ explicitKey: "" }).apiKey, "AIza-env-key");
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_MODEL_FALLBACKS } = require("./gemini_client.js");

const ROOT = path.resolve(__dirname, "..");
const SCHEDULE_CONFIG_PATH = path.join(ROOT, "phase2_editorial_training", "editorial_schedule.json");
const SCHEDULE_TEMPLATE_PATH = path.join(ROOT, "phase2_editorial_training", "editorial_schedule.template.json");

function readJsonIfExists(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function loadScheduleFileConfig() {
  return readJsonIfExists(SCHEDULE_CONFIG_PATH, readJsonIfExists(SCHEDULE_TEMPLATE_PATH, {}));
}

function resolveGeminiApiKey(options = {}) {
  const explicit = String(options.explicitKey || options.apiKey || "").trim();
  if (explicit) {
    return { apiKey: explicit, source: "explicit" };
  }

  const envKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (envKey) {
    return { apiKey: envKey, source: "env" };
  }

  const fileKey = String(loadScheduleFileConfig().geminiApiKey || "").trim();
  if (fileKey) {
    return { apiKey: fileKey, source: "file" };
  }

  return { apiKey: "", source: "none" };
}

function resolveGeminiRuntimeConfig(options = {}) {
  const fileConfig = loadScheduleFileConfig();
  const { apiKey, source } = resolveGeminiApiKey(options);

  return {
    apiKey,
    apiKeySource: source,
    model: String(options.model || fileConfig.geminiModel || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL,
    fallbackModels:
      Array.isArray(options.fallbackModels) && options.fallbackModels.length
        ? options.fallbackModels
        : Array.isArray(fileConfig.geminiModelFallbacks) && fileConfig.geminiModelFallbacks.length
          ? fileConfig.geminiModelFallbacks
          : DEFAULT_GEMINI_MODEL_FALLBACKS,
  };
}

module.exports = {
  SCHEDULE_CONFIG_PATH,
  loadScheduleFileConfig,
  resolveGeminiApiKey,
  resolveGeminiRuntimeConfig,
};
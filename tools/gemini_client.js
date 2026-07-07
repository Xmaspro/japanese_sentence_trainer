const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_GEMINI_MODEL_FALLBACKS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-8b",
];
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function normalizeGeminiModel(model) {
  const raw = String(model || "").trim();
  if (!raw || raw.startsWith("openrouter/")) return DEFAULT_GEMINI_MODEL;
  if (raw === "gemini-1.5-flash") return "gemini-2.0-flash";
  return raw;
}

function readGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || "").join("").trim();
}

function buildGeminiUrl(model, apiKey) {
  const normalized = normalizeGeminiModel(model);
  return `${GEMINI_API_BASE}/models/${encodeURIComponent(normalized)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function looksLikeOpenRouterKey(apiKey) {
  return /^sk-or-/i.test(String(apiKey || "").trim());
}

function assertGeminiApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("未填写 Gemini API Key。请在设置中填写后保存。");
  if (looksLikeOpenRouterKey(key)) {
    throw new Error(
      "检测到 OpenRouter 密钥（sk-or-...）。请改用 Google AI Studio 的 Gemini API Key：https://aistudio.google.com/apikey",
    );
  }
  return key;
}

function formatGeminiApiError(status, bodyText) {
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    // keep raw body
  }

  const message = parsed?.error?.message || String(bodyText || "").trim();
  const details = parsed?.error?.details || [];
  const reason = details.find((item) => item.reason)?.reason || "";

  if (reason === "API_KEY_INVALID" || /API key not valid/i.test(message)) {
    return "Gemini API Key 无效。请到 https://aistudio.google.com/apikey 创建密钥（通常以 AIza 开头），保存后重试。不要用 OpenRouter 密钥。";
  }
  if (/quota|RESOURCE_EXHAUSTED/i.test(message) || reason === "RATE_LIMIT_EXCEEDED") {
    return "Gemini API 配额或速率已用尽。请稍后再试，或检查 Google AI Studio 的用量限制。";
  }
  if (/model.*not found|NOT_FOUND/i.test(message)) {
    return `Gemini 模型不可用：${message}。请改用 gemini-2.0-flash。`;
  }

  return message ? `Gemini ${status}: ${message}` : `Gemini ${status}`;
}

function isGeminiRetryableError(error) {
  const message = String(error?.message || error || "");
  return /quota|RESOURCE_EXHAUSTED|RATE_LIMIT|429|503|overload|高峰|速率|配额|too many requests|UNAVAILABLE|temporarily unavailable|capacity/i.test(
    message,
  );
}

function buildModelAttemptList(preferredModel, fallbackModels) {
  const ordered = [
    normalizeGeminiModel(preferredModel),
    ...(fallbackModels || DEFAULT_GEMINI_MODEL_FALLBACKS).map((model) => normalizeGeminiModel(model)),
  ];
  return [...new Set(ordered.filter(Boolean))];
}

async function generateGeminiContentWithFallback(options = {}) {
  const models = buildModelAttemptList(options.model, options.fallbackModels);
  let lastError = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    try {
      const result = await generateGeminiContent({ ...options, model });
      return { ...result, model, fallbackUsed: index > 0 };
    } catch (error) {
      lastError = error;
      if (!isGeminiRetryableError(error) || index === models.length - 1) throw error;
    }
  }

  throw lastError || new Error("Gemini request failed");
}

async function generateGeminiChatWithFallback(options = {}) {
  const models = buildModelAttemptList(options.model, options.fallbackModels);
  let lastError = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    try {
      const result = await generateGeminiChat({ ...options, model });
      return { ...result, model, fallbackUsed: index > 0 };
    } catch (error) {
      lastError = error;
      if (!isGeminiRetryableError(error) || index === models.length - 1) throw error;
    }
  }

  throw lastError || new Error("Gemini chat failed");
}

async function generateGeminiContent(options = {}) {
  const apiKey = assertGeminiApiKey(options.apiKey);

  const body = {
    contents: [{ role: "user", parts: [{ text: String(options.prompt || "") }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
    },
  };

  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: String(options.systemInstruction) }] };
  }
  if (options.jsonMode) {
    body.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(buildGeminiUrl(options.model, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(formatGeminiApiError(response.status, await response.text()));
  }

  const data = await response.json();
  const text = readGeminiText(data);
  if (!text) throw new Error("Gemini returned empty content");
  return { text, model: normalizeGeminiModel(options.model), raw: data };
}

function messagesToGeminiPayload(messages, options = {}) {
  let systemInstruction = options.systemInstruction || "";
  const contents = [];

  for (const message of messages || []) {
    const role = message.role === "assistant" ? "model" : message.role;
    const text = String(message.content || message.text || "").trim();
    if (!text) continue;
    if (role === "system") {
      systemInstruction = systemInstruction ? `${systemInstruction}\n${text}` : text;
      continue;
    }
    contents.push({ role: role === "model" ? "model" : "user", parts: [{ text }] });
  }

  if (!contents.length) {
    throw new Error("Gemini chat requires at least one user/model message");
  }

  return { systemInstruction, contents };
}

async function generateGeminiChat(options = {}) {
  const apiKey = assertGeminiApiKey(options.apiKey);

  const { systemInstruction, contents } = messagesToGeminiPayload(options.messages, options);
  const body = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.4,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (options.jsonMode) {
    body.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(buildGeminiUrl(options.model, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(formatGeminiApiError(response.status, await response.text()));
  }

  const data = await response.json();
  const text = readGeminiText(data);
  if (!text) throw new Error("Gemini returned empty content");
  return { text, model: normalizeGeminiModel(options.model), raw: data };
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODEL_FALLBACKS,
  assertGeminiApiKey,
  buildModelAttemptList,
  formatGeminiApiError,
  generateGeminiChat,
  generateGeminiChatWithFallback,
  generateGeminiContent,
  generateGeminiContentWithFallback,
  isGeminiRetryableError,
  looksLikeOpenRouterKey,
  messagesToGeminiPayload,
  normalizeGeminiModel,
  readGeminiText,
};
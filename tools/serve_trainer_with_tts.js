const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { generateBackground } = require("./generate_bg_helper");
const { ensureSpeakingSteps } = require("./asahi_editorial_fetcher.js");
const {
  findBundleForRequest,
  listBundleDates,
  listBundleSummariesForDate,
  listEditorialsForDate,
  runEditorialDay,
} = require("./editorial_pipeline.js");

function withEnsuredSpeaking(bundle) {
  if (!bundle?.article?.paragraphs?.length) return bundle;
  return {
    ...bundle,
    speaking: ensureSpeakingSteps(bundle.speaking, {
      title: bundle.source?.title || "",
      paragraphs: bundle.article.paragraphs,
      dateKey: bundle.date,
      newspaperLabel: bundle.source?.newspaperLabel || "",
    }),
  };
}
const { DEFAULT_GEMINI_MODEL, generateGeminiChat, generateGeminiContent } = require("./gemini_client.js");
const { getSchedulerStatus, startEditorialScheduler } = require("./editorial_scheduler.js");
const { resolveGeminiRuntimeConfig } = require("./gemini_config.js");
const { listScenePresets } = require("./scene_presets.js");
const { generateSceneDialogue } = require("./scene_dialogue_pipeline.js");

const root = path.resolve(__dirname, "..");
const host = "0.0.0.0";
const port = Number(process.env.PORT || 5177);
const VOICEVOX_ENGINE_URL = String(process.env.VOICEVOX_ENGINE_URL || "http://127.0.0.1:50021").replace(/\/+$/, "");

const contentTypes = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
};

http
  .createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${host}:${port}`);
      if (url.pathname === "/api/microsoft-tts") {
        await handleMicrosoftTts(request, response);
        return;
      }
      if (url.pathname === "/api/voicevox-tts") {
        await handleVoicevoxTts(request, response);
        return;
      }
      if (url.pathname === "/api/gemini-explain") {
        await handleGeminiExplain(request, response);
        return;
      }
      if (url.pathname === "/api/gemini-chat") {
        await handleGeminiChat(request, response);
        return;
      }
      if (url.pathname === "/api/gemini-generate") {
        await handleGeminiGenerate(request, response);
        return;
      }
      if (url.pathname === "/api/generate-background") {
        await handleGenerateBackground(request, response);
        return;
      }
      if (url.pathname === "/api/editorial/run") {
        await handleEditorialRun(request, response);
        return;
      }
      if (url.pathname === "/api/editorial/day") {
        await handleEditorialDay(request, response, url);
        return;
      }
      if (url.pathname === "/api/editorial/dates") {
        await handleEditorialDates(request, response);
        return;
      }
      if (url.pathname === "/api/editorial/bundles") {
        await handleEditorialBundles(request, response, url);
        return;
      }
      if (url.pathname === "/api/editorial/list") {
        await handleEditorialList(request, response, url);
        return;
      }
      if (url.pathname === "/api/editorial/scheduler/status") {
        await handleEditorialSchedulerStatus(request, response);
        return;
      }
      if (url.pathname === "/api/scene-presets") {
        await handleScenePresets(request, response);
        return;
      }
      if (url.pathname === "/api/scene-dialogue") {
        await handleSceneDialogue(request, response);
        return;
      }
      if (url.pathname === "/api/voicevox/status") {
        await handleVoicevoxStatus(request, response);
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        sendJsonError(response, 404, `API endpoint not found: ${url.pathname}`);
        return;
      }
      serveStatic(url.pathname, response);
    } catch (error) {
      if (url.pathname.startsWith("/api/")) {
        sendJsonError(response, 500, error.message || "Server error");
        return;
      }
      response.writeHead(500, { "Content-Type": "text/plain;charset=utf-8" });
      response.end(error.message || "Server error");
    }
  })
  .listen(port, host, () => {
    console.log(`Japanese trainer: http://127.0.0.1:${port}/japanese_sentence_trainer/index.html`);
    console.log(`Editorial trainer (pure reading): http://127.0.0.1:${port}/phase2_editorial_training/editorial.html`);
    console.log("AI provider: Google Gemini API");
    const scheduler = startEditorialScheduler();
    if (scheduler.started) {
      console.log(`Editorial scheduler: JST ${scheduler.scheduleHoursJst.join(", ")} (every ${scheduler.intervalMs / 1000}s tick)`);
    }
  });

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json;charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendJsonError(response, status, message) {
  sendJson(response, status, { error: message });
}

async function handleEditorialRun(request, response) {
  if (request.method !== "POST") {
    sendJsonError(response, 405, "Method not allowed");
    return;
  }
  try {
    const body = JSON.parse(await readBody(request));
    const runtime = resolveGeminiRuntimeConfig({
      explicitKey: body.apiKey,
      model: body.model,
    });
    const result = await runEditorialDay({
      date: body.date,
      source: String(body.source || "asahi").trim(),
      url: String(body.url || "").trim(),
      apiKey: runtime.apiKey,
      model: runtime.model,
      fallbackModels: runtime.fallbackModels,
      forceFetch: Boolean(body.forceFetch),
      forceAnalyze: Boolean(body.forceAnalyze),
      forceResearch: Boolean(body.forceResearch),
    });
    response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
    response.end(JSON.stringify(result));
  } catch (error) {
    sendJsonError(response, 500, error.message || "Editorial run failed");
  }
}

async function handleEditorialDay(request, response, url) {
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }
  const bundle = findBundleForRequest({
    date: url.searchParams.get("date"),
    url: url.searchParams.get("url") || "",
    id: url.searchParams.get("id") || "",
  });
  if (!bundle) {
    response.writeHead(404, { "Content-Type": "application/json;charset=utf-8" });
    response.end(JSON.stringify({ error: "Bundle not found" }));
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
  response.end(JSON.stringify({ bundle: withEnsuredSpeaking(bundle) }));
}

async function handleEditorialDates(request, response) {
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
  response.end(JSON.stringify({ dates: listBundleDates() }));
}

async function handleEditorialSchedulerStatus(request, response) {
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
  response.end(JSON.stringify(getSchedulerStatus()));
}

async function handleEditorialList(request, response, url) {
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }
  try {
    const date = String(url.searchParams.get("date") || "").trim();
    const source = String(url.searchParams.get("source") || "asahi").trim();
    const items = await listEditorialsForDate({ source, date });
    response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
    response.end(JSON.stringify({ date, source, items }));
  } catch (error) {
    sendJsonError(response, 500, error.message || "Editorial list failed");
  }
}

async function handleEditorialBundles(request, response, url) {
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }
  const date = String(url.searchParams.get("date") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    sendJsonError(response, 400, "Invalid date");
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
  response.end(JSON.stringify({ date, bundles: listBundleSummariesForDate(date) }));
}

function serveStatic(urlPath, response) {
  const requested = path.normalize(path.join(root, decodeURIComponent(urlPath)));
  if (!requested.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(requested, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(requested)] || "application/octet-stream",
    });
    response.end(data);
  });
}

async function handleGeminiExplain(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  try {
    const body = JSON.parse(await readBody(request));
    const key = String(body.key || "").trim();
    const model = String(body.model || DEFAULT_GEMINI_MODEL).trim();
    if (!key || !body.sentence) {
      response.writeHead(400);
      response.end("Missing Gemini API key or sentence");
      return;
    }

    const result = await generateGeminiContent({
      apiKey: key,
      model,
      prompt: `请用中文说明下面日语对话组的场景、文法、词汇，固定输出三段：场景说明、核心文法、重点词汇。重点解释学习者容易误解的词和文法，不要泛泛聊天。不要超过400字。\n${formatDialogueForGemini(body.sentence)}`,
      temperature: 0.3,
    });
    response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
    response.end(JSON.stringify({ explanation: result.text }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain;charset=utf-8" });
    response.end(error.message || "Gemini explain failed");
  }
}

async function handleGeminiGenerate(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  try {
    const body = JSON.parse(await readBody(request));
    const key = String(body.key || "").trim();
    const model = String(body.model || DEFAULT_GEMINI_MODEL).trim();
    const prompt = String(body.prompt || "").trim();
    if (!key || !prompt) {
      response.writeHead(400);
      response.end("Missing Gemini API key or prompt");
      return;
    }

    const result = await generateGeminiContent({
      apiKey: key,
      model,
      prompt,
      jsonMode: Boolean(body.jsonMode),
      temperature: body.temperature ?? 0.2,
    });
    response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
    response.end(JSON.stringify({ text: result.text, model: result.model }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain;charset=utf-8" });
    response.end(error.message || "Gemini generate failed");
  }
}

function stripJsonFence(text) {
  let cleanText = String(text || "").trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
  }
  return cleanText;
}

function stripSceneDialoguePayload(pipelineResult) {
  const {
    mission: _mission,
    geminiUsed: _geminiUsed,
    geminiModel: _geminiModel,
    fallbackUsed: _fallbackUsed,
    corpusCandidates: _corpusCandidates,
    ...rest
  } = pipelineResult || {};
  return rest;
}

function buildMissionFallback(pipelineResult) {
  const first = pipelineResult?.utterances?.find((item) => item.speaker === "B") || pipelineResult?.utterances?.[1];
  const firstUtterance = first?.ja || pipelineResult?.utterances?.[0]?.ja || "こんにちは。";
  const firstZh = first?.zh || pipelineResult?.utterances?.[0]?.zh || "";
  const label = pipelineResult?.sceneLabel || "生活场景";

  return {
    character_name: "ずんだもん",
    character_desc: `${label}对练角色`,
    mission_goal: pipelineResult?.sceneSummaryZh || pipelineResult?.sceneDescription || "完成自然口语对练。",
    checkpoints: (pipelineResult?.keyPhrases || []).slice(0, 4).map((item, index) => `阶段 ${index + 1}：说出「${item.ja}」的自然用法`),
    first_utterance: firstUtterance,
    first_utterance_zh: firstZh,
  };
}

function formatDialogueForGemini(sentence) {
  const topic = sentence.topicName || "";
  if (sentence.dialogueLines && sentence.dialogueLines.length > 0) {
    const linesStr = sentence.dialogueLines
      .map((line) => `${line.speaker || ""}: ${line.ja || ""}${line.pattern && line.pattern !== "会话表达" ? ` (重要句型: ${line.pattern})` : ""}`)
      .join("\n");
    return `主题：${topic}\n完整对话内容：\n${linesStr}`;
  }
  const before = (sentence.contextBefore || []).map((line) => `${line.speaker || ""}: ${line.text || ""}`).join("\n");
  const after = (sentence.contextAfter || []).map((line) => `${line.speaker || ""}: ${line.text || ""}`).join("\n");
  return `主题：${topic}\n前文：\n${before}\n当前句：\n${sentence.speaker || ""}: ${sentence.ja || ""}\n后文：\n${after}\n重要句型：${sentence.pattern || ""}`;
}

const microsoftCacheDir = path.join(root, "tools", ".microsoft_cache");
if (!fs.existsSync(microsoftCacheDir)) {
  fs.mkdirSync(microsoftCacheDir, { recursive: true });
}

async function handleMicrosoftTts(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  const body = JSON.parse(await readBody(request));
  const region = String(body.region || "").trim();
  const key = String(body.key || "").trim();
  const ssml = String(body.ssml || "").trim();
  if (!region || !key || !ssml) {
    response.writeHead(400);
    response.end("Missing region, key, or SSML");
    return;
  }

  // Create hash based on ssml
  const hash = crypto.createHash("sha256").update(ssml).digest("hex");
  const cachePath = path.join(microsoftCacheDir, `${hash}.mp3`);

  if (fs.existsSync(cachePath)) {
    try {
      const data = fs.readFileSync(cachePath);
      response.writeHead(200, { "Content-Type": "audio/mpeg", "X-Cache": "HIT" });
      response.end(data);
      return;
    } catch (err) {
      console.error("Failed to read Microsoft TTS cache:", err);
    }
  }

  const azureResponse = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    },
    body: ssml,
  });

  if (!azureResponse.ok) {
    response.writeHead(azureResponse.status, { "Content-Type": "text/plain;charset=utf-8" });
    response.end(await azureResponse.text());
    return;
  }

  const audioBuffer = Buffer.from(await azureResponse.arrayBuffer());
  try {
    fs.writeFileSync(cachePath, audioBuffer);
  } catch (err) {
    console.error("Failed to write Microsoft TTS cache file:", err);
  }

  response.writeHead(200, { "Content-Type": "audio/mpeg", "X-Cache": "MISS" });
  response.end(audioBuffer);
}

const voicevoxCacheDir = path.join(root, "tools", ".voicevox_cache");
if (!fs.existsSync(voicevoxCacheDir)) {
  fs.mkdirSync(voicevoxCacheDir, { recursive: true });
}

async function handleVoicevoxStatus(request, response) {
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  try {
    const versionResponse = await fetch(`${VOICEVOX_ENGINE_URL}/version`);
    if (!versionResponse.ok) {
      sendJson(response, 503, { ok: false, engineUrl: VOICEVOX_ENGINE_URL, message: `version ${versionResponse.status}` });
      return;
    }
    const version = await versionResponse.json();
    sendJson(response, 200, { ok: true, engineUrl: VOICEVOX_ENGINE_URL, version });
  } catch (error) {
    sendJson(response, 503, {
      ok: false,
      engineUrl: VOICEVOX_ENGINE_URL,
      message: error.message || "VOICEVOX engine unreachable",
    });
  }
}

async function handleVoicevoxTts(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  const body = JSON.parse(await readBody(request));
  const text = String(body.text || "").trim();
  const speaker = Number(body.speaker || 2);

  if (!text) {
    response.writeHead(400);
    response.end("Missing text parameter");
    return;
  }

  // Generate unique file path based on speaker and text hash
  const hash = crypto.createHash("sha256").update(`${speaker}_${text}`).digest("hex");
  const cachePath = path.join(voicevoxCacheDir, `${hash}.wav`);

  if (fs.existsSync(cachePath)) {
    try {
      const data = fs.readFileSync(cachePath);
      response.writeHead(200, { "Content-Type": "audio/wav", "X-Cache": "HIT" });
      response.end(data);
      return;
    } catch (err) {
      console.error("Failed to read VOICEVOX cache file:", err);
    }
  }

  try {
    // Step 1: Create Audio Query
    const queryUrl = `${VOICEVOX_ENGINE_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`;
    const queryResponse = await fetch(queryUrl, { method: "POST" });
    if (!queryResponse.ok) {
      throw new Error(`Failed to create audio query: ${queryResponse.status}`);
    }
    const queryJson = await queryResponse.json();

    // Step 2: Synthesis
    const synthUrl = `${VOICEVOX_ENGINE_URL}/synthesis?speaker=${speaker}`;
    const synthResponse = await fetch(synthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryJson)
    });

    if (!synthResponse.ok) {
      throw new Error(`Failed to synthesize audio: ${synthResponse.status}`);
    }

    const audioBuffer = Buffer.from(await synthResponse.arrayBuffer());
    try {
      fs.writeFileSync(cachePath, audioBuffer);
    } catch (err) {
      console.error("Failed to write VOICEVOX cache file:", err);
    }

    response.writeHead(200, { "Content-Type": "audio/wav", "X-Cache": "MISS" });
    response.end(audioBuffer);
  } catch (error) {
    console.error("VOICEVOX error:", error);
    response.writeHead(503, { "Content-Type": "text/plain;charset=utf-8" });
    response.end("VOICEVOX 引擎未启动或服务不可用，请确保在本地打开了 VOICEVOX 客户端并保持后台运行。");
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function handleGenerateBackground(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  try {
    const body = JSON.parse(await readBody(request));
    const dialogueId = String(body.dialogueId || "").trim();
    const topicName = String(body.topicName || "").trim();
    const firstJa = String(body.firstJa || "").trim();
    const force = !!body.force;
    const bgProvider = String(body.bgProvider || "pollinations").trim();
    const siliconKey = String(body.siliconKey || "").trim();
    const siliconModel = String(body.siliconModel || "").trim();

    if (!dialogueId || !topicName) {
      response.writeHead(400);
      response.end("Missing dialogueId or topicName");
      return;
    }

    const webPath = await generateBackground(dialogueId, topicName, firstJa, force, {
      bgProvider,
      siliconKey,
      siliconModel
    });
    response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
    response.end(JSON.stringify({ success: true, url: webPath }));
  } catch (error) {
    console.error("Failed to handle generate-background request:", error);
    response.writeHead(500, { "Content-Type": "text/plain;charset=utf-8" });
    response.end(error.message || "Internal server error");
  }
}

async function handleScenePresets(request, response) {
  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  sendJson(response, 200, { presets: listScenePresets() });
}

async function handleSceneDialogue(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  try {
    const body = JSON.parse(await readBody(request));
    const runtime = resolveGeminiRuntimeConfig({
      explicitKey: body.key,
      model: body.model,
    });

    const result = await generateSceneDialogue({
      presetId: body.presetId,
      sceneDescription: body.sceneDescription,
      apiKey: runtime.apiKey,
      model: runtime.model,
      fallbackModels: runtime.fallbackModels,
      includeMission: Boolean(body.includeMission),
    });

    sendJson(response, 200, { success: true, result });
  } catch (error) {
    sendJsonError(response, 500, error.message || "Scene dialogue failed");
  }
}

async function handleGeminiChat(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  try {
    const body = JSON.parse(await readBody(request));
    const key = String(body.key || "").trim();
    const model = String(body.model || DEFAULT_GEMINI_MODEL).trim();
    const initCustom = !!body.initCustom;
    const sceneDescription = String(body.sceneDescription || "").trim();
    const history = body.history || [];
    const mission = body.mission || null;

    if (!key) {
      response.writeHead(400);
      response.end("Missing Gemini API key");
      return;
    }

    if (initCustom) {
      const runtime = resolveGeminiRuntimeConfig({ explicitKey: key, model });
      const pipelineResult = await generateSceneDialogue({
        presetId: body.presetId,
        sceneDescription,
        apiKey: runtime.apiKey,
        model: runtime.model,
        fallbackModels: runtime.fallbackModels,
        includeMission: true,
      });

      const mission = pipelineResult.mission || buildMissionFallback(pipelineResult);
      response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
      response.end(
        JSON.stringify({
          success: true,
          result: mission,
          sceneDialogue: stripSceneDialoguePayload(pipelineResult),
        }),
      );
      return;
    }

    {
      if (!mission) {
        response.writeHead(400);
        response.end("Missing active mission context");
        return;
      }

      const systemInstructionText = `你正在扮演二次元虚拟角色：${mission.character}。
当前会话的口语通关任务是：${mission.goal}。
本次对话设置了以下 ${mission.checkpoints.length} 个逻辑关卡（Checkpoints）：
${mission.checkpoints.map((cp, idx) => `- 关卡 ${idx + 1}: ${cp}`).join("\n")}

你的对话对象是 Speaker A（由真实用户扮演）。
请严格进行日语口语角色扮演。你的回复必须契合你当前的角色设定。你的日语必须十分口语化、生动自然、简短（控制在2-3句以内，不超过50个日语字符）。

请务必注意：
1. 评估用户刚才发给你的那句话是否在逻辑上和语言表达上达成/推动了上述某个逻辑关卡。
2. 评估用户日语表达的语法与礼仪得体程度。如果不符合日本的社会习惯或敬语规则，请在 feedback 字段中给出极简纠错。
3. 如果用户刚才的日语不自然、不礼貌、语义不清，或者没有真正回应当前角色的话，请返回 accepted=false。此时不要继续角色扮演，不要推进剧情，不要新增 completed_checkpoints，ja 和 zh 必须为空字符串，只在 feedback 中给出具体修改建议和可参考的自然说法。
4. 只有当用户刚才的话足够自然、符合场景、能推动任务时，才返回 accepted=true，并给出角色的下一句回复。
5. 如果 feedback 中包含任何纠错、表达优化、礼仪提醒或“更自然的说法”，accepted 必须是 false，ja 和 zh 必须为空字符串。accepted=true 时 feedback 只能为空或简短鼓励，不能同时纠错又继续对话。
6. 请必须仅返回一个合法的 JSON 对象，不要包含 markdown 格式标记，JSON 字段如下：
{
  "accepted": true, // 布尔值。用户刚才那句是否合格；false 时必须暂停推进并让用户修改
  "ja": "你（AI角色）用日语口语说出的下一句自然回复（2-3句内）",
  "zh": "该日语回复的中文翻译",
  "feedback": "针对用户刚才那一句话的极简中文语法/礼仪纠错、表达优化建议（如果没有错，可以写一句鼓励的话或为空，控制在50字内）",
  "completed_checkpoints": [1, 2], // 数组。列出用户已经顺利达成的关卡索引（1-indexed，例如达成关卡1则写入 1。可以包含之前已完成的和刚刚新增完成的）
  "mission_completed": false // 布尔值。如果所有指定的关卡都已被用户达成，且对话圆满结束，则为 true
}`;

      const messages = [
        { role: "system", content: systemInstructionText },
        ...history.map(item => ({
          role: item.role === "user" ? "user" : "assistant",
          content: item.text
        }))
      ];

      const result = await generateGeminiChat({
        apiKey: key,
        model,
        messages,
        jsonMode: true,
        temperature: 0.4,
      });
      const cleanText = stripJsonFence(result.text);
      response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
      response.end(JSON.stringify({ success: true, result: JSON.parse(cleanText) }));
    }
  } catch (error) {
    console.error("Gemini chat error:", error);
    response.writeHead(500, { "Content-Type": "text/plain;charset=utf-8" });
    response.end(error.message || "Internal server error");
  }
}

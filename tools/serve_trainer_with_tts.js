const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 5177);

const contentTypes = {
  ".html": "text/html;charset=utf-8",
  ".js": "text/javascript;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
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
      serveStatic(url.pathname, response);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain;charset=utf-8" });
      response.end(error.message || "Server error");
    }
  })
  .listen(port, host, () => {
    console.log(`Japanese trainer: http://${host}:${port}/japanese_sentence_trainer/index.html`);
  });

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

  const body = JSON.parse(await readBody(request));
  const key = String(body.key || "").trim();
  const model = String(body.model || "gemini-1.5-flash").trim();
  if (!key || !body.sentence) {
    response.writeHead(400);
    response.end("Missing Gemini key or sentence");
    return;
  }

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `请用中文说明下面日语对话组的场景、文法、词汇，固定输出三段：场景说明、核心文法、重点词汇。重点解释学习者容易误解的词和文法，不要泛泛聊天。不要超过400字。\n${formatDialogueForGemini(body.sentence)}`,
              },
            ],
          },
        ],
      }),
    },
  );

  if (!geminiResponse.ok) {
    response.writeHead(geminiResponse.status, { "Content-Type": "text/plain;charset=utf-8" });
    response.end(await geminiResponse.text());
    return;
  }

  const data = await geminiResponse.json();
  const explanation = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  response.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
  response.end(JSON.stringify({ explanation }));
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

  response.writeHead(200, { "Content-Type": "audio/mpeg" });
  response.end(Buffer.from(await azureResponse.arrayBuffer()));
}

const voicevoxCacheDir = path.join(root, "tools", ".voicevox_cache");
if (!fs.existsSync(voicevoxCacheDir)) {
  fs.mkdirSync(voicevoxCacheDir, { recursive: true });
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
    const queryUrl = `http://127.0.0.1:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`;
    const queryResponse = await fetch(queryUrl, { method: "POST" });
    if (!queryResponse.ok) {
      throw new Error(`Failed to create audio query: ${queryResponse.status}`);
    }
    const queryJson = await queryResponse.json();

    // Step 2: Synthesis
    const synthUrl = `http://127.0.0.1:50021/synthesis?speaker=${speaker}`;
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

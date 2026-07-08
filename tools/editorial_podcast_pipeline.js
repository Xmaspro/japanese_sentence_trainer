const fs = require("node:fs");
const path = require("node:path");
const { ensureSpeakingSteps } = require("./asahi_editorial_fetcher.js");
const { generateGeminiContentWithFallback } = require("./gemini_client.js");

const ROOT = path.resolve(__dirname, "..");
const VOICEVOX_ENGINE_URL = String(process.env.VOICEVOX_ENGINE_URL || "http://127.0.0.1:50021").replace(/\/+$/, "");
const PODCAST_HOSTS = {
  A: { nameJa: "さくら", voice: "Kore", role: "聞き手", voicevoxSpeaker: 2 },
  B: { nameJa: "けんた", voice: "Puck", role: "解説者", voicevoxSpeaker: 3 },
};

function defaultPodcastShell(dateKey, title = "") {
  return {
    flowTitle: "社说播客深聊",
    flowHint: "先听双人讨论，再对照脚本跟读重点句。",
    hosts: PODCAST_HOSTS,
    title: String(title || "").trim(),
    summaryZh: "",
    utterances: [],
    script: "",
    recording: `phase2_editorial_training/editorial_speaking/recordings/${dateKey}/podcast.wav`,
    shadowingNoteZh: "",
    ttsModel: "",
    ttsError: "",
    done: false,
  };
}

function normalizeSpeakingInput(speaking) {
  if (!speaking || typeof speaking !== "object") return {};
  if (speaking.exercises && typeof speaking.exercises === "object") {
    return speaking.exercises;
  }
  return speaking;
}

function ensureSpeakingModes(speaking, context = {}) {
  const { title = "", paragraphs = [], dateKey = "", newspaperLabel = "" } = context;
  const source = normalizeSpeakingInput(speaking);
  const retelling = ensureSpeakingSteps(source.retelling || source, {
    title,
    paragraphs,
    dateKey,
    newspaperLabel,
  });
  const podcast = {
    ...defaultPodcastShell(dateKey, title),
    ...(source.podcast || {}),
    hosts: {
      ...PODCAST_HOSTS,
      ...(source.podcast?.hosts || {}),
      A: { ...PODCAST_HOSTS.A, ...(source.podcast?.hosts?.A || {}) },
      B: { ...PODCAST_HOSTS.B, ...(source.podcast?.hosts?.B || {}) },
    },
    title: source.podcast?.title || title || "",
  };

  return {
    mode: source.mode || "podcast",
    podcast,
    retelling,
  };
}

function buildPodcastPrompt(bundle, retrieval) {
  const title = bundle.source?.title || "";
  const newspaperLabel = bundle.source?.newspaperLabel || "报纸";
  const summaryZh = bundle.analysis?.summaryZh || "";
  const paragraphs = (bundle.article?.paragraphs || []).slice(0, 4).join("\n\n");
  const facts = (retrieval?.facts || []).slice(0, 3).map((item) => item.text || item.summary || "").filter(Boolean);

  return `你是一名日语播客编剧。请根据下列社说内容，编写一段**自然口语**的双人讨论脚本（聞き手 A / 解説者 B）。

报纸：${newspaperLabel}
标题：${title}
中文摘要：${summaryZh}
正文节选：
${paragraphs}
${facts.length ? `补充背景：\n${facts.join("\n")}` : ""}

要求：
1. 8〜12 轮对话，A/B 交替；必须含自然相槌（そうですね、なるほど、たしかに 等）。
2. 日语口语、です・ます体，每句不超过 55 字；避免论文腔。
3. B 负责解说报社立场，A 负责追问与确认理解。
4. 只返回 JSON：
{
  "summaryZh": "用中文一句话说明这段讨论在聊什么",
  "shadowingNoteZh": "跟读建议（中文）",
  "utterances": [
    { "speaker": "A", "ja": "...", "zh": "...", "isAizuchi": false }
  ]
}`;
}

function stripJsonFence(text) {
  let cleanText = String(text || "").trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
  }
  return cleanText;
}

function normalizeUtterances(rawUtterances) {
  return (rawUtterances || [])
    .map((item, index) => ({
      turnNum: index + 1,
      speaker: item.speaker === "B" ? "B" : "A",
      ja: String(item.ja || "").trim(),
      zh: String(item.zh || "").trim(),
      isAizuchi: Boolean(item.isAizuchi),
    }))
    .filter((item) => item.ja);
}

async function synthesizeVoicevoxWav(text, speakerId) {
  const queryResponse = await fetch(
    `${VOICEVOX_ENGINE_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${Number(speakerId)}`,
    { method: "POST" },
  );
  if (!queryResponse.ok) throw new Error(`VOICEVOX audio_query ${queryResponse.status}`);
  const queryJson = await queryResponse.json();
  const synthResponse = await fetch(`${VOICEVOX_ENGINE_URL}/synthesis?speaker=${Number(speakerId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(queryJson),
  });
  if (!synthResponse.ok) throw new Error(`VOICEVOX synthesis ${synthResponse.status}`);
  return Buffer.from(await synthResponse.arrayBuffer());
}

async function synthesizePodcastAudio(podcast, dateKey) {
  const utterances = podcast.utterances || [];
  if (!utterances.length) return null;

  const chunks = [];
  for (const item of utterances) {
    const host = item.speaker === "B" ? podcast.hosts?.B : podcast.hosts?.A;
    const speakerId = host?.voicevoxSpeaker || (item.speaker === "B" ? 3 : 2);
    chunks.push(await synthesizeVoicevoxWav(item.ja, speakerId));
  }

  const outputPath = path.join(
    ROOT,
    "phase2_editorial_training",
    "editorial_speaking",
    "recordings",
    dateKey,
    "podcast.wav",
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat(chunks));
  return `phase2_editorial_training/editorial_speaking/recordings/${dateKey}/podcast.wav`;
}

async function enrichSpeakingWithPodcast(bundle, retrieval, options = {}) {
  const speaking = ensureSpeakingModes(bundle.speaking, {
    title: bundle.source?.title || "",
    paragraphs: bundle.article?.paragraphs || [],
    dateKey: bundle.date,
    newspaperLabel: bundle.source?.newspaperLabel || "",
  });

  const podcast = { ...speaking.podcast };
  if (!options.apiKey) {
    return speaking;
  }

  if (!options.force && (podcast.utterances || []).length >= 4) {
    return { ...speaking, podcast };
  }

  const result = await generateGeminiContentWithFallback({
    apiKey: options.apiKey,
    model: options.model,
    fallbackModels: options.fallbackModels,
    prompt: buildPodcastPrompt(bundle, retrieval),
    jsonMode: true,
    temperature: 0.45,
  });

  const parsed = JSON.parse(stripJsonFence(result.text));
  const utterances = normalizeUtterances(parsed.utterances);
  podcast.utterances = utterances;
  podcast.summaryZh = String(parsed.summaryZh || "").trim();
  podcast.shadowingNoteZh = String(parsed.shadowingNoteZh || "").trim();
  podcast.script = utterances.map((item) => `${item.speaker}: ${item.ja}`).join("\n");
  podcast.ttsModel = options.ttsModel || result.model || "";

  if (!options.skipTts && utterances.length) {
    try {
      const recording = await synthesizePodcastAudio(podcast, bundle.date);
      if (recording) podcast.recording = recording;
      podcast.ttsError = "";
    } catch (error) {
      podcast.ttsError = error.message || "VOICEVOX podcast synthesis failed";
    }
  }

  return { ...speaking, podcast };
}

module.exports = {
  PODCAST_HOSTS,
  defaultPodcastShell,
  ensureSpeakingModes,
  enrichSpeakingWithPodcast,
  normalizeSpeakingInput,
};
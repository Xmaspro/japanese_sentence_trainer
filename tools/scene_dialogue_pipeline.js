const { generateGeminiContentWithFallback } = require("./gemini_client.js");
const { findMatchingDialogues } = require("./jdd_scene_matcher.js");
const { resolveSceneInput } = require("./scene_presets.js");

const DIALOGUE_SCHEMA_HINT = `{
  "source": "jdd" | "generated" | "hybrid",
  "matchScore": 0.0,
  "sceneSummaryZh": "用中文一句话描述这段对话发生的生活画面",
  "selectedRefs": [{ "topicId": 1, "dialogueId": 12 }],
  "utterances": [
    {
      "speaker": "A",
      "ja": "自然口语日语",
      "zh": "中文",
      "isAizuchi": false,
      "role": "进入场景|提问|回应|相槌|感受|理由|请求|收尾"
    }
  ],
  "keyPhrases": [
    { "ja": "よかったら一緒に食べに行きませんか。", "zh": "要不要一起去吃？", "scene": "顺势邀约" }
  ],
  "aizuchiTipsZh": "说明本对话里相槌如何承接上下文",
  "shadowingNoteZh": "跟读建议：先听整段，再分角色练"
}`;

function buildCandidateDigest(candidates) {
  return (candidates || [])
    .slice(0, 5)
    .map((item, index) => {
      const lines = (item.utterances || [])
        .map((u) => `  ${u.speaker}: ${u.utterance}`)
        .join("\n");
      return `【候选${index + 1}】topic=${item.topicId} dialogue_id=${item.dialogueId} score=${item.score}\n${lines}`;
    })
    .join("\n\n");
}

function buildSceneDialoguePrompt(scene, matchResult) {
  const candidateBlock = buildCandidateDigest(matchResult.candidates);
  const hasCandidates = matchResult.candidates.length > 0;

  return `你是一名日语口语教练，擅长把真实生活对话整理成适合中文母语者跟读、暗记的版本。

用户场景说明：
"${scene.sceneDescription}"
${scene.presetId ? `典型场景 ID：${scene.presetId}（${scene.label}）` : "输入方式：用户自定义场景"}

下面是从「日本語日常対話コーパス（JDD）」检索到的${hasCandidates ? "候选对话" : "候选（无强匹配）"}：
${hasCandidates ? candidateBlock : "（语料库中没有明显匹配，请完全基于场景实时生成）"}

请完成：
1. 判断候选对话是否贴合用户场景（0〜1 的 matchScore）。
2. 若 matchScore >= 0.45：以最佳候选为基础，**保留真实上下文**，可微调专有名词、语序、敬语，使其更口语自然；必须保留/补足自然的 **相槌**（如：そうですね、なるほど、ええ、はい、そうなんですか）。
3. 若 matchScore < 0.45：实时生成一段全新对话（6〜10 轮），仍须符合日本日常生活、含相槌。
4. utterances 必须 A/B 交替自然对话，不要写成作文；每句 ja 控制在 45 字以内，偏 です/ます 口语。
5. 至少 2 句 isAizuchi=true。
6. keyPhrases 提取 4〜6 句最值得暗记的表达。

只返回合法 JSON，不要 markdown，格式：
${DIALOGUE_SCHEMA_HINT}`;
}

function buildMissionPrompt(scene, dialogueResult) {
  const lines = (dialogueResult.utterances || [])
    .map((item) => `${item.speaker}: ${item.ja}`)
    .join("\n");

  return `你是一名日语口语教学设计师。根据下列**语料库提炼后的真实对话**，设计一个角色扮演通关任务。

场景：${scene.sceneDescription}
对话摘要：${dialogueResult.sceneSummaryZh || ""}

参考对话：
${lines}

相槌提示：${dialogueResult.aizuchiTipsZh || ""}

要求：
1. 角色人设自然（店员/同事/朋友/店员ずんだもん等，符合场景）。
2. mission_goal 150字内，融入日本礼仪要点。
3. checkpoints 3〜5 个，对应对话里的真实表达逻辑（含至少 1 个相槌/附和关卡）。
4. first_utterance 必须自然口语，可基于参考对话首句微调，不超过 2 句。

只返回 JSON：
{
  "character_name": "",
  "character_desc": "",
  "mission_goal": "",
  "checkpoints": ["阶段1：...", "阶段2：..."],
  "first_utterance": "",
  "first_utterance_zh": ""
}`;
}

function normalizeDialogueResult(raw, matchResult, scene) {
  const utterances = Array.isArray(raw?.utterances) ? raw.utterances : [];
  return {
    source: raw?.source || (matchResult.hasStrongMatch ? "jdd" : "generated"),
    matchScore: Number(raw?.matchScore ?? matchResult.bestScore ?? 0),
    sceneSummaryZh: String(raw?.sceneSummaryZh || scene.sceneDescription || "").trim(),
    presetId: scene.presetId || "",
    sceneLabel: scene.label || "",
    sceneDescription: scene.sceneDescription,
    selectedRefs: Array.isArray(raw?.selectedRefs) ? raw.selectedRefs : [],
    utterances: utterances.map((item, index) => ({
      turnNum: index + 1,
      speaker: String(item.speaker || (index % 2 === 0 ? "A" : "B")).trim(),
      ja: String(item.ja || "").trim(),
      zh: String(item.zh || "").trim(),
      isAizuchi: Boolean(item.isAizuchi),
      role: String(item.role || "").trim(),
    })),
    keyPhrases: Array.isArray(raw?.keyPhrases) ? raw.keyPhrases : [],
    aizuchiTipsZh: String(raw?.aizuchiTipsZh || "").trim(),
    shadowingNoteZh: String(raw?.shadowingNoteZh || "").trim(),
    corpusCandidates: matchResult.candidates,
  };
}

function fallbackFromCandidate(matchResult, scene) {
  const best = matchResult.candidates[0];
  if (!best) {
    return {
      source: "generated",
      matchScore: 0,
      sceneSummaryZh: scene.sceneDescription,
      selectedRefs: [],
      utterances: [],
      keyPhrases: [],
      aizuchiTipsZh: "未找到语料且未配置 API，请填写 Gemini API Key 后重试。",
      shadowingNoteZh: "",
      corpusCandidates: [],
    };
  }

  return {
    source: "jdd",
    matchScore: best.score,
    sceneSummaryZh: scene.sceneDescription,
    selectedRefs: [{ topicId: best.topicId, dialogueId: best.dialogueId }],
    utterances: best.utterances.map((item, index) => ({
      turnNum: index + 1,
      speaker: item.speaker,
      ja: item.utterance,
      zh: "",
      isAizuchi: item.isAizuchi,
      role: item.isAizuchi ? "相槌" : "",
    })),
    keyPhrases: best.utterances.slice(0, 4).map((item) => ({
      ja: item.utterance,
      zh: "",
      scene: item.isAizuchi ? "相槌" : "场景表达",
    })),
    aizuchiTipsZh: "已从 JDD 原句返回；配置 Gemini 后可自动润色为更自然口语。",
    shadowingNoteZh: "先整段跟读，再拆分 A/B。",
    corpusCandidates: matchResult.candidates,
  };
}

async function generateSceneDialogue(options = {}) {
  const scene = resolveSceneInput(options);
  const matchResult = findMatchingDialogues({
    sceneDescription: scene.sceneDescription,
    keywords: scene.keywords,
    topicIds: scene.topicIds,
    limit: options.candidateLimit || 5,
    dataDir: options.dataDir,
  });

  const apiKey = String(options.apiKey || "").trim();
  if (!apiKey) {
    const fallback = fallbackFromCandidate(matchResult, scene);
    return {
      ...fallback,
      presetId: scene.presetId,
      sceneLabel: scene.label,
      sceneDescription: scene.sceneDescription,
      corpusCandidates: matchResult.candidates,
      geminiUsed: false,
    };
  }

  const dialoguePrompt = buildSceneDialoguePrompt(scene, matchResult);
  const dialogueResponse = await generateGeminiContentWithFallback({
    apiKey,
    model: options.model,
    fallbackModels: options.fallbackModels,
    prompt: dialoguePrompt,
    jsonMode: true,
    temperature: 0.35,
  });

  let parsed;
  try {
    parsed = JSON.parse(stripJsonFence(dialogueResponse.text));
  } catch (error) {
    throw new Error(`场景对话 JSON 解析失败：${error.message}`);
  }

  const dialogueResult = normalizeDialogueResult(parsed, matchResult, scene);

  let mission = null;
  if (options.includeMission) {
    const missionResponse = await generateGeminiContentWithFallback({
      apiKey,
      model: options.model,
      fallbackModels: options.fallbackModels,
      prompt: buildMissionPrompt(scene, dialogueResult),
      jsonMode: true,
      temperature: 0.4,
    });
    mission = JSON.parse(stripJsonFence(missionResponse.text));
  }

  return {
    ...dialogueResult,
    mission,
    geminiUsed: true,
    geminiModel: dialogueResponse.model,
    fallbackUsed: dialogueResponse.fallbackUsed,
  };
}

function stripJsonFence(text) {
  let cleanText = String(text || "").trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
  }
  return cleanText;
}

module.exports = {
  buildCandidateDigest,
  buildMissionPrompt,
  buildSceneDialoguePrompt,
  generateSceneDialogue,
  normalizeDialogueResult,
  stripJsonFence,
};
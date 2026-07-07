const { loadDialogueData } = require("./dialogue_corpus_builder.js");

const AIZUCHI_RE =
  /^(そうですね|なるほど|ええ|はい|そうなんですか|本当ですか|いいですね|たしかに|そうですか|うん|まあ)[。！？]?$/;

const CUSTOM_HINT_MAP = [
  { pattern: /便利店|コンビニ|罗森|全家|结账|袋子/, keywords: ["コンビニ", "レジ", "袋", "お弁当"] },
  { pattern: /电车|地铁|通勤|车站|换乘/, keywords: ["電車", "駅", "乗り換え", "遅れ"] },
  { pattern: /点餐|餐厅|午饭|晚饭|外卖|菜单/, keywords: ["レストラン", "注文", "メニュー", "ランチ"] },
  { pattern: /起床|早上|晨|洗漱/, keywords: ["おはよう", "朝", "天気", "準備"] },
  { pattern: /电话|预约|挂号/, keywords: ["電話", "予約", "時間"] },
  { pattern: /天气|下雨|伞|太热/, keywords: ["天気", "雨", "傘", "暑"] },
  { pattern: /回家|做饭|打扫|房东|坏了/, keywords: ["料理", "掃除", "壊れ", "部屋"] },
  { pattern: /寒暄|闲聊|好久不见|最近怎样/, keywords: ["久しぶり", "元気", "最近"] },
  { pattern: /睡前|回顾|累了|明天/, keywords: ["おやすみ", "疲れ", "明日", "一日"] },
  { pattern: /学校|作业|请假|报告/, keywords: ["宿題", "学校", "休み", "レポート"], topicIds: [2] },
  { pattern: /旅行|酒店|入住|机票/, keywords: ["チェックイン", "予約", "ホテル", "旅行"], topicIds: [3] },
  { pattern: /医院|头疼|发烧|药/, keywords: ["病院", "痛い", "熱", "薬"], topicIds: [4] },
  { pattern: /电影|爱好|卡拉OK|聚会/, keywords: ["映画", "趣味", "歌", "遊び"], topicIds: [5] },
];

function dialogueText(dialogue) {
  return (dialogue.utterances || []).map((item) => item.utterance).join("\n");
}

function countKeywordHits(text, keywords) {
  let hits = 0;
  for (const keyword of keywords || []) {
    if (keyword && text.includes(keyword)) hits += 1;
  }
  return hits;
}

function inferKeywordsFromDescription(description, seedKeywords = []) {
  const keywords = [...new Set(seedKeywords)];
  const desc = String(description || "");
  for (const rule of CUSTOM_HINT_MAP) {
    if (rule.pattern.test(desc)) {
      keywords.push(...rule.keywords);
      if (rule.topicIds) {
        return { keywords: [...new Set(keywords)], topicIds: rule.topicIds };
      }
    }
  }
  return { keywords: [...new Set(keywords)], topicIds: null };
}

function scoreDialogue(dialogue, context) {
  const text = dialogueText(dialogue);
  const keywordHits = countKeywordHits(text, context.keywords);
  const keywordScore = context.keywords.length ? keywordHits / context.keywords.length : 0;

  let topicScore = 0;
  if (context.topicIds?.length) {
    topicScore = context.topicIds.includes(dialogue.topic_id) ? 1 : 0;
  }

  const length = dialogue.dialogue_length || dialogue.utterances?.length || 0;
  const lengthScore = length >= 5 && length <= 10 ? 1 : length >= 4 && length <= 12 ? 0.6 : 0.3;

  const aizuchiCount = (dialogue.utterances || []).filter((item) => isAizuchiUtterance(item.utterance)).length;
  const aizuchiScore = Math.min(aizuchiCount / 2, 1);

  const total =
    keywordScore * 0.55 + topicScore * 0.2 + lengthScore * 0.15 + aizuchiScore * 0.1;

  return {
    dialogue,
    score: Number(total.toFixed(4)),
    keywordHits,
    aizuchiCount,
    topicId: dialogue.topic_id,
    topicName: dialogue.topic_name,
    dialogueId: dialogue.dialogue_id,
    dialogueLength: length,
    preview: (dialogue.utterances || []).slice(0, 3).map(formatUtterance),
  };
}

function isAizuchiUtterance(text) {
  const cleaned = String(text || "").trim();
  if (AIZUCHI_RE.test(cleaned)) return true;
  return /^(そうですね|なるほど|ええ|はい|たしかに|いいですね)[、，]/.test(cleaned);
}

function formatUtterance(item) {
  return {
    turnNum: item.turn_num,
    speaker: item.speaker,
    utterance: item.utterance,
    isAizuchi: isAizuchiUtterance(item.utterance),
  };
}

function formatDialogueCandidate(entry) {
  const dialogue = entry.dialogue;
  return {
    topicId: dialogue.topic_id,
    topicName: dialogue.topic_name,
    dialogueId: dialogue.dialogue_id,
    dialogueLength: dialogue.dialogue_length,
    score: entry.score,
    keywordHits: entry.keywordHits,
    aizuchiCount: entry.aizuchiCount,
    utterances: (dialogue.utterances || []).map(formatUtterance),
  };
}

function findMatchingDialogues(options = {}) {
  const description = String(options.sceneDescription || "").trim();
  const seedKeywords = options.keywords || [];
  const seedTopicIds = options.topicIds || null;

  const inferred = inferKeywordsFromDescription(description, seedKeywords);
  const keywords = inferred.keywords;
  const topicIds = seedTopicIds || inferred.topicIds || [1, 2, 3, 4, 5];

  const dialogues = (options.dialogues || loadDialogueData(options.dataDir)).filter((dialogue) =>
    topicIds.includes(dialogue.topic_id),
  );

  const ranked = dialogues
    .map((dialogue) => scoreDialogue(dialogue, { keywords, topicIds }))
    .filter((entry) => entry.score > 0.08 || entry.keywordHits > 0)
    .sort((a, b) => b.score - a.score || b.aizuchiCount - a.aizuchiCount);

  const limit = Number(options.limit || 5);
  const minScore = Number(options.minScore ?? 0.28);

  return {
    sceneDescription: description,
    keywords,
    topicIds,
    candidates: ranked.slice(0, limit).map(formatDialogueCandidate),
    bestScore: ranked[0]?.score || 0,
    hasStrongMatch: (ranked[0]?.score || 0) >= minScore,
  };
}

module.exports = {
  AIZUCHI_RE,
  countKeywordHits,
  dialogueText,
  findMatchingDialogues,
  formatDialogueCandidate,
  inferKeywordsFromDescription,
  isAizuchiUtterance,
  scoreDialogue,
};
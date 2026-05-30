const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "japanese-daily-dialogue-main", "data");
const OUTPUT = path.join(ROOT, "content_archive", "dialogue_items.json");

const topicMap = {
  Dailylife: { id: "dailylife", label: "日常生活" },
  School: { id: "school", label: "学校学习" },
  Travel: { id: "travel", label: "旅行出行" },
  Health: { id: "health", label: "医院健康" },
  Entertainment: { id: "entertainment", label: "社交娱乐" },
};

const particlePattern = /まで|から|より|には|では|とは|[はがをにでとのもへ]/g;

function convertDialoguesToTrainingItems(dialogues) {
  const items = [];
  for (const dialogue of dialogues) {
    const topic = topicMap[dialogue.topic_name] || {
      id: String(dialogue.topic_name || "dialogue").toLowerCase(),
      label: dialogue.topic_name || "对话",
    };
    const utterances = dialogue.utterances || [];
    const dialogueId = `${topic.id}-${String(dialogue.dialogue_id).padStart(3, "0")}`;
    for (const utterance of utterances) {
      const ja = cleanupText(utterance.utterance);
      if (!isUsefulUtterance(ja)) continue;
      const particles = detectParticles(ja);
      items.push({
        id: `${dialogueId}-${String(utterance.turn_num).padStart(2, "0")}`,
        scene: topic.id,
        course: topic.id,
        level: estimateDialogueLevel(ja),
        zh: "",
        ja,
        kana: "",
        speaker: utterance.speaker,
        topicId: dialogue.topic_id,
        topicName: topic.label,
        dialogueId,
        sourceDialogueId: dialogue.dialogue_id,
        turnNum: utterance.turn_num,
        contextBefore: nearbyContext(utterances, utterance.turn_num, -2),
        contextAfter: nearbyContext(utterances, utterance.turn_num, 1),
        pattern: detectPattern(ja),
        patternNeedle: detectPatternNeedle(ja),
        particlePrompt: buildParticlePrompt(ja),
        particleAnswer: particles,
        tags: [topic.label, `Speaker ${utterance.speaker}`],
        notes: [
          ["主题", topic.label],
          ["角色", `Speaker ${utterance.speaker}`],
          ["对话", dialogueId],
        ],
      });
    }
  }
  return dedupeItems(items);
}

function loadDialogueData(dataDir = DATA_DIR) {
  return fs
    .readdirSync(dataDir)
    .filter((file) => /^topic\d+\.json$/.test(file))
    .sort()
    .flatMap((file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8")));
}

function writeDialogueBundle(options = {}) {
  const dataDir = options.dataDir || DATA_DIR;
  const output = options.output || OUTPUT;
  const dialogues = loadDialogueData(dataDir);
  const items = convertDialoguesToTrainingItems(dialogues);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDir: path.relative(ROOT, dataDir).replaceAll("\\", "/"),
        dialogueCount: dialogues.length,
        itemCount: items.length,
        topics: Object.values(topicMap),
        items,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return { dialogues, items, output };
}

function nearbyContext(utterances, turnNum, direction) {
  if (direction < 0) {
    return utterances
      .filter((item) => item.turn_num < turnNum)
      .slice(-2)
      .map(contextLine);
  }
  return utterances
    .filter((item) => item.turn_num > turnNum)
    .slice(0, 1)
    .map(contextLine);
}

function contextLine(item) {
  return { speaker: item.speaker, text: cleanupText(item.utterance) };
}

function isUsefulUtterance(text) {
  if (text.length < 6) return false;
  if (text.length > 90) return false;
  return /[ぁ-んァ-ン一-龯]/.test(text);
}

function cleanupText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function detectParticles(text) {
  return [...cleanupText(text).matchAll(particlePattern)].map((match) => match[0]).slice(0, 5);
}

function buildParticlePrompt(text) {
  let count = 0;
  return cleanupText(text).replace(particlePattern, (particle) => {
    count += 1;
    return count <= 5 ? "（　）" : particle;
  });
}

function estimateDialogueLevel(text) {
  const ja = cleanupText(text);
  if (/ございます|くださいませ|ご本人|確認証|いただけ|でしょうか|ませんか/.test(ja)) return "N3";
  if (/なければ|られます|ています|と思います|そうです|ようです|ため/.test(ja) || ja.length > 32) return "N4";
  return "N5";
}

function detectPattern(text) {
  if (text.includes("ませんか")) return "ませんか";
  if (text.includes("てください")) return "てください";
  if (text.includes("たい")) return "たい";
  if (text.includes("ですか")) return "ですか";
  if (text.includes("ましょう")) return "ましょう";
  return "会话表达";
}

function detectPatternNeedle(text) {
  return detectPattern(text);
}

function dedupeItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = `${item.scene}:${item.dialogueId}:${item.turnNum}:${item.ja}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

if (require.main === module) {
  const { dialogues, items, output } = writeDialogueBundle();
  console.log(`Converted ${dialogues.length} dialogues into ${items.length} dialogue training items.`);
  console.log(output);
}

module.exports = {
  convertDialoguesToTrainingItems,
  loadDialogueData,
  writeDialogueBundle,
  detectParticles,
  buildParticlePrompt,
  estimateDialogueLevel,
};

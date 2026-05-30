const test = require("node:test");
const assert = require("node:assert/strict");

const {
  convertDialoguesToTrainingItems,
  detectParticles,
  buildParticlePrompt,
  estimateDialogueLevel,
} = require("../tools/dialogue_corpus_builder.js");

test("dialogue corpus conversion keeps topic, speaker, and nearby context", () => {
  const items = convertDialoguesToTrainingItems([
    {
      topic_id: 2,
      topic_name: "School",
      dialogue_id: 7,
      utterances: [
        { turn_num: 1, speaker: "A", utterance: "宿題は終わりましたか？" },
        { turn_num: 2, speaker: "B", utterance: "まだ終わっていません。" },
        { turn_num: 3, speaker: "A", utterance: "では、明日までに出してください。" },
      ],
    },
  ]);

  assert.equal(items.length, 3);
  assert.equal(items[1].scene, "school");
  assert.equal(items[1].speaker, "B");
  assert.equal(items[1].dialogueId, "school-007");
  assert.deepEqual(items[1].contextBefore, [{ speaker: "A", text: "宿題は終わりましたか？" }]);
  assert.deepEqual(items[1].contextAfter, [{ speaker: "A", text: "では、明日までに出してください。" }]);
});

test("dialogue conversion builds particle prompts without Chinese hints", () => {
  const item = convertDialoguesToTrainingItems([
    {
      topic_id: 1,
      topic_name: "Dailylife",
      dialogue_id: 1,
      utterances: [{ turn_num: 1, speaker: "A", utterance: "今日は駅で友達と会います。" }],
    },
  ])[0];

  assert.equal(item.zh, "");
  assert.deepEqual(item.particleAnswer, ["は", "で", "と"]);
  assert.equal(item.particlePrompt, "今日（　）駅（　）友達（　）会います。");
});

test("level estimation keeps short daily dialogue approachable", () => {
  assert.equal(estimateDialogueLevel("ぜひ行きましょう。"), "N5");
  assert.equal(estimateDialogueLevel("予約表とご本人さま確認証をお持ちください。"), "N3");
  assert.deepEqual(detectParticles("資料を明日までに提出します。"), ["を", "まで", "に"]);
  assert.equal(buildParticlePrompt("資料を明日までに提出します。"), "資料（　）明日（　）（　）提出します。");
});

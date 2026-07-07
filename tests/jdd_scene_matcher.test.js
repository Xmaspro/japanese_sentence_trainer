const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findMatchingDialogues,
  inferKeywordsFromDescription,
  isAizuchiUtterance,
} = require("../tools/jdd_scene_matcher.js");
const { getScenePreset, listScenePresets, resolveSceneInput } = require("../tools/scene_presets.js");
const { loadDialogueData } = require("../tools/dialogue_corpus_builder.js");

test("listScenePresets returns nine typical Phase 1 scenes", () => {
  const presets = listScenePresets();
  assert.equal(presets.length, 9);
  assert.ok(presets.some((item) => item.id === "S03" && item.label.includes("便利店")));
});

test("resolveSceneInput maps preset id to description and keywords", () => {
  const scene = resolveSceneInput({ presetId: "S03" });
  assert.equal(scene.presetId, "S03");
  assert.match(scene.sceneDescription, /便利店/);
  assert.ok(scene.keywords.includes("コンビニ"));
});

test("resolveSceneInput accepts custom description", () => {
  const scene = resolveSceneInput({ sceneDescription: "在罗森买水并加热便当" });
  assert.equal(scene.source, "custom");
  assert.equal(scene.label, "自定义场景");
});

test("inferKeywordsFromDescription maps Chinese hints to Japanese keywords", () => {
  const inferred = inferKeywordsFromDescription("在便利店结账要袋子");
  assert.ok(inferred.keywords.includes("コンビニ"));
  assert.ok(inferred.keywords.includes("袋"));
});

test("isAizuchiUtterance detects short backchannel lines", () => {
  assert.equal(isAizuchiUtterance("そうですね。"), true);
  assert.equal(isAizuchiUtterance("今日はステーキが食べたいです。"), false);
});

test("findMatchingDialogues returns konbini-related dialogue for convenience scene", () => {
  const dialogues = loadDialogueData();
  const preset = getScenePreset("S03");
  const result = findMatchingDialogues({
    sceneDescription: preset.description,
    keywords: preset.keywords,
    topicIds: preset.topicIds,
    dialogues,
    limit: 3,
  });

  assert.ok(result.candidates.length > 0);
  assert.ok(result.bestScore > 0.1);
  const text = result.candidates[0].utterances.map((item) => item.utterance).join("");
  assert.ok(/コンビニ|レジ|袋|お弁当|払/.test(text));
});
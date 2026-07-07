const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveAiSpeakerId,
  normalizeEngineUrl,
} = require("../japanese_sentence_trainer/voicevox_client.js");

test("resolveAiSpeakerId maps AI speakers to VOICEVOX ids", () => {
  assert.equal(resolveAiSpeakerId({}, "A"), 2);
  assert.equal(resolveAiSpeakerId({}, "B"), 3);
  assert.equal(resolveAiSpeakerId({ speakerAVoice: "8", speakerBVoice: "1" }, "A"), 8);
  assert.equal(resolveAiSpeakerId({ speakerAVoice: "ja-JP-NanamiNeural" }, "A"), 2);
});

test("normalizeEngineUrl trims trailing slash", () => {
  assert.equal(normalizeEngineUrl("http://127.0.0.1:50021/"), "http://127.0.0.1:50021");
});
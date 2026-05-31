const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isAiChatReplyAccepted,
  buildAcceptedAiHistoryPayload,
} = require("../japanese_sentence_trainer/ai_chat_helpers.js");

test("ai roleplay only advances on explicit accepted true without correction feedback", () => {
  assert.equal(isAiChatReplyAccepted({ accepted: true, feedback: "" }), true);
  assert.equal(isAiChatReplyAccepted({ accepted: "true", feedback: "いいですね。" }), true);
});

test("ai roleplay blocks missing accepted and corrective feedback", () => {
  assert.equal(isAiChatReplyAccepted({ feedback: "" }), false);
  assert.equal(
    isAiChatReplyAccepted({
      accepted: true,
      feedback: "更自然的说法是「何本くらいがいいかな？」",
    }),
    false,
  );
  assert.equal(isAiChatReplyAccepted({ accepted: false, feedback: "请用更礼貌的说法。" }), false);
});

test("rejected user turns are excluded from the next gemini history payload", () => {
  const payload = buildAcceptedAiHistoryPayload([
    { role: "model", ja: "何にしますか。" },
    { role: "user", ja: "何本か君が教えてください", accepted: false },
    { role: "user", ja: "ミネラルウォーターを二本お願いします。" },
  ]);

  assert.deepEqual(payload, [
    { role: "model", text: "何にしますか。" },
    { role: "user", text: "ミネラルウォーターを二本お願いします。" },
  ]);
});

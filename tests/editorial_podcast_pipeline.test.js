const test = require("node:test");
const assert = require("node:assert/strict");

const { ensureSpeakingModes, normalizeSpeakingInput } = require("../tools/editorial_podcast_pipeline.js");

test("ensureSpeakingModes builds podcast and retelling shells", () => {
  const modes = ensureSpeakingModes(null, {
    title: "（社説）テスト",
    paragraphs: ["社会保障の見直しが必要だ。", "財源確保が課題となる。"],
    dateKey: "2026-07-08",
    newspaperLabel: "朝日新聞",
  });

  assert.equal(modes.mode, "podcast");
  assert.equal(modes.retelling.flowTitle, "社论复述口语范本");
  assert.match(modes.retelling.script, /朝日新聞の社説は/);
  assert.equal(modes.podcast.flowTitle, "社说播客深聊");
  assert.equal(modes.podcast.hosts.A.voicevoxSpeaker, 2);
  assert.equal(modes.podcast.hosts.B.voicevoxSpeaker, 3);
  assert.match(modes.podcast.recording, /2026-07-08\/podcast\.wav$/);
});

test("ensureSpeakingModes keeps user retelling script", () => {
  const modes = ensureSpeakingModes(
    { script: "自分の复述メモ", flowTitle: "旧标题" },
    {
      title: "テスト",
      paragraphs: ["段落です。"],
      dateKey: "2026-07-08",
      newspaperLabel: "朝日新聞",
    },
  );

  assert.equal(modes.retelling.script, "自分の复述メモ");
});

test("normalizeSpeakingInput unwraps exercises", () => {
  assert.deepEqual(normalizeSpeakingInput({ exercises: { mode: "podcast" } }), { mode: "podcast" });
});
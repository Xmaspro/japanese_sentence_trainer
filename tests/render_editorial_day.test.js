const test = require("node:test");
const assert = require("node:assert/strict");

const { renderEditorialHtml, escapeHtml } = require("../tools/render_editorial_day.js");

test("escapeHtml escapes unsafe characters", () => {
  assert.equal(escapeHtml('<script>"&"'), "&lt;script&gt;&quot;&amp;&quot;");
});

test("renderEditorialHtml includes article, notes, and speaking tabs", () => {
  const html = renderEditorialHtml({
    dateKey: "2026-07-06",
    fetched: {
      title: "（社説）テスト",
      url: "https://example.com/article",
      paragraphs: ["第一段です。", "第二段です。"],
    },
    reading: {
      newspaperLabel: "朝日新聞",
      reading: {
        topic: "テスト話題",
        summaryJa: "",
        vocab: [{ lemma: "共有地", reading: "きょうゆうち", meaningZh: "公共领域", exampleJa: "例文" }],
      },
      extractedText: { lead: "第一段です。" },
    },
    speaking: {
      exercises: {
        summary30s: { prompt: "何の話？", script: "下書き" },
        desuMasuConversion: [{ originalFromEditorial: "姿だ。", spoken: "姿です。" }],
        explainKeyword: { keyword: "お金の話", spokenExplanation: "説明" },
        myOpinion: { script: "賛成" },
        retellNextDay: { dueDate: "2026-07-07", script: "要点" },
      },
    },
  });

  assert.match(html, /第一段です。/);
  assert.match(html, /data-tab="article"/);
  assert.match(html, /data-tab="notes"/);
  assert.match(html, /data-tab="speaking"/);
  assert.match(html, /共有地/);
  assert.match(html, /姿です。/);
});
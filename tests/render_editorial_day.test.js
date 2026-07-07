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
        flowTitle: "社论复述口语范本",
        flowHint: "先朗读，再复述。",
        script: "今日の朝日新聞の社説は、テストがテーマです。",
      },
    },
  });

  assert.match(html, /第一段です。/);
  assert.match(html, /data-tab="article"/);
  assert.match(html, /data-tab="notes"/);
  assert.match(html, /data-tab="speaking"/);
  assert.match(html, /社论复述口语范本/);
  assert.match(html, /テストがテーマです/);
  assert.match(html, /共有地/);
});
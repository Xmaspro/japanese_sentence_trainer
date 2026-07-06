const test = require("node:test");
const assert = require("node:assert/strict");

const { verifyAnalysisOutput } = require("../tools/editorial_analyzer.js");
const { planResearchQueries } = require("../tools/editorial_researcher.js");

test("planResearchQueries marks editorial policy topics as research-needed", () => {
  const plan = planResearchQueries({
    title: "（社説）社会保障の給付",
    paragraphs: ["国民会議は結論を断念した。", "サービス給付の議論がない。"],
  });
  assert.equal(plan.needed, true);
  assert.ok(plan.queries.length >= 1);
});

test("verifyAnalysisOutput drops grammar without sentence in article", () => {
  const article = { paragraphs: ["目的が「手取りを増やす」ことに尽きている。"] };
  const result = verifyAnalysisOutput(
    {
      summaryZh: "测试",
      vocab: [
        { lemma: "手取り", exampleJa: "目的が「手取りを増やす」ことに尽きている。" },
        { lemma: "虚构", exampleJa: "存在しない句子。" },
      ],
      grammar: [
        { pattern: "〜に尽きる", sentenceJa: "目的が「手取りを増やす」ことに尽きている。" },
        { pattern: "假句型", sentenceJa: "这是假句子。" },
      ],
      lectureZh: {
        timeline: [
          {
            when: "7月",
            what: "目的が「手取りを増やす」",
            sourceId: "src-article",
            sourceType: "article",
            confidence: "verified",
          },
          {
            when: "未知",
            what: "完全编造",
            sourceId: "src-missing",
            sourceType: "web",
            confidence: "verified",
          },
        ],
      },
      skippedFacts: [],
    },
    article,
    [],
  );

  assert.equal(result.vocab.length, 1);
  assert.equal(result.grammar.length, 1);
  assert.equal(result.lectureZh.timeline.length, 1);
  assert.ok(result.skippedFacts.length >= 1);
});
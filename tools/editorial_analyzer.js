const { DEFAULT_GEMINI_MODEL, generateGeminiContentWithFallback } = require("./gemini_client.js");

function buildAnalysisPrompt(article, retrieval) {
  return `你是日语 N1 社说教练。请基于下列材料输出严格 JSON（不要 markdown 代码块）。

要求：
1. 词汇 8-12 个，exampleJa 必须来自社说正文原文子串。
2. 语法 4-6 条，每条必须有 jlptLevel（N1/N2/N3/N4/N5 或 N1-N2）和 usageContext（从：口语/日常/书面/正式/社论/敬体/常体 中选至少2个）。
3. 讲解 lectureZh 必须包含：eventBackground、timeline（数组）、timelineNarrative、topicContext、newspaperStance、argumentStructure、readingTips。
4. timeline 每条必须有 sourceId、sourceType（article 或 web）、confidence（verified/article-only）。
5. 只能使用【社说正文】和【联网检索摘要】里可核对的信息；无法核实的事实写入 skippedFacts，不要编造日期/数字/人名。
6. 若信息来自联网摘要，sourceId 必须引用对应 src-web-xxx；来自正文用 src-article。
7. summaryZh 为 1-2 句中文主旨。

材料：
标题：${article.title}
URL：${article.url}

${retrieval.textBlock}

输出 JSON schema：
{
  "summaryZh": "string",
  "vocab": [{"lemma":"","reading":"","pos":"","meaningZh":"","exampleJa":"","n1Note":""}],
  "grammar": [{"pattern":"","sentenceJa":"","jlptLevel":"","usageContext":[],"register":"","explanationZh":"","spokenHint":"","compareNote":""}],
  "lectureZh": {
    "eventBackground": "string",
    "timeline": [{"when":"","what":"","sourceId":"","sourceType":"","confidence":""}],
    "timelineNarrative": "string",
    "topicContext": "string",
    "newspaperStance": "string",
    "argumentStructure": "string",
    "readingTips": "string"
  },
  "skippedFacts": ["string"]
}`;
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Analyzer returned non-JSON output");
  return JSON.parse(candidate.slice(start, end + 1));
}

function substringVerified(example, articleText) {
  const sample = String(example || "").trim();
  if (!sample) return false;
  return articleText.includes(sample) || articleText.includes(sample.replace(/^　+/, ""));
}

function verifyAnalysisOutput(parsed, article, webSources) {
  const articleText = (article.paragraphs || []).join("\n");
  const sourceIds = new Set(["src-article", ...webSources.map((source) => source.id)]);
  const webSnippets = webSources.map((source) => source.snippet || "").join("\n");
  const skippedFacts = [...(parsed.skippedFacts || [])];

  const vocab = (parsed.vocab || []).filter((item) => substringVerified(item.exampleJa, articleText));
  const grammar = (parsed.grammar || []).filter((item) => substringVerified(item.sentenceJa, articleText));

  const timeline = [];
  for (const item of parsed.lectureZh?.timeline || []) {
    if (!item?.what || !sourceIds.has(item.sourceId)) {
      skippedFacts.push(item?.what || "timeline item missing source");
      continue;
    }
    const inArticle = articleText.includes(item.what) || articleText.includes(String(item.what).slice(0, 12));
    const inWeb = webSnippets.includes(String(item.what).slice(0, 8));
    if (item.sourceType === "article" && !inArticle && item.confidence === "verified") {
      item.confidence = "article-only";
    }
    if (item.sourceType === "web" && !inWeb && !inArticle) {
      skippedFacts.push(item.what);
      continue;
    }
    timeline.push(item);
  }

  return {
    summaryZh: parsed.summaryZh || "",
    vocab,
    grammar,
    lectureZh: {
      eventBackground: parsed.lectureZh?.eventBackground || "",
      timeline,
      timelineNarrative: parsed.lectureZh?.timelineNarrative || "",
      topicContext: parsed.lectureZh?.topicContext || "",
      newspaperStance: parsed.lectureZh?.newspaperStance || "",
      argumentStructure: parsed.lectureZh?.argumentStructure || "",
      readingTips: parsed.lectureZh?.readingTips || "",
    },
    skippedFacts: [...new Set(skippedFacts.filter(Boolean))],
  };
}

async function analyzeEditorial(article, retrieval, options = {}) {
  const prompt = buildAnalysisPrompt(article, retrieval);
  const result = await generateGeminiContentWithFallback({
    apiKey: options.apiKey,
    model: options.model || DEFAULT_GEMINI_MODEL,
    fallbackModels: options.fallbackModels,
    prompt,
    jsonMode: true,
    temperature: 0.2,
  });
  const parsed = extractJsonObject(result.text);
  return {
    data: verifyAnalysisOutput(parsed, article, retrieval.webSources || []),
    model: result.model,
    fallbackUsed: Boolean(result.fallbackUsed),
  };
}

module.exports = {
  DEFAULT_MODEL: DEFAULT_GEMINI_MODEL,
  analyzeEditorial,
  buildAnalysisPrompt,
  extractJsonObject,
  verifyAnalysisOutput,
};
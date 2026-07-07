const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildSpeakingExercises,
  convertToDesuMasu,
  ensureSpeakingSteps,
  normalizeEditorialUrl,
  parseAsahiEditorialArticle,
  parseAsahiEditorialList,
  pickListItemForDate,
} = require("../tools/asahi_editorial_fetcher.js");

const FIXTURES = path.join(__dirname, "fixtures");

test("normalizeEditorialUrl accepts http(s) links and rejects invalid values", () => {
  assert.equal(
    normalizeEditorialUrl("https://www.asahi.com/articles/DA3S16496827.html"),
    "https://www.asahi.com/articles/DA3S16496827.html",
  );
  assert.throws(() => normalizeEditorialUrl("not-a-url"), /无效的 URL/);
  assert.throws(() => normalizeEditorialUrl("ftp://example.com"), /http/);
});

test("parseAsahiEditorialList extracts title, lead, url, and date", () => {
  const html = fs.readFileSync(path.join(FIXTURES, "asahi_editorial_list.snippet.html"), "utf8");
  const items = parseAsahiEditorialList(html);

  assert.equal(items.length, 2);
  assert.equal(items[0].title, "（社説）社会保障の給付　サービスの議論がない");
  assert.equal(items[0].url, "https://www.asahi.com/articles/DA3S16496826.html");
  assert.match(items[0].lead, /食料品にかかる消費税/);
  assert.equal(items[0].publishedAt, "2026-07-06T05:00:00+09:00");
});

test("pickListItemForDate prefers the matching publish date", () => {
  const html = fs.readFileSync(path.join(FIXTURES, "asahi_editorial_list.snippet.html"), "utf8");
  const items = parseAsahiEditorialList(html);
  const picked = pickListItemForDate(items, "2026-07-06");

  assert.equal(picked.title, "（社説）社会保障の給付　サービスの議論がない");
});

test("parseAsahiEditorialArticle extracts paragraphs before paywall", () => {
  const html = fs.readFileSync(path.join(FIXTURES, "asahi_editorial_article.snippet.html"), "utf8");
  const article = parseAsahiEditorialArticle(html);

  assert.equal(article.title, "（社説）社会保障の給付　サービスの議論がない");
  assert.equal(article.paragraphs.length, 5);
  assert.match(article.paragraphs[0], /食料品にかかる消費税/);
  assert.match(article.fullText, /共有地/);
  assert.doesNotMatch(article.fullText, /有料会員/);
});

test("convertToDesuMasu handles common editorial endings", () => {
  assert.equal(
    convertToDesuMasu("これが、社会保障国民会議の姿だ。"),
    "これが、社会保障国民会議の姿です。",
  );
  assert.equal(
    convertToDesuMasu("政治は財源確保から目をそむけがちだ。"),
    "政治は財源確保から目をそむけがちです。",
  );
});

test("buildSpeakingExercises creates a single retelling script", () => {
  const html = fs.readFileSync(path.join(FIXTURES, "asahi_editorial_article.snippet.html"), "utf8");
  const article = parseAsahiEditorialArticle(html);
  const exercises = buildSpeakingExercises({
    title: article.title,
    paragraphs: article.paragraphs,
    dateKey: "2026-07-06",
  });

  assert.equal(exercises.flowTitle, "社论复述口语范本");
  assert.match(exercises.script, /【社论复述口语范本】/);
  assert.match(exercises.script, /今日の朝日新聞の社説は/);
  assert.match(exercises.script, /社会保障の給付/);
  assert.match(exercises.script, /朝日新聞の立場をまとめると/);
  assert.equal(
    exercises.recording,
    "phase2_editorial_training/editorial_speaking/recordings/2026-07-06/retelling.m4a",
  );
});

test("ensureSpeakingSteps keeps user script and migrates legacy speaking", () => {
  const html = fs.readFileSync(path.join(FIXTURES, "asahi_editorial_article.snippet.html"), "utf8");
  const article = parseAsahiEditorialArticle(html);
  const context = {
    title: article.title,
    paragraphs: article.paragraphs,
    dateKey: "2026-07-06",
  };

  const kept = ensureSpeakingSteps({ script: "自分で書いた复述" }, context);
  assert.equal(kept.script, "自分で書いた复述");

  const migrated = ensureSpeakingSteps(
    { summary30s: { prompt: "何の話？", script: "旧缓存" } },
    context,
  );
  assert.equal(migrated.script, "旧缓存");
  assert.equal(migrated.flowTitle, "社论复述口语范本");
});
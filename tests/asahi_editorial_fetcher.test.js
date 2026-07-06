const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildSpeakingExercises,
  convertToDesuMasu,
  parseAsahiEditorialArticle,
  parseAsahiEditorialList,
  pickListItemForDate,
} = require("../tools/asahi_editorial_fetcher.js");

const FIXTURES = path.join(__dirname, "fixtures");

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

test("buildSpeakingExercises creates summary, conversion, and keyword drills", () => {
  const html = fs.readFileSync(path.join(FIXTURES, "asahi_editorial_article.snippet.html"), "utf8");
  const article = parseAsahiEditorialArticle(html);
  const exercises = buildSpeakingExercises({
    title: article.title,
    paragraphs: article.paragraphs,
    dateKey: "2026-07-06",
  });

  assert.match(exercises.summary30s.script, /社会保障の給付/);
  assert.ok(exercises.desuMasuConversion.length >= 2);
  assert.equal(exercises.explainKeyword.keyword, "お金の話");
  assert.equal(exercises.retellNextDay.dueDate, "2026-07-07");
});
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  normalizeSource,
  parseNikkeiEditorialList,
  publishDateKeyFromIso,
} = require("../tools/editorial_sources.js");

const FIXTURES = path.join(__dirname, "fixtures");

test("normalizeSource accepts asahi and nikkei", () => {
  assert.equal(normalizeSource("asahi"), "asahi");
  assert.equal(normalizeSource("nikkei"), "nikkei");
  assert.throws(() => normalizeSource("yomiuri"), /未知新闻源/);
});

test("parseNikkeiEditorialList extracts titles, urls, and JST dates", () => {
  const html = fs.readFileSync(path.join(FIXTURES, "nikkei_editorial_list.snippet.html"), "utf8");
  const items = parseNikkeiEditorialList(html);

  assert.equal(items.length, 2);
  assert.equal(items[0].title, "［社説］中国のSLBM発射を深く憂慮する");
  assert.equal(items[0].url, "https://www.nikkei.com/article/DGXZQODK074A80X00C26A7000000/");
  assert.equal(publishDateKeyFromIso(items[0].publishedAt), "2026-07-07");
  assert.equal(publishDateKeyFromIso(items[1].publishedAt), "2026-07-07");
});
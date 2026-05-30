const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseRssItems,
  normalizeNewsItem,
  buildTrainerItems,
  extractReadableTextFromHtml,
  getSourceUrls,
  splitArticleIntoSentences,
  pruneRollingDays,
} = require("../tools/daily_news_fetcher.js");

test("parses RSS items into normalized raw news records", () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>物価高対策を検討へ</title>
        <link>https://example.com/news/1</link>
        <description>政府は生活支援策を検討しています。</description>
        <pubDate>Sat, 30 May 2026 06:00:00 +0900</pubDate>
      </item>
    </channel></rss>`;

  const items = parseRssItems(xml, { id: "sample", label: "Sample" });

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "物価高対策を検討へ");
  assert.equal(items[0].sourceId, "sample");
});

test("normalizes one raw news item into trainer item without article body copying", () => {
  const normalized = normalizeNewsItem({
    title: "東京都区部CPIを公表",
    url: "https://example.com/news/cpi",
    description: "東京の生活費を見る材料になります。",
    publishedAt: "2026-05-30T06:00:00+09:00",
    sourceId: "nhk",
    sourceLabel: "NHK",
  });

  const trainer = buildTrainerItems([normalized], "2026-05-30");

  assert.equal(trainer.length, 1);
  assert.equal(trainer[0].scene, "news");
  assert.equal(trainer[0].ja, "東京都区部CPIを公表");
  assert.equal(trainer[0].sourceUrl, "https://example.com/news/cpi");
});

test("rolling retention keeps the newest ten date directories", () => {
  const days = [
    "2026-05-01",
    "2026-05-02",
    "2026-05-03",
    "2026-05-04",
    "2026-05-05",
    "2026-05-06",
    "2026-05-07",
    "2026-05-08",
    "2026-05-09",
    "2026-05-10",
    "2026-05-11",
  ];

  assert.deepEqual(pruneRollingDays(days, 10), ["2026-05-01"]);
});

test("reuse-allowed full text news is preserved for article reading practice", () => {
  const normalized = normalizeNewsItem({
    title: "地域の防災訓練を実施",
    url: "https://example.com/wiki-news",
    description: "地域で訓練がありました。",
    fullText: "地域の防災訓練を実施しました。参加者は避難経路を確認しました。",
    canFullTextPractice: true,
    license: "CC BY 2.5",
    publishedAt: "2026-05-30T06:00:00+09:00",
    sourceId: "wikinews",
    sourceLabel: "ウィキニュース",
  });

  const trainer = buildTrainerItems([normalized], "2026-05-30");

  assert.equal(trainer[0].canFullTextPractice, true);
  assert.equal(trainer[0].fullText, normalized.fullText);
  assert.deepEqual(splitArticleIntoSentences(normalized.fullText), [
    "地域の防災訓練を実施しました。",
    "参加者は避難経路を確認しました。",
  ]);
});

test("generic public html pages can be reduced to readable Japanese body text", () => {
  const text = extractReadableTextFromHtml(`
    <html><head><script>ignore()</script><style>body{}</style></head>
    <body><nav>メニュー</nav><main>
      <h1>制度のお知らせ</h1>
      <p>申請の受付を開始しました。</p>
      <p>対象者は窓口で確認できます。</p>
    </main></body></html>
  `);

  assert.equal(text.includes("ignore"), false);
  assert.match(text, /制度のお知らせ/);
  assert.match(text, /対象者は窓口で確認できます。/);
});

test("source URLs include fallback RSSHub instances after the primary URL", () => {
  assert.deepEqual(getSourceUrls({ url: "https://rsshub.app/nhk/news_web_easy", fallbackUrls: ["https://rsshub.example/nhk/news_web_easy"] }), [
    "https://rsshub.app/nhk/news_web_easy",
    "https://rsshub.example/nhk/news_web_easy",
  ]);
});

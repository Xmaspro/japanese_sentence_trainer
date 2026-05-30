const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ARCHIVE = path.join(ROOT, "content_archive");
const SOURCES = path.join(ARCHIVE, "sources.json");

function parseRssItems(xml, source) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
    .map((match) => match[0])
    .map((itemXml) =>
      normalizeNewsItem({
        title: readTag(itemXml, "title"),
        url: readTag(itemXml, "link"),
        description: stripHtml(readTag(itemXml, "description")),
        publishedAt: parsePubDate(readTag(itemXml, "pubDate")),
        sourceId: source.id,
        sourceLabel: source.label,
        canFullTextPractice: Boolean(source.fullText),
        license: source.license,
      }),
    )
    .filter((item) => item.title && item.url);
}

function normalizeNewsItem(item) {
  return {
    id: stableId(`${item.sourceId}:${item.url || item.title}`),
    sourceId: item.sourceId,
    sourceLabel: item.sourceLabel,
    title: decodeXml(String(item.title || "")).trim(),
    url: decodeXml(String(item.url || "")).trim(),
    description: decodeXml(String(item.description || "")).trim(),
    fullText: decodeXml(String(item.fullText || "")).trim(),
    canFullTextPractice: Boolean(item.canFullTextPractice && item.fullText),
    license: item.license || "",
    publishedAt: item.publishedAt || new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  };
}

function buildTrainerItems(items, dateKey) {
  return dedupeByUrl(items).map((item, index) => {
    const title = cleanupTitle(item.title);
    return {
      id: `news-${dateKey}-${String(index + 1).padStart(3, "0")}-${item.id}`,
      source: "mainstream_news_rss",
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel,
      date: dateKey,
      scene: "news",
      course: "news",
      level: estimateNewsLevel(title),
      zh: `新闻标题理解：${item.sourceLabel}`,
      ja: title,
      kana: "",
      pattern: detectPattern(title),
      patternNeedle: detectPatternNeedle(title),
      particlePrompt: buildParticlePrompt(title),
      particleAnswer: detectParticles(title),
      tags: ["每日新闻", item.sourceLabel],
      sourceUrl: item.url,
      title,
      fullText: item.canFullTextPractice ? item.fullText : "",
      canFullTextPractice: Boolean(item.canFullTextPractice && item.fullText),
      license: item.license || "",
      notes: [
        ["来源", item.sourceLabel],
        ["发布时间", item.publishedAt],
        ["说明", item.canFullTextPractice ? "该来源允许全文再利用，保存全文用于听读练习。" : "保存标题、URL与短摘要，不保存新闻全文。"],
      ],
    };
  });
}

async function fetchDailyNews(options = {}) {
  const archiveDir = path.resolve(options.archiveDir || ARCHIVE);
  const dateKey = options.dateKey || todayKey();
  const config = JSON.parse(fs.readFileSync(options.sourcesPath || SOURCES, "utf8"));
  const dayRawDir = path.join(archiveDir, "raw", dateKey);
  const dayProcessedDir = path.join(archiveDir, "processed", dateKey);
  fs.mkdirSync(dayRawDir, { recursive: true });
  fs.mkdirSync(dayProcessedDir, { recursive: true });
  fs.mkdirSync(path.join(archiveDir, "logs"), { recursive: true });

  const rawItems = [];
  const log = [];
  for (const source of config.sources) {
    try {
      const { xml, url } = await fetchSourceXml(source);
      fs.writeFileSync(path.join(dayRawDir, `${source.id}.xml`), xml, "utf8");
      let items = parseRssItems(xml, source).slice(0, config.maxItemsPerSource ?? 30);
      items = await enrichFullTextItems(items, source);
      rawItems.push(...items);
      log.push({ source: source.id, ok: true, count: items.length, url });
    } catch (error) {
      log.push({ source: source.id, ok: false, error: error.message });
    }
  }

  const deduped = dedupeByUrl(rawItems);
  const trainerItems = buildTrainerItems(deduped, dateKey);
  const dailyBundle = {
    generatedAt: new Date().toISOString(),
    date: dateKey,
    sourcePolicy: "Mainstream RSS sources store titles, URLs, timestamps, and short RSS descriptions only. Full text is stored only for sources configured as reusable/open-license.",
    rawCount: rawItems.length,
    itemCount: trainerItems.length,
    rawItems: deduped,
    trainerItems,
  };

  fs.writeFileSync(path.join(dayProcessedDir, "news_items.json"), `${JSON.stringify(dailyBundle, null, 2)}\n`, "utf8");
  writeRollingTrainerBundle(archiveDir, config.retentionDays ?? 10);
  pruneArchive(archiveDir, config.retentionDays ?? 10);
  fs.writeFileSync(path.join(archiveDir, "logs", `${dateKey}.json`), `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return dailyBundle;
}

function writeRollingTrainerBundle(archiveDir, retentionDays = 10) {
  const processed = path.join(archiveDir, "processed");
  const days = fs.existsSync(processed)
    ? fs.readdirSync(processed).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort().slice(-retentionDays)
    : [];
  const items = [];
  for (const day of days) {
    const file = path.join(processed, day, "news_items.json");
    if (!fs.existsSync(file)) continue;
    const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
    items.push(...(bundle.trainerItems ?? []));
  }
  fs.writeFileSync(
    path.join(archiveDir, "trainer_items.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), days, items }, null, 2)}\n`,
    "utf8",
  );
  return { days, items };
}

function pruneArchive(archiveDir, retentionDays) {
  for (const section of ["raw", "processed"]) {
    const dir = path.join(archiveDir, section);
    if (!fs.existsSync(dir)) continue;
    for (const day of pruneRollingDays(fs.readdirSync(dir), retentionDays)) {
      fs.rmSync(path.join(dir, day), { recursive: true, force: true });
    }
  }
}

function pruneRollingDays(days, retentionDays) {
  return days.filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort().slice(0, Math.max(0, days.length - retentionDays));
}

async function fetchSourceXml(source) {
  const errors = [];
  for (const url of getSourceUrls(source)) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 japanese-sentence-trainer/1.0",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { xml: await response.text(), url };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(errors.join("; "));
}

function getSourceUrls(source) {
  return [source.url, ...(source.fallbackUrls || [])].filter(Boolean);
}

async function enrichFullTextItems(items, source) {
  if (!source.fullText) return items;
  const enriched = [];
  for (const item of items) {
    const fullText =
      source.extractor === "mediawikiExtract" && source.apiUrl
        ? await fetchMediaWikiExtract(source.apiUrl, item.title)
        : source.extractor === "genericHtmlText"
          ? await fetchGenericHtmlText(item.url, source)
          : "";
    enriched.push(
      normalizeNewsItem({
        ...item,
        fullText,
        canFullTextPractice: Boolean(fullText),
        license: source.license,
      }),
    );
  }
  return enriched;
}

async function fetchGenericHtmlText(url, source) {
  const response = await fetch(url, { headers: { "User-Agent": "japanese-sentence-trainer/1.0" } });
  if (!response.ok) return "";
  return extractReadableTextFromHtml(await response.text(), source);
}

async function fetchMediaWikiExtract(apiUrl, title) {
  const url = new URL(apiUrl);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exsectionformat", "plain");
  url.searchParams.set("format", "json");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);
  const response = await fetch(url, { headers: { "User-Agent": "japanese-sentence-trainer/1.0" } });
  if (!response.ok) return "";
  const data = await response.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  return cleanupArticleText(pages[0]?.extract || "");
}

function cleanupArticleText(text) {
  return String(text || "")
    .replace(/==+[^=\n]+==+/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function extractReadableTextFromHtml(html, source = {}) {
  const mainMatch =
    String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
    String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
    String(html).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const scoped = mainMatch ? mainMatch[1] : String(html);
  return decodeXml(
    scoped
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
      .replace(/<nav\b[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer\b[\s\S]*?<\/footer>/gi, "")
      .replace(/<(h[1-3]|p|li|br)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  )
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^(メニュー|本文へ|検索|ページの先頭)/.test(line))
    .join("\n")
    .slice(0, source.maxFullTextChars ?? 12000);
}

function splitArticleIntoSentences(text) {
  return String(text || "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .match(/[^。！？!?]+[。！？!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 6) ?? [];
}

function readTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "") : "";
}

function parsePubDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function stripHtml(value) {
  return String(value).replace(/<[^>]*>/g, "");
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function cleanupTitle(value) {
  return String(value).replace(/\s+/g, " ").replace(/[|｜].*$/, "").trim();
}

function dedupeByUrl(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = item.url || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function detectParticles(ja) {
  return [...ja.matchAll(/[はがをにでとのもへ]/g)].map((match) => match[0]).slice(0, 4);
}

function buildParticlePrompt(ja) {
  let count = 0;
  return ja.replace(/[はがをにでとのもへ]/g, (particle) => {
    count += 1;
    return count <= 4 ? "（　）" : particle;
  });
}

function detectPattern(ja) {
  if (ja.includes("へ")) return "へ";
  if (ja.includes("で")) return "で";
  if (ja.includes("に")) return "に";
  if (ja.includes("を")) return "を";
  return "新闻标题";
}

function detectPatternNeedle(ja) {
  return detectPattern(ja);
}

function estimateNewsLevel(title) {
  if (/政策|経済|市場|政府|調査|発表|容疑|影響|協議|制度/.test(title)) return "N2";
  if (title.length >= 24) return "N3";
  return "N4";
}

function stableId(value) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

if (require.main === module) {
  fetchDailyNews()
    .then((bundle) => {
      console.log(`Fetched ${bundle.itemCount} trainer news items for ${bundle.date}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  parseRssItems,
  normalizeNewsItem,
  buildTrainerItems,
  extractReadableTextFromHtml,
  getSourceUrls,
  splitArticleIntoSentences,
  fetchDailyNews,
  writeRollingTrainerBundle,
  pruneRollingDays,
};

const {
  dedupeParagraphs,
  normalizeEditorialUrl,
  prependLeadParagraph,
} = require("./asahi_editorial_fetcher.js");

const NIKKEI_LIST_URL = "https://www.nikkei.com/opinion/editorial/";
const NIKKEI_ORIGIN = "https://www.nikkei.com";
const USER_AGENT = "Mozilla/5.0 japanese-sentence-trainer/1.0 (personal study)";

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, ""))
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/\u3000+/g, "\u3000")
    .trim();
}

function publishDateKeyFromIso(iso, fallbackDate = "") {
  const raw = String(iso || "").trim();
  if (!raw) return fallbackDate;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fallbackDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isNoiseParagraph(text) {
  if (!text) return true;
  if (text.length < 12) return true;
  if (/朝夕刊や電子版|記事共有や会議資料|ご希望の方は|有料会員|続きを読む|関連記事/.test(text)) return true;
  return false;
}

function parseNikkeiEditorialList(html) {
  const items = [];
  const seen = new Set();
  const cardPattern = /<article class="(?:headlineCard|defaultCard)[^"]*">([\s\S]*?)<\/article>/gi;

  for (const match of html.matchAll(cardPattern)) {
    const block = match[1];
    const path = block.match(/href="(\/article\/[^"]+)"/)?.[1];
    const title = stripTags(block.match(/class="titleLink[^"]*">([\s\S]*?)<\/a>/i)?.[1] || "");
    const publishedAt = block.match(/dateTime="([^"]+)"/i)?.[1] || "";
    const lead = stripTags(block.match(/class="excerpt_[^"]*">([\s\S]*?)<\/div>/i)?.[1] || "");
    if (!path || !title || !title.includes("社説")) continue;

    const url = `${NIKKEI_ORIGIN}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);

    items.push({
      title,
      url,
      lead,
      publishedAt,
      publishedLabel: publishDateKeyFromIso(publishedAt),
      newspaper: "nikkei",
      newspaperLabel: "日本経済新聞",
    });
  }

  return items;
}

function filterListItemsForDate(items, dateKey) {
  return items.filter((item) => publishDateKeyFromIso(item.publishedAt, item.publishedLabel) === dateKey);
}

function extractJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    const payload = JSON.parse(match[1]);
    const graph = payload["@graph"] || [payload];
    return graph.find((node) => node["@type"] === "NewsArticle") || graph[0] || null;
  } catch {
    return null;
  }
}

function parseNikkeiEditorialArticle(html, articleUrl = "") {
  const jsonLd = extractJsonLd(html);
  const title =
    stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") ||
    jsonLd?.headline ||
    "";
  const publishedAt = jsonLd?.datePublished || "";

  const paragraphs = dedupeParagraphs(
    [...html.matchAll(/<p class="paragraph_p[^"]*">([\s\S]*?)<\/p>/gi)]
      .map((match) => stripTags(match[1]))
      .filter((text) => !isNoiseParagraph(text)),
  );

  const withLead = dedupeParagraphs(prependLeadParagraph(paragraphs, jsonLd?.description || paragraphs[0] || ""));

  return {
    title,
    publishedAt,
    url: jsonLd?.mainEntityOfPage?.["@id"] || articleUrl,
    lead: withLead[0] || "",
    paragraphs: withLead,
    fullText: withLead.join("\n\n"),
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

function buildFetchedRecord({ listItem, article, dateKey, articleUrl = "" }) {
  const paragraphs = prependLeadParagraph(article.paragraphs, listItem?.lead || article.lead);
  return {
    date: dateKey,
    source: "nikkei",
    section: "社説",
    title: article.title || listItem?.title || "",
    url: article.url || listItem?.url || articleUrl || "",
    publishedAt: article.publishedAt || listItem?.publishedAt || "",
    fetchedAt: new Date().toISOString(),
    lead: paragraphs[0] || listItem?.lead || "",
    paragraphs,
    fullText: paragraphs.join("\n\n"),
    storagePolicy: "local-only personal study archive; do not publish or redistribute",
  };
}

async function listNikkeiEditorialsForDate(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date: ${dateKey}`);
  }
  const html = await fetchText(NIKKEI_LIST_URL);
  return filterListItemsForDate(parseNikkeiEditorialList(html), dateKey);
}

async function fetchNikkeiEditorialForDate(options = {}) {
  const dateKey = options.date || publishDateKeyFromIso(new Date().toISOString());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date: ${dateKey}`);
  }

  let listItem = null;
  if (!options.url) {
    const items = await listNikkeiEditorialsForDate(dateKey);
    listItem = items[0] || null;
    if (!listItem) {
      throw new Error(`No Nikkei editorial found for ${dateKey}`);
    }
  }

  const articleUrl = normalizeEditorialUrl(options.url || listItem?.url || "");
  if (!articleUrl) {
    throw new Error("Missing article URL");
  }

  const articleHtml = await fetchText(articleUrl);
  const article = parseNikkeiEditorialArticle(articleHtml, articleUrl);
  if (!article.paragraphs.length) {
    throw new Error(`No article paragraphs extracted from ${articleUrl}`);
  }

  const fetchedRecord = buildFetchedRecord({ listItem, article, dateKey, articleUrl });
  return {
    dateKey,
    fetchedRecord,
    listItem,
  };
}

module.exports = {
  NIKKEI_LIST_URL,
  buildFetchedRecord,
  fetchNikkeiEditorialForDate,
  filterListItemsForDate,
  listNikkeiEditorialsForDate,
  parseNikkeiEditorialArticle,
  parseNikkeiEditorialList,
  publishDateKeyFromIso,
};
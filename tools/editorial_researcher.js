const USER_AGENT = "Mozilla/5.0 japanese-sentence-trainer/1.0 (personal study)";

const TRUSTED_HOSTS = [
  "asahi.com",
  "asahicom.jp",
  "nikkei.com",
  "nhk.or.jp",
  "yahoo.co.jp",
  "mainichi.jp",
  "yomiuri.co.jp",
  "gov.go.jp",
  "wikipedia.org",
];

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function isTrustedUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return TRUSTED_HOSTS.some((trusted) => host === trusted || host.endsWith(`.${trusted}`));
  } catch {
    return false;
  }
}

function planResearchQueries(article) {
  const title = String(article.title || "").replace(/^（社説）/, "").trim();
  const lead = article.paragraphs?.[0] || "";
  const text = [title, lead, ...(article.paragraphs || []).slice(0, 3)].join(" ");
  const entities = [...text.matchAll(/[一-龯ぁ-んァ-ン]{2,12}(?:国民会議|会議|法案|政策|内閣|首相)/g)]
    .map((match) => match[0])
    .slice(0, 3);
  const queries = [];
  if (title) queries.push(`${title} 背景`);
  for (const entity of entities) {
    if (!queries.some((query) => query.includes(entity))) queries.push(`${entity} 2026`);
  }
  if (queries.length < 2 && title) queries.push(`${title} NHK`);
  const needed = text.length < 900 || /国民会議|会議|法案|政策/.test(text);
  return {
    needed,
    queries: [...new Set(queries)].slice(0, 4),
  };
}

async function searchWikipediaJa(query) {
  const searchUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=3&srsearch=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) return [];
  const data = await response.json();
  const hits = data.query?.search || [];
  const results = [];
  for (const hit of hits.slice(0, 2)) {
    const pageUrl = `https://ja.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`;
    results.push({
      title: hit.title,
      url: pageUrl,
      snippet: stripTags(hit.snippet),
      provider: "wikipedia-ja",
    });
  }
  return results;
}

async function searchDuckDuckGoLite(query) {
  const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  if (!response.ok) return [];
  const html = await response.text();
  const results = [];
  const rowPattern = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td class="result-snippet">([\s\S]*?)<\/td>/gi;
  for (const match of html.matchAll(rowPattern)) {
    const url = decodeHtml(match[1]);
    const title = stripTags(match[2]);
    const snippet = stripTags(match[3]);
    if (!url || !title || !isTrustedUrl(url)) continue;
    results.push({ title, url, snippet, provider: "duckduckgo-lite" });
    if (results.length >= 3) break;
  }
  return results;
}

async function researchEditorialTopic(article, options = {}) {
  const plan = planResearchQueries(article);
  if (!plan.needed && !options.force) {
    return { plan, sources: [], hitCount: 0 };
  }

  const collected = [];
  const errors = [];
  for (const query of plan.queries) {
    try {
      const [wiki, web] = await Promise.all([
        searchWikipediaJa(query).catch((error) => {
          errors.push(`wikipedia:${query}:${error.message}`);
          return [];
        }),
        searchDuckDuckGoLite(query).catch((error) => {
          errors.push(`ddg:${query}:${error.message}`);
          return [];
        }),
      ]);
      collected.push(...wiki, ...web);
    } catch (error) {
      errors.push(`${query}:${error.message}`);
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of collected) {
    const key = item.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const sources = deduped.slice(0, 8).map((item, index) => ({
    id: `src-web-${String(index + 1).padStart(3, "0")}`,
    type: "web",
    label: item.title,
    url: item.url,
    snippet: item.snippet,
    provider: item.provider,
    retrievedAt: new Date().toISOString(),
  }));

  return {
    plan,
    sources,
    hitCount: sources.length,
    errors,
  };
}

function buildRetrievalContext(article, webSources) {
  const articleSource = {
    id: "src-article",
    type: "article",
    label: "社说正文",
    url: article.url || "",
    snippet: (article.paragraphs || []).join("\n"),
  };
  return {
    articleSource,
    webSources,
    textBlock: [
      "【社说正文】",
      articleSource.snippet,
      "",
      "【联网检索摘要】",
      ...webSources.map((source) => `- [${source.id}] ${source.label}\n  URL: ${source.url}\n  摘要: ${source.snippet}`),
    ].join("\n"),
  };
}

module.exports = {
  buildRetrievalContext,
  isTrustedUrl,
  planResearchQueries,
  researchEditorialTopic,
};
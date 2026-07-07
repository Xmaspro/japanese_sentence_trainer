const {
  fetchAsahiEditorialForDate,
  parseAsahiEditorialList,
  pickListItemForDate,
} = require("./asahi_editorial_fetcher.js");
const {
  fetchNikkeiEditorialForDate,
  filterListItemsForDate,
  listNikkeiEditorialsForDate,
  parseNikkeiEditorialList,
  publishDateKeyFromIso,
} = require("./nikkei_editorial_fetcher.js");

const USER_AGENT = "Mozilla/5.0 japanese-sentence-trainer/1.0 (personal study)";

const EDITORIAL_SOURCES = {
  asahi: {
    id: "asahi",
    label: "朝日新聞",
    listUrl: "https://www.asahi.com/rensai/list.html?id=16",
  },
  nikkei: {
    id: "nikkei",
    label: "日本経済新聞",
    listUrl: "https://www.nikkei.com/opinion/editorial/",
  },
};

function normalizeSource(source) {
  const key = String(source || "asahi").trim().toLowerCase();
  if (!EDITORIAL_SOURCES[key]) {
    throw new Error(`未知新闻源：${source}。请选择朝日或日经。`);
  }
  return key;
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

function toListItem(item, sourceKey) {
  const meta = EDITORIAL_SOURCES[sourceKey];
  return {
    title: item.title,
    url: item.url,
    lead: item.lead || "",
    publishedAt: item.publishedAt || "",
    publishedLabel: item.publishedLabel || publishDateKeyFromIso(item.publishedAt),
    newspaper: sourceKey,
    newspaperLabel: item.newspaperLabel || meta.label,
  };
}

async function listAsahiEditorialsForDate(dateKey) {
  const html = await fetchText(EDITORIAL_SOURCES.asahi.listUrl);
  const items = parseAsahiEditorialList(html);
  return items
    .filter((item) => item.publishedAt.startsWith(dateKey))
    .map((item) => toListItem(item, "asahi"));
}

async function listEditorialsForDate({ source = "asahi", date } = {}) {
  const sourceKey = normalizeSource(source);
  const dateKey = String(date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date: ${dateKey}`);
  }

  if (sourceKey === "nikkei") {
    const items = await listNikkeiEditorialsForDate(dateKey);
    return items.map((item) => toListItem(item, "nikkei"));
  }

  return listAsahiEditorialsForDate(dateKey);
}

async function fetchEditorialForDate({ source = "asahi", date, url, dryRun = true } = {}) {
  const sourceKey = normalizeSource(source);
  if (sourceKey === "nikkei") {
    const result = await fetchNikkeiEditorialForDate({ date, url, dryRun });
    return {
      ...result,
      source: sourceKey,
      newspaperLabel: EDITORIAL_SOURCES.nikkei.label,
    };
  }

  const result = await fetchAsahiEditorialForDate({ date, url, dryRun });
  return {
    dateKey: result.dateKey,
    fetchedRecord: result.fetchedRecord,
    source: sourceKey,
    newspaperLabel: EDITORIAL_SOURCES.asahi.label,
  };
}

module.exports = {
  EDITORIAL_SOURCES,
  fetchEditorialForDate,
  filterListItemsForDate,
  listAsahiEditorialsForDate,
  listEditorialsForDate,
  normalizeSource,
  parseNikkeiEditorialList,
  publishDateKeyFromIso,
};
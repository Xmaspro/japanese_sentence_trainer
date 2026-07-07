const fs = require("node:fs");
const path = require("node:path");
const { normalizeEditorialUrl } = require("./asahi_editorial_fetcher.js");

const ROOT = path.resolve(__dirname, "..");
const BUNDLES_DIR = path.join(ROOT, "phase2_editorial_training", "bundles");
const MAX_TITLE_FILENAME_LENGTH = 120;

function sanitizeTitleForFilename(title) {
  return String(title || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, MAX_TITLE_FILENAME_LENGTH);
}

function isLegacyBundleFileId(bundleFileId) {
  const id = String(bundleFileId || "").trim();
  return id === "editorial" || id.startsWith("url-");
}

function parsePublishDateKey(publishedAt, fallbackDate = "") {
  const match = String(publishedAt || "").match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const fallback = String(fallbackDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fallback)) return fallback;
  return "";
}

function bundlePath({ publishDate, bundleFileId }) {
  return path.join(BUNDLES_DIR, publishDate, `${bundleFileId}.json`);
}

function formatBundleRef(bundle) {
  const publishDate = bundle?.date || "";
  const bundleFileId = bundle?.id || "";
  return publishDate && bundleFileId ? `${publishDate}/${bundleFileId}` : bundleFileId;
}

function listPublishDates() {
  if (!fs.existsSync(BUNDLES_DIR)) return [];
  const dates = new Set();
  for (const name of fs.readdirSync(BUNDLES_DIR)) {
    if (name === ".gitkeep") continue;
    const fullPath = path.join(BUNDLES_DIR, name);
    if (/^\d{4}-\d{2}-\d{2}$/.test(name)) {
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          dates.add(name);
          continue;
        }
      } catch {
        continue;
      }
    }
    const legacyMatch = name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
    if (legacyMatch) dates.add(legacyMatch[1]);
    const legacyUrlMatch = name.match(/^url-[^/]+\.json$/);
    if (legacyUrlMatch) {
      try {
        const bundle = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        const publishDate = parsePublishDateKey(bundle.source?.publishedAt, bundle.date);
        if (publishDate) dates.add(publishDate);
      } catch {
        // ignore invalid legacy files
      }
    }
  }
  return [...dates].sort().reverse();
}

function listBundleDates() {
  return listPublishDates();
}

function listBundlesInPublishDate(publishDate) {
  const dirPath = path.join(BUNDLES_DIR, publishDate);
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return [];
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""));
}

function listBundleIds() {
  const refs = [];
  for (const publishDate of listPublishDates()) {
    for (const bundleFileId of listBundlesInPublishDate(publishDate)) {
      refs.push(`${publishDate}/${bundleFileId}`);
    }
  }
  return refs.sort().reverse();
}

function readBundleFileRaw(publishDate, bundleFileId) {
  const filePath = bundlePath({ publishDate, bundleFileId });
  if (!fs.existsSync(filePath)) return null;
  const bundle = JSON.parse(fs.readFileSync(filePath, "utf8"));
  bundle.id = bundle.id || bundleFileId;
  bundle.date = bundle.date || publishDate;
  return { bundle, filePath };
}

function normalizeUrlForMatch(url) {
  if (!url) return "";
  try {
    return normalizeEditorialUrl(url).split("?")[0];
  } catch {
    return String(url).trim().split("?")[0];
  }
}

function urlsMatch(left, right) {
  const a = normalizeUrlForMatch(left);
  const b = normalizeUrlForMatch(right);
  return Boolean(a && b && a === b);
}

function removeStaleBundleFile(previousRef, bundle) {
  if (!previousRef?.id || !previousRef?.date) return;
  if (previousRef.id === bundle.id && previousRef.date === bundle.date) return;
  const oldPath = bundlePath({ publishDate: previousRef.date, bundleFileId: previousRef.id });
  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
}

function assignBundleFileName(bundle) {
  const publishDate = String(bundle.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
    throw new Error(`Invalid publish date: ${publishDate}`);
  }

  const base = sanitizeTitleForFilename(bundle.source?.title) || "untitled";
  const dirPath = path.join(BUNDLES_DIR, publishDate);
  if (fs.existsSync(dirPath)) {
    for (const bundleFileId of listBundlesInPublishDate(publishDate)) {
      const existing = readBundleFileRaw(publishDate, bundleFileId);
      if (!existing) continue;
      if (urlsMatch(existing.bundle.source?.url, bundle.source?.url) && !isLegacyBundleFileId(bundleFileId)) {
        bundle.id = bundleFileId;
        return bundleFileId;
      }
    }
  }

  let candidate = base;
  let index = 2;
  while (fs.existsSync(bundlePath({ publishDate, bundleFileId: candidate }))) {
    const existing = readBundleFileRaw(publishDate, candidate);
    if (
      existing &&
      urlsMatch(existing.bundle.source?.url, bundle.source?.url) &&
      !isLegacyBundleFileId(candidate)
    ) {
      bundle.id = candidate;
      return candidate;
    }
    candidate = `${base}-${index}`;
    index += 1;
  }

  bundle.id = candidate;
  return candidate;
}

function maybeMigrateLegacyBundleFile(publishDate, bundleFileId, bundle) {
  if (!isLegacyBundleFileId(bundleFileId) || !bundle.source?.title) return bundle;
  const previousRef = { date: publishDate, id: bundleFileId };
  assignBundleFileName(bundle);
  writeBundle(bundle, { previousRef });
  return bundle;
}

function tryMigrateLegacyFlatBundle(legacyName) {
  const legacyPath = path.join(BUNDLES_DIR, `${legacyName}.json`);
  if (!fs.existsSync(legacyPath)) return null;

  const bundle = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
  const publishDate = parsePublishDateKey(bundle.source?.publishedAt, bundle.date || legacyName);
  if (!publishDate) return null;

  bundle.date = publishDate;
  if (!bundle.source?.title && legacyName.startsWith("url-")) {
    bundle.id = legacyName;
    writeBundle(bundle);
  } else {
    assignBundleFileName(bundle);
    writeBundle(bundle);
  }
  fs.unlinkSync(legacyPath);
  return bundle;
}

function readBundle(ref) {
  if (!ref) return null;

  if (typeof ref === "string") {
    const migrated = tryMigrateLegacyFlatBundle(ref);
    if (migrated) return migrated;
    if (ref.startsWith("url-")) return findBundleByFileId(ref);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ref)) return findDefaultBundleForDate(ref);
    return null;
  }

  const publishDate = String(ref.publishDate || "").trim();
  const bundleFileId = String(ref.bundleFileId || "").trim();
  if (!publishDate || !bundleFileId) return null;

  const raw = readBundleFileRaw(publishDate, bundleFileId);
  if (!raw) {
    if (isLegacyBundleFileId(bundleFileId)) {
      const migrated = tryMigrateLegacyFlatBundle(bundleFileId);
      if (migrated) return migrated;
    }
    if (bundleFileId === "editorial") {
      const migrated = tryMigrateLegacyFlatBundle(publishDate);
      if (migrated) return migrated;
    }
    return null;
  }

  return maybeMigrateLegacyBundleFile(publishDate, bundleFileId, raw.bundle);
}

function pickLatestBundle(bundles) {
  let best = null;
  let bestTime = "";
  for (const bundle of bundles) {
    const time = bundle.meta?.analyzedAt || bundle.meta?.fetchedAt || "";
    if (!best || time > bestTime) {
      best = bundle;
      bestTime = time;
    }
  }
  return best;
}

function findDefaultBundleForDate(publishDate) {
  const migratedFlat = tryMigrateLegacyFlatBundle(publishDate);
  if (migratedFlat) return migratedFlat;

  const bundles = [];
  for (const bundleFileId of listBundlesInPublishDate(publishDate)) {
    const bundle = readBundle({ publishDate, bundleFileId });
    if (bundle) bundles.push(bundle);
  }
  if (!bundles.length) return null;
  if (bundles.length === 1) return bundles[0];
  return pickLatestBundle(bundles);
}

function findBundleByFileId(bundleFileId) {
  const targetId = String(bundleFileId || "").trim();
  if (!targetId) return null;

  const migrated = tryMigrateLegacyFlatBundle(targetId);
  if (migrated) return migrated;

  for (const publishDate of listPublishDates()) {
    const bundle = readBundle({ publishDate, bundleFileId: targetId });
    if (bundle) return bundle;
  }
  return null;
}

function findBundleByUrl(url) {
  const targetUrl = normalizeUrlForMatch(url);
  if (!targetUrl) return null;

  for (const publishDate of listPublishDates()) {
    for (const bundleFileId of listBundlesInPublishDate(publishDate)) {
      const bundle = readBundle({ publishDate, bundleFileId });
      if (bundle && urlsMatch(bundle.source?.url, targetUrl)) return bundle;
    }
  }

  return findBundleByFileId(`url-${targetUrl.split("/").pop()?.replace(/\.html$/i, "") || ""}`);
}

function listBundleSummariesForDate(publishDate) {
  const dateKey = String(publishDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [];

  tryMigrateLegacyFlatBundle(dateKey);

  const summaries = [];
  const seen = new Set();
  for (const bundleFileId of listBundlesInPublishDate(dateKey)) {
    const bundle = readBundle({ publishDate: dateKey, bundleFileId });
    if (!bundle || seen.has(bundle.id)) continue;
    seen.add(bundle.id);
    summaries.push(bundleToSummary(bundle));
  }

  summaries.sort((a, b) =>
    String(b.analyzedAt || b.fetchedAt || "").localeCompare(String(a.analyzedAt || a.fetchedAt || "")),
  );
  return summaries;
}

function bundleToSummary(bundle) {
  return {
    id: bundle.id || "",
    date: bundle.date || "",
    title: bundle.source?.title || bundle.id || "未命名",
    url: bundle.source?.url || "",
    newspaperLabel: bundle.source?.newspaperLabel || bundle.source?.newspaper || "",
    status: bundle.meta?.status || "empty",
    analyzedAt: bundle.meta?.analyzedAt || "",
    fetchedAt: bundle.meta?.fetchedAt || "",
  };
}

function findBundleForRequest({ date, url, id } = {}) {
  const articleUrl = String(url || "").trim();
  if (articleUrl) return findBundleByUrl(articleUrl);
  const publishDate = String(date || "").trim();
  const bundleId = String(id || "").trim();
  if (publishDate && bundleId) {
    return readBundle({ publishDate, bundleFileId: bundleId });
  }
  if (!publishDate) return null;
  return findDefaultBundleForDate(publishDate);
}

function readPrimaryBundleForDate(publishDate) {
  return findDefaultBundleForDate(publishDate);
}

function writeBundle(bundle, options = {}) {
  const publishDate = String(bundle.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
    throw new Error(`Invalid publish date: ${publishDate}`);
  }

  if (!bundle.id || isLegacyBundleFileId(bundle.id)) {
    assignBundleFileName(bundle);
  }

  bundle.date = publishDate;
  const filePath = bundlePath({ publishDate, bundleFileId: bundle.id });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  if (options.previousRef) removeStaleBundleFile(options.previousRef, bundle);
  return filePath;
}

function shouldSyncLegacyFiles(bundle, options = {}) {
  return !options.manualUrl;
}

function createEmptyBundle(publishDate, bundleFileId = "") {
  return {
    id: bundleFileId,
    date: publishDate,
    source: { newspaper: "asahi", newspaperLabel: "朝日新聞", section: "社説", url: "", title: "", publishedAt: "" },
    article: { lead: "", paragraphs: [], fullText: "" },
    analysis: {
      summaryZh: "",
      vocab: [],
      grammar: [],
      lectureZh: {
        eventBackground: "",
        timeline: [],
        timelineNarrative: "",
        topicContext: "",
        newspaperStance: "",
        argumentStructure: "",
        readingTips: "",
      },
    },
    speaking: {},
    sources: [],
    researchMeta: { needed: false, queries: [], hitCount: 0, skippedFacts: [] },
    meta: { fetchedAt: "", analyzedAt: "", model: "", analyzerVersion: 1, status: "empty" },
  };
}

module.exports = {
  BUNDLES_DIR,
  assignBundleFileName,
  bundlePath,
  createEmptyBundle,
  findBundleByFileId,
  findBundleByUrl,
  findBundleForRequest,
  findDefaultBundleForDate,
  formatBundleRef,
  listBundleDates,
  listBundleIds,
  listBundleSummariesForDate,
  listPublishDates,
  parsePublishDateKey,
  readBundle,
  readPrimaryBundleForDate,
  sanitizeTitleForFilename,
  shouldSyncLegacyFiles,
  writeBundle,
};
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const BUNDLES_DIR = path.join(ROOT, "phase2_editorial_training", "bundles");

function bundlePath(dateKey) {
  return path.join(BUNDLES_DIR, `${dateKey}.json`);
}

function listBundleDates() {
  if (!fs.existsSync(BUNDLES_DIR)) return [];
  return fs
    .readdirSync(BUNDLES_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.replace(/\.json$/, ""))
    .sort()
    .reverse();
}

function readBundle(dateKey) {
  const filePath = bundlePath(dateKey);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeBundle(bundle) {
  fs.mkdirSync(BUNDLES_DIR, { recursive: true });
  const filePath = bundlePath(bundle.date);
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return filePath;
}

function createEmptyBundle(dateKey) {
  return {
    date: dateKey,
    source: { newspaper: "asahi", newspaperLabel: "朝日新聞", section: "社説", url: "", title: "" },
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
  bundlePath,
  createEmptyBundle,
  listBundleDates,
  readBundle,
  writeBundle,
};
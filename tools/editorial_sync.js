const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FETCHED = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "fetched");
const READINGS = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "text");
const SPEAKING = path.join(ROOT, "phase2_editorial_training", "editorial_speaking", "logs");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function syncLegacyFiles(bundle) {
  const dateKey = bundle.date;
  const paths = {
    fetched: path.join(FETCHED, `${dateKey}.json`),
    reading: path.join(READINGS, `${dateKey}.json`),
    speaking: path.join(SPEAKING, `${dateKey}.json`),
  };

  writeJson(paths.fetched, {
    date: dateKey,
    source: bundle.source?.newspaper || "asahi",
    section: bundle.source?.section || "社説",
    title: bundle.source?.title || "",
    url: bundle.source?.url || "",
    publishedAt: bundle.source?.publishedAt || "",
    fetchedAt: bundle.meta?.fetchedAt || new Date().toISOString(),
    lead: bundle.article?.lead || "",
    paragraphs: bundle.article?.paragraphs || [],
    fullText: bundle.article?.fullText || "",
    storagePolicy: "local-only personal study archive; do not publish or redistribute",
  });

  const readingTemplate = readJsonIfExists(
    path.join(READINGS, "_template.json"),
    { reading: { vocab: [] }, extractedText: {} },
  );
  const readingExisting = readJsonIfExists(paths.reading, readingTemplate);
  const keyParagraphs = (bundle.article?.paragraphs || []).slice(0, 3);
  writeJson(paths.reading, {
    ...readingExisting,
    date: dateKey,
    newspaper: bundle.source?.newspaper || "asahi",
    newspaperLabel: bundle.source?.newspaperLabel || "朝日新聞",
    section: bundle.source?.section || "社説",
    title: bundle.source?.title || "",
    sourceUrl: bundle.source?.url || "",
    fetchedPath: `phase2_editorial_training/editorial_readings/fetched/${dateKey}.json`,
    bundlePath: `phase2_editorial_training/bundles/${dateKey}.json`,
    extractedText: {
      ...readingExisting.extractedText,
      title: bundle.source?.title || "",
      lead: bundle.article?.lead || "",
      keyParagraphs,
      proofread: false,
      proofreadNotes: bundle.meta?.status === "ready" ? "synced from editorial bundle" : "fetched only",
    },
    reading: {
      ...readingExisting.reading,
      topic: bundle.analysis?.summaryZh ? bundle.source?.title?.replace(/^（社説）/, "") : readingExisting.reading?.topic,
      newspaperStance: bundle.analysis?.lectureZh?.newspaperStance || readingExisting.reading?.newspaperStance || "",
      keyReason: bundle.analysis?.lectureZh?.argumentStructure || readingExisting.reading?.keyReason || "",
      summaryJa: readingExisting.reading?.summaryJa || bundle.analysis?.summaryZh || "",
      readMinutes: readingExisting.reading?.readMinutes || 0,
      vocab:
        bundle.analysis?.vocab?.length > 0
          ? bundle.analysis.vocab.map((item) => ({
              lemma: item.lemma || "",
              reading: item.reading || "",
              meaningZh: item.meaningZh || "",
              exampleJa: item.exampleJa || "",
            }))
          : readingExisting.reading?.vocab || [],
    },
  });

  const speakingTemplate = readJsonIfExists(path.join(SPEAKING, "_template.json"), { exercises: {} });
  const speakingExisting = readJsonIfExists(paths.speaking, speakingTemplate);
  writeJson(paths.speaking, {
    ...speakingExisting,
    date: dateKey,
    linkedReading: `phase2_editorial_training/editorial_readings/text/${dateKey}.json`,
    newspaper: bundle.source?.newspaper || "asahi",
    source: "editorial-bundle-sync",
    exercises: {
      ...speakingExisting.exercises,
      ...bundle.speaking,
    },
  });

  return paths;
}

module.exports = { syncLegacyFiles };
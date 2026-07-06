const { fetchAsahiEditorialForDate, buildSpeakingExercises } = require("./asahi_editorial_fetcher.js");
const { analyzeEditorial, DEFAULT_MODEL } = require("./editorial_analyzer.js");
const { buildRetrievalContext, researchEditorialTopic } = require("./editorial_researcher.js");
const { createEmptyBundle, listBundleDates, readBundle, writeBundle } = require("./editorial_store.js");
const { syncLegacyFiles } = require("./editorial_sync.js");

async function runEditorialDay(options = {}) {
  const dateKey = options.date;
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date: ${dateKey}`);
  }

  const existing = readBundle(dateKey);
  if (existing?.meta?.status === "ready" && !options.forceFetch && !options.forceAnalyze) {
    return { bundle: existing, cached: true, steps: ["cache"] };
  }

  const steps = [];
  let bundle = existing || createEmptyBundle(dateKey);

  if (!existing?.article?.paragraphs?.length || options.forceFetch) {
    steps.push("fetching");
    const fetched = await fetchAsahiEditorialForDate({
      date: dateKey,
      dryRun: true,
    });
    const record = fetched.fetchedRecord;
    bundle.source = {
      newspaper: "asahi",
      newspaperLabel: "朝日新聞",
      section: record.section,
      url: record.url,
      title: record.title,
      publishedAt: record.publishedAt,
    };
    bundle.article = {
      lead: record.lead,
      paragraphs: record.paragraphs,
      fullText: record.fullText,
    };
    bundle.meta.fetchedAt = new Date().toISOString();
    steps.push("fetched");
  }

  if (!options.apiKey) {
    bundle.meta.status = "fetched";
    bundle.meta.analyzerVersion = 1;
    writeBundle(bundle);
    syncLegacyFiles(bundle);
    return {
      bundle,
      cached: false,
      steps,
      warning: "Missing OpenRouter API key. Article fetched; analysis skipped.",
    };
  }

  steps.push("researching");
  const research = await researchEditorialTopic(
    { title: bundle.source.title, url: bundle.source.url, paragraphs: bundle.article.paragraphs },
    { force: options.forceResearch },
  );
  const retrieval = buildRetrievalContext(
    { title: bundle.source.title, url: bundle.source.url, paragraphs: bundle.article.paragraphs },
    research.sources,
  );
  bundle.sources = [retrieval.articleSource, ...research.sources];
  bundle.researchMeta = {
    needed: research.plan.needed,
    queries: research.plan.queries,
    hitCount: research.hitCount,
    skippedFacts: [],
    errors: research.errors || [],
  };
  steps.push("researched");

  steps.push("analyzing");
  const analysis = await analyzeEditorial(
    {
      title: bundle.source.title,
      url: bundle.source.url,
      paragraphs: bundle.article.paragraphs,
    },
    retrieval,
    { apiKey: options.apiKey, model: options.model || DEFAULT_MODEL },
  );
  bundle.analysis = analysis;
  bundle.researchMeta.skippedFacts = analysis.skippedFacts;
  bundle.speaking = buildSpeakingExercises({
    title: bundle.source.title,
    paragraphs: bundle.article.paragraphs,
    dateKey,
  });
  bundle.meta.analyzedAt = new Date().toISOString();
  bundle.meta.model = options.model || DEFAULT_MODEL;
  bundle.meta.status = "ready";
  bundle.meta.analyzerVersion = 1;
  steps.push("ready");

  writeBundle(bundle);
  syncLegacyFiles(bundle);
  return { bundle, cached: false, steps };
}

module.exports = {
  listBundleDates,
  readBundle,
  runEditorialDay,
};
const { ensureSpeakingSteps, normalizeEditorialUrl } = require("./asahi_editorial_fetcher.js");
const { fetchEditorialForDate, listEditorialsForDate, normalizeSource } = require("./editorial_sources.js");
const { analyzeEditorial, DEFAULT_MODEL } = require("./editorial_analyzer.js");
const { buildRetrievalContext, researchEditorialTopic } = require("./editorial_researcher.js");
const {
  assignBundleFileName,
  createEmptyBundle,
  findBundleForRequest,
  formatBundleRef,
  listBundleDates,
  listBundleSummariesForDate,
  parsePublishDateKey,
  readBundle,
  shouldSyncLegacyFiles,
  writeBundle,
} = require("./editorial_store.js");
const { syncLegacyFiles } = require("./editorial_sync.js");

async function runEditorialDay(options = {}) {
  const dateKey = options.date;
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date: ${dateKey}`);
  }

  const source = normalizeSource(options.source);
  const articleUrl = normalizeEditorialUrl(options.url);
  const existing = findBundleForRequest({ date: dateKey, url: articleUrl });
  const previousRef = existing ? { date: existing.date, id: existing.id } : null;

  if (existing?.meta?.status === "ready" && !options.forceFetch && !options.forceAnalyze) {
    if (existing.article?.paragraphs?.length) {
      existing.speaking = ensureSpeakingSteps(existing.speaking, {
        title: existing.source?.title || "",
        paragraphs: existing.article.paragraphs,
        dateKey: existing.date,
        newspaperLabel: existing.source?.newspaperLabel || "",
      });
    }
    return { bundle: existing, bundleRef: formatBundleRef(existing), cached: true, steps: ["cache"] };
  }

  const steps = [];
  const tentativePublishDate = existing?.date || dateKey;
  let bundle = existing || createEmptyBundle(tentativePublishDate);

  if (!existing?.article?.paragraphs?.length || options.forceFetch) {
    steps.push("fetching");
    const fetched = await fetchEditorialForDate({
      source,
      date: dateKey,
      url: articleUrl || undefined,
      dryRun: true,
    });
    const record = fetched.fetchedRecord;
    const publishDate = parsePublishDateKey(record.publishedAt, dateKey);
    bundle.date = publishDate;
    bundle.source = {
      newspaper: record.source || source,
      newspaperLabel: fetched.newspaperLabel,
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
    assignBundleFileName(bundle);
    steps.push("fetched");
  }

  if (!options.apiKey) {
    bundle.meta.status = "fetched";
    bundle.meta.analyzerVersion = 1;
    writeBundle(bundle, { previousRef });
    if (shouldSyncLegacyFiles(bundle, { manualUrl: Boolean(articleUrl) })) syncLegacyFiles(bundle);
    return {
      bundle,
      bundleRef: formatBundleRef(bundle),
      cached: false,
      steps,
      warning: "Missing Gemini API key. Article fetched; analysis skipped.",
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
  const analysisResult = await analyzeEditorial(
    {
      title: bundle.source.title,
      url: bundle.source.url,
      paragraphs: bundle.article.paragraphs,
    },
    retrieval,
    {
      apiKey: options.apiKey,
      model: options.model || DEFAULT_MODEL,
      fallbackModels: options.fallbackModels,
    },
  );
  bundle.analysis = analysisResult.data;
  bundle.researchMeta.skippedFacts = analysisResult.data.skippedFacts;
  bundle.speaking = ensureSpeakingSteps(bundle.speaking, {
    title: bundle.source.title,
    paragraphs: bundle.article.paragraphs,
    dateKey: bundle.date,
    newspaperLabel: bundle.source.newspaperLabel,
  });
  bundle.meta.analyzedAt = new Date().toISOString();
  bundle.meta.model = analysisResult.model || options.model || DEFAULT_MODEL;
  bundle.meta.modelFallbackUsed = Boolean(analysisResult.fallbackUsed);
  bundle.meta.status = "ready";
  bundle.meta.analyzerVersion = 1;
  assignBundleFileName(bundle);
  steps.push("ready");

  writeBundle(bundle, { previousRef });
  if (shouldSyncLegacyFiles(bundle, { manualUrl: Boolean(articleUrl) })) syncLegacyFiles(bundle);
  return { bundle, bundleRef: formatBundleRef(bundle), cached: false, steps };
}

module.exports = {
  findBundleForRequest,
  listBundleDates,
  listBundleSummariesForDate,
  listEditorialsForDate,
  readBundle,
  runEditorialDay,
};
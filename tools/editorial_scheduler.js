const fs = require("node:fs");
const path = require("node:path");
const { resolveGeminiRuntimeConfig } = require("./gemini_config.js");
const { listEditorialsForDate } = require("./editorial_sources.js");
const { findBundleByUrl } = require("./editorial_store.js");
const { runEditorialDay } = require("./editorial_pipeline.js");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "phase2_editorial_training", "editorial_schedule.json");
const CONFIG_TEMPLATE_PATH = path.join(ROOT, "phase2_editorial_training", "editorial_schedule.template.json");
const STATE_PATH = path.join(ROOT, "phase2_editorial_training", "editorial_scheduler_state.json");
const LOG_PATH = path.join(ROOT, "phase2_editorial_training", "editorial_scheduler.log");

const DEFAULT_SCHEDULE_HOURS_JST = [6, 12, 18, 20];

function getJstParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function addDays(dateKey, offset) {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendSchedulerLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, line, "utf8");
}

function loadSchedulerConfig() {
  const fileConfig = readJsonIfExists(CONFIG_PATH, readJsonIfExists(CONFIG_TEMPLATE_PATH, {}));
  const runtime = resolveGeminiRuntimeConfig();

  return {
    enabled: fileConfig.enabled !== false,
    sources: Array.isArray(fileConfig.sources) && fileConfig.sources.length ? fileConfig.sources : ["asahi", "nikkei"],
    scheduleHoursJst: Array.isArray(fileConfig.scheduleHoursJst) && fileConfig.scheduleHoursJst.length
      ? fileConfig.scheduleHoursJst
      : DEFAULT_SCHEDULE_HOURS_JST,
    checkDaysBack: Number.isFinite(fileConfig.checkDaysBack) ? Math.max(1, fileConfig.checkDaysBack) : 2,
    geminiApiKey: runtime.apiKey,
    apiKeySource: runtime.apiKeySource,
    geminiModel: runtime.model,
    geminiModelFallbacks: runtime.fallbackModels,
  };
}

function buildDateKeysToCheck(config, now = new Date()) {
  const { dateKey } = getJstParts(now);
  const days = Math.max(1, config.checkDaysBack || 1);
  const keys = [];
  for (let offset = 0; offset < days; offset += 1) {
    keys.push(addDays(dateKey, -offset));
  }
  return keys;
}

function editorialNeedsGeneration(item) {
  const existing = findBundleByUrl(item.url);
  if (!existing) return true;
  if (!existing.article?.paragraphs?.length) return true;
  return existing.meta?.status !== "ready";
}

async function collectPendingEditorials(config, now = new Date()) {
  const dateKeys = buildDateKeysToCheck(config, now);
  const pending = [];
  const seenUrls = new Set();

  for (const dateKey of dateKeys) {
    for (const source of config.sources) {
      try {
        const items = await listEditorialsForDate({ source, date: dateKey });
        for (const item of items) {
          if (!item?.url || seenUrls.has(item.url)) continue;
          seenUrls.add(item.url);
          if (editorialNeedsGeneration(item)) {
            pending.push({ ...item, source, queryDate: dateKey });
          }
        }
      } catch (error) {
        appendSchedulerLog(`list failed ${source} ${dateKey}: ${error.message}`);
      }
    }
  }

  return pending;
}

function buildSlotKey(dateKey, hour) {
  return `${dateKey}-${String(hour).padStart(2, "0")}`;
}

function shouldRunScheduledSlot(config, state, now = new Date()) {
  const { dateKey, hour, minute } = getJstParts(now);
  if (!config.scheduleHoursJst.includes(hour)) return null;
  if (minute !== 0) return null;

  const slotKey = buildSlotKey(dateKey, hour);
  if (state.lastRuns?.[slotKey]) return null;
  return slotKey;
}

async function runEditorialSchedulerCheck(options = {}) {
  const config = { ...loadSchedulerConfig(), ...options.config };
  const now = options.now || new Date();
  const pending = await collectPendingEditorials(config, now);
  const results = [];

  if (!pending.length) {
    return {
      ok: true,
      generated: 0,
      skipped: 0,
      pending: 0,
      results,
      message: "没有待生成的社说",
    };
  }

  if (!config.geminiApiKey) {
    appendSchedulerLog("skip generation: set GEMINI_API_KEY env or editorial_schedule.json geminiApiKey");
    return {
      ok: false,
      generated: 0,
      skipped: pending.length,
      pending: pending.length,
      results,
      message: "未配置 Gemini API Key，已跳过自动生成",
    };
  }

  for (const item of pending) {
    try {
      appendSchedulerLog(`generating ${item.source} ${item.title}`);
      const result = await runEditorialDay({
        date: item.queryDate,
        source: item.source,
        url: item.url,
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        fallbackModels: config.geminiModelFallbacks,
        forceFetch: true,
        forceAnalyze: true,
        forceResearch: false,
      });
      const modelInfo = result.bundle?.meta?.modelFallbackUsed
        ? `${result.bundle?.meta?.model} (fallback)`
        : result.bundle?.meta?.model || config.geminiModel;
      appendSchedulerLog(`done ${item.title} -> ${result.bundleRef} model=${modelInfo}`);
      results.push({
        ok: true,
        title: item.title,
        url: item.url,
        source: item.source,
        bundleRef: result.bundleRef,
        model: result.bundle?.meta?.model,
        modelFallbackUsed: Boolean(result.bundle?.meta?.modelFallbackUsed),
        warning: result.warning || "",
      });
    } catch (error) {
      appendSchedulerLog(`failed ${item.title}: ${error.message}`);
      results.push({
        ok: false,
        title: item.title,
        url: item.url,
        source: item.source,
        error: error.message,
      });
    }
  }

  const generated = results.filter((item) => item.ok).length;
  return {
    ok: generated > 0,
    generated,
    skipped: results.length - generated,
    pending: pending.length,
    results,
    message: generated ? `已自动生成 ${generated} 篇社说` : "自动生成失败，详见日志",
  };
}

function markSlotRun(slotKey, summary, state = readJsonIfExists(STATE_PATH, {})) {
  const nextState = {
    ...state,
    lastRuns: {
      ...(state.lastRuns || {}),
      [slotKey]: {
        at: new Date().toISOString(),
        summary,
      },
    },
    lastRunAt: new Date().toISOString(),
    lastSummary: summary,
  };
  writeJson(STATE_PATH, nextState);
  return nextState;
}

function pruneOldSlotRuns(state, keepDays = 14) {
  const { dateKey } = getJstParts();
  const cutoff = addDays(dateKey, -keepDays);
  const lastRuns = { ...(state.lastRuns || {}) };
  for (const key of Object.keys(lastRuns)) {
    const runDate = key.slice(0, 10);
    if (runDate < cutoff) delete lastRuns[key];
  }
  return { ...state, lastRuns };
}

async function tickEditorialScheduler(options = {}) {
  const config = loadSchedulerConfig();
  if (!config.enabled) {
    return { ran: false, reason: "disabled" };
  }

  let state = pruneOldSlotRuns(readJsonIfExists(STATE_PATH, {}));
  const slotKey = shouldRunScheduledSlot(config, state, options.now || new Date());
  if (!slotKey) {
    return { ran: false, reason: "no-slot" };
  }

  appendSchedulerLog(`slot start ${slotKey}`);
  const summary = await runEditorialSchedulerCheck({ config, now: options.now });
  markSlotRun(slotKey, summary, state);
  appendSchedulerLog(`slot end ${slotKey}: ${summary.message}`);
  return { ran: true, slotKey, summary };
}

function startEditorialScheduler(options = {}) {
  const config = loadSchedulerConfig();
  if (!config.enabled) {
    appendSchedulerLog("scheduler disabled");
    return { started: false, reason: "disabled" };
  }

  const intervalMs = Number(options.intervalMs || 60_000);
  appendSchedulerLog(`scheduler started hours=${config.scheduleHoursJst.join(",")} JST`);

  const timer = setInterval(() => {
    tickEditorialScheduler().catch((error) => {
      appendSchedulerLog(`tick failed: ${error.message}`);
    });
  }, intervalMs);

  if (typeof timer.unref === "function") timer.unref();

  tickEditorialScheduler().catch((error) => {
    appendSchedulerLog(`initial tick failed: ${error.message}`);
  });

  return { started: true, intervalMs, scheduleHoursJst: config.scheduleHoursJst };
}

function getSchedulerStatus() {
  const config = loadSchedulerConfig();
  const state = readJsonIfExists(STATE_PATH, {});
  const jst = getJstParts();
  return {
    enabled: config.enabled,
    jst,
    scheduleHoursJst: config.scheduleHoursJst,
    sources: config.sources,
    hasApiKey: Boolean(config.geminiApiKey),
    apiKeySource: config.apiKeySource || "none",
    geminiModel: config.geminiModel,
    geminiModelFallbacks: config.geminiModelFallbacks,
    lastRunAt: state.lastRunAt || "",
    lastSummary: state.lastSummary || null,
    lastRuns: state.lastRuns || {},
    logPath: path.relative(ROOT, LOG_PATH),
    configPath: fs.existsSync(CONFIG_PATH) ? path.relative(ROOT, CONFIG_PATH) : path.relative(ROOT, CONFIG_TEMPLATE_PATH),
  };
}

if (require.main === module) {
  const runNow = process.argv.includes("--run-now");
  const showStatus = process.argv.includes("--status");

  if (showStatus) {
    console.log(JSON.stringify(getSchedulerStatus(), null, 2));
    process.exit(0);
  }

  if (runNow) {
    runEditorialSchedulerCheck()
      .then((summary) => {
        console.log(JSON.stringify(summary, null, 2));
        process.exit(summary.generated > 0 || summary.pending === 0 ? 0 : 1);
      })
      .catch((error) => {
        console.error(error.message);
        process.exit(1);
      });
    return;
  }

  const handle = startEditorialScheduler();
  console.log(JSON.stringify(handle, null, 2));
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_SCHEDULE_HOURS_JST,
  buildDateKeysToCheck,
  buildSlotKey,
  collectPendingEditorials,
  editorialNeedsGeneration,
  getJstParts,
  getSchedulerStatus,
  loadSchedulerConfig,
  runEditorialSchedulerCheck,
  shouldRunScheduledSlot,
  startEditorialScheduler,
  tickEditorialScheduler,
};
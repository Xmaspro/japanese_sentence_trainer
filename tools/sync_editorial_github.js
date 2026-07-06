const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const GITHUB_SYNC = path.join(ROOT, "phase2_editorial_training", "github_sync");
const BUNDLES = path.join(ROOT, "phase2_editorial_training", "bundles");
const TEXT = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "text");
const LOGS = path.join(ROOT, "phase2_editorial_training", "editorial_speaking", "logs");

const CODE_PATHS = [
  "phase2_editorial_training/editorial.html",
  "phase2_editorial_training/editorial.js",
  "phase2_editorial_training/editorial.css",
  "phase2_editorial_training/README.md",
  "phase2_editorial_training/github_sync/.gitkeep",
  "phase2_editorial_training/editorial_readings/text/_template.json",
  "phase2_editorial_training/editorial_speaking/logs/_template.json",
  "tools/asahi_editorial_fetcher.js",
  "tools/editorial_analyzer.js",
  "tools/editorial_pipeline.js",
  "tools/editorial_researcher.js",
  "tools/editorial_store.js",
  "tools/editorial_sync.js",
  "tools/sync_editorial_github.js",
  "tools/render_editorial_day.js",
  "tools/show_editorial_day.js",
  "tools/open_editorial_view.js",
  "tools/new_editorial_day.js",
  "tools/serve_trainer_with_tts.js",
  "tests/sync_editorial_github.test.js",
  "tests/asahi_editorial_fetcher.test.js",
  "tests/editorial_analyzer.test.js",
  "tests/render_editorial_day.test.js",
  "tests/fixtures/asahi_editorial_article.snippet.html",
  "tests/fixtures/asahi_editorial_list.snippet.html",
  "package.json",
  ".gitignore",
];

function parseArgs(argv) {
  const options = { dryRun: false, push: false, message: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    if (arg === "--push") options.push = true;
    if (arg === "--message") options.message = argv[i + 1];
  }
  if (!options.message) {
    options.message = `editorial: sync learning logs ${new Date().toISOString().slice(0, 10)}`;
  }
  return options;
}

function listDateKeys() {
  const dates = new Set();
  for (const dir of [BUNDLES, TEXT, LOGS, GITHUB_SYNC]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const match = name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (match) dates.add(match[1]);
    }
  }
  return [...dates].sort();
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isUserWrittenScript(script) {
  const text = String(script || "").trim();
  if (!text) return false;
  if (/_{3,}|下書き|要自分|________________/.test(text)) return false;
  return true;
}

function buildGithubSafeRecord(dateKey) {
  const bundle = readJsonIfExists(path.join(BUNDLES, `${dateKey}.json`));
  const text = readJsonIfExists(path.join(TEXT, `${dateKey}.json`));
  const logs = readJsonIfExists(path.join(LOGS, `${dateKey}.json`));

  const reading = text?.reading || {};
  const vocab = (bundle?.analysis?.vocab || reading.vocab || [])
    .filter((item) => item.lemma && item.meaningZh)
    .map((item) => ({
      lemma: item.lemma,
      reading: item.reading || "",
      meaningZh: item.meaningZh,
      jlptLevel: item.jlptLevel || "",
      n1Note: item.n1Note || "",
    }));

  const grammar = (bundle?.analysis?.grammar || [])
    .filter((item) => item.pattern && item.explanationZh)
    .map((item) => ({
      pattern: item.pattern,
      jlptLevel: item.jlptLevel || "",
      usageContext: item.usageContext || [],
      explanationZh: item.explanationZh,
    }));

  const exercises = logs?.exercises || bundle?.speaking || {};
  return {
    date: dateKey,
    title: bundle?.source?.title || text?.title || "",
    sourceUrl: bundle?.source?.url || text?.sourceUrl || "",
    newspaper: text?.newspaper || bundle?.source?.newspaper || "asahi",
    syncedAt: new Date().toISOString(),
    reading: {
      topic: reading.topic || "",
      summaryJa: reading.summaryJa || bundle?.analysis?.summaryZh || "",
      readMinutes: reading.readMinutes || 0,
      vocab,
    },
    grammar,
    lectureZh: bundle?.analysis?.lectureZh
      ? {
          eventBackground: "",
          topicContext: bundle.analysis.lectureZh.topicContext || "",
          newspaperStance: bundle.analysis.lectureZh.newspaperStance || "",
          readingTips: bundle.analysis.lectureZh.readingTips || "",
        }
      : undefined,
    speaking: {
      summary30s: {
        done: Boolean(exercises.summary30s?.done),
        script: isUserWrittenScript(exercises.summary30s?.script) ? exercises.summary30s.script : "",
      },
      myOpinion: {
        stance: exercises.myOpinion?.stance || "",
        script: isUserWrittenScript(exercises.myOpinion?.script) ? exercises.myOpinion.script : "",
      },
      retellNextDay: {
        dueDate: exercises.retellNextDay?.dueDate || "",
        done: Boolean(exercises.retellNextDay?.done),
        script: isUserWrittenScript(exercises.retellNextDay?.script) ? exercises.retellNextDay.script : "",
      },
      minutes: logs?.minutes || 0,
      done: Boolean(logs?.done),
    },
    policy: "GitHub-safe export: no article full text, no editorial sentence quotes",
  };
}

function writeGithubSyncExports() {
  fs.mkdirSync(GITHUB_SYNC, { recursive: true });
  const dates = listDateKeys();
  const written = [];
  for (const dateKey of dates) {
    const record = buildGithubSafeRecord(dateKey);
    const hasContent =
      record.title ||
      record.reading.summaryJa ||
      record.reading.vocab.length ||
      record.grammar.length ||
      record.speaking.summary30s.script ||
      record.speaking.myOpinion.script;
    if (!hasContent) continue;
    const out = path.join(GITHUB_SYNC, `${dateKey}.json`);
    fs.writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    written.push(out);
  }
  return written;
}

function existingPathsToStage() {
  const staged = [];
  for (const rel of CODE_PATHS) {
    if (fs.existsSync(path.join(ROOT, rel))) staged.push(rel);
  }
  if (fs.existsSync(GITHUB_SYNC)) {
    for (const name of fs.readdirSync(GITHUB_SYNC)) {
      if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) {
        staged.push(`phase2_editorial_training/github_sync/${name}`);
      }
    }
  }
  return staged;
}

function runGit(args, dryRun) {
  if (dryRun) return `git ${args.map((arg) => JSON.stringify(arg)).join(" ")}`;
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function syncEditorialGithub(options = {}) {
  const exports = writeGithubSyncExports();
  const paths = existingPathsToStage();
  const lines = [
    `GitHub sync prepared (${exports.length} learning log export(s))`,
    "",
    "Will stage:",
    ...paths.map((item) => `  ${item}`),
    "",
    "Excluded by policy:",
    "  phase2_editorial_training/bundles/**",
    "  phase2_editorial_training/editorial_readings/fetched/**",
    "  phase2_editorial_training/views/**",
    "  phase2_editorial_training/editorial_readings/scans/**",
    "  phase2_editorial_training/editorial_speaking/recordings/**",
    "  text/logs daily files with article quotes",
  ];

  if (options.dryRun) {
    return { exports, paths, commands: [`git add ${paths.join(" ")}`, `git commit -m "${options.message}"`, options.push ? "git push" : "(skip push)"] , output: lines.join("\n") };
  }

  if (!paths.length) {
    throw new Error("Nothing to stage for GitHub sync");
  }

  runGit(["add", ...paths], false);
  const status = runGit(["status", "--short"], false);
  const commit = runGit(["commit", "-m", options.message], false);
  let push = "";
  if (options.push) {
    push = runGit(["push"], false);
  }
  return { exports, paths, status, commit, push, output: [...lines, "", status, commit, push].join("\n") };
}

if (require.main === module) {
  try {
    const result = syncEditorialGithub(parseArgs(process.argv.slice(2)));
    console.log(result.output);
    if (result.commands) {
      console.log("\nDry-run commands:");
      for (const cmd of result.commands) console.log(`  ${cmd}`);
    }
  } catch (error) {
    if (String(error.stdout || "").includes("nothing to commit")) {
      console.log("No changes to commit.");
      process.exit(0);
    }
    console.error(error.message || error.stdout || error);
    process.exit(1);
  }
}

module.exports = {
  buildGithubSafeRecord,
  syncEditorialGithub,
  writeGithubSyncExports,
};
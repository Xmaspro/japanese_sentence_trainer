const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FETCHED = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "fetched");
const READINGS = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "text");
const SPEAKING = path.join(ROOT, "phase2_editorial_training", "editorial_speaking", "logs");
const VIEWS = path.join(ROOT, "phase2_editorial_training", "views");

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--date") options.date = argv[i + 1];
  }
  return options;
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderVocab(vocab) {
  const items = (vocab || []).filter((item) => item.lemma || item.meaningZh);
  if (!items.length) {
    return '<p class="empty">读完后在 text JSON 的 reading.vocab 填写生词。</p>';
  }
  return `<ul class="vocab-list">${items
    .map(
      (item) => `<li>
        <strong>${escapeHtml(item.lemma)}</strong>
        <span class="muted">${escapeHtml(item.reading)}</span>
        <div>${escapeHtml(item.meaningZh)}</div>
        ${item.exampleJa ? `<div class="example">${escapeHtml(item.exampleJa)}</div>` : ""}
      </li>`,
    )
    .join("")}</ul>`;
}

function renderSpeakingScript(exercises) {
  const retelling = exercises?.retelling || exercises || {};
  const script = retelling.script || exercises?.script || "";
  if (!script && exercises?.steps?.length) {
    const combined = exercises.steps
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((step) => step.script)
      .filter(Boolean)
      .join("\n\n");
    if (combined) {
      return `<article class="speaking-script-card"><pre class="script">${escapeHtml(combined)}</pre></article>`;
    }
  }
  if (!script) return '<p class="empty">口语范本尚未生成。</p>';
  return `<article class="speaking-script-card"><pre class="script">${escapeHtml(script)}</pre></article>`;
}

function renderEditorialHtml({ dateKey, fetched, reading, speaking }) {
  const title = fetched?.title || reading?.title || `${dateKey} 社说`;
  const paragraphs = fetched?.paragraphs || reading?.extractedText?.keyParagraphs || [];
  const exercises = speaking?.exercises || {};
  const readingData = reading?.reading || {};
  const extracted = reading?.extractedText || {};

  const articleBody = paragraphs.length
    ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
    : '<p class="empty">未找到正文。先运行 npm run editorial:fetch-asahi</p>';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f4ee;
      --paper: #fffdf8;
      --ink: #1f1f1f;
      --muted: #666;
      --accent: #8b1e1e;
      --line: #e6dfd2;
      --tab: #efe8db;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.9;
    }
    .wrap { max-width: 760px; margin: 0 auto; padding: 24px 20px 64px; }
    .meta { color: var(--muted); font-size: 0.92rem; margin-bottom: 10px; }
    h1 { font-size: 1.55rem; line-height: 1.5; margin: 0 0 12px; }
    .source a { color: var(--accent); }
    .tabs {
      display: flex; gap: 8px; margin: 24px 0 0; flex-wrap: wrap;
    }
    .tab-btn {
      border: 1px solid var(--line); background: var(--tab); color: var(--ink);
      padding: 8px 14px; border-radius: 999px; cursor: pointer; font: inherit;
    }
    .tab-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .panel {
      display: none; background: var(--paper); border: 1px solid var(--line);
      border-radius: 14px; padding: 22px 24px; margin-top: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.04);
    }
    .panel.active { display: block; }
    .panel h2 { font-size: 1.05rem; margin: 0 0 14px; color: var(--accent); }
    .panel h3 { font-size: 0.98rem; margin: 18px 0 8px; }
    .article p { margin: 0 0 1.15em; text-indent: 1em; }
    .note-grid { display: grid; gap: 12px; }
    .note-card {
      border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: #fff;
    }
    .note-card .label { color: var(--muted); font-size: 0.85rem; margin-bottom: 4px; }
    .empty { color: var(--muted); font-style: italic; }
    .vocab-list { list-style: none; padding: 0; margin: 0; }
    .vocab-list li { padding: 10px 0; border-bottom: 1px solid var(--line); }
    .vocab-list .muted { margin-left: 8px; color: var(--muted); }
    .vocab-list .example { margin-top: 4px; color: #444; }
    .conversion-list { display: grid; gap: 12px; }
    .conversion-card {
      border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: #fff;
    }
    .conversion-card .label { color: var(--muted); font-size: 0.82rem; margin-bottom: 4px; }
    .conversion-card .spoken { color: #234; }
    .prompt { background: #faf6ef; border-left: 3px solid var(--accent); padding: 10px 12px; }
    pre.script {
      white-space: pre-wrap; word-break: break-word; font: inherit;
      background: #faf6ef; border: 1px solid var(--line); border-radius: 10px;
      padding: 12px 14px; margin: 0;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="meta">${escapeHtml(dateKey)} · ${escapeHtml(reading?.newspaperLabel || fetched?.source || "editorial")}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="source meta">来源：<a href="${escapeHtml(fetched?.url || reading?.sourceUrl || "#")}" target="_blank" rel="noreferrer">${escapeHtml(fetched?.url || reading?.sourceUrl || "")}</a></div>

    <div class="tabs" role="tablist">
      <button class="tab-btn active" data-tab="article" type="button">正文</button>
      <button class="tab-btn" data-tab="notes" type="button">笔记</button>
      <button class="tab-btn" data-tab="speaking" type="button">口语</button>
    </div>

    <section class="panel active" id="article" role="tabpanel">
      <h2>社说正文</h2>
      <div class="article">${articleBody}</div>
    </section>

    <section class="panel" id="notes" role="tabpanel">
      <h2>阅读笔记</h2>
      <div class="note-grid">
        <div class="note-card"><div class="label">话题</div><div>${escapeHtml(readingData.topic || "—")}</div></div>
        <div class="note-card"><div class="label">导语</div><div>${escapeHtml(extracted.lead || "—")}</div></div>
        <div class="note-card"><div class="label">报纸立场</div><div>${escapeHtml(readingData.newspaperStance || "—")}</div></div>
        <div class="note-card"><div class="label">我的摘要 summaryJa</div><div>${escapeHtml(readingData.summaryJa || "（读完后填写）")}</div></div>
        <div class="note-card"><div class="label">阅读时间</div><div>${readingData.readMinutes ? `${readingData.readMinutes} 分钟` : "（未记录）"}</div></div>
      </div>
      <h3>生词</h3>
      ${renderVocab(readingData.vocab)}
    </section>

    <section class="panel" id="speaking" role="tabpanel">
      <h2>${escapeHtml(exercises.flowTitle || "社论复述口语范本")}</h2>
      <p class="muted">${escapeHtml(exercises.flowHint || "先大声朗读下面的です・ます范文，再合上正文用自己的话复述一遍。")}</p>
      ${renderSpeakingScript(exercises)}
    </section>
  </div>
  <script>
    for (const button of document.querySelectorAll(".tab-btn")) {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((el) => el.classList.remove("active"));
        document.querySelectorAll(".panel").forEach((el) => el.classList.remove("active"));
        button.classList.add("active");
        document.getElementById(button.dataset.tab).classList.add("active");
      });
    }
  </script>
</body>
</html>`;
}

function loadEditorialBundle(dateKey) {
  const fetched = readJsonIfExists(path.join(FETCHED, `${dateKey}.json`));
  const reading = readJsonIfExists(path.join(READINGS, `${dateKey}.json`));
  const speaking = readJsonIfExists(path.join(SPEAKING, `${dateKey}.json`));
  if (!fetched && !reading && !speaking) {
    throw new Error(`No editorial data for ${dateKey}`);
  }
  return { dateKey, fetched, reading, speaking };
}

function renderEditorialDay(options = {}) {
  const dateKey = options.date || todayKey();
  const bundle = loadEditorialBundle(dateKey);
  const html = renderEditorialHtml(bundle);
  const outPath = path.join(VIEWS, `${dateKey}.html`);
  fs.mkdirSync(VIEWS, { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
  return { dateKey, outPath, bundle };
}

if (require.main === module) {
  try {
    const result = renderEditorialDay(parseArgs(process.argv.slice(2)));
    console.log(`Rendered: ${path.relative(ROOT, result.outPath)}`);
    console.log(`Open: file://${result.outPath}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  loadEditorialBundle,
  renderEditorialDay,
  renderEditorialHtml,
  escapeHtml,
};
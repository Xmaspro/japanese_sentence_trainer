const SETTINGS_KEY = "jp-sentence-trainer-settings";

const els = {
  dateInput: document.querySelector("#dateInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  modelInput: document.querySelector("#modelInput"),
  runBtn: document.querySelector("#runBtn"),
  reloadBtn: document.querySelector("#reloadBtn"),
  status: document.querySelector("#status"),
  content: document.querySelector("#content"),
  headlineMeta: document.querySelector("#headlineMeta"),
  headlineTitle: document.querySelector("#headlineTitle"),
  article: document.querySelector("#article"),
  vocab: document.querySelector("#vocab"),
  grammar: document.querySelector("#grammar"),
  lecture: document.querySelector("#lecture"),
  speaking: document.querySelector("#speaking"),
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(`${SETTINGS_KEY}.backup`);
    if (!raw) return;
    const settings = JSON.parse(raw);
    if (settings.geminiKey) els.apiKeyInput.value = settings.geminiKey;
    if (settings.geminiModel) els.modelInput.value = settings.geminiModel;
  } catch {
    // ignore
  }
}

function saveSettingsToTrainer() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const settings = raw ? JSON.parse(raw) : {};
    settings.geminiKey = els.apiKeyInput.value.trim();
    settings.geminiModel = els.modelInput.value.trim() || settings.geminiModel;
    const payload = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_KEY, payload);
    localStorage.setItem(`${SETTINGS_KEY}.backup`, payload);
  } catch {
    // ignore
  }
}

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.className = `status ${kind}`.trim();
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBundle(bundle) {
  els.content.classList.remove("hidden");
  els.headlineMeta.textContent = `${bundle.date} · ${bundle.source?.newspaperLabel || "朝日新聞"} · ${bundle.meta?.status || ""}`;
  els.headlineTitle.textContent = bundle.source?.title || bundle.date;

  const paragraphs = bundle.article?.paragraphs || [];
  els.article.innerHTML = `
    <div class="meta-line">来源：<a href="${escapeHtml(bundle.source?.url)}" target="_blank" rel="noreferrer">${escapeHtml(bundle.source?.url)}</a></div>
    ${bundle.analysis?.summaryZh ? `<div class="card"><strong>主旨</strong><div>${escapeHtml(bundle.analysis.summaryZh)}</div></div>` : ""}
    <div class="article">${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</div>
  `;

  const vocab = bundle.analysis?.vocab || [];
  els.vocab.innerHTML = vocab.length
    ? vocab
        .map(
          (item) => `<article class="card">
        <h3>${escapeHtml(item.lemma)} <span class="muted">${escapeHtml(item.reading)}</span></h3>
        <div class="tags">${item.pos ? `<span class="tag">${escapeHtml(item.pos)}</span>` : ""}</div>
        <div>${escapeHtml(item.meaningZh)}</div>
        <div class="muted">例：${escapeHtml(item.exampleJa)}</div>
        ${item.n1Note ? `<div class="muted">N1：${escapeHtml(item.n1Note)}</div>` : ""}
      </article>`,
        )
        .join("")
    : `<p class="muted">分析未完成。请填写 API Key 后点击「开始」。</p>`;

  const grammar = bundle.analysis?.grammar || [];
  els.grammar.innerHTML = grammar.length
    ? grammar
        .map(
          (item) => `<article class="card">
        <h3>${escapeHtml(item.pattern)}</h3>
        <div class="tags">
          ${item.jlptLevel ? `<span class="tag jlpt">${escapeHtml(item.jlptLevel)}</span>` : ""}
          ${(item.usageContext || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          ${item.register ? `<span class="tag">${escapeHtml(item.register)}</span>` : ""}
        </div>
        <div>原文：${escapeHtml(item.sentenceJa)}</div>
        <div>${escapeHtml(item.explanationZh)}</div>
        ${item.spokenHint ? `<div class="muted">口语：${escapeHtml(item.spokenHint)}</div>` : ""}
        ${item.compareNote ? `<div class="muted">对比：${escapeHtml(item.compareNote)}</div>` : ""}
      </article>`,
        )
        .join("")
    : `<p class="muted">分析未完成。</p>`;

  const lecture = bundle.analysis?.lectureZh || {};
  const timeline = lecture.timeline || [];
  const sources = bundle.sources || [];
  els.lecture.innerHTML = `
    <div class="card"><h3>发生了什么</h3><div>${escapeHtml(lecture.eventBackground || "—")}</div></div>
    <div class="card"><h3>来龙去脉</h3>
      <ul>${timeline.map((item) => `<li>${escapeHtml(item.when)} — ${escapeHtml(item.what)} <span class="muted">[${escapeHtml(item.sourceId)} / ${escapeHtml(item.confidence)}]</span></li>`).join("") || "<li>—</li>"}</ul>
      ${lecture.timelineNarrative ? `<p>${escapeHtml(lecture.timelineNarrative)}</p>` : ""}
    </div>
    <div class="card"><h3>话题背景</h3><div>${escapeHtml(lecture.topicContext || "—")}</div></div>
    <div class="card"><h3>报纸立场</h3><div>${escapeHtml(lecture.newspaperStance || "—")}</div></div>
    <div class="card"><h3>论证结构</h3><div>${escapeHtml(lecture.argumentStructure || "—")}</div></div>
    <div class="card"><h3>难点提示</h3><div>${escapeHtml(lecture.readingTips || "—")}</div></div>
    ${
      (bundle.researchMeta?.skippedFacts || []).length
        ? `<div class="card"><h3>未核实（已省略）</h3><ul>${bundle.researchMeta.skippedFacts.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul></div>`
        : ""
    }
    <div class="card"><h3>来源</h3><ul class="source-list">${sources
      .map((source) => {
        const href = source.url ? `href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer"` : "";
        return `<li>[${escapeHtml(source.id)}] <a ${href}>${escapeHtml(source.label || source.type)}</a></li>`;
      })
      .join("")}</ul>
    </div>
  `;

  const speaking = bundle.speaking || {};
  els.speaking.innerHTML = `
    <div class="card"><h3>30 秒要約</h3><div class="muted">${escapeHtml(speaking.summary30s?.prompt || "")}</div><pre class="script">${escapeHtml(speaking.summary30s?.script || "")}</pre></div>
    <div class="card"><h3>です・ます转换</h3>
      ${(speaking.desuMasuConversion || [])
        .map(
          (item) => `<div style="margin-bottom:10px">
          <div>${escapeHtml(item.originalFromEditorial)}</div>
          <div class="muted">→ ${escapeHtml(item.spoken)}</div>
        </div>`,
        )
        .join("")}
    </div>
    <div class="card"><h3>关键词</h3><pre class="script">${escapeHtml(speaking.explainKeyword?.spokenExplanation || "")}</pre></div>
    <div class="card"><h3>我的观点</h3><pre class="script">${escapeHtml(speaking.myOpinion?.script || "")}</pre></div>
    <div class="card"><h3>隔天复述 ${escapeHtml(speaking.retellNextDay?.dueDate || "")}</h3><pre class="script">${escapeHtml(speaking.retellNextDay?.script || "")}</pre></div>
  `;
}

async function loadCached(date) {
  const response = await fetch(`/api/editorial/day?date=${encodeURIComponent(date)}`);
  if (!response.ok) throw new Error("本地无缓存，请点击「开始」抓取");
  const data = await response.json();
  renderBundle(data.bundle);
  setStatus(`已加载缓存：${date}`, "ok");
}

async function runPipeline(date, forceFetch = false) {
  saveSettingsToTrainer();
  setStatus("抓取与分析中，请稍候…");
  els.runBtn.disabled = true;
  try {
    const response = await fetch("/api/editorial/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        apiKey: els.apiKeyInput.value.trim(),
        model: els.modelInput.value.trim(),
        forceFetch,
        forceAnalyze: forceFetch,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    renderBundle(data.bundle);
    const stepText = (data.steps || []).join(" → ");
    if (data.warning) setStatus(`${data.warning}（${stepText}）`, "warn");
    else setStatus(data.cached ? `已使用缓存：${date}` : `完成：${stepText}`, "ok");
  } catch (error) {
    setStatus(error.message || "处理失败", "error");
  } finally {
    els.runBtn.disabled = false;
  }
}

for (const button of document.querySelectorAll(".tab-btn")) {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
}

els.runBtn.addEventListener("click", () => {
  const date = els.dateInput.value;
  if (!date) {
    setStatus("请选择日期", "warn");
    return;
  }
  runPipeline(date, true);
});

els.reloadBtn.addEventListener("click", async () => {
  const date = els.dateInput.value;
  if (!date) {
    setStatus("请选择日期", "warn");
    return;
  }
  try {
    await loadCached(date);
  } catch (error) {
    setStatus(error.message, "warn");
  }
});

els.dateInput.value = todayKey();
loadSettings();
loadCached(els.dateInput.value).catch(() => {
  setStatus("本地尚无缓存。选择日期后点击「开始」。", "");
});
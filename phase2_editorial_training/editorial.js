const SETTINGS_KEY = "jp-sentence-trainer-settings";

const els = {
  dateInput: document.querySelector("#dateInput"),
  urlInput: document.querySelector("#urlInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  modelInput: document.querySelector("#modelInput"),
  status: document.querySelector("#status"),
  content: document.querySelector("#content"),
  headlineMeta: document.querySelector("#headlineMeta"),
  headlineTitle: document.querySelector("#headlineTitle"),
  article: document.querySelector("#article"),
  lecture: document.querySelector("#lecture"),
  speaking: document.querySelector("#speaking"),
  calendarMonth: document.querySelector("#calendarMonth"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarPrev: document.querySelector("#calendarPrev"),
  calendarNext: document.querySelector("#calendarNext"),
  bundlePickerTitle: document.querySelector("#bundlePickerTitle"),
  bundleList: document.querySelector("#bundleList"),
  pickerDateInput: document.querySelector("#pickerDateInput"),
  sourceAsahi: document.querySelector("#sourceAsahi"),
  sourceNikkei: document.querySelector("#sourceNikkei"),
  queryTitlesBtn: document.querySelector("#queryTitlesBtn"),
  titleList: document.querySelector("#titleList"),
  generateBtn: document.querySelector("#generateBtn"),
  apiKeyHint: document.querySelector("#apiKeyHint"),
};

const calendarState = {
  viewYear: 0,
  viewMonth: 0,
  selectedDate: "",
  selectedBundleId: "",
  availableDates: new Set(),
  bundles: [],
};

const pickerState = {
  source: "asahi",
  date: "",
  items: [],
  selectedIndex: -1,
  selectedUrl: "",
};

function clearPickerSelection() {
  pickerState.selectedIndex = -1;
  pickerState.selectedUrl = "";
  els.urlInput.value = "";
}

function getSelectedEditorialItem() {
  if (pickerState.selectedIndex < 0) return null;
  return pickerState.items[pickerState.selectedIndex] || null;
}

function setGenerateBusy(busy) {
  els.generateBtn.dataset.busy = busy ? "true" : "false";
  updateGenerateButton();
}

const SOURCE_LABELS = {
  asahi: "朝日新闻",
  nikkei: "日本経済新聞",
};

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function loadServerGeminiHint() {
  try {
    const response = await fetch("/api/editorial/scheduler/status");
    if (!response.ok) return;
    const data = await readApiJson(response);
    if (!data.hasApiKey) return;

    const sourceText =
      data.apiKeySource === "env"
        ? "服务端已配置 GEMINI_API_KEY 环境变量（优先于页面输入）。"
        : data.apiKeySource === "file"
          ? "服务端已从 editorial_schedule.json 读取 API Key。"
          : "服务端已配置 API Key。";
    els.apiKeyHint.textContent = sourceText;
    els.apiKeyHint.classList.remove("hidden");
    if (!els.modelInput.value && data.geminiModel) {
      els.modelInput.value = data.geminiModel;
    }
  } catch {
    // ignore
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(`${SETTINGS_KEY}.backup`);
    if (!raw) return;
    const settings = JSON.parse(raw);
    if (settings.geminiKey) els.apiKeyInput.value = settings.geminiKey;
    if (settings.geminiModel) {
      els.modelInput.value = settings.geminiModel.startsWith("openrouter/") ? "gemini-2.0-flash" : settings.geminiModel;
    }
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

async function readApiJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const preview = text.trim().slice(0, 240);
    if (/OpenRouter/i.test(preview)) {
      throw new Error("服务端仍是旧版 OpenRouter 接口。请停止当前 npm start，重新运行 npm start，并改用 Gemini API Key。");
    }
    throw new Error(preview || `HTTP ${response.status}`);
  }
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findParagraphIndex(paragraphs, needle) {
  const sample = String(needle || "").trim();
  if (!sample) return 0;
  for (let i = 0; i < paragraphs.length; i += 1) {
    if (paragraphs[i].includes(sample)) return i;
    if (paragraphs[i].includes(sample.replace(/^　+/, ""))) return i;
  }
  const snippet = sample.slice(0, Math.min(16, sample.length));
  if (snippet.length >= 4) {
    for (let i = 0; i < paragraphs.length; i += 1) {
      if (paragraphs[i].includes(snippet)) return i;
    }
  }
  return 0;
}

function groupNotesByParagraph(items, paragraphs, textKey) {
  const groups = paragraphs.map(() => []);
  for (const item of items) {
    const index = findParagraphIndex(paragraphs, item[textKey]);
    groups[index].push(item);
  }
  return groups;
}

function highlightParagraph(paragraph, vocabItems, grammarItems) {
  let html = escapeHtml(paragraph);
  const needles = [
    ...grammarItems.map((item) => ({ text: item.sentenceJa, cls: "hl-grammar" })),
    ...vocabItems.map((item) => ({ text: item.exampleJa, cls: "hl-vocab" })),
  ]
    .map((item) => ({ ...item, text: String(item.text || "").trim() }))
    .filter((item) => item.text)
    .sort((a, b) => b.text.length - a.text.length);

  for (const { text, cls } of needles) {
    const escaped = escapeHtml(text);
    if (html.includes(escaped)) {
      html = html.replace(escaped, `<mark class="${cls}">${escaped}</mark>`);
      continue;
    }
    const trimmed = escapeHtml(text.replace(/^　+/, ""));
    if (trimmed && html.includes(trimmed)) {
      html = html.replace(trimmed, `<mark class="${cls}">${trimmed}</mark>`);
    }
  }
  return html;
}

function renderVocabSideCard(item) {
  const metaParts = [item.reading, item.pos].filter(Boolean).map((part) => escapeHtml(part));

  return `<article class="side-note side-note-vocab">
    <div class="side-note-head">
      <strong class="side-note-lemma">${escapeHtml(item.lemma)}</strong>${metaParts.length ? `<span class="side-note-inline-meta">${metaParts.join(" · ")}</span>` : ""}
    </div>
    <div class="side-note-body">${escapeHtml(item.meaningZh)}</div>
    ${item.n1Note ? `<div class="muted side-note-foot">N1：${escapeHtml(item.n1Note)}</div>` : ""}
  </article>`;
}

function renderGrammarSideCard(item) {
  return `<article class="side-note side-note-grammar">
    <div class="side-note-title">${escapeHtml(item.pattern)}</div>
    <div class="tags">
      ${item.jlptLevel ? `<span class="tag jlpt">${escapeHtml(item.jlptLevel)}</span>` : ""}
      ${(item.usageContext || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
    <div class="side-note-body">${escapeHtml(item.explanationZh)}</div>
    ${item.spokenHint ? `<div class="muted">口语：${escapeHtml(item.spokenHint)}</div>` : ""}
    ${item.compareNote ? `<div class="muted">对比：${escapeHtml(item.compareNote)}</div>` : ""}
  </article>`;
}

function renderArticleRow(paragraph, paraVocab, paraGrammar) {
  const leftColumn = paraVocab.length
    ? `<aside class="article-side article-side-left" aria-label="词汇">${paraVocab.map(renderVocabSideCard).join("")}</aside>`
    : `<div class="article-side article-side-left article-side-empty" aria-hidden="true"></div>`;
  const rightColumn = paraGrammar.length
    ? `<aside class="article-side article-side-right" aria-label="语法">${paraGrammar.map(renderGrammarSideCard).join("")}</aside>`
    : `<div class="article-side article-side-right article-side-empty" aria-hidden="true"></div>`;

  return `<div class="article-row">
    ${leftColumn}
    <div class="article-main article">
      <p>${highlightParagraph(paragraph, paraVocab, paraGrammar)}</p>
    </div>
    ${rightColumn}
  </div>`;
}

function renderArticlePanel(bundle) {
  const paragraphs = bundle.article?.paragraphs || [];
  const vocab = bundle.analysis?.vocab || [];
  const grammar = bundle.analysis?.grammar || [];
  const vocabByParagraph = groupNotesByParagraph(vocab, paragraphs, "exampleJa");
  const grammarByParagraph = groupNotesByParagraph(grammar, paragraphs, "sentenceJa");
  const hasSideNotes = vocab.length > 0 || grammar.length > 0;

  const header = `
    <div class="meta-line">来源：<a href="${escapeHtml(bundle.source?.url)}" target="_blank" rel="noreferrer">${escapeHtml(bundle.source?.url)}</a></div>
    ${bundle.analysis?.summaryZh ? `<div class="card article-summary"><strong>主旨</strong><div>${escapeHtml(bundle.analysis.summaryZh)}</div></div>` : ""}
  `;

  if (!paragraphs.length) {
    return `${header}<p class="muted">暂无正文。</p>`;
  }

  if (!hasSideNotes) {
    return `${header}
      <div class="article article-simple">
        ${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      </div>
      <p class="muted">词汇与语法将显示在正文两侧。请填写 API Key 后点击「开始」。</p>`;
  }

  const body = paragraphs
    .map((paragraph, index) =>
      renderArticleRow(paragraph, vocabByParagraph[index] || [], grammarByParagraph[index] || []),
    )
    .join("");

  return `${header}
    <div class="article-legend muted">
      <span><mark class="hl-vocab">词汇</mark> 在左</span>
      <span><mark class="hl-grammar">语法</mark> 在右</span>
    </div>
    <div class="article-reading">${body}</div>`;
}

function renderBundle(bundle) {
  els.content.classList.remove("hidden");
  els.headlineMeta.textContent = `${bundle.date} · ${bundle.source?.newspaperLabel || "朝日新聞"} · ${bundle.meta?.status || ""}`;
  els.headlineTitle.textContent = bundle.source?.title || bundle.date;
  els.article.innerHTML = renderArticlePanel(bundle);

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

  els.speaking.innerHTML = renderSpeakingPanel(bundle);
}

function normalizeSpeakingScript(speaking) {
  if (speaking?.script) {
    return {
      flowTitle: speaking.flowTitle || "社论复述口语范本",
      flowHint:
        speaking.flowHint || "先大声朗读下面的です・ます范文，再合上正文用自己的话复述一遍。",
      script: speaking.script,
      recording: speaking.recording || "",
      done: Boolean(speaking.done),
    };
  }

  const steps = speaking?.steps || [];
  if (steps.length) {
    const combined = steps
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((step) => step.script)
      .filter(Boolean)
      .join("\n\n");
    if (combined) {
      return {
        flowTitle: speaking.flowTitle || "社论复述口语范本",
        flowHint: speaking.flowHint || "旧版多步口语已合并为一份复述范本。",
        script: combined,
        recording: steps.find((step) => step.recording)?.recording || "",
        done: steps.every((step) => step.done),
      };
    }
  }

  if (speaking?.summary30s?.script) {
    return {
      flowTitle: speaking.flowTitle || "社论复述口语范本",
      flowHint: speaking.flowHint || "",
      script: speaking.summary30s.script,
      recording: speaking.summary30s.recording || "",
      done: Boolean(speaking.summary30s.done),
    };
  }

  return {
    flowTitle: speaking?.flowTitle || "社论复述口语范本",
    flowHint: speaking?.flowHint || "",
    script: "",
    recording: "",
    done: false,
  };
}

function renderSpeakingPanel(bundle) {
  const speaking = normalizeSpeakingScript(bundle?.speaking || {});
  if (!speaking.script) {
    return `<p class="muted">口语范本尚未生成。请填写 API Key 后点击「开始」。</p>`;
  }

  const recordingLine = speaking.recording
    ? `<p class="muted speaking-recording">录音保存至：${escapeHtml(speaking.recording)}</p>`
    : "";

  return `
    <div class="speaking-flow-intro">
      <h3>${escapeHtml(speaking.flowTitle)}</h3>
      <p class="muted">${escapeHtml(speaking.flowHint)}</p>
    </div>
    <article class="speaking-script-card${speaking.done ? " is-done" : ""}">
      <pre class="script">${escapeHtml(speaking.script)}</pre>
    </article>
    ${recordingLine}
  `;
}

function bundleCacheLabel(bundle) {
  if (!bundle?.date || !bundle?.id) return bundle?.source?.title || bundle?.date || "";
  return `${bundle.date}/${bundle.id}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatMonthLabel(year, monthIndex) {
  return `${year}年${monthIndex + 1}月`;
}

function statusLabel(status) {
  if (status === "ready") return "已分析";
  if (status === "fetched") return "已抓取";
  return "未完成";
}

async function fetchAvailableDates() {
  try {
    const response = await fetch("/api/editorial/dates");
    if (!response.ok) return;
    const data = await readApiJson(response);
    calendarState.availableDates = new Set(data.dates || []);
    renderCalendar();
  } catch {
    // ignore
  }
}

async function fetchBundlesForDate(dateKey) {
  const response = await fetch(`/api/editorial/bundles?date=${encodeURIComponent(dateKey)}`);
  if (!response.ok) throw new Error("无法读取当日新闻列表");
  const data = await readApiJson(response);
  calendarState.bundles = data.bundles || [];
  renderBundleList();
  return calendarState.bundles;
}

function renderCalendar() {
  const { viewYear, viewMonth, selectedDate, availableDates } = calendarState;
  els.calendarMonth.textContent = formatMonthLabel(viewYear, viewMonth);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayKey();

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ outside: true, label: "" });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const month = String(viewMonth + 1).padStart(2, "0");
    const dayText = String(day).padStart(2, "0");
    const dateKey = `${viewYear}-${month}-${dayText}`;
    const bundleOnDay =
      dateKey === selectedDate ? calendarState.bundles.find((item) => item.date === dateKey) : null;
    cells.push({
      dateKey,
      label: String(day),
      hasBundle: availableDates.has(dateKey),
      isReady: bundleOnDay?.status === "ready",
      isSelected: dateKey === selectedDate,
      isToday: dateKey === today,
    });
  }

  els.calendarGrid.innerHTML = cells
    .map((cell) => {
      if (cell.outside) return `<span class="calendar-day is-outside" aria-hidden="true"></span>`;
      const classes = ["calendar-day"];
      if (cell.hasBundle) classes.push("has-bundle");
      if (cell.isReady) classes.push("is-ready");
      if (cell.isSelected) classes.push("is-selected");
      if (cell.isToday) classes.push("is-today");
      return `<button type="button" class="${classes.join(" ")}" data-date="${cell.dateKey}" aria-pressed="${cell.isSelected ? "true" : "false"}">${cell.label}</button>`;
    })
    .join("");
}

function renderBundleList() {
  const { selectedDate, selectedBundleId, bundles } = calendarState;
  els.bundlePickerTitle.textContent = selectedDate ? `${selectedDate} 社说` : "当日社说";

  if (!selectedDate) {
    els.bundleList.innerHTML = `<p class="muted bundle-empty">选择日期后显示已生成的新闻。</p>`;
    return;
  }

  if (!bundles.length) {
    els.bundleList.innerHTML = `<p class="muted bundle-empty">该日尚无缓存。填写 API Key 后点击「开始」抓取。</p>`;
    return;
  }

  els.bundleList.innerHTML = bundles
    .map((bundle, index) => {
      const active = bundle.id === selectedBundleId ? " is-active" : "";
      const title = escapeHtml(bundle.title || bundle.id || "未命名");
      const meta = escapeHtml(`${bundle.newspaperLabel || "朝日"} · ${statusLabel(bundle.status)}`);
      return `<button type="button" class="bundle-item${active}" data-bundle-index="${index}">
        <span class="bundle-item-title">${title}</span>
        <span class="bundle-item-meta">${meta}</span>
      </button>`;
    })
    .join("");
}

function setSelectedDate(dateKey, options = {}) {
  const { keepBundle = false, keepTitles = false } = options;
  calendarState.selectedDate = dateKey;
  els.dateInput.value = dateKey;
  pickerState.date = dateKey;
  els.pickerDateInput.value = dateKey;
  const parsed = parseDateKey(dateKey);
  calendarState.viewYear = parsed.getFullYear();
  calendarState.viewMonth = parsed.getMonth();
  if (!keepBundle) calendarState.selectedBundleId = "";
  if (!keepTitles) {
    pickerState.items = [];
    clearPickerSelection();
    renderTitleList();
    updateGenerateButton();
  }
  renderCalendar();
}

function setPickerSource(source) {
  pickerState.source = source;
  pickerState.items = [];
  clearPickerSelection();
  els.sourceAsahi.classList.toggle("is-active", source === "asahi");
  els.sourceNikkei.classList.toggle("is-active", source === "nikkei");
  els.sourceAsahi.setAttribute("aria-pressed", source === "asahi" ? "true" : "false");
  els.sourceNikkei.setAttribute("aria-pressed", source === "nikkei" ? "true" : "false");
  renderTitleList();
  updateGenerateButton();
}

function renderTitleList() {
  const { items, selectedIndex, source, date } = pickerState;
  if (!date) {
    els.titleList.innerHTML = `<p class="muted title-empty">请选择日期。</p>`;
    return;
  }

  if (!items.length) {
    els.titleList.innerHTML = `<p class="muted title-empty">点击「查询标题」获取 ${SOURCE_LABELS[source] || source} ${date} 的社说列表。</p>`;
    return;
  }

  els.titleList.innerHTML = items
    .map((item, index) => {
      const active = index === selectedIndex ? " is-active" : "";
      const title = escapeHtml(item.title || "未命名");
      const meta = escapeHtml(item.publishedLabel || item.publishedAt || "");
      return `<button type="button" class="title-item${active}" data-title-index="${index}">
        <span class="title-item-title">${title}</span>
        <span class="title-item-meta">${meta}</span>
      </button>`;
    })
    .join("");
}

function updateGenerateButton() {
  const selected = getSelectedEditorialItem();
  const hasSelection = Boolean(selected?.url || pickerState.selectedUrl);
  const busy = els.generateBtn.dataset.busy === "true";
  els.generateBtn.disabled = busy || !hasSelection;
}

function selectTitleItem(index) {
  const item = pickerState.items[index];
  if (!item?.url) return;
  pickerState.selectedIndex = index;
  pickerState.selectedUrl = item.url;
  els.urlInput.value = item.url;
  renderTitleList();
  updateGenerateButton();
  setStatus(`已选择：${item.title}`, "");
}

async function queryEditorialTitles() {
  const date = els.pickerDateInput.value || calendarState.selectedDate;
  if (!date) {
    setStatus("请选择日期", "warn");
    return;
  }

  pickerState.date = date;
  setSelectedDate(date, { keepBundle: true, keepTitles: true });
  clearPickerSelection();
  updateGenerateButton();

  els.queryTitlesBtn.disabled = true;
  setStatus(`正在查询 ${SOURCE_LABELS[pickerState.source]} ${date} 的社说标题…`);
  try {
    const params = new URLSearchParams({ source: pickerState.source, date });
    const response = await fetch(`/api/editorial/list?${params.toString()}`);
    const data = await readApiJson(response);
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    pickerState.items = data.items || [];
    renderTitleList();
    if (!pickerState.items.length) {
      setStatus(`未找到 ${date} 的社说标题，可换一天或切换新闻源再试。`, "warn");
      updateGenerateButton();
      return;
    }
    if (pickerState.items.length === 1) {
      selectTitleItem(0);
    } else {
      updateGenerateButton();
    }
    setStatus(`找到 ${pickerState.items.length} 篇社说，请选择标题后点击「生成」。`, "ok");
  } catch (error) {
    pickerState.items = [];
    clearPickerSelection();
    renderTitleList();
    setStatus(error.message || "查询标题失败", "error");
  } finally {
    els.queryTitlesBtn.disabled = false;
    updateGenerateButton();
  }
}

async function selectDate(dateKey, options = {}) {
  setSelectedDate(dateKey, options);
  try {
    const bundles = await fetchBundlesForDate(dateKey);
    if (!bundles.length) {
      els.content.classList.add("hidden");
      setStatus("该日尚无本地缓存。请在右侧查询标题并生成。", "");
      return;
    }

    const preferredId = options.bundleId || calendarState.selectedBundleId;
    const target =
      bundles.find((bundle) => bundle.id === preferredId) ||
      (bundles.length === 1 ? bundles[0] : null);

    if (target) {
      await selectBundle(target, { silent: Boolean(options.silent) });
      return;
    }

    renderBundleList();
    setStatus(`已选择 ${dateKey}，请从左侧选择一篇社说。`, "");
  } catch (error) {
    setStatus(error.message, "warn");
  }
}

async function selectBundle(bundle, options = {}) {
  calendarState.selectedBundleId = bundle.id;
  renderBundleList();
  els.urlInput.value = bundle.url || "";
  try {
    await loadCached(bundle.date, { id: bundle.id, url: bundle.url || "" });
    if (!options.silent) setStatus(`已加载：${bundle.title || bundle.id}`, "ok");
  } catch (error) {
    setStatus(error.message, "warn");
  }
}

async function refreshSidebar(dateKey = calendarState.selectedDate) {
  await fetchAvailableDates();
  if (dateKey) await fetchBundlesForDate(dateKey);
}

async function loadCached(date, { url = "", id = "" } = {}) {
  const params = new URLSearchParams({ date });
  if (id) params.set("id", id);
  else if (url) params.set("url", url);
  const response = await fetch(`/api/editorial/day?${params.toString()}`);
  if (!response.ok) throw new Error("本地无缓存，请点击「开始」抓取");
  const data = await readApiJson(response);
  calendarState.selectedBundleId = data.bundle?.id || id || calendarState.selectedBundleId;
  renderBundleList();
  renderBundle(data.bundle);
  setStatus(`已加载缓存：${bundleCacheLabel(data.bundle)}`, "ok");
}

async function runPipeline(date, { url = "", source = pickerState.source, forceFetch = true } = {}) {
  saveSettingsToTrainer();
  const selected = getSelectedEditorialItem();
  const articleUrl = String(url || selected?.url || pickerState.selectedUrl || els.urlInput.value || "").trim();
  if (!articleUrl) {
    setStatus("请先选择一篇社说标题", "warn");
    return;
  }

  setStatus("正在抓取并分析，请稍候…");
  setGenerateBusy(true);
  try {
    const response = await fetch("/api/editorial/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        source,
        url: articleUrl,
        apiKey: els.apiKeyInput.value.trim(),
        model: els.modelInput.value.trim(),
        forceFetch,
        forceAnalyze: forceFetch,
      }),
    });
    const data = await readApiJson(response);
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    calendarState.selectedDate = data.bundle?.date || date;
    calendarState.selectedBundleId = data.bundle?.id || "";
    await refreshSidebar(calendarState.selectedDate);
    renderBundle(data.bundle);
    const stepText = (data.steps || []).join(" → ");
    if (data.warning) setStatus(`${data.warning}（${stepText}）`, "warn");
    else {
      const label = bundleCacheLabel(data.bundle);
      setStatus(data.cached ? `已使用缓存：${label}` : `完成：${stepText}（${label}）`, "ok");
    }
  } catch (error) {
    setStatus(error.message || "处理失败", "error");
  } finally {
    setGenerateBusy(false);
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

els.sourceAsahi.addEventListener("click", () => setPickerSource("asahi"));
els.sourceNikkei.addEventListener("click", () => setPickerSource("nikkei"));

els.pickerDateInput.addEventListener("change", () => {
  const date = els.pickerDateInput.value;
  if (date) setSelectedDate(date);
});

els.queryTitlesBtn.addEventListener("click", () => {
  queryEditorialTitles();
});

els.titleList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-title-index]");
  if (!button) return;
  selectTitleItem(Number(button.dataset.titleIndex));
});

els.generateBtn.addEventListener("click", () => {
  const date = els.pickerDateInput.value || calendarState.selectedDate;
  const selected = getSelectedEditorialItem();
  const articleUrl = selected?.url || pickerState.selectedUrl;
  if (!date) {
    setStatus("请选择日期", "warn");
    return;
  }
  if (!articleUrl) {
    setStatus("请先选择一篇社说标题", "warn");
    return;
  }
  runPipeline(date, { url: articleUrl, source: pickerState.source, forceFetch: true });
});

els.calendarPrev.addEventListener("click", () => {
  calendarState.viewMonth -= 1;
  if (calendarState.viewMonth < 0) {
    calendarState.viewMonth = 11;
    calendarState.viewYear -= 1;
  }
  renderCalendar();
});

els.calendarNext.addEventListener("click", () => {
  calendarState.viewMonth += 1;
  if (calendarState.viewMonth > 11) {
    calendarState.viewMonth = 0;
    calendarState.viewYear += 1;
  }
  renderCalendar();
});

els.calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  selectDate(button.dataset.date);
});

els.bundleList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-bundle-index]");
  if (!button) return;
  const bundle = calendarState.bundles[Number(button.dataset.bundleIndex)];
  if (bundle) selectBundle(bundle);
});

const initialDate = todayKey();
els.dateInput.value = initialDate;
setSelectedDate(initialDate);
setPickerSource("asahi");
loadSettings();
loadServerGeminiHint();
fetchAvailableDates().then(() => {
  selectDate(initialDate, { silent: true }).catch(() => {
    setStatus("本地尚无缓存。请在右侧查询标题并生成。", "");
  });
});
const {
  GROUP_SIZE,
  courses,
  sentenceBank,
  getQueueForCourse,
} = window.JapaneseSentenceTrainerCurriculum;
const {
  checkExactAnswer: coreCheckExactAnswer,
  checkPatternAnswer: coreCheckPatternAnswer,
  createInitialProgress,
  ensureProgressDay,
  getResumeIndexForCourse,
  markCoursePosition,
  markCorrectAnswer,
  createPracticeGroupsForDay,
  getTodayKey,
  serializeProgress,
  deserializeProgress,
  buildSpeechSsml,
  filterCoursesForModule,
  getCurrentDialogueItems,
  getDialogueDisplayText,
  getSpeakerVoice,
  getDialogueGroupsForCourse,
  summarizeDialogueGroupProgress,
} = window.JapaneseSentenceTrainerCore;

const modeLabels = {
  dictation: ["听写", "听到的日语"],
  pattern: ["自由表达", "新的日语句子"],
};

const storageKeys = {
  stats: "jp-sentence-trainer-stats",
  mistakes: "jp-sentence-trainer-mistakes",
  progress: "jp-sentence-trainer-progress",
  settings: "jp-sentence-trainer-settings",
};

const todayKey = getTodayKey();
const progress = deserializeProgress(readJson(storageKeys.progress, null), todayKey);
const defaultSettings = {
  voiceProvider: "microsoft",
  speechRegion: "japaneast",
  speechKey: "",
  speechVoice: "ja-JP-NanamiNeural",
  speakerAVoice: "ja-JP-NanamiNeural",
  speakerBVoice: "ja-JP-KeitaNeural",
  geminiKey: "",
  geminiModel: "gemini-1.5-flash",
  vnMode: true,
  bgProvider: "pollinations",
  siliconKey: "",
  siliconModel: "black-forest-labs/FLUX.1-schnell",
};

const state = {
  module: "life",
  course: "dailylife",
  mode: "dictation",
  index: 0,
  activeDate: progress.activeDate,
  progress,
  lifeSentences: [...sentenceBank],
  allSentences: [...sentenceBank],
  dailyGroups: createPracticeGroupsForDay(sentenceBank, progress.activeDate, GROUP_SIZE),
  dailyGroupIndex: 0,
  groupComplete: false,
  recorder: null,
  recordingChunks: [],
  recordingUrl: "",
  isRecording: false,
  queue: [],
  settings: { ...defaultSettings, ...readJson(storageKeys.settings, {}) },
  stats: readJson(storageKeys.stats, {
    done: 0,
    correct: 0,
  }),
  mistakes: readJson(storageKeys.mistakes, []),
  lastPrefetchedDialogueId: null,
  currentAudio: null,
};

const els = {
  appShell: document.querySelector("#appShell"),
  courseList: document.querySelector("#courseList"),
  courseEyebrow: document.querySelector("#courseEyebrow"),
  lessonTitle: document.querySelector("#lessonTitle"),
  progressSummary: document.querySelector("#progressSummary"),
  sideProgressBar: document.querySelector("#sideProgressBar"),
  sideProgressPercent: document.querySelector("#sideProgressPercent"),
  modeTabs: document.querySelector("#modeTabs"),
  levelPill: document.querySelector("#levelPill"),
  sentencePosition: document.querySelector("#sentencePosition"),
  dialogueThread: document.querySelector("#dialogueThread"),
  kanaLine: document.querySelector("#kanaLine"),
  answerLabel: document.querySelector("#answerLabel"),
  answerInput: document.querySelector("#answerInput"),
  playButton: document.querySelector("#playButton"),
  recordButton: document.querySelector("#recordButton"),
  playRecordingButton: document.querySelector("#playRecordingButton"),
  checkButton: document.querySelector("#checkButton"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  prevGroupButton: document.querySelector("#prevGroupButton"),
  nextGroupButton: document.querySelector("#nextGroupButton"),
  jumpGroupInput: document.querySelector("#jumpGroupInput"),
  jumpGroupButton: document.querySelector("#jumpGroupButton"),
  feedbackPanel: document.querySelector("#feedbackPanel"),
  explainButton: document.querySelector("#explainButton"),
  explainList: document.querySelector("#explainList"),
  voiceProvider: document.querySelector("#voiceProvider"),
  speechRegion: document.querySelector("#speechRegion"),
  speechKey: document.querySelector("#speechKey"),
  speechVoice: document.querySelector("#speechVoice"),
  speakerAVoice: document.querySelector("#speakerAVoice"),
  speakerBVoice: document.querySelector("#speakerBVoice"),
  saveVoiceButton: document.querySelector("#saveVoiceButton"),
  voiceStatus: document.querySelector("#voiceStatus"),
  geminiKey: document.querySelector("#geminiKey"),
  geminiModel: document.querySelector("#geminiModel"),
  saveGeminiButton: document.querySelector("#saveGeminiButton"),
  geminiStatus: document.querySelector("#geminiStatus"),
  bgProvider: document.querySelector("#bgProvider"),
  siliconKey: document.querySelector("#siliconKey"),
  siliconModel: document.querySelector("#siliconModel"),
  saveBgSettingsButton: document.querySelector("#saveBgSettingsButton"),
  bgSettingsStatus: document.querySelector("#bgSettingsStatus"),
  vnModeToggle: document.querySelector("#vnModeToggle"),
  vnStage: document.querySelector("#vnStage"),
  vnBgA: document.querySelector("#vnBgA"),
  vnBgB: document.querySelector("#vnBgB"),
  charLeft: document.querySelector("#charLeft"),
  charRight: document.querySelector("#charRight"),
  vnPrevGroupBtn: document.querySelector("#vnPrevGroupBtn"),
  vnPrevBtn: document.querySelector("#vnPrevBtn"),
  vnPlayBtn: document.querySelector("#vnPlayBtn"),
  vnRecordBtn: document.querySelector("#vnRecordBtn"),
  vnPlayRecordingBtn: document.querySelector("#vnPlayRecordingBtn"),
  vnRegenBgBtn: document.querySelector("#vnRegenBgBtn"),
  vnNextBtn: document.querySelector("#vnNextBtn"),
  vnNextGroupBtn: document.querySelector("#vnNextGroupBtn"),
};

function saveJson(key, value) {
  const payload = JSON.stringify(value);
  localStorage.setItem(key, payload);
  localStorage.setItem(`${key}.backup`, payload);
}

function readJson(key, fallback) {
  for (const candidate of [key, `${key}.backup`]) {
    try {
      const raw = localStorage.getItem(candidate);
      if (raw) return JSON.parse(raw);
    } catch {
      // Try the mirrored key before falling back.
    }
  }
  return fallback;
}

function getQueue() {
  return getQueueForCourse(state.course, state.mistakes, state.allSentences);
}

function getCourseGroups() {
  return getDialogueGroupsForCourse(state.allSentences, state.course);
}

function currentSentence() {
  if (!state.queue.length) return null;
  return state.queue[state.index % state.queue.length];
}

let prefetchAbortController = null;

function getPrefetchSentences() {
  const groups = getCourseGroups();
  const currentGroupIndex = getCurrentGroupIndex(groups);
  const prefetchList = [];

  // Add all sentences in current group
  const currentGroup = groups[currentGroupIndex];
  if (currentGroup) {
    prefetchList.push(...currentGroup);
  }

  // Add all sentences in next group
  const nextGroup = groups[currentGroupIndex + 1];
  if (nextGroup) {
    prefetchList.push(...nextGroup);
  }

  return prefetchList;
}

function triggerVoicevoxPrefetch() {
  if (state.settings.voiceProvider !== "voicevox") return;
  const sentence = currentSentence();
  if (!sentence) return;

  const currentDialogueId = sentence.dialogueId || sentence.id;
  if (state.lastPrefetchedDialogueId === currentDialogueId) {
    return;
  }
  state.lastPrefetchedDialogueId = currentDialogueId;

  if (prefetchAbortController) {
    prefetchAbortController.abort();
  }
  prefetchAbortController = new AbortController();
  const signal = prefetchAbortController.signal;

  const prefetchList = getPrefetchSentences();
  if (!prefetchList.length) return;

  let i = 0;
  const processNext = () => {
    if (signal.aborted || i >= prefetchList.length) return;

    const item = prefetchList[i];
    i++;

    const runPrefetch = async () => {
      try {
        const selectedVoice = getSpeakerVoice(state.settings, item.speaker);
        let speakerId = item.speaker === "B" ? "3" : "2";
        if (selectedVoice && /^\d+$/.test(String(selectedVoice).trim())) {
          speakerId = String(selectedVoice).trim();
        }

        await fetch("/api/voicevox-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.ja, speaker: Number(speakerId) }),
          signal,
        });
      } catch (err) {
        // Silently catch errors or aborts
      }

      if (!signal.aborted) {
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(() => {
            setTimeout(processNext, 800);
          }, { timeout: 2000 });
        } else {
          setTimeout(processNext, 800);
        }
      }
    };

    runPrefetch();
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => processNext(), { timeout: 2000 });
  } else {
    setTimeout(processNext, 100);
  }
}

function render() {
  ensureProgressDay(state.progress, state.activeDate);
  state.queue = getQueue();
  if (state.index >= state.queue.length) state.index = 0;
  state.groupComplete = isCurrentGroupComplete();

  renderCourses();
  renderStats();
  renderTrainer();
  renderDeck();
  renderExplain();
  triggerVoicevoxPrefetch();
  renderVnStage();
}

function renderCourses() {
  els.courseList.innerHTML = "";
  for (const course of filterCoursesForModule(courses, state.module || "life")) {
    const count = getDialogueGroupsForCourse(state.lifeSentences, course.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `course-button${state.course === course.id ? " is-active" : ""}`;
    button.dataset.course = course.id;
    button.innerHTML = `
      <span class="course-icon">${course.icon}</span>
      <span><span class="course-title">${course.label}</span><span class="course-count">${formatCourseCount(course, count)}</span></span>
      <span class="course-count">›</span>
    `;
    els.courseList.append(button);
  }
}

function formatCourseCount(course, count) {
  return `${count} 组`;
}

function isCurrentGroupComplete() {
  const sentence = currentSentence();
  if (!sentence) return false;
  const day = ensureProgressDay(state.progress, state.activeDate);
  const group = getCurrentDialogueItems(state.queue, sentence);
  return group.length > 0 && group.every((item) => day.completedIds.has(item.id));
}

function renderStats() {
  const summary = summarizeDialogueGroupProgress(state.allSentences, state.progress, state.course);
  els.progressSummary.textContent = `${summary.completed} / ${summary.total} 组`;
  els.sideProgressPercent.textContent = `${summary.percent}%`;
  els.sideProgressBar.style.width = `${summary.percent}%`;
}

function persistProgress() {
  state.progress.activeDate = state.activeDate;
  saveJson(storageKeys.progress, serializeProgress(state.progress));
}

function saveCurrentCoursePosition() {
  state.queue = getQueue();
  const sentence = currentSentence();
  if (!sentence) return;
  markCoursePosition(state.progress, state.course, sentence.id);
  localStorage.setItem(`jp-sentence-trainer-last-id-${state.course}`, sentence.id);
  persistProgress();
}

function restoreCoursePosition(courseId) {
  state.queue = getQueue();
  const legacyId = localStorage.getItem(`jp-sentence-trainer-last-id-${courseId}`);
  if (legacyId && !state.progress.coursePositions?.[courseId]) {
    markCoursePosition(state.progress, courseId, legacyId);
  }
  state.index = getResumeIndexForCourse(state.queue, state.allSentences, state.progress, courseId);
  persistProgress();
}

function updateVoiceSettingsUI(provider) {
  const regionLabel = els.speechRegion.parentElement;
  const keyLabel = els.speechKey.parentElement;
  const voiceLabel = els.speechVoice.parentElement;
  const speakerALabel = els.speakerAVoice.parentElement;
  const speakerBLabel = els.speakerBVoice.parentElement;

  if (provider === "voicevox") {
    regionLabel.style.display = "none";
    keyLabel.style.display = "none";
    voiceLabel.style.display = "flex";
    speakerALabel.style.display = "flex";
    speakerBLabel.style.display = "flex";

    voiceLabel.querySelector("span").textContent = "默认音色 ID";
    els.speechVoice.placeholder = "2";

    speakerALabel.querySelector("span").textContent = "Speaker A 音色 ID";
    els.speakerAVoice.placeholder = "2";

    speakerBLabel.querySelector("span").textContent = "Speaker B 音色 ID";
    els.speakerBVoice.placeholder = "3";

    // Auto-migrate values to numbers if they are empty or Microsoft voice names
    if (!els.speechVoice.value || !/^\d+$/.test(els.speechVoice.value.trim())) {
      els.speechVoice.value = "2";
    }
    if (!els.speakerAVoice.value || !/^\d+$/.test(els.speakerAVoice.value.trim())) {
      els.speakerAVoice.value = "2";
    }
    if (!els.speakerBVoice.value || !/^\d+$/.test(els.speakerBVoice.value.trim())) {
      els.speakerBVoice.value = "3";
    }
  } else if (provider === "microsoft") {
    regionLabel.style.display = "flex";
    keyLabel.style.display = "flex";
    voiceLabel.style.display = "flex";
    speakerALabel.style.display = "flex";
    speakerBLabel.style.display = "flex";

    voiceLabel.querySelector("span").textContent = "默认 Voice";
    els.speechVoice.placeholder = "ja-JP-NanamiNeural";

    speakerALabel.querySelector("span").textContent = "Speaker A Voice";
    els.speakerAVoice.placeholder = "ja-JP-NanamiNeural";

    speakerBLabel.querySelector("span").textContent = "Speaker B Voice";
    els.speakerBVoice.placeholder = "ja-JP-KeitaNeural";

    // Auto-migrate values to Microsoft names if they are numeric
    if (!els.speechVoice.value || /^\d+$/.test(els.speechVoice.value.trim())) {
      els.speechVoice.value = defaultSettings.speechVoice;
    }
    if (!els.speakerAVoice.value || /^\d+$/.test(els.speakerAVoice.value.trim())) {
      els.speakerAVoice.value = defaultSettings.speakerAVoice;
    }
    if (!els.speakerBVoice.value || /^\d+$/.test(els.speakerBVoice.value.trim())) {
      els.speakerBVoice.value = defaultSettings.speakerBVoice;
    }
  } else {
    regionLabel.style.display = "none";
    keyLabel.style.display = "none";
    voiceLabel.style.display = "none";
    speakerALabel.style.display = "none";
    speakerBLabel.style.display = "none";
  }
}

function renderVoiceSettings() {
  els.voiceProvider.value = state.settings.voiceProvider;
  els.speechRegion.value = state.settings.speechRegion;
  els.speechKey.value = state.settings.speechKey;
  els.speechVoice.value = state.settings.speechVoice;
  els.speakerAVoice.value = state.settings.speakerAVoice || defaultSettings.speakerAVoice;
  els.speakerBVoice.value = state.settings.speakerBVoice || defaultSettings.speakerBVoice;
  els.geminiKey.value = state.settings.geminiKey || "";
  els.geminiModel.value = state.settings.geminiModel || defaultSettings.geminiModel;
  els.vnModeToggle.checked = !!state.settings.vnMode;
  updateVoiceSettingsUI(state.settings.voiceProvider);

  // Populate background settings
  els.bgProvider.value = state.settings.bgProvider || "pollinations";
  els.siliconKey.value = state.settings.siliconKey || "";
  els.siliconModel.value = state.settings.siliconModel || "black-forest-labs/FLUX.1-schnell";
  updateBgSettingsUI(els.bgProvider.value);
}

function updateBgSettingsUI(provider) {
  const siliconKeyLabel = document.querySelector("#siliconKeyLabel");
  const siliconModelLabel = document.querySelector("#siliconModelLabel");
  if (!siliconKeyLabel || !siliconModelLabel) return;
  if (provider === "siliconflow") {
    siliconKeyLabel.style.display = "grid";
    siliconModelLabel.style.display = "grid";
  } else {
    siliconKeyLabel.style.display = "none";
    siliconModelLabel.style.display = "none";
  }
}

const courseBackgrounds = {
  dailylife: "assets/backgrounds/dailylife.png",
  school: "assets/backgrounds/school.png",
  travel: "assets/backgrounds/travel.png",
  health: "assets/backgrounds/hospital.png",
  entertainment: "assets/backgrounds/social.png",
};

let currentVnBgUrl = "";

async function renderVnStage() {
  const isVn = !!state.settings.vnMode;
  document.body.classList.toggle("vn-active", isVn);
  if (!isVn) return;

  const sentence = currentSentence();
  if (!sentence) {
    const bgUrl = courseBackgrounds[state.course] || "assets/backgrounds/dailylife.png";
    applyVnBackground(bgUrl);
    return;
  }

  const dialogueId = sentence.dialogueId || sentence.id;
  const topicName = sentence.topicName || getLessonTitle(sentence);

  // Retrieve the first Japanese sentence in this dialogue group for unique AI generation context
  const currentDialogue = getCurrentDialogueItems(state.queue, sentence);
  const firstJa = currentDialogue.length > 0 ? currentDialogue[0].ja : sentence.ja;

  try {
    const response = await fetch("/api/generate-background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dialogueId,
        topicName,
        firstJa,
        bgProvider: state.settings.bgProvider,
        siliconKey: state.settings.siliconKey,
        siliconModel: state.settings.siliconModel
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.url) {
        applyVnBackground(data.url);
        preloadNextGroupBackground();
        return;
      }
    }
  } catch (error) {
    console.error("Failed to fetch dynamic background, falling back:", error);
  }

  const bgUrl = courseBackgrounds[state.course] || "assets/backgrounds/dailylife.png";
  applyVnBackground(bgUrl);
}

function applyVnBackground(imgUrl) {
  if (currentVnBgUrl === imgUrl) return;
  currentVnBgUrl = imgUrl;

  const activeLayer = els.vnBgA.classList.contains("is-active") ? els.vnBgA : els.vnBgB;
  const inactiveLayer = activeLayer === els.vnBgA ? els.vnBgB : els.vnBgA;

  const img = new Image();
  img.onload = () => {
    inactiveLayer.style.backgroundImage = `url('${imgUrl}')`;
    inactiveLayer.classList.add("is-active");
    activeLayer.classList.remove("is-active");
  };
  img.src = imgUrl;
}

async function preloadNextGroupBackground() {
  const groups = getCourseGroups();
  const currentGroupIndex = getCurrentGroupIndex(groups);
  const nextGroup = groups[currentGroupIndex + 1];
  
  if (nextGroup && nextGroup.length > 0) {
    const nextSentence = nextGroup[0];
    const dialogueId = nextSentence.dialogueId || nextSentence.id;
    const topicName = nextSentence.topicName || getLessonTitle(nextSentence);
    const firstJa = nextSentence.ja;
    
    try {
      fetch("/api/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogueId,
          topicName,
          firstJa,
          bgProvider: state.settings.bgProvider,
          siliconKey: state.settings.siliconKey,
          siliconModel: state.settings.siliconModel
        })
      });
    } catch (err) {
      // Quietly swallow preloading errors
    }
  }
}

async function regenerateCurrentBackground() {
  const sentence = currentSentence();
  if (!sentence) return;

  const btn = els.vnRegenBgBtn;
  if (!btn) return;

  const originalText = btn.textContent;
  btn.textContent = "⏳ 生成中...";
  btn.disabled = true;

  const dialogueId = sentence.dialogueId || sentence.id;
  const topicName = sentence.topicName || getLessonTitle(sentence);

  const currentDialogue = getCurrentDialogueItems(state.queue, sentence);
  const firstJa = currentDialogue.length > 0 ? currentDialogue[0].ja : sentence.ja;

  try {
    const response = await fetch("/api/generate-background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dialogueId,
        topicName,
        firstJa,
        force: true,
        bgProvider: state.settings.bgProvider,
        siliconKey: state.settings.siliconKey,
        siliconModel: state.settings.siliconModel
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.url) {
        applyVnBackground(data.url);
      }
    }
  } catch (error) {
    console.error("Failed to regenerate background:", error);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function animateVnSpeaker(speaker, audio) {
  if (!state.settings.vnMode) return;

  const charLeft = els.charLeft;
  const charRight = els.charRight;

  if (!charLeft || !charRight) return;

  if (speaker === "A") {
    charLeft.classList.add("is-talking");
    charLeft.classList.remove("is-silent");
    charRight.classList.remove("is-talking");
    charRight.classList.add("is-silent");
  } else if (speaker === "B") {
    charRight.classList.add("is-talking");
    charRight.classList.remove("is-silent");
    charLeft.classList.remove("is-talking");
    charLeft.classList.add("is-silent");
  } else {
    charLeft.classList.remove("is-talking", "is-silent");
    charRight.classList.remove("is-talking", "is-silent");
  }

  if (audio) {
    audio.addEventListener("ended", () => {
      charLeft.classList.remove("is-talking", "is-silent");
      charRight.classList.remove("is-talking", "is-silent");
    }, { once: true });
  }
}

function renderTrainer() {
  const sentence = currentSentence();
  const course = courses.find((item) => item.id === state.course);
  els.courseEyebrow.textContent = course?.label ?? "对话主题";
  els.lessonTitle.textContent = sentence ? getLessonTitle(sentence) : "暂无句子";

  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });

  if (!sentence) {
    els.levelPill.textContent = "复习";
    els.sentencePosition.textContent = "0 / 0";
    els.dialogueThread.innerHTML = `<div class="chat-empty">当前主题没有可练习的句子。</div>`;
    els.kanaLine.textContent = "";
    els.answerInput.value = "";
    els.answerInput.disabled = true;
    els.jumpGroupInput.value = 1;
    els.jumpGroupInput.max = 1;
    els.nextButton.textContent = "下一句";
    setFeedback("暂无句子", "请选择左侧其他主题。", "");
    const container = document.querySelector("#translationList");
    if (container) container.innerHTML = `<div class="chat-empty" style="font-size: 14px; color: var(--muted); text-align: center; padding: 12px;">暂无句子。</div>`;
    return;
  }

  els.answerInput.disabled = false;
  els.levelPill.textContent = sentence.level;
  els.sentencePosition.textContent = getSentencePosition();
  updateGroupJumpControl();
  els.answerLabel.textContent = modeLabels[state.mode][1];
  els.answerInput.value = "";
  els.answerInput.placeholder = getPlaceholder();
  renderDialogueThread();

  if (state.mode === "dictation") {
    els.kanaLine.textContent = `${sentence.topicName || getLessonTitle(sentence)} / Speaker ${sentence.speaker || "-"}`;
  } else if (state.mode === "pattern") {
    els.kanaLine.textContent = `句型：${sentence.pattern} / 参考句：${sentence.ja}`;
  } else {
    els.kanaLine.textContent = `${sentence.topicName || getLessonTitle(sentence)} / Speaker ${sentence.speaker || "-"}`;
  }

  els.nextButton.textContent = getNextButtonLabel();
  setFeedback("准备开始", "等待输入。", "");

  if (sentence && state.settings.vnMode) {
    markSentenceAnswered(sentence);
  }
  renderGroupTranslation();
  renderVnStage();
}

function getLessonTitle(sentence) {
  return courses.find((course) => course.id === sentence.scene)?.label ?? "对话训练";
}

function getSentencePosition() {
  const groups = getCourseGroups();
  const groupIndex = getCurrentGroupIndex(groups);
  const currentDialogue = getCurrentDialogueItems(state.queue, currentSentence());
  const turnIndex = currentDialogue.findIndex((item) => item.id === currentSentence()?.id);
  return `第 ${groupIndex + 1} / ${groups.length} 组 · ${turnIndex + 1} / ${currentDialogue.length} 句`;
}

function getNextButtonLabel() {
  return "下一句";
}

function getPlaceholder() {
  if (state.mode === "pattern") return "用当前句型写一个新句子";
  return "听音频后输入日语";
}

function renderDialogueThread() {
  const currentDialogue = getCurrentDialogueItems(state.queue, currentSentence());
  if (!currentDialogue.length) {
    els.dialogueThread.innerHTML = `<div class="chat-empty">暂无对话。</div>`;
    return;
  }

  els.dialogueThread.innerHTML = "";
  const current = currentSentence();
  currentDialogue.forEach((sentence) => {
    const index = state.queue.findIndex((item) => item.id === sentence.id);
    const item = document.createElement("button");
    item.type = "button";
    const active = index === state.index ? " is-active" : "";
    const side = sentence.speaker === "B" ? " from-b" : " from-a";
    item.className = `chat-bubble${side}${active}`;
    item.dataset.index = index;
    const textToShow = state.settings.vnMode ? sentence.ja : getDialogueDisplayText(sentence, current, state.mode);
    item.innerHTML = `<strong>${escapeHtml(sentence.speaker || "")}</strong><span>${escapeHtml(textToShow)}</span>`;
    els.dialogueThread.append(item);
  });
}

function renderDeck() {
  renderDialogueThread();
}

let activeTranslationFetchId = null;

async function fetchGroupTranslation(dialogueId, currentDialogue) {
  const key = state.settings.geminiKey;
  const model = state.settings.geminiModel || "gemini-1.5-flash";
  if (!key) return null;

  try {
    const lines = currentDialogue.map(line => ({
      id: line.id,
      speaker: line.speaker || "",
      ja: line.ja || ""
    }));

    const promptText = `请将下面这组日语对话翻译为中文。你必须仅返回一个合法的 JSON 格式对象，不要包含任何 markdown 格式标记（如 \`\`\`json ）。该对象的键为每句对话的 id，值为对应的中文翻译。

对话内容：
${JSON.stringify(lines, null, 2)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) throw new Error(`Gemini translation failed: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
    
    let cleanText = text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    }
    const translations = JSON.parse(cleanText.trim());
    return translations;
  } catch (error) {
    console.error("Gemini translation error:", error);
    return null;
  }
}

function renderGroupTranslation() {
  const container = document.querySelector("#translationList");
  if (!container) return;

  const currentDialogue = getCurrentDialogueItems(state.queue, currentSentence());
  if (!currentDialogue.length) {
    container.innerHTML = `<div class="chat-empty" style="font-size: 14px; color: var(--muted); text-align: center; padding: 12px;">暂无翻译。</div>`;
    return;
  }

  const current = currentSentence();
  const dialogueId = current?.dialogueId || current?.id;

  // 1. Try to read from cache first
  const cacheKey = `jp-sentence-trainer-trans-${dialogueId}`;
  let cachedTrans = readJson(cacheKey, null);

  // If no cache but we have pre-defined zh in the sentence (like news), let's create a temporary cache object
  if (!cachedTrans) {
    const hasPredefinedZh = currentDialogue.some(s => s.zh);
    if (hasPredefinedZh) {
      cachedTrans = {};
      currentDialogue.forEach(s => {
        cachedTrans[s.id] = s.zh;
      });
    }
  }

  // 2. Render the translations list if we have it
  if (cachedTrans) {
    container.innerHTML = currentDialogue
      .map((sentence) => {
        const isCurrent = sentence.id === current?.id;
        const translationText = cachedTrans[sentence.id] || sentence.zh || "";
        const bgStyle = isCurrent 
          ? "background: rgba(224, 169, 109, 0.12); font-weight: 700; color: var(--ink); border-left: 3px solid var(--green); padding: 6px 8px; border-radius: 0 4px 4px 0;" 
          : "color: var(--muted); padding: 6px 8px;";
        return `<div style="margin: 6px 0; font-size: 13.5px; line-height: 1.5; transition: all 0.2s; ${bgStyle}"><strong>${escapeHtml(sentence.speaker || "")}：</strong>${escapeHtml(translationText || "（暂无翻译）")}</div>`;
      })
      .join("");
    return;
  }

  // 3. If no cache and no predefined zh
  if (!state.settings.geminiKey) {
    container.innerHTML = `
      <div style="font-size: 13px; color: var(--muted); padding: 12px 8px; line-height: 1.6; text-align: center;">
        <span style="display: block; margin-bottom: 6px; font-weight: bold; color: var(--green);">💡 智能翻译说明</span>
        本对话暂无翻译。请在左侧配置并保存 <strong>Gemini API Key</strong>，系统将自动通过 AI 翻译该组对话。
      </div>
    `;
    return;
  }

  // If we have Gemini key, show a loading status and trigger fetch
  container.innerHTML = `<div class="chat-empty" style="font-size: 13.5px; color: var(--muted); text-align: center; padding: 16px;">正在通过 Gemini AI 翻译对话，请稍候...</div>`;

  if (activeTranslationFetchId !== dialogueId) {
    activeTranslationFetchId = dialogueId;
    fetchGroupTranslation(dialogueId, currentDialogue).then((translations) => {
      if (translations && activeTranslationFetchId === dialogueId) {
        saveJson(cacheKey, translations);
        renderGroupTranslation();
      }
    });
  }
}

function renderExplain() {
  const sentence = currentSentence();
  if (!sentence) {
    els.explainList.innerHTML = `<div class="explain-item">完成练习后，这里会显示当前句子的拆解。</div>`;
    return;
  }

  const cached = readJson(getExplanationCacheKey(sentence), null);
  if (cached?.html) {
    els.explainList.innerHTML = cached.html;
    return;
  }

  const contextHtml = [...(sentence.contextBefore || []), { speaker: sentence.speaker || "", text: sentence.ja }, ...(sentence.contextAfter || [])]
    .map((line) => `<p style="margin: 0 0 8px 0; font-size: 15px;"><strong>${escapeHtml(line.speaker)}：</strong>${escapeHtml(line.text)}</p>`)
    .join("");
  const notesHtml = sentence.notes
    .map(([title, body]) => `<p style="margin: 8px 0 0 0; font-size: 15px;"><strong>${title}</strong><br />${body}</p>`)
    .join("");

  els.explainList.innerHTML = `
    <div class="explain-item" style="padding: 16px; border-radius: 12px; line-height: 1.6;">
      <div style="margin-bottom: 12px; font-weight: 700; border-bottom: 1px solid var(--line); padding-bottom: 8px; font-size: 15px; color: var(--ink);">对话参考与场景</div>
      <div style="font-size: 15px; color: var(--muted);">
        ${contextHtml}
        ${notesHtml ? `<div style="margin: 12px 0 8px 0; border-top: 1px dashed var(--line); padding-top: 8px;"></div>${notesHtml}` : ""}
      </div>
    </div>
  `;

  // 自动触发生成 AI 讲解 (进入该组会话后自动调用)
  if (state.settings.geminiKey && state.fetchingExplanationSentenceId !== sentence.id) {
    refreshGeminiExplanation();
  }
}

function checkAnswer() {
  const sentence = currentSentence();
  if (!sentence) return;

  const raw = els.answerInput.value;
  const answer = raw.trim();
  if (!answer) {
    setFeedback("还没有输入", "先写下你的答案。", "wrong");
    return;
  }

  let result;
  if (state.mode === "pattern") {
    result = checkPatternAnswer(sentence, answer);
  } else {
    result = checkExactAnswer(sentence, answer);
  }

  state.stats.done += 1;
  if (result.correct) {
    state.stats.correct += 1;
    removeResolvedMistake(sentence.id);
    setFeedback("正确", result.message, "correct");
  } else {
    addMistake(sentence, result.reason, result.particles);
    setFeedback("再改一次", result.message, "wrong", result.diff);
  }

  if (result.markComplete) {
    markSentenceAnswered(sentence);
  }
  persistProgress();
  saveJson(storageKeys.stats, state.stats);
  saveJson(storageKeys.mistakes, state.mistakes);
  renderStats();
  renderDeck();
  updateGroupProgressAfterAnswer();
}

function markSentenceAnswered(sentence) {
  markCorrectAnswer(state.progress, state.activeDate, sentence.id);
  persistProgress();
  renderStats();
}

function updateGroupProgressAfterAnswer() {
  state.groupComplete = isCurrentGroupComplete();
  els.sentencePosition.textContent = getSentencePosition();
  els.nextButton.textContent = getNextButtonLabel();
  renderStats();
}

function checkExactAnswer(sentence, answer) {
  return coreCheckExactAnswer(sentence, answer);
}

function checkPatternAnswer(sentence, answer) {
  return coreCheckPatternAnswer(sentence, answer);
}

function addMistake(sentence, reason, particles) {
  const current = state.mistakes.find((item) => item.id === sentence.id);
  if (current) {
    current.count += 1;
    current.reason = reason;
    current.particles = particles;
    current.updatedAt = new Date().toISOString();
  } else {
    state.mistakes.unshift({
      id: sentence.id,
      count: 1,
      reason,
      particles,
      updatedAt: new Date().toISOString(),
    });
  }
}

function removeResolvedMistake(id) {
  state.mistakes = state.mistakes.filter((item) => item.id !== id);
}

function setFeedback(title, body, status, diff = "") {
  els.feedbackPanel.className = `feedback${status ? ` is-${status}` : ""}`;
  els.feedbackPanel.innerHTML = `
    <div class="feedback-title">${title}</div>
    <div class="feedback-body">${body}</div>
    ${diff ? `<div class="diff">${diff}</div>` : ""}
  `;
}

async function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setFeedback("无法录音", "当前浏览器不支持录音功能。", "wrong");
    return;
  }

  try {
    clearRecording();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordingChunks = [];
    state.recorder = new MediaRecorder(stream);
    state.recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) state.recordingChunks.push(event.data);
    });
    state.recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(state.recordingChunks, { type: state.recorder.mimeType || "audio/webm" });
      state.recordingUrl = URL.createObjectURL(blob);
      state.isRecording = false;
      els.recordButton.textContent = "录";
      els.recordButton.classList.remove("is-recording");
      els.playRecordingButton.disabled = false;
      if (els.vnRecordBtn) {
        els.vnRecordBtn.textContent = "🎙 录音";
        els.vnRecordBtn.classList.remove("is-recording");
      }
      if (els.vnPlayRecordingBtn) {
        els.vnPlayRecordingBtn.disabled = false;
      }
      setFeedback("录音完成", "可以播放自己的录音，或重新录一遍。", "");
    });
    state.recorder.start();
    state.isRecording = true;
    els.recordButton.textContent = "停";
    els.recordButton.classList.add("is-recording");
    els.playRecordingButton.disabled = true;
    if (els.vnRecordBtn) {
      els.vnRecordBtn.textContent = "🛑 停止";
      els.vnRecordBtn.classList.add("is-recording");
    }
    if (els.vnPlayRecordingBtn) {
      els.vnPlayRecordingBtn.disabled = true;
    }
    setFeedback("录音中", "再次点击“停”结束录音。", "");
  } catch (error) {
    setFeedback("麦克风不可用", "请允许浏览器使用麦克风后再试。", "wrong");
  }
}

function stopRecording() {
  if (state.recorder?.state === "recording") state.recorder.stop();
}

function clearRecording() {
  if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
  state.recordingUrl = "";
  state.recordingChunks = [];
  state.recorder = null;
  state.isRecording = false;
  els.recordButton.textContent = "录";
  els.recordButton.classList.remove("is-recording");
  els.playRecordingButton.disabled = true;
  if (els.vnRecordBtn) {
    els.vnRecordBtn.textContent = "🎙 录音";
    els.vnRecordBtn.classList.remove("is-recording");
  }
  if (els.vnPlayRecordingBtn) {
    els.vnPlayRecordingBtn.disabled = true;
  }
}

async function playUserRecording() {
  if (!state.recordingUrl) return;
  await new Audio(state.recordingUrl).play();
}

function stopCurrentSpeech() {
  if (state.currentAudio) {
    try {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
    } catch (e) {
      // Quietly ignore errors
    }
    state.currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

async function playSentence() {
  stopCurrentSpeech();

  const sentence = currentSentence();
  if (!sentence) return;
  const speaker = sentence.speaker || "A";

  if (state.settings.voiceProvider === "voicevox") {
    try {
      const selectedVoice = getSpeakerVoice(state.settings, sentence.speaker);
      let speakerId = sentence.speaker === "B" ? "3" : "2";
      if (selectedVoice && /^\d+$/.test(String(selectedVoice).trim())) {
        speakerId = String(selectedVoice).trim();
      }
      const audio = await playVoicevoxSpeech(sentence.ja, speakerId);
      animateVnSpeaker(speaker, audio);
      return;
    } catch (error) {
      els.voiceStatus.textContent = "VOICEVOX 语音失败（请检查本地引擎是否开启），已回退到浏览器语音。";
    }
  } else if (state.settings.voiceProvider === "microsoft" && state.settings.speechKey) {
    try {
      const audio = await playMicrosoftSpeech(sentence.ja, getSpeakerVoice(state.settings, sentence.speaker));
      animateVnSpeaker(speaker, audio);
      return;
    } catch (error) {
      els.voiceStatus.textContent = "微软语音失败，已回退到浏览器语音。";
    }
  }

  const utterance = playBrowserSpeech(sentence.ja);
  if (utterance) {
    utterance.onstart = () => animateVnSpeaker(speaker, null);
    utterance.onend = () => animateVnSpeaker(null, null);
    utterance.onerror = () => animateVnSpeaker(null, null);
  }
}

async function playVoicevoxSpeech(text, speakerId) {
  stopCurrentSpeech();

  const response = await fetch("/api/voicevox-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speaker: speakerId }),
  });

  if (!response.ok) throw new Error(`VOICEVOX Speech failed: ${response.status}`);

  const audio = new Audio(URL.createObjectURL(await response.blob()));
  state.currentAudio = audio;
  audio.addEventListener("ended", () => {
    URL.revokeObjectURL(audio.src);
    if (state.currentAudio === audio) state.currentAudio = null;
  }, { once: true });
  await audio.play();
  els.voiceStatus.textContent = `VOICEVOX 语音：Speaker ${speakerId}`;
  return audio;
}

async function playMicrosoftSpeech(text, selectedVoice = state.settings.speechVoice) {
  stopCurrentSpeech();

  const region = state.settings.speechRegion.trim();
  const voice = selectedVoice.trim();
  const key = state.settings.speechKey.trim();
  if (!region || !voice || !key) throw new Error("Missing Microsoft Speech configuration");

  const ssml = buildSpeechSsml(voice, text);
  let response = await fetch("/api/microsoft-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region, key, voice, text, ssml }),
  });

  if (response.status === 404 || response.status === 405) {
    response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      },
      body: ssml,
    });
  }

  if (!response.ok) throw new Error(`Microsoft Speech failed: ${response.status}`);

  const audio = new Audio(URL.createObjectURL(await response.blob()));
  state.currentAudio = audio;
  audio.addEventListener("ended", () => {
    URL.revokeObjectURL(audio.src);
    if (state.currentAudio === audio) state.currentAudio = null;
  }, { once: true });
  await audio.play();
  els.voiceStatus.textContent = `微软语音：${voice}`;
  return audio;
}

async function playMicrosoftSpeechDirect(text) {
  const region = state.settings.speechRegion.trim();
  const voice = state.settings.speechVoice.trim();
  const key = state.settings.speechKey.trim();
  const ssml = buildSpeechSsml(voice, text);
  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    },
    body: ssml,
  });
  if (!response.ok) throw new Error(`Microsoft Speech failed: ${response.status}`);

  const audio = new Audio(URL.createObjectURL(await response.blob()));
  audio.addEventListener("ended", () => URL.revokeObjectURL(audio.src), { once: true });
  await audio.play();
  els.voiceStatus.textContent = `微软语音：${voice}`;
}

function playBrowserSpeech(text) {
  if (!("speechSynthesis" in window)) return null;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

function saveVoiceSettings() {
  state.settings = {
    ...state.settings,
    voiceProvider: els.voiceProvider.value,
    speechRegion: els.speechRegion.value.trim() || defaultSettings.speechRegion,
    speechKey: els.speechKey.value.trim(),
    speechVoice: els.speechVoice.value.trim() || defaultSettings.speechVoice,
    speakerAVoice: els.speakerAVoice.value.trim() || defaultSettings.speakerAVoice,
    speakerBVoice: els.speakerBVoice.value.trim() || defaultSettings.speakerBVoice,
    vnMode: !!els.vnModeToggle.checked,
  };
  saveJson(storageKeys.settings, state.settings);
  renderVnStage();

  if (state.settings.voiceProvider === "voicevox") {
    els.voiceStatus.textContent = "VOICEVOX 本地语音配置已保存。";
  } else if (state.settings.voiceProvider === "browser") {
    els.voiceStatus.textContent = "已切换为浏览器原生语音。";
  } else {
    els.voiceStatus.textContent = state.settings.speechKey
      ? "微软语音配置已保存到本机浏览器。"
      : "微软语音未填写 API Key，将回退到浏览器语音。";
  }
}

function saveGeminiSettings() {
  state.settings = {
    ...state.settings,
    geminiKey: els.geminiKey.value.trim(),
    geminiModel: els.geminiModel.value.trim() || defaultSettings.geminiModel,
  };
  saveJson(storageKeys.settings, state.settings);
  els.geminiStatus.textContent = state.settings.geminiKey ? "Gemini 配置已保存到本机浏览器。" : "未填写 Gemini API Key。";
}

function saveBgSettings() {
  state.settings = {
    ...state.settings,
    bgProvider: els.bgProvider.value,
    siliconKey: els.siliconKey.value.trim(),
    siliconModel: els.siliconModel.value.trim() || "black-forest-labs/FLUX.1-schnell",
  };
  saveJson(storageKeys.settings, state.settings);
  els.bgSettingsStatus.textContent = "AI 背景图配置已保存！";
  renderVnStage();
}

async function refreshGeminiExplanation() {
  const sentence = currentSentence();
  if (!sentence) return;
  if (!state.settings.geminiKey) {
    els.geminiStatus.textContent = "请先填写并保存 Gemini API Key。";
    els.explainList.innerHTML = `<div class="explain-item" style="color: var(--coral); padding: 16px; border-radius: 12px; line-height: 1.6;">请先在左侧“Gemini 配置”中填写并保存您的 API Key。</div>`;
    return;
  }

  els.geminiStatus.textContent = "正在生成讲解...";
  els.explainList.innerHTML = `<div class="explain-item" style="color: var(--muted); text-align: center; padding: 24px; border-radius: 12px; line-height: 1.6;">正在生成 AI 讲解，请稍候...</div>`;
  state.fetchingExplanationSentenceId = sentence.id;
  try {
    const explanation = await requestGeminiExplanation(sentence);
    const html = explanationToHtml(explanation);
    saveJson(getExplanationCacheKey(sentence), { html, generatedAt: new Date().toISOString() });
    
    if (currentSentence()?.id === sentence.id) {
      els.explainList.innerHTML = html;
    }
    els.geminiStatus.textContent = "讲解已生成并缓存。";
  } catch (error) {
    if (currentSentence()?.id === sentence.id) {
      els.geminiStatus.textContent = "Gemini 讲解失败，请检查 API Key 或本地服务。";
      els.explainList.innerHTML = `<div class="explain-item" style="color: var(--coral); padding: 16px; border-radius: 12px; line-height: 1.6;">Gemini 讲解生成失败。请检查您的 API Key 是否有效，或本地 Node 服务是否正常运行。</div>`;
    }
  } finally {
    if (state.fetchingExplanationSentenceId === sentence.id) {
      state.fetchingExplanationSentenceId = null;
    }
  }
}

async function requestGeminiExplanation(sentence) {
  const currentDialogue = getCurrentDialogueItems(state.queue, sentence);
  const dialogueLines = currentDialogue.map(line => ({
    speaker: line.speaker || "",
    ja: line.ja || "",
    pattern: line.pattern || ""
  }));

  const payload = {
    key: state.settings.geminiKey,
    model: state.settings.geminiModel || defaultSettings.geminiModel,
    sentence: {
      ja: sentence.ja,
      speaker: sentence.speaker,
      topicName: sentence.topicName || "",
      dialogueId: sentence.dialogueId || "",
      dialogueLines: dialogueLines,
      pattern: sentence.pattern,
      particleAnswer: sentence.particleAnswer || [],
    },
  };
  let response = await fetch("/api/gemini-explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.status === 404 || response.status === 405) {
    response = await fetchGeminiDirect(payload);
  }
  if (!response.ok) throw new Error(`Gemini failed: ${response.status}`);
  const data = await response.json();
  return data.explanation || data.text || data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
}

async function fetchGeminiDirect(payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(payload.model)}:generateContent?key=${encodeURIComponent(payload.key)}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiRequestBody(payload.sentence)),
  });
}

function buildGeminiRequestBody(sentence) {
  return {
    contents: [
      {
        parts: [
          {
            text: `请用中文说明下面日语对话组的场景、文法、词汇，固定输出三段：场景说明、核心文法、重点词汇。重点解释学习者容易误解的词和文法，不要泛泛聊天。不要超过400字。\n${formatDialogueForGemini(sentence)}`,
          },
        ],
      },
    ],
  };
}

function formatDialogueForGemini(sentence) {
  const topic = sentence.topicName || "";
  if (sentence.dialogueLines && sentence.dialogueLines.length > 0) {
    const linesStr = sentence.dialogueLines
      .map((line) => `${line.speaker || ""}: ${line.ja || ""}${line.pattern && line.pattern !== "会话表达" ? ` (重要句型: ${line.pattern})` : ""}`)
      .join("\n");
    return `主题：${topic}\n完整对话内容：\n${linesStr}`;
  }
  const before = (sentence.contextBefore || []).map((line) => `${line.speaker || ""}: ${line.text || ""}`).join("\n");
  const after = (sentence.contextAfter || []).map((line) => `${line.speaker || ""}: ${line.text || ""}`).join("\n");
  return `主题：${topic}\n前文：\n${before}\n当前句：\n${sentence.speaker || ""}: ${sentence.ja || ""}\n后文：\n${after}\n重要句型：${sentence.pattern || ""}`;
}

function explanationToHtml(text) {
  let inList = false;
  
  const htmlLines = String(text || "")
    .split(/\n/)
    .map((line) => {
      let trimmed = line.trim();
      if (!trimmed) {
        if (inList) {
          inList = false;
          return "</ul>";
        }
        return "";
      }
      
      // Escape HTML to prevent injection, but allow our custom formatting later
      let escaped = escapeHtml(trimmed);
      
      // Bold text **bold**
      escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      
      // Headings ### or ## or #
      if (escaped.startsWith("### ")) {
        const headerText = escaped.substring(4);
        if (inList) {
          inList = false;
          return "</ul>" + `<h3 style="margin: 18px 0 10px 0; font-size: 16px; color: var(--ink); font-weight: bold; border-bottom: 1px dashed var(--line); padding-bottom: 6px;">${headerText}</h3>`;
        }
        return `<h3 style="margin: 18px 0 10px 0; font-size: 16px; color: var(--ink); font-weight: bold; border-bottom: 1px dashed var(--line); padding-bottom: 6px;">${headerText}</h3>`;
      }
      if (escaped.startsWith("## ")) {
        const headerText = escaped.substring(3);
        if (inList) {
          inList = false;
          return "</ul>" + `<h4 style="margin: 20px 0 12px 0; font-size: 17px; color: var(--ink); font-weight: bold;">${headerText}</h4>`;
        }
        return `<h4 style="margin: 20px 0 12px 0; font-size: 17px; color: var(--ink); font-weight: bold;">${headerText}</h4>`;
      }
      if (escaped.startsWith("# ")) {
        const headerText = escaped.substring(2);
        if (inList) {
          inList = false;
          return "</ul>" + `<h4 style="margin: 22px 0 14px 0; font-size: 18px; color: var(--ink); font-weight: bold;">${headerText}</h4>`;
        }
        return `<h4 style="margin: 22px 0 14px 0; font-size: 18px; color: var(--ink); font-weight: bold;">${headerText}</h4>`;
      }
      
      // Lists - or *
      if (escaped.startsWith("- ") || escaped.startsWith("* ") || escaped.startsWith("• ")) {
        const content = escaped.substring(2);
        if (!inList) {
          inList = true;
          return `<ul style="margin: 6px 0; padding-left: 20px; list-style-type: disc;"><li style="margin: 4px 0; line-height: 1.6; font-size: 14.5px; color: var(--muted);">${content}</li>`;
        }
        return `<li style="margin: 4px 0; line-height: 1.6; font-size: 14.5px; color: var(--muted);">${content}</li>`;
      }
      
      // Regular paragraph
      if (inList) {
        inList = false;
        return "</ul>" + `<p style="margin: 0 0 10px 0; line-height: 1.65; font-size: 14.5px; color: var(--muted);">${escaped}</p>`;
      }
      return `<p style="margin: 0 0 10px 0; line-height: 1.65; font-size: 14.5px; color: var(--muted);">${escaped}</p>`;
    })
    .filter(Boolean);
    
  if (inList) {
    htmlLines.push("</ul>");
  }
  
  return `<div class="explain-item" style="padding: 16px; border-radius: 12px; line-height: 1.65;">${htmlLines.join("")}</div>`;
}

function getExplanationCacheKey(sentence) {
  const key = sentence.dialogueId || sentence.id;
  return `jp-sentence-trainer-explain-${key}`;
}

function getCurrentGroupIndex(groups = getCourseGroups()) {
  const sentence = currentSentence();
  if (!sentence) return 0;
  const index = groups.findIndex((group) => group.some((item) => item.dialogueId === sentence.dialogueId));
  return Math.max(0, index);
}

function jumpToGroupNumber(groupNumber) {
  const groups = getCourseGroups();
  if (!groups.length) return;
  const targetIndex = Math.min(Math.max(Number(groupNumber) - 1 || 0, 0), groups.length - 1);
  const firstId = groups[targetIndex][0]?.id;
  const queueIndex = state.queue.findIndex((item) => item.id === firstId);
  state.index = queueIndex >= 0 ? queueIndex : 0;

  const sentence = currentSentence();
  if (sentence && state.settings.vnMode) {
    markSentenceAnswered(sentence);
  }

  saveCurrentCoursePosition();
  clearRecording();
  renderTrainer();
  renderExplain();
  if (state.settings.vnMode) {
    playSentence();
  } else {
    els.answerInput.focus();
  }
}

function updateGroupJumpControl() {
  const groups = getCourseGroups();
  const groupIndex = getCurrentGroupIndex(groups);
  els.jumpGroupInput.max = Math.max(1, groups.length);
  els.jumpGroupInput.value = Math.min(groupIndex + 1, Math.max(1, groups.length));
  els.prevGroupButton.disabled = groupIndex <= 0;
  els.nextGroupButton.disabled = groupIndex >= groups.length - 1;
}

function previousGroup() {
  jumpToGroupNumber(getCurrentGroupIndex() || 1);
}

function nextGroup() {
  jumpToGroupNumber(getCurrentGroupIndex() + 2);
}

function nextSentence() {
  if (!state.queue.length) return;
  state.index = (state.index + 1) % state.queue.length;

  const sentence = currentSentence();
  if (sentence && state.settings.vnMode) {
    markSentenceAnswered(sentence);
  }

  saveCurrentCoursePosition();
  clearRecording();
  renderTrainer();
  renderExplain();
  if (state.settings.vnMode) {
    playSentence();
  } else {
    els.answerInput.focus();
  }
}

function previousSentence() {
  if (!state.queue.length) return;
  state.index = (state.index - 1 + state.queue.length) % state.queue.length;

  const sentence = currentSentence();
  if (sentence && state.settings.vnMode) {
    markSentenceAnswered(sentence);
  }

  saveCurrentCoursePosition();
  clearRecording();
  renderTrainer();
  renderExplain();
  if (state.settings.vnMode) {
    playSentence();
  } else {
    els.answerInput.focus();
  }
}

function chooseCourse(courseId) {
  saveCurrentCoursePosition();
  state.course = courseId;
  state.groupComplete = false;
  clearRecording();

  const loadAndSetIndex = () => {
    restoreCoursePosition(courseId);
  };

  if (!loadedCourseItems[courseId]) {
    loadCourseDialogue(courseId).then((items) => {
      if (items) {
        updateStateSentences();
        loadAndSetIndex();
        render();
      }
    });
  } else {
    loadAndSetIndex();
    render();
  }
  els.answerInput.focus();
}

const loadedCourseItems = {};

async function loadCourseDialogue(courseId) {
  if (loadedCourseItems[courseId]) return loadedCourseItems[courseId];
  try {
    const response = await fetch(`../content_archive/dialogue_${courseId}.json`, { cache: "no-store" });
    if (!response.ok) return null;
    const bundle = await response.json();
    const items = normalizeDialogueItems(bundle.items ?? []);
    if (items.length) {
      loadedCourseItems[courseId] = items;
    }
    return items;
  } catch (error) {
    console.error(`Failed to load dialogue for ${courseId}:`, error);
    return null;
  }
}

function updateStateSentences() {
  const loadedCourseIds = new Set(Object.keys(loadedCourseItems));
  let allItems = sentenceBank.filter((item) => !loadedCourseIds.has(item.scene));
  for (const [courseId, items] of Object.entries(loadedCourseItems)) {
    allItems = allItems.concat(items);
  }
  state.lifeSentences = allItems.filter((item) => item.scene !== "news");
  state.allSentences = allItems;
}

function normalizeDialogueItems(items) {
  return items
    .filter((item) => item.id && item.ja && item.scene)
    .map((item) => ({
      ...item,
      course: item.course || item.scene,
      zh: item.zh || "",
      kana: item.kana || "",
      tags: item.tags || [item.topicName || item.scene],
      notes: item.notes || [["主题", item.topicName || item.scene]],
      contextBefore: item.contextBefore || [],
      contextAfter: item.contextAfter || [],
      particleAnswer: item.particleAnswer || [],
      particlePrompt: item.particlePrompt || item.ja,
      pattern: item.pattern || "自由表达",
      patternNeedle: item.patternNeedle || item.pattern || "",
    }));
}

function mergeSentences(core, extra) {
  const byId = new Map(core.map((item) => [item.id, item]));
  for (const item of extra) byId.set(item.id, item);
  return [...byId.values()];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function chooseMode(mode) {
  state.mode = mode;
  renderTrainer();
  els.answerInput.focus();
}

els.courseList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-course]");
  if (button) chooseCourse(button.dataset.course);
});

els.modeTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (button) chooseMode(button.dataset.mode);
});

els.dialogueThread.addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (!button) return;
  state.index = Number(button.dataset.index);

  const sentence = currentSentence();
  if (sentence && state.settings.vnMode) {
    markSentenceAnswered(sentence);
  }

  saveCurrentCoursePosition();
  renderTrainer();
  renderDeck();
  renderExplain();
  if (state.settings.vnMode) {
    playSentence();
  }
});

els.playButton.addEventListener("click", playSentence);
els.recordButton.addEventListener("click", toggleRecording);
els.playRecordingButton.addEventListener("click", playUserRecording);
els.checkButton.addEventListener("click", checkAnswer);
els.prevButton.addEventListener("click", previousSentence);
els.nextButton.addEventListener("click", nextSentence);
els.prevGroupButton.addEventListener("click", previousGroup);
els.nextGroupButton.addEventListener("click", nextGroup);
els.jumpGroupButton.addEventListener("click", () => jumpToGroupNumber(els.jumpGroupInput.value));
els.jumpGroupInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") jumpToGroupNumber(els.jumpGroupInput.value);
});

// 绑定视觉小说控制条按钮事件
els.vnPrevGroupBtn.addEventListener("click", previousGroup);
els.vnPrevBtn.addEventListener("click", previousSentence);
els.vnPlayBtn.addEventListener("click", playSentence);
els.vnRecordBtn.addEventListener("click", toggleRecording);
els.vnPlayRecordingBtn.addEventListener("click", playUserRecording);
els.vnRegenBgBtn.addEventListener("click", regenerateCurrentBackground);
els.vnNextBtn.addEventListener("click", nextSentence);
els.vnNextGroupBtn.addEventListener("click", nextGroup);
els.voiceProvider.addEventListener("change", (event) => {
  updateVoiceSettingsUI(event.target.value);
});
els.saveVoiceButton.addEventListener("click", saveVoiceSettings);
els.vnModeToggle.addEventListener("change", (event) => {
  state.settings.vnMode = !!event.target.checked;
  saveJson(storageKeys.settings, state.settings);
  renderVnStage();
});
els.saveGeminiButton.addEventListener("click", saveGeminiSettings);
els.saveBgSettingsButton.addEventListener("click", saveBgSettings);
els.bgProvider.addEventListener("change", (event) => {
  updateBgSettingsUI(event.target.value);
});
els.explainButton.addEventListener("click", refreshGeminiExplanation);
els.answerInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    checkAnswer();
  }
});

function makeCharacterDraggable(el) {
  if (!el) return;
  let isDragging = false;
  let startX, startY;
  let initialLeft, initialTop;

  el.style.cursor = "grab";
  el.style.pointerEvents = "auto";

  el.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // Left click only
    isDragging = true;
    el.style.cursor = "grabbing";
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = el.offsetLeft;
    initialTop = el.offsetTop;
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    const parentWidth = el.parentElement.clientWidth;
    const parentHeight = el.parentElement.clientHeight;
    
    const newLeft = ((initialLeft + dx) / parentWidth) * 100;
    const newTop = ((initialTop + dy) / parentHeight) * 100;

    el.style.left = `${newLeft}%`;
    el.style.top = `${newTop}%`;
    el.style.bottom = "auto";
    el.style.right = "auto";
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      el.style.cursor = "grab";
    }
  });

  // Touch support for mobile devices
  el.addEventListener("touchstart", (e) => {
    isDragging = true;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    initialLeft = el.offsetLeft;
    initialTop = el.offsetTop;
  });

  document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    
    const parentWidth = el.parentElement.clientWidth;
    const parentHeight = el.parentElement.clientHeight;
    
    const newLeft = ((initialLeft + dx) / parentWidth) * 100;
    const newTop = ((initialTop + dy) / parentHeight) * 100;

    el.style.left = `${newLeft}%`;
    el.style.top = `${newTop}%`;
    el.style.bottom = "auto";
    el.style.right = "auto";
  });

  document.addEventListener("touchend", () => {
    isDragging = false;
  });

  // Double click to flip horizontally (mirror image)
  el.addEventListener("dblclick", () => {
    const isFlipped = el.style.transform.includes("scaleX(-1)");
    if (isFlipped) {
      el.style.transform = el.style.transform.replace("scaleX(-1)", "").trim();
    } else {
      el.style.transform = (el.style.transform + " scaleX(-1)").trim();
    }
  });
}

async function initApp() {
  makeCharacterDraggable(els.charLeft);
  makeCharacterDraggable(els.charRight);
  renderVoiceSettings();
  persistProgress();

  const restoreInitialIndex = () => {
    restoreCoursePosition(state.course);
  };

  restoreInitialIndex();
  render();

  // 1. Immediately fetch default course sharded file
  await loadCourseDialogue(state.course);
  updateStateSentences();
  restoreInitialIndex();
  render();

  // 2. Lazily fetch other sharded files in the background
  const otherCourses = courses
    .map((c) => c.id)
    .filter((id) => id !== state.course);

  for (const id of otherCourses) {
    loadCourseDialogue(id).then((items) => {
      if (items) {
        updateStateSentences();
        renderCourses();
        renderStats();
      }
    });
  }
}

initApp();

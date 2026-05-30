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
  pattern: ["替换造句", "新的日语句子"],
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
  newsItems: [],
  selectedArticle: null,
  articleQueue: [],
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

function renderVoiceSettings() {
  els.voiceProvider.value = state.settings.voiceProvider;
  els.speechRegion.value = state.settings.speechRegion;
  els.speechKey.value = state.settings.speechKey;
  els.speechVoice.value = state.settings.speechVoice;
  els.speakerAVoice.value = state.settings.speakerAVoice || defaultSettings.speakerAVoice;
  els.speakerBVoice.value = state.settings.speakerBVoice || defaultSettings.speakerBVoice;
  els.geminiKey.value = state.settings.geminiKey || "";
  els.geminiModel.value = state.settings.geminiModel || defaultSettings.geminiModel;
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
    item.innerHTML = `<strong>${escapeHtml(sentence.speaker || "")}</strong><span>${escapeHtml(getDialogueDisplayText(sentence, current, state.mode))}</span>`;
    els.dialogueThread.append(item);
  });
}

function renderDeck() {
  renderDialogueThread();
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

  const context = [...(sentence.contextBefore || []), { speaker: sentence.speaker || "", text: sentence.ja }, ...(sentence.contextAfter || [])]
    .map((line) => `<div class="explain-item"><strong>${escapeHtml(line.speaker)}：</strong>${escapeHtml(line.text)}</div>`)
    .join("");
  const notes = sentence.notes
    .map(([title, body]) => `<div class="explain-item"><strong>${title}</strong><br />${body}</div>`)
    .join("");
  els.explainList.innerHTML = `${context}${notes}`;
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
      setFeedback("录音完成", "可以播放自己的录音，或重新录一遍。", "");
    });
    state.recorder.start();
    state.isRecording = true;
    els.recordButton.textContent = "停";
    els.recordButton.classList.add("is-recording");
    els.playRecordingButton.disabled = true;
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
}

async function playUserRecording() {
  if (!state.recordingUrl) return;
  await new Audio(state.recordingUrl).play();
}

async function playSentence() {
  const sentence = currentSentence();
  if (!sentence) return;
  if (state.settings.voiceProvider === "microsoft" && state.settings.speechKey) {
    try {
      await playMicrosoftSpeech(sentence.ja, getSpeakerVoice(state.settings, sentence.speaker));
      return;
    } catch (error) {
      els.voiceStatus.textContent = "微软语音失败，已回退到浏览器语音。";
    }
  }
  playBrowserSpeech(sentence.ja);
}

async function playMicrosoftSpeech(text, selectedVoice = state.settings.speechVoice) {
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
  audio.addEventListener("ended", () => URL.revokeObjectURL(audio.src), { once: true });
  await audio.play();
  els.voiceStatus.textContent = `微软语音：${voice}`;
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
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
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
  };
  saveJson(storageKeys.settings, state.settings);
  els.voiceStatus.textContent = state.settings.speechKey
    ? "语音配置已保存到本机浏览器。"
    : "未填写 API Key，将使用浏览器语音。";
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

async function refreshGeminiExplanation() {
  const sentence = currentSentence();
  if (!sentence) return;
  if (!state.settings.geminiKey) {
    els.geminiStatus.textContent = "请先填写并保存 Gemini API Key。";
    return;
  }

  els.geminiStatus.textContent = "正在生成讲解...";
  try {
    const explanation = await requestGeminiExplanation(sentence);
    const html = explanationToHtml(explanation);
    saveJson(getExplanationCacheKey(sentence), { html, generatedAt: new Date().toISOString() });
    els.explainList.innerHTML = html;
    els.geminiStatus.textContent = "讲解已生成并缓存。";
  } catch (error) {
    els.geminiStatus.textContent = "Gemini 讲解失败，请检查 API Key 或本地服务。";
  }
}

async function requestGeminiExplanation(sentence) {
  const payload = {
    key: state.settings.geminiKey,
    model: state.settings.geminiModel || defaultSettings.geminiModel,
    sentence: {
      ja: sentence.ja,
      speaker: sentence.speaker,
      topicName: sentence.topicName,
      contextBefore: sentence.contextBefore || [],
      contextAfter: sentence.contextAfter || [],
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
            text: `请用中文说明下面日语对话句，固定输出四段：词汇、文法、自然用法、可替代表达。重点解释学习者容易误解的词和文法，不要泛泛聊天。不要超过350字。\n${formatSentenceForGemini(sentence)}`,
          },
        ],
      },
    ],
  };
}

function formatSentenceForGemini(sentence) {
  const before = (sentence.contextBefore || []).map((line) => `${line.speaker}: ${line.text}`).join("\n");
  const after = (sentence.contextAfter || []).map((line) => `${line.speaker}: ${line.text}`).join("\n");
  return `主题：${sentence.topicName || ""}\n前文：\n${before}\n当前句：\n${sentence.speaker || ""}: ${sentence.ja}\n后文：\n${after}\n句型：${sentence.pattern || ""}`;
}

function explanationToHtml(text) {
  return String(text || "")
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<div class="explain-item">${escapeHtml(line)}</div>`)
    .join("");
}

function getExplanationCacheKey(sentence) {
  return `jp-sentence-trainer-explain-${sentence.id}`;
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
  clearRecording();
  renderTrainer();
  renderExplain();
  els.answerInput.focus();
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
  clearRecording();
  renderTrainer();
  renderExplain();
  els.answerInput.focus();
}

function previousSentence() {
  if (!state.queue.length) return;
  state.index = (state.index - 1 + state.queue.length) % state.queue.length;
  clearRecording();
  renderTrainer();
  renderExplain();
  els.answerInput.focus();
}

function chooseCourse(courseId) {
  state.course = courseId;
  state.index = 0;
  state.groupComplete = false;
  clearRecording();
  render();
  els.answerInput.focus();
}

async function loadNewsTrainerItems() {
  try {
    const response = await fetch("../content_archive/trainer_items.json", { cache: "no-store" });
    if (!response.ok) return;
    const bundle = await response.json();
    const items = normalizeNewsItems(bundle.items ?? []);
    if (!items.length) return;
    state.newsItems = items;
    state.allSentences = state.lifeSentences;
    if (state.index >= getQueue().length) state.index = 0;
    render();
  } catch (error) {
    // News archive is optional; core practice should continue offline.
  }
}

async function loadDialogueTrainerItems() {
  try {
    const response = await fetch("../content_archive/dialogue_items.json", { cache: "no-store" });
    if (!response.ok) return;
    const bundle = await response.json();
    const items = normalizeDialogueItems(bundle.items ?? []);
    if (!items.length) return;
    state.lifeSentences = items;
    state.allSentences = items;
    if (state.index >= getQueue().length) state.index = 0;
    render();
  } catch (error) {
    // Dialogue corpus is optional during development; static fallback stays usable.
  }
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
      pattern: item.pattern || "自由改写",
      patternNeedle: item.patternNeedle || item.pattern || "",
    }));
}

function normalizeNewsItems(items) {
  return items
    .filter((item) => item.id && item.ja && item.scene === "news")
    .map((item) => ({
      ...item,
      course: "news",
      kana: item.kana ?? "",
      particleAnswer: item.particleAnswer ?? [],
      tags: item.tags ?? ["每日新闻"],
      notes: item.notes ?? [["来源", "content_archive"]],
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
  renderTrainer();
  renderDeck();
  renderExplain();
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
els.saveVoiceButton.addEventListener("click", saveVoiceSettings);
els.saveGeminiButton.addEventListener("click", saveGeminiSettings);
els.explainButton.addEventListener("click", refreshGeminiExplanation);
els.answerInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    checkAnswer();
  }
});

renderVoiceSettings();
persistProgress();
render();
loadDialogueTrainerItems();

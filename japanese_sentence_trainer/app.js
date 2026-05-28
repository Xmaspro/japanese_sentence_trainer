const sentenceBank = [
  {
    id: "n5-001",
    course: "basic",
    level: "N5",
    zh: "昨天我和朋友看了电影。",
    ja: "昨日、友達と映画を見ました。",
    kana: "きのう、ともだちとえいがをみました。",
    pattern: "名词 と 动作",
    patternNeedle: "と",
    particlePrompt: "昨日、友達（　）映画（　）見ました。",
    particleAnswer: ["と", "を"],
    tags: ["助词 と", "助词 を", "过去敬体"],
    notes: [
      ["友達と", "と 表示共同动作对象，这里是“和朋友”。"],
      ["映画を", "を 标记动作的直接对象。"],
      ["見ました", "見る 的过去敬体，表达“看了”。"],
    ],
  },
  {
    id: "n5-002",
    course: "basic",
    level: "N5",
    zh: "车站前面有一家便利店。",
    ja: "駅の前にコンビニがあります。",
    kana: "えきのまえにコンビニがあります。",
    pattern: "地点 に 物 があります",
    patternNeedle: "に",
    particlePrompt: "駅（　）前（　）コンビニがあります。",
    particleAnswer: ["の", "に"],
    tags: ["存在句", "助词 に", "助词 の"],
    notes: [
      ["駅の前", "の 连接两个名词，表示“车站的前面”。"],
      ["前に", "に 标记存在的位置。"],
      ["あります", "用于无生命物体的存在。"],
    ],
  },
  {
    id: "n5-003",
    course: "basic",
    level: "N5",
    zh: "请用日语再说一遍。",
    ja: "日本語でもう一度言ってください。",
    kana: "にほんごでもういちどいってください。",
    pattern: "て形 + ください",
    patternNeedle: "てください",
    particlePrompt: "日本語（　）もう一度言ってください。",
    particleAnswer: ["で"],
    tags: ["请求", "助词 で", "て形"],
    notes: [
      ["日本語で", "で 表示使用的工具或方式。"],
      ["言って", "言う 的て形。"],
      ["ください", "接在て形后，表示礼貌请求。"],
    ],
  },
  {
    id: "n5-004",
    course: "travel",
    level: "N5",
    zh: "到机场要怎么去？",
    ja: "空港までどうやって行きますか。",
    kana: "くうこうまでどうやっていきますか。",
    pattern: "地点 まで どうやって",
    patternNeedle: "まで",
    particlePrompt: "空港（　）どうやって行きますか。",
    particleAnswer: ["まで"],
    tags: ["问路", "助词 まで", "疑问句"],
    notes: [
      ["空港まで", "まで 表示到达的终点。"],
      ["どうやって", "询问方法或交通方式。"],
      ["行きますか", "行く 的敬体疑问句。"],
    ],
  },
  {
    id: "n5-005",
    course: "travel",
    level: "N5",
    zh: "这个料理太辣了。",
    ja: "この料理は辛すぎます。",
    kana: "このりょうりはからすぎます。",
    pattern: "い形容词词干 + すぎます",
    patternNeedle: "すぎます",
    particlePrompt: "この料理（　）辛すぎます。",
    particleAnswer: ["は"],
    tags: ["形容词", "助词 は", "程度表达"],
    notes: [
      ["料理は", "は 标记话题。"],
      ["辛すぎます", "辛い 去掉い，加 すぎます，表示“太辣”。"],
      ["この", "この 直接修饰名词，不能单独使用。"],
    ],
  },
  {
    id: "n4-001",
    course: "pattern",
    level: "N4",
    zh: "如果明天下雨，我就在家。",
    ja: "明日雨が降ったら、家にいます。",
    kana: "あしたあめがふったら、いえにいます。",
    pattern: "た形 + ら",
    patternNeedle: "たら",
    particlePrompt: "明日雨（　）降ったら、家（　）います。",
    particleAnswer: ["が", "に"],
    tags: ["条件句", "助词 が", "助词 に"],
    notes: [
      ["雨が", "が 标记自然现象的主语。"],
      ["降ったら", "降る 的た形加 ら，表示条件。"],
      ["家にいます", "に 标记所在位置。"],
    ],
  },
  {
    id: "n4-002",
    course: "pattern",
    level: "N4",
    zh: "我想把这个礼物送给老师。",
    ja: "このプレゼントを先生にあげたいです。",
    kana: "このプレゼントをせんせいにあげたいです。",
    pattern: "物 を 人 に あげる",
    patternNeedle: "に",
    particlePrompt: "このプレゼント（　）先生（　）あげたいです。",
    particleAnswer: ["を", "に"],
    tags: ["授受", "助词 を", "助词 に"],
    notes: [
      ["プレゼントを", "を 标记送出的东西。"],
      ["先生に", "に 标记接受者。"],
      ["あげたいです", "あげる 的愿望表达。"],
    ],
  },
  {
    id: "n4-003",
    course: "pattern",
    level: "N4",
    zh: "我觉得这家店很安静。",
    ja: "この店はとても静かだと思います。",
    kana: "このみせはとてもしずかだとおもいます。",
    pattern: "普通形 + と思います",
    patternNeedle: "と思います",
    particlePrompt: "この店（　）とても静かだ（　）思います。",
    particleAnswer: ["は", "と"],
    tags: ["意见表达", "な形容词", "引用 と"],
    notes: [
      ["店は", "は 标记评论的话题。"],
      ["静かだ", "な形容词接 と思います 时通常用普通形。"],
      ["と", "と 标记引用的内容。"],
    ],
  },
];

const courses = [
  { id: "today", label: "今日练习", icon: "今" },
  { id: "basic", label: "N5 基础句", icon: "基" },
  { id: "travel", label: "旅行日语", icon: "旅" },
  { id: "pattern", label: "句型替换", icon: "型" },
  { id: "review", label: "复习本", icon: "復" },
];

const modeLabels = {
  translate: ["中文提示", "你的日语"],
  dictation: ["听写", "听到的日语"],
  particle: ["助词填空", "按顺序输入助词"],
  shadow: ["跟读", "跟读后默写"],
  pattern: ["替换造句", "新的日语句子"],
};

const storageKeys = {
  stats: "jp-sentence-trainer-stats",
  mistakes: "jp-sentence-trainer-mistakes",
};

const state = {
  course: "today",
  mode: "translate",
  index: 0,
  queue: [...sentenceBank],
  stats: readJson(storageKeys.stats, {
    done: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    shadowCount: 0,
  }),
  mistakes: readJson(storageKeys.mistakes, []),
};

const els = {
  courseList: document.querySelector("#courseList"),
  courseEyebrow: document.querySelector("#courseEyebrow"),
  lessonTitle: document.querySelector("#lessonTitle"),
  doneCount: document.querySelector("#doneCount"),
  accuracyCount: document.querySelector("#accuracyCount"),
  streakCount: document.querySelector("#streakCount"),
  modeTabs: document.querySelector("#modeTabs"),
  levelPill: document.querySelector("#levelPill"),
  sentencePosition: document.querySelector("#sentencePosition"),
  promptLabel: document.querySelector("#promptLabel"),
  promptText: document.querySelector("#promptText"),
  kanaLine: document.querySelector("#kanaLine"),
  answerLabel: document.querySelector("#answerLabel"),
  answerInput: document.querySelector("#answerInput"),
  playButton: document.querySelector("#playButton"),
  hintButton: document.querySelector("#hintButton"),
  checkButton: document.querySelector("#checkButton"),
  nextButton: document.querySelector("#nextButton"),
  feedbackPanel: document.querySelector("#feedbackPanel"),
  deckList: document.querySelector("#deckList"),
  shuffleButton: document.querySelector("#shuffleButton"),
  explainButton: document.querySelector("#explainButton"),
  explainList: document.querySelector("#explainList"),
  mistakeList: document.querySelector("#mistakeList"),
  clearMistakesButton: document.querySelector("#clearMistakesButton"),
  particleRadar: document.querySelector("#particleRadar"),
};

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getQueue() {
  if (state.course === "today") return sentenceBank;
  if (state.course === "review") {
    const ids = new Set(state.mistakes.map((item) => item.id));
    return sentenceBank.filter((sentence) => ids.has(sentence.id));
  }
  return sentenceBank.filter((sentence) => sentence.course === state.course);
}

function currentSentence() {
  if (!state.queue.length) return null;
  return state.queue[state.index % state.queue.length];
}

function render() {
  state.queue = getQueue();
  if (state.index >= state.queue.length) state.index = 0;
  renderCourses();
  renderStats();
  renderTrainer();
  renderDeck();
  renderExplain();
  renderMistakes();
  renderParticleRadar();
}

function renderCourses() {
  els.courseList.innerHTML = "";
  for (const course of courses) {
    const count =
      course.id === "today"
        ? sentenceBank.length
        : course.id === "review"
          ? state.mistakes.length
          : sentenceBank.filter((sentence) => sentence.course === course.id).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `course-button${state.course === course.id ? " is-active" : ""}`;
    button.dataset.course = course.id;
    button.innerHTML = `
      <span class="course-icon">${course.icon}</span>
      <span><span class="course-title">${course.label}</span><span class="course-count">${count} 句</span></span>
      <span class="course-count">›</span>
    `;
    els.courseList.append(button);
  }
}

function renderStats() {
  const accuracy = state.stats.done
    ? Math.round((state.stats.correct / state.stats.done) * 100)
    : 0;
  els.doneCount.textContent = state.stats.done;
  els.accuracyCount.textContent = `${accuracy}%`;
  els.streakCount.textContent = state.stats.streak;
}

function renderTrainer() {
  const sentence = currentSentence();
  const course = courses.find((item) => item.id === state.course);
  els.courseEyebrow.textContent = course?.label ?? "今日练习";
  els.lessonTitle.textContent = sentence ? getLessonTitle(sentence) : "复习本为空";

  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });

  if (!sentence) {
    els.levelPill.textContent = "复习";
    els.sentencePosition.textContent = "0 / 0";
    els.promptLabel.textContent = "没有错题";
    els.promptText.textContent = "当前没有需要复习的句子。";
    els.kanaLine.textContent = "";
    els.answerInput.value = "";
    els.answerInput.disabled = true;
    setFeedback("准备复习", "做错的句子会自动出现在这里。", "");
    return;
  }

  els.answerInput.disabled = false;
  els.levelPill.textContent = sentence.level;
  els.sentencePosition.textContent = `${state.index + 1} / ${state.queue.length}`;
  els.promptLabel.textContent = modeLabels[state.mode][0];
  els.answerLabel.textContent = modeLabels[state.mode][1];
  els.answerInput.value = "";
  els.answerInput.placeholder = getPlaceholder();

  if (state.mode === "dictation") {
    els.promptText.textContent = "播放音频后写出日语句子";
    els.kanaLine.textContent = sentence.zh;
  } else if (state.mode === "particle") {
    els.promptText.textContent = sentence.particlePrompt;
    els.kanaLine.textContent = sentence.zh;
  } else if (state.mode === "shadow") {
    els.promptText.textContent = sentence.ja;
    els.kanaLine.textContent = sentence.kana;
  } else if (state.mode === "pattern") {
    els.promptText.textContent = sentence.pattern;
    els.kanaLine.textContent = `${sentence.zh} / 参考：${sentence.ja}`;
  } else {
    els.promptText.textContent = sentence.zh;
    els.kanaLine.textContent = "";
  }

  setFeedback("准备开始", "等待输入。", "");
}

function getLessonTitle(sentence) {
  if (state.course === "today") return "今日句子训练";
  if (state.course === "review") return "错句复习";
  return courses.find((course) => course.id === sentence.course)?.label ?? "句子训练";
}

function getPlaceholder() {
  if (state.mode === "particle") return "例：と を";
  if (state.mode === "pattern") return "用当前句型写一个新句子";
  return "在这里输入答案";
}

function renderDeck() {
  els.deckList.innerHTML = "";
  if (!state.queue.length) {
    els.deckList.innerHTML = `<div class="deck-item"><strong>暂无句子</strong><span>错题会在提交后出现。</span></div>`;
    return;
  }

  state.queue.forEach((sentence, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `deck-item${index === state.index ? " is-active" : ""}`;
    item.dataset.index = index;
    item.innerHTML = `<strong>${sentence.ja}</strong><span>${sentence.zh}</span>`;
    els.deckList.append(item);
  });
}

function renderExplain() {
  const sentence = currentSentence();
  if (!sentence) {
    els.explainList.innerHTML = `<div class="explain-item">完成练习后，这里会显示当前句子的拆解。</div>`;
    return;
  }

  const notes = sentence.notes
    .map(([title, body]) => `<div class="explain-item"><strong>${title}</strong><br />${body}</div>`)
    .join("");
  const tags = `<div class="tag-row">${sentence.tags
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join("")}</div>`;
  els.explainList.innerHTML = `${tags}${notes}`;
}

function renderMistakes() {
  if (!state.mistakes.length) {
    els.mistakeList.innerHTML = `<div class="mistake-item">还没有错题。</div>`;
    return;
  }

  els.mistakeList.innerHTML = state.mistakes
    .slice(0, 6)
    .map((mistake) => {
      const sentence = sentenceBank.find((item) => item.id === mistake.id);
      return `
        <button class="mistake-item" type="button" data-review-id="${mistake.id}">
          <strong>${sentence?.ja ?? "句子"}</strong><br />
          ${mistake.reason} · ${mistake.count} 次
        </button>
      `;
    })
    .join("");
}

function renderParticleRadar() {
  const totals = new Map();
  for (const mistake of state.mistakes) {
    for (const particle of mistake.particles ?? []) {
      totals.set(particle, (totals.get(particle) ?? 0) + mistake.count);
    }
  }

  if (!totals.size) {
    els.particleRadar.innerHTML = `<div class="radar-item">助词错误会在这里累计。</div>`;
    return;
  }

  const max = Math.max(...totals.values());
  els.particleRadar.innerHTML = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([particle, count]) => {
      const width = Math.max(12, Math.round((count / max) * 100));
      return `
        <div class="radar-item">
          <strong>${particle}</strong> · ${count} 次
          <div class="radar-bar"><span style="width:${width}%"></span></div>
        </div>
      `;
    })
    .join("");
}

function normalizeAnswer(value) {
  return value
    .trim()
    .replace(/[，,。．.？?！!\s]/g, "")
    .replace(/[　]/g, "")
    .toLowerCase();
}

function splitParticles(value) {
  const clean = value.trim().replace(/[，,、。]/g, " ");
  if (clean.includes(" ")) return clean.split(/\s+/).filter(Boolean);
  return [...clean].filter(Boolean);
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
  if (state.mode === "particle") {
    result = checkParticleAnswer(sentence, answer);
  } else if (state.mode === "pattern") {
    result = checkPatternAnswer(sentence, answer);
  } else {
    result = checkExactAnswer(sentence, answer);
  }

  state.stats.done += 1;
  if (result.correct) {
    state.stats.correct += 1;
    state.stats.streak += 1;
    state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak);
    removeResolvedMistake(sentence.id);
    setFeedback("正确", result.message, "correct");
  } else {
    state.stats.streak = 0;
    addMistake(sentence, result.reason, result.particles);
    setFeedback("再改一次", result.message, "wrong", result.diff);
  }

  saveJson(storageKeys.stats, state.stats);
  saveJson(storageKeys.mistakes, state.mistakes);
  renderStats();
  renderMistakes();
  renderParticleRadar();
  renderDeck();
}

function checkExactAnswer(sentence, answer) {
  const correct = normalizeAnswer(answer) === normalizeAnswer(sentence.ja);
  if (correct) {
    return { correct: true, message: `答案：${sentence.ja}` };
  }

  const analysis = analyzeMisses(sentence, answer);
  return {
    correct: false,
    reason: analysis.reason,
    particles: analysis.particles,
    message: `参考：${sentence.ja}`,
    diff: buildDiff(sentence.ja, answer),
  };
}

function checkParticleAnswer(sentence, answer) {
  const given = splitParticles(answer);
  const expected = sentence.particleAnswer;
  const correct = expected.length === given.length && expected.every((item, index) => item === given[index]);

  if (correct) {
    return { correct: true, message: `助词顺序：${expected.join(" ")}` };
  }

  return {
    correct: false,
    reason: "助词顺序或选择不对",
    particles: expected,
    message: `正确助词：${expected.join(" ")}`,
    diff: buildParticleDiff(expected, given),
  };
}

function checkPatternAnswer(sentence, answer) {
  const compact = normalizeAnswer(answer);
  const correct = compact.includes(normalizeAnswer(sentence.patternNeedle)) && answer.length >= 8;
  if (correct) {
    return {
      correct: true,
      message: `句型命中：${sentence.pattern}`,
    };
  }
  return {
    correct: false,
    reason: `没有稳定使用句型：${sentence.pattern}`,
    particles: sentence.particleAnswer,
    message: `需要包含：${sentence.patternNeedle}`,
  };
}

function analyzeMisses(sentence, answer) {
  const compact = normalizeAnswer(answer);
  const particles = sentence.particleAnswer.filter((particle) => !compact.includes(particle));
  if (particles.length) {
    return {
      reason: `漏掉或误用了助词：${particles.join("、")}`,
      particles,
    };
  }

  const finalChunk = normalizeAnswer(sentence.ja).slice(-5);
  if (!compact.endsWith(finalChunk.slice(-3))) {
    return {
      reason: "句尾活用或敬体形式不稳",
      particles: sentence.particleAnswer,
    };
  }

  return {
    reason: "词序、汉字或假名和参考句不一致",
    particles: sentence.particleAnswer,
  };
}

function buildDiff(expected, answer) {
  const expectedChars = [...normalizeAnswer(expected)];
  const answerChars = [...normalizeAnswer(answer)];
  return expectedChars
    .map((char, index) => {
      const ok = answerChars[index] === char;
      return `<span class="${ok ? "" : "miss"}">${char}</span>`;
    })
    .join("");
}

function buildParticleDiff(expected, given) {
  return expected
    .map((particle, index) => {
      const ok = given[index] === particle;
      return `<span class="${ok ? "" : "miss"}">${particle}</span>`;
    })
    .join("");
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

function showHint() {
  const sentence = currentSentence();
  if (!sentence) return;

  if (state.mode === "particle") {
    setFeedback("提示", `这个句子需要 ${sentence.particleAnswer.length} 个助词。`, "");
  } else if (state.mode === "pattern") {
    setFeedback("提示", `保留句型：${sentence.pattern}`, "");
  } else {
    const prefix = sentence.ja.slice(0, Math.max(2, Math.ceil(sentence.ja.length / 3)));
    setFeedback("提示", `开头：${prefix}`, "");
  }
}

function playSentence() {
  const sentence = currentSentence();
  if (!sentence || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentence.ja);
  utterance.lang = "ja-JP";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function nextSentence() {
  if (!state.queue.length) return;
  state.index = (state.index + 1) % state.queue.length;
  renderTrainer();
  renderDeck();
  renderExplain();
  els.answerInput.focus();
}

function shuffleQueue() {
  state.queue = [...getQueue()].sort(() => Math.random() - 0.5);
  state.index = 0;
  renderTrainer();
  renderDeck();
  renderExplain();
}

function chooseCourse(courseId) {
  state.course = courseId;
  state.index = 0;
  render();
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

els.deckList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (!button) return;
  state.index = Number(button.dataset.index);
  renderTrainer();
  renderDeck();
  renderExplain();
});

els.mistakeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-id]");
  if (!button) return;
  state.course = "review";
  state.queue = getQueue();
  state.index = Math.max(0, state.queue.findIndex((sentence) => sentence.id === button.dataset.reviewId));
  render();
});

els.playButton.addEventListener("click", playSentence);
els.hintButton.addEventListener("click", showHint);
els.checkButton.addEventListener("click", checkAnswer);
els.nextButton.addEventListener("click", nextSentence);
els.shuffleButton.addEventListener("click", shuffleQueue);
els.explainButton.addEventListener("click", renderExplain);
els.clearMistakesButton.addEventListener("click", () => {
  state.mistakes = [];
  saveJson(storageKeys.mistakes, state.mistakes);
  if (state.course === "review") state.index = 0;
  render();
});

els.answerInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    checkAnswer();
  }
});

render();

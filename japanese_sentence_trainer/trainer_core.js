(function (root, factory) {
  const core = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }
  root.JapaneseSentenceTrainerCore = core;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function normalizeAnswer(value) {
    return String(value)
      .trim()
      .replace(/[，,。．.？?！!\s]/g, "")
      .replace(/[　]/g, "")
      .toLowerCase();
  }

  function checkExactAnswer(sentence, answer) {
    const correct = normalizeAnswer(answer) === normalizeAnswer(sentence.ja);
    if (correct) {
      return { correct: true, markComplete: true, message: `答案：${sentence.ja}` };
    }
    return {
      correct: false,
      markComplete: false,
      reason: analyzeMisses(sentence, answer).reason,
      particles: analyzeMisses(sentence, answer).particles,
      message: `参考：${sentence.ja}`,
      diff: buildDiff(sentence.ja, answer),
    };
  }

  function checkPatternAnswer(sentence, answer) {
    const trimmed = String(answer || "").trim();
    const needle = normalizeAnswer(sentence.patternNeedle || "");
    const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(trimmed);
    const hasMeaningfulNeedle = needle && !["会话表达", "自由改写"].includes(sentence.patternNeedle);

    if (hasMeaningfulNeedle) {
      const correct = normalizeAnswer(trimmed).includes(needle) && trimmed.length >= 8;
      if (correct) {
        return {
          correct: true,
          markComplete: true,
          message: `句型命中：${sentence.pattern}`,
        };
      }
      return {
        correct: false,
        markComplete: false,
        reason: `没有稳定使用句型：${sentence.pattern}`,
        particles: sentence.particleAnswer ?? [],
        message: `需要包含：${sentence.patternNeedle}`,
      };
    }

    if (hasJapanese && normalizeAnswer(trimmed).length >= 8) {
      return {
        correct: true,
        markComplete: true,
        message: "已记录新的日语句子。",
      };
    }

    return {
      correct: false,
      markComplete: false,
      reason: "新句子太短，或没有输入日语。",
      particles: sentence.particleAnswer ?? [],
      message: "请用日语写一个新的自然句子。",
    };
  }

  function analyzeMisses(sentence, answer) {
    const compact = normalizeAnswer(answer);
    const particles = (sentence.particleAnswer ?? []).filter((particle) => !compact.includes(particle));
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
        particles: sentence.particleAnswer ?? [],
      };
    }

    return {
      reason: "词序、汉字或假名和参考句不一致",
      particles: sentence.particleAnswer ?? [],
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

  function createInitialProgress(today = getTodayKey()) {
    return {
      version: 1,
      activeDate: today,
      coursePositions: {},
      days: {
        [today]: createProgressDay(),
      },
    };
  }

  function createProgressDay() {
    return {
      completedIds: new Set(),
      finishedGroups: new Set(),
    };
  }

  function ensureProgressDay(progress, dateKey) {
    if (!progress.days[dateKey]) progress.days[dateKey] = createProgressDay();
    if (!(progress.days[dateKey].completedIds instanceof Set)) {
      progress.days[dateKey].completedIds = new Set(progress.days[dateKey].completedIds ?? []);
    }
    if (!(progress.days[dateKey].finishedGroups instanceof Set)) {
      progress.days[dateKey].finishedGroups = new Set(progress.days[dateKey].finishedGroups ?? []);
    }
    return progress.days[dateKey];
  }

  function markCorrectAnswer(progress, dateKey, sentenceId) {
    const day = ensureProgressDay(progress, dateKey);
    day.completedIds.add(sentenceId);
    return progress;
  }

  function markCoursePosition(progress, courseId, sentenceId) {
    progress.coursePositions = progress.coursePositions ?? {};
    if (courseId && sentenceId) progress.coursePositions[courseId] = sentenceId;
    return progress;
  }

  function markFinishedGroup(progress, dateKey, groupIndex) {
    const day = ensureProgressDay(progress, dateKey);
    day.finishedGroups.add(groupIndex);
    return progress;
  }

  function getCompletionAction(progress, dateKey, group, groupIndex, groupCount) {
    const day = ensureProgressDay(progress, dateKey);
    const complete = group.length > 0 && group.every((sentence) => day.completedIds.has(sentence.id));
    if (!complete) return "next-sentence";
    if (groupIndex < groupCount - 1) return "next-group";
    return "next-day";
  }

  function buildCalendarDays(progress, currentDateKey = getTodayKey(), span = 14) {
    const end = parseDateKey(currentDateKey);
    return Array.from({ length: span }, (_, offset) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (span - 1 - offset));
      const dateKey = formatDateKey(date);
      const day = progress.days[dateKey];
      const completed = day ? setSize(day.completedIds) : 0;
      const finishedGroups = day ? setSize(day.finishedGroups) : 0;
      return {
        date: dateKey,
        dayLabel: String(date.getDate()),
        completed,
        finishedGroups,
        status: finishedGroups > 0 ? "complete" : completed > 0 ? "partial" : "empty",
      };
    });
  }

  function createPracticeGroupsForDay(sentences, dateKey = getTodayKey(), groupSize = 10) {
    const dailyPool = buildDailyPool(sentences, dateKey);
    if (!dailyPool.length) return [];
    const offset = dayNumber(dateKey) % dailyPool.length;
    const rotated = [...dailyPool.slice(offset), ...dailyPool.slice(0, offset)];
    const groups = [];
    for (let index = 0; index < rotated.length; index += groupSize) {
      groups.push(rotated.slice(index, index + groupSize));
    }
    return groups;
  }

  function buildDailyPool(sentences, dateKey = getTodayKey()) {
    return sentences.filter((sentence) => sentence.scene !== "news");
  }

  function createDialogueGroupsForDay(items, dateKey = getTodayKey(), groupSize = 10) {
    const byDialogue = new Map();
    for (const item of items) {
      if (!item.dialogueId) continue;
      if (!byDialogue.has(item.dialogueId)) byDialogue.set(item.dialogueId, []);
      byDialogue.get(item.dialogueId).push(item);
    }

    const dialogues = [...byDialogue.values()]
      .map((group) => group.sort((a, b) => (a.turnNum ?? 0) - (b.turnNum ?? 0)).slice(0, groupSize))
      .filter((group) => group.length);
    const topics = [...new Set(dialogues.map((group) => group[0].scene))].sort();
    if (!topics.length) return [];

    const dayOffset = dayNumber(dateKey);
    const rotatedTopics = rotate(topics, dayOffset % topics.length);
    const groups = [];
    for (const topic of rotatedTopics) {
      const topicDialogues = dialogues.filter((group) => group[0].scene === topic);
      const selected = topicDialogues[dayOffset % topicDialogues.length];
      if (selected) groups.push(selected);
    }
    return groups;
  }

  function rotate(items, offset) {
    return [...items.slice(offset), ...items.slice(0, offset)];
  }

  function getCurrentDialogueItems(items, currentItem) {
    if (!currentItem?.dialogueId) return currentItem ? [currentItem] : [];
    return items
      .filter((item) => item.dialogueId === currentItem.dialogueId)
      .sort((a, b) => (a.turnNum ?? 0) - (b.turnNum ?? 0));
  }

  function getDialogueGroupsForCourse(items, courseId) {
    const byDialogue = new Map();
    for (const item of items) {
      if (item.scene !== courseId) continue;
      const dialogueId = item.dialogueId || item.id;
      if (!byDialogue.has(dialogueId)) byDialogue.set(dialogueId, []);
      byDialogue.get(dialogueId).push(item);
    }
    return [...byDialogue.values()].map((group) =>
      [...group].sort((a, b) => (a.turnNum ?? 0) - (b.turnNum ?? 0)),
    );
  }

  function summarizeCourseProgress(items, progress, courseId) {
    const total = items.filter((item) => item.scene === courseId).length;
    const completedIds = new Set(
      Object.values(progress.days || {}).flatMap((day) => [...(day.completedIds || [])]),
    );
    const completed = items.filter((item) => item.scene === courseId && completedIds.has(item.id)).length;
    return {
      total,
      completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
    };
  }

  function summarizeDialogueGroupProgress(items, progress, courseId) {
    const groups = getDialogueGroupsForCourse(items, courseId);
    const completedIds = new Set(
      Object.values(progress.days || {}).flatMap((day) => [...(day.completedIds || [])]),
    );
    const completed = groups.filter((group) => group.length > 0 && group.every((item) => completedIds.has(item.id))).length;
    return {
      total: groups.length,
      completed,
      percent: groups.length ? Math.round((completed / groups.length) * 100) : 0,
    };
  }

  function getResumeIndexForCourse(queue, allItems, progress, courseId) {
    const savedId = progress?.coursePositions?.[courseId];
    if (savedId) {
      const savedIndex = queue.findIndex((item) => item.id === savedId);
      if (savedIndex >= 0) return savedIndex;
    }

    const groups = getDialogueGroupsForCourse(allItems, courseId);
    const completedIds = new Set(
      Object.values(progress?.days || {}).flatMap((day) => [...(day.completedIds || [])]),
    );
    const incompleteGroup = groups.find((group) =>
      group.length > 0 && !group.every((item) => completedIds.has(item.id)),
    );
    if (incompleteGroup?.length) {
      const firstId = incompleteGroup[0].id;
      const firstIncompleteIndex = queue.findIndex((item) => item.id === firstId);
      return firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0;
    }
    return 0;
  }

  function getDialogueDisplayText(line, currentItem, mode) {
    if (mode === "dictation" && line?.turnNum != null && currentItem?.turnNum != null && line.turnNum >= currentItem.turnNum) return "？？？";
    if (mode === "dictation" && line?.id && currentItem?.id && line.id === currentItem.id) return "？？？";
    return line?.ja || line?.text || "";
  }

  function getSpeakerVoice(settings, speaker) {
    if (speaker === "A" && settings?.speakerAVoice) return settings.speakerAVoice;
    if (speaker === "B" && settings?.speakerBVoice) return settings.speakerBVoice;
    return settings?.speechVoice || "ja-JP-NanamiNeural";
  }

  function getTodayKey() {
    return formatDateKey(new Date());
  }

  function getNextDateKey(dateKey) {
    const date = parseDateKey(dateKey);
    date.setDate(date.getDate() + 1);
    return formatDateKey(date);
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function dayNumber(dateKey) {
    const date = parseDateKey(dateKey);
    return Math.floor(date.getTime() / 86400000);
  }

  function setSize(value) {
    return value instanceof Set ? value.size : (value ?? []).length;
  }

  function buildSpeechSsml(voice, text) {
    return `<speak version="1.0" xml:lang="ja-JP"><voice xml:lang="ja-JP" name="${escapeXml(voice)}">${escapeXml(text)}</voice></speak>`;
  }

  function filterCoursesForModule(courses, moduleName = "life") {
    const ids = new Set(["dailylife", "school", "travel", "health", "entertainment"]);
    return courses.filter((course) => ids.has(course.id));
  }



  function escapeXml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function serializeProgress(progress) {
    const days = {};
    for (const [dateKey, day] of Object.entries(progress.days)) {
      days[dateKey] = {
        completedIds: [...(day.completedIds ?? [])],
        finishedGroups: [...(day.finishedGroups ?? [])],
      };
    }
    return {
      version: progress.version,
      activeDate: progress.activeDate,
      coursePositions: { ...(progress.coursePositions ?? {}) },
      days,
    };
  }

  function deserializeProgress(value, today = getTodayKey()) {
    const progress = value && typeof value === "object" ? value : createInitialProgress(today);
    progress.version = progress.version ?? 1;
    progress.activeDate = progress.activeDate ?? today;
    progress.coursePositions = progress.coursePositions ?? {};
    progress.days = progress.days ?? {};
    ensureProgressDay(progress, progress.activeDate);
    for (const dateKey of Object.keys(progress.days)) ensureProgressDay(progress, dateKey);
    return progress;
  }

  return {
    normalizeAnswer,
    checkExactAnswer,
    checkPatternAnswer,
    analyzeMisses,
    buildDiff,
    createInitialProgress,
    ensureProgressDay,
    markCorrectAnswer,
    markCoursePosition,
    markFinishedGroup,
    getCompletionAction,
    buildCalendarDays,
    createPracticeGroupsForDay,
    createDialogueGroupsForDay,
    getCurrentDialogueItems,
    getDialogueGroupsForCourse,
    getDialogueDisplayText,
    getSpeakerVoice,
    summarizeCourseProgress,
    summarizeDialogueGroupProgress,
    getResumeIndexForCourse,
    buildDailyPool,
    getTodayKey,
    getNextDateKey,
    serializeProgress,
    deserializeProgress,
    buildSpeechSsml,
    filterCoursesForModule,
  };
});

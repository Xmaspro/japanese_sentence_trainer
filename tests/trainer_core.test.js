const test = require("node:test");
const assert = require("node:assert/strict");

const {
  checkExactAnswer,
  checkPatternAnswer,
  createInitialProgress,
  getCompletionAction,
  markCorrectAnswer,
  buildCalendarDays,
  createPracticeGroupsForDay,
  buildDailyPool,
  createDialogueGroupsForDay,
  getCurrentDialogueItems,
  getDialogueGroupsForCourse,
  getDialogueDisplayText,
  getSpeakerVoice,
  summarizeCourseProgress,
  summarizeDialogueGroupProgress,
  filterCoursesForModule,
  serializeProgress,
  deserializeProgress,
  buildSpeechSsml,
} = require("../japanese_sentence_trainer/trainer_core.js");
const { GROUP_SIZE, courses, sentenceBank } = require("../japanese_sentence_trainer/curriculum.js");

test("wrong exact answers are not treated as completed sentences", () => {
  const sentence = {
    id: "school-n3-001",
    ja: "資料が足りなかったら、あとで追加で出せます。",
    particleAnswer: ["が", "で"],
  };

  const result = checkExactAnswer(sentence, "資料は不足であったら、後でもう一度提出します");

  assert.equal(result.correct, false);
  assert.equal(result.markComplete, false);
});

test("free dialogue rewrite does not require the placeholder pattern label", () => {
  const result = checkPatternAnswer(
    {
      ja: "この様子だと昼から暑くなりそうですね。",
      pattern: "自由改写",
      patternNeedle: "",
      particleAnswer: [],
    },
    "この様子だと電車に間に合わないそうです。",
  );

  assert.equal(result.correct, true);
  assert.equal(result.markComplete, true);
  assert.equal(result.message.includes("会话表达"), false);
});

test("only correct answers advance daily group completion", () => {
  const progress = createInitialProgress("2026-05-30");
  const group = [{ id: "a" }, { id: "b" }];

  markCorrectAnswer(progress, "2026-05-30", "a");

  assert.deepEqual([...progress.days["2026-05-30"].completedIds], ["a"]);
  assert.equal(getCompletionAction(progress, "2026-05-30", group, 0, 2), "next-sentence");
});

test("calendar days summarize daily practice status", () => {
  const progress = createInitialProgress("2026-05-30");
  progress.days["2026-05-30"].completedIds.add("a");
  progress.days["2026-05-29"] = { completedIds: new Set(["x", "y"]), finishedGroups: new Set([0]) };

  const days = buildCalendarDays(progress, "2026-05-30", 7);

  assert.equal(days.length, 7);
  assert.equal(days.at(-1).date, "2026-05-30");
  assert.equal(days.at(-1).status, "partial");
  assert.equal(days.at(-2).status, "complete");
});

test("future day practice produces a different first group", () => {
  const today = createPracticeGroupsForDay(sentenceBank, "2026-05-30", GROUP_SIZE);
  const nextDay = createPracticeGroupsForDay(sentenceBank, "2026-05-31", GROUP_SIZE);

  assert.notDeepEqual(
    today[0].map((sentence) => sentence.id),
    nextDay[0].map((sentence) => sentence.id),
  );
});

test("progress serializes and restores completed sentence ids", () => {
  const progress = createInitialProgress("2026-05-30");
  markCorrectAnswer(progress, "2026-05-30", "sentence-a");

  const restored = deserializeProgress(serializeProgress(progress), "2026-05-30");

  assert.equal(restored.days["2026-05-30"].completedIds.has("sentence-a"), true);
});

test("completion action moves through groups and stops at next day after final group", () => {
  const progress = createInitialProgress("2026-05-30");
  const group = [{ id: "a" }];
  markCorrectAnswer(progress, "2026-05-30", "a");

  assert.equal(getCompletionAction(progress, "2026-05-30", group, 0, 2), "next-group");
  assert.equal(getCompletionAction(progress, "2026-05-30", group, 1, 2), "next-day");
});

test("speech ssml escapes user text and selects Japanese voice", () => {
  const ssml = buildSpeechSsml("ja-JP-NanamiNeural", "5 < 6 & 7");

  assert.match(ssml, /ja-JP-NanamiNeural/);
  assert.match(ssml, /5 &lt; 6 &amp; 7/);
});

test("course filters keep life and news modules independent", () => {
  const lifeCourses = filterCoursesForModule(courses, "life").map((course) => course.id);

  assert.deepEqual(lifeCourses, ["dailylife", "school", "travel", "health", "entertainment"]);
  assert.equal(lifeCourses.includes("today"), false);
  assert.equal(lifeCourses.includes("review"), false);
});

test("daily dialogue groups rotate topics and preserve whole dialogue turns", () => {
  const items = [
    { id: "d1-1", scene: "dailylife", dialogueId: "dailylife-001", turnNum: 1 },
    { id: "d1-2", scene: "dailylife", dialogueId: "dailylife-001", turnNum: 2 },
    { id: "s1-1", scene: "school", dialogueId: "school-001", turnNum: 1 },
    { id: "s1-2", scene: "school", dialogueId: "school-001", turnNum: 2 },
    { id: "t1-1", scene: "travel", dialogueId: "travel-001", turnNum: 1 },
  ];

  const groups = createDialogueGroupsForDay(items, "2026-05-30", 10);

  assert.equal(groups.length, 3);
  assert.deepEqual([...new Set(groups.map((group) => group[0].scene))].sort(), ["dailylife", "school", "travel"]);
  assert.deepEqual(groups[0].map((item) => item.turnNum), [1, 2]);
});

test("current dialogue list only includes the active dialogue in source order", () => {
  const items = [
    { id: "a1", dialogueId: "a", turnNum: 1 },
    { id: "b1", dialogueId: "b", turnNum: 1 },
    { id: "a2", dialogueId: "a", turnNum: 2 },
  ];

  assert.deepEqual(
    getCurrentDialogueItems(items, items[0]).map((item) => item.id),
    ["a1", "a2"],
  );
});

test("dialogue groups preserve course dialogue order and turn order", () => {
  const items = [
    { id: "b2", scene: "school", dialogueId: "school-002", turnNum: 2 },
    { id: "a1", scene: "school", dialogueId: "school-001", turnNum: 1 },
    { id: "b1", scene: "school", dialogueId: "school-002", turnNum: 1 },
    { id: "a2", scene: "school", dialogueId: "school-001", turnNum: 2 },
    { id: "x1", scene: "health", dialogueId: "health-001", turnNum: 1 },
  ];

  const groups = getDialogueGroupsForCourse(items, "school");

  assert.deepEqual(groups.map((group) => group[0].dialogueId), ["school-002", "school-001"]);
  assert.deepEqual(groups[0].map((item) => item.id), ["b1", "b2"]);
});

test("dialogue group progress only counts fully completed groups", () => {
  const progress = createInitialProgress("2026-05-30");
  progress.days["2026-05-30"].completedIds.add("a1");
  progress.days["2026-05-30"].completedIds.add("a2");
  progress.days["2026-05-30"].completedIds.add("b1");

  const summary = summarizeDialogueGroupProgress(
    [
      { id: "a1", scene: "school", dialogueId: "school-001", turnNum: 1 },
      { id: "a2", scene: "school", dialogueId: "school-001", turnNum: 2 },
      { id: "b1", scene: "school", dialogueId: "school-002", turnNum: 1 },
      { id: "b2", scene: "school", dialogueId: "school-002", turnNum: 2 },
    ],
    progress,
    "school",
  );

  assert.deepEqual(summary, { total: 2, completed: 1, percent: 50 });
});

test("course progress summarizes total completed and percentage", () => {
  const progress = createInitialProgress("2026-05-30");
  progress.days["2026-05-30"].completedIds.add("a");
  const summary = summarizeCourseProgress(
    [
      { id: "a", scene: "school" },
      { id: "b", scene: "school" },
      { id: "c", scene: "health" },
    ],
    progress,
    "school",
  );

  assert.deepEqual(summary, { total: 2, completed: 1, percent: 50 });
});

test("dictation display hides only the active target sentence", () => {
  const current = { id: "b", turnNum: 2 };
  assert.equal(getDialogueDisplayText({ id: "a", ja: "前の句です。", turnNum: 1 }, current, "dictation"), "前の句です。");
  assert.equal(getDialogueDisplayText({ id: "b", ja: "今の句です。", turnNum: 2 }, current, "dictation"), "？？？");
  assert.equal(getDialogueDisplayText({ id: "c", ja: "後の句です。", turnNum: 3 }, current, "dictation"), "？？？");
  assert.equal(getDialogueDisplayText({ id: "b", ja: "今の句です。", turnNum: 2 }, current, "pattern"), "今の句です。");
});

test("speaker voices select separate A and B voices", () => {
  const settings = {
    speechVoice: "ja-JP-NanamiNeural",
    speakerAVoice: "ja-JP-NanamiNeural",
    speakerBVoice: "ja-JP-KeitaNeural",
  };

  assert.equal(getSpeakerVoice(settings, "A"), "ja-JP-NanamiNeural");
  assert.equal(getSpeakerVoice(settings, "B"), "ja-JP-KeitaNeural");
  assert.equal(getSpeakerVoice(settings, "C"), "ja-JP-NanamiNeural");
});

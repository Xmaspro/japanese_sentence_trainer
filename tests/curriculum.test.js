const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GROUP_SIZE,
  courses,
  sentenceBank,
  wordBank,
  createDailyGroups,
  getQueueForCourse,
} = require("../japanese_sentence_trainer/curriculum.js");

test("catalog prioritizes practical Japan life scenes across levels", () => {
  const lifeScenes = new Set([
    "dailylife",
    "school",
    "travel",
    "health",
    "entertainment",
  ]);

  assert.deepEqual(courses.map((course) => course.id), ["dailylife", "school", "travel", "health", "entertainment"]);

  const sceneIds = new Set(courses.filter((course) => course.scene).map((course) => course.id));
  for (const scene of lifeScenes) {
    assert.equal(sceneIds.has(scene), true, `${scene} course should exist`);
  }

  const levels = new Set(sentenceBank.map((sentence) => sentence.level));
  for (const level of ["N5", "N4", "N3", "N2", "N1"]) {
    assert.equal(levels.has(level), true, `${level} sentences should exist`);
  }

  assert.ok(sentenceBank.length >= 80, "starter catalog should be large enough for varied daily practice");
  assert.ok(wordBank.length >= 240, "word bank should cover a practical daily-life vocabulary base");
});

test("legacy daily helper can still split fallback sentences into finite groups", () => {
  const groups = createDailyGroups(sentenceBank, GROUP_SIZE);

  assert.ok(groups.length >= 3, "daily practice should offer several groups");
  assert.ok(groups.every((group) => group.length <= GROUP_SIZE), "groups should not exceed configured size");
  assert.ok(groups[0].every((sentence) => sentence.id), "group entries should be full sentence records");
  assert.notDeepEqual(
    groups[0].map((sentence) => sentence.id),
    groups[1].map((sentence) => sentence.id),
    "next group should not repeat the first group",
  );
});

test("course queues can target a practical life scene", () => {
  const dailylife = getQueueForCourse("dailylife", []);
  const health = getQueueForCourse("health", []);

  assert.ok(dailylife.length >= 3, "dailylife should have a useful starter set");
  assert.ok(health.length >= 3, "health should have a useful starter set");
  assert.ok(dailylife.every((sentence) => sentence.scene === "dailylife"));
  assert.ok(health.every((sentence) => sentence.scene === "health"));
});

test("course queues keep source order for dialogue topics", () => {
  const ordered = [
    { id: "a", scene: "school" },
    { id: "b", scene: "dailylife" },
    { id: "c", scene: "school" },
  ];
  const queue = getQueueForCourse("school", [], ordered);

  assert.deepEqual(queue.map((item) => item.id), ["a", "c"]);
});

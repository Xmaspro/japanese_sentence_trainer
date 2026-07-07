const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildDateKeysToCheck,
  buildSlotKey,
  editorialNeedsGeneration,
  getJstParts,
  shouldRunScheduledSlot,
} = require("../tools/editorial_scheduler.js");

test("getJstParts returns Asia/Tokyo date and hour", () => {
  const parts = getJstParts(new Date("2026-07-08T03:30:00.000Z"));
  assert.equal(parts.dateKey, "2026-07-08");
  assert.equal(parts.hour, 12);
  assert.equal(parts.minute, 30);
});

test("shouldRunScheduledSlot runs once per configured hour", () => {
  const config = { scheduleHoursJst: [6, 12, 18, 20] };
  const now = new Date("2026-07-08T03:00:00.000Z");
  const slot = shouldRunScheduledSlot(config, { lastRuns: {} }, now);
  assert.equal(slot, buildSlotKey("2026-07-08", 12));

  const again = shouldRunScheduledSlot(config, { lastRuns: { [slot]: { at: now.toISOString() } } }, now);
  assert.equal(again, null);
});

test("shouldRunScheduledSlot ignores non-zero minute", () => {
  const config = { scheduleHoursJst: [12] };
  const now = new Date("2026-07-08T03:05:00.000Z");
  assert.equal(shouldRunScheduledSlot(config, { lastRuns: {} }, now), null);
});

test("buildDateKeysToCheck includes recent days", () => {
  const keys = buildDateKeysToCheck({ checkDaysBack: 2 }, new Date("2026-07-08T03:00:00.000Z"));
  assert.deepEqual(keys, ["2026-07-08", "2026-07-07"]);
});

test("editorialNeedsGeneration treats missing or non-ready bundles as pending", () => {
  assert.equal(editorialNeedsGeneration({ url: "https://example.com/a" }), true);
  assert.equal(
    editorialNeedsGeneration({ url: "https://example.com/b" }),
    true,
  );
});
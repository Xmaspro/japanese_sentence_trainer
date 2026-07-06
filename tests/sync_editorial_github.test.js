const test = require("node:test");
const assert = require("node:assert/strict");

const { buildGithubSafeRecord } = require("../tools/sync_editorial_github.js");

test("buildGithubSafeRecord excludes article paragraph quotes", () => {
  const record = buildGithubSafeRecord("2099-01-01");
  assert.equal(record.date, "2099-01-01");
  assert.ok(record.policy.includes("no article full text"));
});
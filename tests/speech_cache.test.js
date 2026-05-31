const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getSpeechObjectUrl,
  trimSpeechBlobCache,
} = require("../japanese_sentence_trainer/speech_cache.js");

function createFakeUrlApi() {
  let nextId = 1;
  const revoked = [];
  return {
    revoked,
    createObjectURL() {
      return `blob:fake-${nextId++}`;
    },
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };
}

test("speech cache reuses an in-flight synthesis request", async () => {
  const cache = new Map();
  const urlApi = createFakeUrlApi();
  let calls = 0;

  const first = getSpeechObjectUrl(cache, "microsoft", "こんにちは", "voice-a", async () => {
    calls += 1;
    return { audio: true };
  }, urlApi);
  const second = getSpeechObjectUrl(cache, "microsoft", "こんにちは", "voice-a", async () => {
    calls += 1;
    return { audio: true };
  }, urlApi);

  assert.equal(await first, "blob:fake-1");
  assert.equal(await second, "blob:fake-1");
  assert.equal(calls, 1);
});

test("speech cache trims oldest object urls", () => {
  const cache = new Map([
    ["a", { url: "blob:a", createdAt: 1 }],
    ["b", { url: "blob:b", createdAt: 2 }],
    ["c", { url: "blob:c", createdAt: 3 }],
  ]);
  const urlApi = createFakeUrlApi();

  trimSpeechBlobCache(cache, 2, urlApi);

  assert.deepEqual([...cache.keys()], ["b", "c"]);
  assert.deepEqual(urlApi.revoked, ["blob:a"]);
});

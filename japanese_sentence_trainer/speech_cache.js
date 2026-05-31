(function (root, factory) {
  const helpers = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
  }
  root.JapaneseSentenceTrainerSpeechCache = helpers;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  async function getSpeechObjectUrl(cache, provider, text, voice, blobFactory, urlApi = URL) {
    const key = `${provider}:${voice}:${text}`;
    const cached = cache.get(key);
    if (cached?.url) return cached.url;
    if (cached?.promise) return cached.promise;

    const promise = blobFactory()
      .then((blob) => {
        const url = urlApi.createObjectURL(blob);
        cache.set(key, { url, createdAt: Date.now() });
        trimSpeechBlobCache(cache, 80, urlApi);
        return url;
      })
      .catch((error) => {
        cache.delete(key);
        throw error;
      });

    cache.set(key, { promise, createdAt: Date.now() });
    return promise;
  }

  function trimSpeechBlobCache(cache, maxItems = 80, urlApi = URL) {
    if (cache.size <= maxItems) return;
    const entries = [...cache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    for (const [key, value] of entries.slice(0, cache.size - maxItems)) {
      if (value.url) urlApi.revokeObjectURL(value.url);
      cache.delete(key);
    }
  }

  return {
    getSpeechObjectUrl,
    trimSpeechBlobCache,
  };
});

(function (root, factory) {
  const client = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = client;
  }
  root.JapaneseSentenceTrainerVoicevoxClient = client;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const DEFAULT_ENGINE_URL = "http://127.0.0.1:50021";

  function normalizeEngineUrl(url) {
    const raw = String(url || DEFAULT_ENGINE_URL).trim();
    return raw.replace(/\/+$/, "") || DEFAULT_ENGINE_URL;
  }

  function resolveAiSpeakerId(settings, speakerChar) {
    const side = speakerChar === "B" ? "B" : "A";
    const configured = side === "B" ? settings?.speakerBVoice : settings?.speakerAVoice;
    if (configured && /^\d+$/.test(String(configured).trim())) {
      return Number(String(configured).trim());
    }
    return side === "B" ? 3 : 2;
  }

  async function synthesizeViaEngine(text, speakerId, engineUrl = DEFAULT_ENGINE_URL) {
    const base = normalizeEngineUrl(engineUrl);
    const speaker = Number(speakerId || 2);
    const queryResponse = await fetch(
      `${base}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
      { method: "POST" },
    );
    if (!queryResponse.ok) {
      throw new Error(`VOICEVOX audio_query failed: ${queryResponse.status}`);
    }
    const queryJson = await queryResponse.json();
    const synthResponse = await fetch(`${base}/synthesis?speaker=${speaker}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queryJson),
    });
    if (!synthResponse.ok) {
      throw new Error(`VOICEVOX synthesis failed: ${synthResponse.status}`);
    }
    return synthResponse.blob();
  }

  async function synthesizeViaServerProxy(text, speakerId) {
    const response = await fetch("/api/voicevox-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker: Number(speakerId || 2) }),
    });
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(detail || `VOICEVOX proxy failed: ${response.status}`);
    }
    return response.blob();
  }

  async function fetchVoicevoxBlob(text, speakerId, options = {}) {
    const engineUrl = normalizeEngineUrl(options.engineUrl);
    const errors = [];

    if (options.preferEngine !== true) {
      try {
        return await synthesizeViaServerProxy(text, speakerId);
      } catch (error) {
        errors.push(`proxy: ${error.message}`);
      }
    }

    try {
      return await synthesizeViaEngine(text, speakerId, engineUrl);
    } catch (error) {
      errors.push(`engine: ${error.message}`);
      throw new Error(errors.join(" | "));
    }
  }

  async function checkVoicevoxEngine(engineUrl = DEFAULT_ENGINE_URL) {
    const base = normalizeEngineUrl(engineUrl);
    try {
      const response = await fetch(`${base}/version`, { method: "GET" });
      if (!response.ok) return { ok: false, engineUrl: base, message: `version ${response.status}` };
      const version = await response.json();
      return { ok: true, engineUrl: base, version };
    } catch (error) {
      return { ok: false, engineUrl: base, message: error.message || "unreachable" };
    }
  }

  return {
    DEFAULT_ENGINE_URL,
    checkVoicevoxEngine,
    fetchVoicevoxBlob,
    normalizeEngineUrl,
    resolveAiSpeakerId,
    synthesizeViaEngine,
    synthesizeViaServerProxy,
  };
});
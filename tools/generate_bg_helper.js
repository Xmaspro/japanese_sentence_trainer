const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const generatedDir = path.join(rootDir, "japanese_sentence_trainer", "assets", "backgrounds", "generated");

// Ensure the directory exists
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

// Active generations map to prevent duplicate concurrent API requests
const activeGenerations = new Map();

/**
 * Generates an anime-style visual novel background based on topic name.
 * Uses Pollinations AI and caches the result locally.
 * 
 * @param {string} dialogueId Unique ID of the dialogue group
 * @param {string} topicName Theme of the dialogue group
 * @returns {Promise<string>} The web path of the image
 */
async function generateBackground(dialogueId, topicName, firstJa, force = false) {
  if (!dialogueId || !topicName) {
    throw new Error("dialogueId and topicName are required");
  }

  // Sanitize dialogueId for filename
  const safeFilename = String(dialogueId).replace(/[^a-zA-Z0-9_-]/g, "") + ".jpg";
  const absolutePath = path.join(generatedDir, safeFilename);
  const webPath = `/japanese_sentence_trainer/assets/backgrounds/generated/${safeFilename}`;

  // 1. Check if cached image already exists
  if (!force && fs.existsSync(absolutePath)) {
    const mtimeMs = fs.statSync(absolutePath).mtimeMs;
    return `${webPath}?t=${Math.floor(mtimeMs)}`;
  }

  // 2. Check if there's already an active generation for this dialogueId
  if (activeGenerations.has(dialogueId)) {
    console.log(`Waiting for existing background generation of [${topicName}] (ID: ${dialogueId})...`);
    return activeGenerations.get(dialogueId);
  }

  // Define the generation promise and register it
  const generationPromise = (async () => {
    try {
      // 3. Build the optimized visual novel style prompt
      // Target Kyoto Animation soft focus, beautiful visual novel background scenery
      const optimizedTopic = topicName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, "").trim();
      const cleanJa = firstJa ? firstJa.replace(/[^\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff0-9a-zA-Z\s，。！？、]/g, "").trim() : "";

      let prompt;
      if (cleanJa) {
        prompt = `Kyoto Animation style, visual novel background, soft focus, anime scenery, warm lighting, highly detailed, no characters, ${cleanJa}, theme of ${optimizedTopic}`;
      } else {
        prompt = `Kyoto Animation style, visual novel background, soft focus, anime scenery, warm lighting, highly detailed, no characters, ${optimizedTopic}`;
      }

      const apiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=576&nologo=true`;

      console.log(`Generating VN background for [${topicName}] (ID: ${dialogueId})...`);

      // 4. Fetch image from Pollinations AI with robust retry mechanism
      let response;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await fetch(apiUrl);
          if (response.ok) {
            break; // Success!
          }
          console.warn(`Pollinations AI returned status ${response.status} (attempt ${attempt}/${maxRetries})`);
        } catch (fetchErr) {
          console.warn(`Fetch to Pollinations AI failed: ${fetchErr.message} (attempt ${attempt}/${maxRetries})`);
        }
        
        if (attempt < maxRetries) {
          const delay = attempt * 1200; // Easing delay slightly to avoid rate limit
          console.log(`Retrying background generation in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Failed to generate image from Pollinations AI after ${maxRetries} attempts: ${response ? response.status : 'Network Error'}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 5. Save to local cache
      fs.writeFileSync(absolutePath, buffer);
      console.log(`VN background generated and cached successfully at: ${absolutePath}`);

      const mtimeMs = fs.statSync(absolutePath).mtimeMs;
      return `${webPath}?t=${Math.floor(mtimeMs)}`;
    } finally {
      // Remove generation lock when completed or failed
      activeGenerations.delete(dialogueId);
    }
  })();

  activeGenerations.set(dialogueId, generationPromise);
  return generationPromise;
}

module.exports = {
  generateBackground
};

const fs = require("node:fs");
const path = require("node:path");

const generatedDir = path.join(__dirname, "..", "japanese_sentence_trainer", "assets", "backgrounds", "generated");

if (fs.existsSync(generatedDir)) {
  const files = fs.readdirSync(generatedDir);
  for (const file of files) {
    const filePath = path.join(generatedDir, file);
    if (fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
      console.log(`Deleted cached background: ${file}`);
    }
  }
  console.log("Background image cache cleaned successfully.");
} else {
  console.log("Cache directory does not exist.");
}

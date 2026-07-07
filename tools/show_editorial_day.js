const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const FETCHED = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "fetched");
const READINGS = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "text");
const SPEAKING = path.join(ROOT, "phase2_editorial_training", "editorial_speaking", "logs");

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--date") options.date = argv[i + 1];
  }
  return options;
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function showDay(options = {}) {
  const dateKey = options.date || todayKey();
  const fetched = readJsonIfExists(path.join(FETCHED, `${dateKey}.json`));
  const reading = readJsonIfExists(path.join(READINGS, `${dateKey}.json`));
  const speaking = readJsonIfExists(path.join(SPEAKING, `${dateKey}.json`));

  console.log(`=== Editorial day: ${dateKey} ===\n`);

  if (!fetched && !reading && !speaking) {
    throw new Error(`No editorial JSON found for ${dateKey}`);
  }

  if (fetched) {
    console.log("[1] fetched/  → 精读全文（本地 only）");
    console.log(`    标题: ${fetched.title}`);
    console.log(`    URL : ${fetched.url}`);
    console.log(`    段数: ${fetched.paragraphs.length}`);
    console.log("    用法: 打开 fetched JSON，读 paragraphs[] 或 fullText");
    console.log("");
    fetched.paragraphs.forEach((paragraph, index) => {
      console.log(`    ${index + 1}. ${paragraph}`);
    });
    console.log("");
  } else {
    console.log("[1] fetched/  → 未找到。先运行: npm run editorial:fetch-asahi -- --date", dateKey);
    console.log("");
  }

  if (reading) {
    console.log("[2] text/  → 阅读笔记（可 git）");
    console.log(`    topic          : ${reading.reading?.topic || ""}`);
    console.log(`    newspaperStance: ${(reading.reading?.newspaperStance || "").slice(0, 60)}...`);
    console.log("    用法: 读完后填 reading.summaryJa / vocab / readMinutes");
    console.log(`    文件: phase2_editorial_training/editorial_readings/text/${dateKey}.json`);
    console.log("");
  }

  if (speaking) {
    const exercises = speaking.exercises || {};
    console.log("[3] logs/  → 口语练习（可 git）");
    console.log("    用法: 朗读复述范本，录到 recordings/ 对应路径");
    console.log(`    文件: phase2_editorial_training/editorial_speaking/logs/${dateKey}.json`);
    console.log("");
    const script = exercises.script || "";
    if (script) {
      const preview = script.split("\n").slice(0, 3).join(" / ");
      console.log(`    ${exercises.flowTitle || "社论复述口语范本"}`);
      console.log(`    ${preview}${script.includes("\n") ? " …" : ""}`);
      if (exercises.recording) console.log(`    录音: ${exercises.recording}`);
    } else {
      console.log("    （口语范本尚未生成，请重新运行 editorial pipeline）");
    }
  }
}

if (require.main === module) {
  try {
    showDay(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { showDay };
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const READINGS = path.join(ROOT, "phase2_editorial_training", "editorial_readings");
const SPEAKING = path.join(ROOT, "phase2_editorial_training", "editorial_speaking");

const PAPER_CONFIG = {
  asahi: { newspaper: "asahi", newspaperLabel: "朝日新聞", filePrefix: "asahi" },
  nikkei: { newspaper: "nikkei", newspaperLabel: "日本経済新聞", filePrefix: "nikkei" },
};

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--date") options.date = argv[i + 1];
    if (arg === "--paper") options.paper = argv[i + 1];
  }
  return options;
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function paperForWeekday(dateKey) {
  const day = new Date(`${dateKey}T12:00:00`).getDay();
  if (day === 0) return "review";
  return [1, 3, 5].includes(day) ? "asahi" : "nikkei";
}

function readTemplate(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function addDays(dateKey, offset) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return todayKey(date);
}

function createDay(options = {}) {
  const dateKey = options.date || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date: ${dateKey}`);
  }

  const rotation = paperForWeekday(dateKey);
  if (rotation === "review") {
    console.log(`${dateKey} is review day. Create files manually if you still read today.`);
  }

  const paperKey = options.paper || (rotation === "review" ? "asahi" : rotation);
  const paper = PAPER_CONFIG[paperKey];
  if (!paper) {
    throw new Error(`Unknown paper: ${paperKey}. Use asahi or nikkei.`);
  }

  const scansDir = path.join(READINGS, "scans", dateKey);
  const recordingsDir = path.join(SPEAKING, "recordings", dateKey);
  const readingFile = path.join(READINGS, "text", `${dateKey}.json`);
  const speakingFile = path.join(SPEAKING, "logs", `${dateKey}.json`);

  fs.mkdirSync(scansDir, { recursive: true });
  fs.mkdirSync(recordingsDir, { recursive: true });

  const created = [];

  if (!fs.existsSync(readingFile)) {
    const reading = readTemplate("phase2_editorial_training/editorial_readings/text/_template.json");
    reading.date = dateKey;
    reading.newspaper = paper.newspaper;
    reading.newspaperLabel = paper.newspaperLabel;
    reading.images = [
      `phase2_editorial_training/editorial_readings/scans/${dateKey}/${paper.filePrefix}_editorial_01.jpg`,
    ];
    writeJson(readingFile, reading);
    created.push(readingFile);
  }

  if (!fs.existsSync(speakingFile)) {
    const speaking = readTemplate("phase2_editorial_training/editorial_speaking/logs/_template.json");
    speaking.date = dateKey;
    speaking.newspaper = paper.newspaper;
    speaking.linkedReading = `phase2_editorial_training/editorial_readings/text/${dateKey}.json`;
    if (speaking.exercises?.recording) {
      speaking.exercises.recording = speaking.exercises.recording.replace("YYYY-MM-DD", dateKey);
    }
    writeJson(speakingFile, speaking);
    created.push(speakingFile);
  }

  console.log(`Editorial day ready: ${dateKey} (${paper.newspaperLabel})`);
  console.log(`Scans dir: ${scansDir}`);
  console.log(`Recordings dir: ${recordingsDir}`);
  if (created.length) {
    console.log("Created:");
    for (const file of created) console.log(`  ${path.relative(ROOT, file)}`);
  } else {
    console.log("Reading/speaking JSON already exist. Directories refreshed.");
  }
}

if (require.main === module) {
  try {
    createDay(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { createDay, paperForWeekday, todayKey };
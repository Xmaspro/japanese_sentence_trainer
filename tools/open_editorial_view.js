const { execSync } = require("node:child_process");
const path = require("node:path");
const { renderEditorialDay } = require("./render_editorial_day.js");

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--date") options.date = argv[i + 1];
  }
  return options;
}

function openFile(filePath) {
  const platform = process.platform;
  if (platform === "darwin") {
    execSync(`open ${JSON.stringify(filePath)}`);
    return;
  }
  if (platform === "win32") {
    execSync(`start "" ${JSON.stringify(filePath)}`, { shell: true });
    return;
  }
  execSync(`xdg-open ${JSON.stringify(filePath)}`);
}

if (require.main === module) {
  try {
    const result = renderEditorialDay(parseArgs(process.argv.slice(2)));
    openFile(result.outPath);
    console.log(`Opened ${path.basename(result.outPath)}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
const fs = require("node:fs");
const path = require("node:path");
const { renderEditorialDay } = require("./render_editorial_day.js");

const ROOT = path.resolve(__dirname, "..");
const FETCHED_DIR = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "fetched");
const READINGS_TEXT = path.join(ROOT, "phase2_editorial_training", "editorial_readings", "text");
const SPEAKING_LOGS = path.join(ROOT, "phase2_editorial_training", "editorial_speaking", "logs");

const ASAHI_LIST_URL = "https://www.asahi.com/rensai/list.html?id=16";
const USER_AGENT = "Mozilla/5.0 japanese-sentence-trainer/1.0 (personal study)";

function parseArgs(argv) {
  const options = { paper: "asahi" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--date") options.date = argv[i + 1];
    if (arg === "--url") options.url = argv[i + 1];
    if (arg === "--dry-run") options.dryRun = true;
  }
  return options;
}

function normalizeEditorialUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`无效的 URL：${raw}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL 须以 http:// 或 https:// 开头");
  }
  return parsed.toString();
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, offset) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return todayKey(date);
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, ""))
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/\u3000+/g, "\u3000")
    .trim();
}

function parseJapaneseDateTime(text) {
  const match = String(text || "").match(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})時(\d{1,2})分)?/);
  if (!match) return "";
  const [, year, month, day, hour = "0", minute = "0"] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00+09:00`;
  return iso;
}

function parseAsahiEditorialList(html) {
  const items = [];
  const pattern =
    /<li><a href="(https:\/\/www\.asahi\.com\/articles\/[^"]+)"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?<p class="rsgMp">\s*([\s\S]*?)<\/p>[\s\S]*?<span class="Sgvid">([^<]+)<\/span>/gi;

  for (const match of html.matchAll(pattern)) {
    const [, url, title, leadHtml, publishedText] = match;
    const lead = stripTags(leadHtml).replace(/\[続きを読む\]$/, "").trim();
    items.push({
      title: stripTags(title),
      url: url.split("?")[0],
      lead,
      publishedAt: parseJapaneseDateTime(publishedText),
      publishedLabel: stripTags(publishedText),
    });
  }
  return items;
}

function pickListItemForDate(items, dateKey) {
  const target = dateKey.replace(/-/g, "年").replace(/年(\d{2})月/, (m, mm) => `年${mm}月`).slice(0, 11);
  const normalizedTarget = dateKey.replace(/-/g, "/");
  return (
    items.find((item) => item.publishedAt.startsWith(dateKey)) ||
    items.find((item) => item.publishedLabel.includes(target.replace(/-/g, ""))) ||
    items[0] ||
    null
  );
}

function extractMainHtml(html) {
  const mainStart = html.indexOf("<main");
  const mainEnd = html.indexOf("</main>");
  if (mainStart < 0 || mainEnd < 0) return html;
  return html.slice(mainStart, mainEnd);
}

function extractArticleTitle(mainHtml) {
  const match = mainHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripTags(match[1]) : "";
}

function extractJsonLd(mainHtml) {
  const match = mainHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function isNoiseParagraph(text) {
  if (!text) return true;
  if (text.length < 12) return true;
  if (/シェア|印刷する|有料会員|続きを読む|関連記事|メールで/.test(text)) return true;
  return false;
}

function extractMetaDescription(html) {
  const match = html.match(/<meta name="description" content="([^"]+)"/i);
  return match ? stripTags(match[1]).replace(/…+$/, "").trim() : "";
}

function dedupeParagraphs(paragraphs) {
  const result = [];
  for (const paragraph of paragraphs) {
    const text = String(paragraph || "").trim();
    if (!text) continue;
    const previous = result[result.length - 1];
    if (previous && (previous.includes(text) || text.includes(previous))) {
      if (text.length > previous.length) result[result.length - 1] = text;
      continue;
    }
    if (!result.includes(text)) result.push(text);
  }
  return result;
}

function prependLeadParagraph(paragraphs, lead) {
  const normalizedLead = String(lead || "").trim().replace(/…+$/, "").trim();
  if (!normalizedLead) return dedupeParagraphs(paragraphs);
  if (!paragraphs.length) return [normalizedLead];

  const first = paragraphs[0];
  if (first.includes(normalizedLead.slice(0, 12)) || normalizedLead.includes(first.slice(0, 12))) {
    return dedupeParagraphs(paragraphs);
  }

  const leadSentence = normalizedLead.split("。")[0];
  if (leadSentence.length >= 12 && !first.includes(leadSentence.slice(0, 12))) {
    return dedupeParagraphs([`${leadSentence}。`, ...paragraphs]);
  }

  return dedupeParagraphs(paragraphs);
}

function extractEditorialParagraphs(bodyHtml, endIndex) {
  const slice = bodyHtml.slice(0, endIndex);
  const editorialPattern = /<p>\s*\u3000([\s\S]*?)<\/p>/gi;
  const paragraphs = [];
  for (const match of slice.matchAll(editorialPattern)) {
    const text = stripTags(match[1]);
    if (!isNoiseParagraph(text)) paragraphs.push(text);
  }
  if (paragraphs.length >= 2) return paragraphs;

  const fallback = [];
  const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of slice.matchAll(paragraphPattern)) {
    const text = stripTags(match[1]);
    if (!isNoiseParagraph(text)) fallback.push(text);
  }
  return fallback;
}

function parseAsahiEditorialArticle(html) {
  const mainHtml = extractMainHtml(html);
  const title = extractArticleTitle(mainHtml);
  const jsonLd = extractJsonLd(html);
  const metaLead = extractMetaDescription(html);
  const h1Index = mainHtml.search(/<h1[^>]*>/i);
  const bodyStart = h1Index >= 0 ? h1Index : 0;
  const bodyHtml = mainHtml.slice(bodyStart);
  const paywallIndex = bodyHtml.indexOf("有料会員になると");
  const endIndex = paywallIndex >= 0 ? paywallIndex : bodyHtml.length;

  const paragraphs = dedupeParagraphs(extractEditorialParagraphs(bodyHtml, endIndex));
  const withLead = dedupeParagraphs(
    prependLeadParagraph(paragraphs, metaLead || jsonLd?.description || ""),
  );

  return {
    title: title || jsonLd?.headline || "",
    publishedAt: jsonLd?.datePublished || "",
    url: jsonLd?.mainEntityOfPage?.["@id"] || "",
    lead: withLead[0] || "",
    paragraphs: withLead,
    fullText: withLead.join("\n\n"),
  };
}

function cleanEditorialTitle(title) {
  return String(title || "")
    .replace(/^（社説）/, "")
    .replace(/^（社说）/, "")
    .trim();
}

function extractQuotedTerms(text) {
  return [...String(text || "").matchAll(/「([^」]{2,24})」/g)].map((match) => match[1]);
}

function applySpokenPhraseRules(text) {
  const phraseRules = [
    [/在留外国人が/g, "在留外国人の方が"],
    [/外国人労働者らが/g, "外国人の労働者の方が"],
    [/移民が公用語/g, "移民の人が公用語"],
    [/プロジェクトチーム/g, "PT"],
    [/日本語や生活上のルール/g, "日本語とか生活のルール"],
    [/韓国やドイツなどは/g, "韓国とかドイツみたいな国は"],
    [/創設に向け、?/g, "作ろうとしてて、"],
    [/自治体任せだった従来の姿勢を改め、/g, "自治体任せだったのを変えて、"],
    [/国が責任をもって取り組むのは/g, "国がちゃんと責任持ってやるっていうのは"],
    [/大きな前進だ。$/, "すごく前進だと思います。"],
    [/低価格で提供している。$/, "安く提供してるんですよね。"],
    [/外国人に適応を求めるだけではなく、/g, "外国人に「適応しろ」だけじゃなくて、"],
    [/受け入れる側が他国の文化を知り、/g, "受け入れる側も相手の文化を知って、"],
    [/異なる習慣や価値観を尊重する姿勢も必要だ。$/, "違う習慣や価値観を尊重する姿勢が必要だと思います。"],
    [/学ぶプログラム/g, "学べるプログラム"],
    [
      /外国人労働者らが通える日本語教室がない「空白地域」は、市区町村の(\d+％)を占める。$/,
      "外国人の労働者の方が通える日本語教室がない地域、空白地域っていうんですけど、市区町村の$1もあるらしいです。",
    ],
  ];

  let result = text;
  for (const [pattern, replacement] of phraseRules) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function convertToDesuMasu(sentence) {
  let text = String(sentence || "").trim();
  if (!text) return "";

  text = applySpokenPhraseRules(text);
  text = text
    .replace(/と言えます。/g, "と思います。")
    .replace(/動き出した。$/, "動き始めたんです。")
    .replace(/まとめた。$/, "まとめたんです。")
    .replace(/占める。$/, "あるらしいです。")
    .replace(/進めてほしい。$/, "進めてほしい、っていうことですね。")
    .replace(/前進だ。$/, "前進だと思います。")
    .replace(/必要だ。$/, "必要だと思います。")
    .replace(/べきだ。$/, "べきだと思います。")
    .replace(/だろう。$/, "でしょう。")
    .replace(/姿だ。$/, "姿なんです。")
    .replace(/である。$/, "なんです。")
    .replace(/している。$/, "してるんですよね。")
    .replace(/ていない。$/, "ていないんです。")
    .replace(/([^い])ない。$/, "$1ないんです。")
    .replace(/いない。$/, "いないんです。")
    .replace(/だ。$/, "なんです。")
    .replace(/ある。$/, "あるんです。");

  return text.replace(/と言えます。/g, "と思います。");
}

function buildSummaryScaffold(title, paragraphs) {
  const topic = cleanEditorialTitle(title);
  const lead = paragraphs[0] || "";
  const stance = paragraphs[paragraphs.length - 1] || "";
  return [
    "【下書き・読んだあと自分の言葉に直す】",
    `今日の社説は「${topic}」についてです。`,
    lead ? `要するに、${lead}` : "要するに、____________________。",
    stance ? `朝日新聞は最後に、${stance}` : "朝日新聞の主張は、____________________。",
  ].join("\n");
}

function buildKeywordScaffold(keyword, paragraphs) {
  const context = paragraphs.find((paragraph) => paragraph.includes(keyword)) || paragraphs[0] || "";
  return [
    `キーワード：${keyword || "________"}`,
    "意味：____________________",
    context ? `本文での使い方：${context}` : "本文での使い方：____________________",
    "自分の言葉で説明：____________________",
  ].join("\n");
}

function buildOpinionScaffold(title) {
  const topic = cleanEditorialTitle(title);
  return [
    `題材：${topic}`,
    "私は朝日の主張に（賛成 / 反対 / どちらとも言えない）と思います。",
    "理由1：____________________",
    "理由2：____________________",
    "結論：____________________",
  ].join("\n");
}

function firstSentence(text) {
  return String(text || "")
    .split("。")
    .map((part) => part.trim())
    .find(Boolean);
}

function excerptToSpoken(text, maxSentences = 2) {
  const sentences = String(text || "")
    .split(/(?<=。)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, maxSentences);
  return sentences.map((sentence) => {
    const normalized = sentence.endsWith("。") ? sentence : `${sentence}。`;
    const spoken = convertToDesuMasu(normalized);
    return spoken || normalized;
  });
}

function isPlaceholderSpeakingScript(script) {
  const text = String(script || "").trim();
  if (!text) return true;
  return /_{3,}|________________|下書き/.test(text);
}

function buildRetellingScript({ title, paragraphs, newspaperLabel = "朝日新聞" }) {
  const paper = String(newspaperLabel || "朝日新聞").trim() || "朝日新聞";
  const topic = cleanEditorialTitle(title);
  const leadLines = excerptToSpoken(paragraphs[0] || "", 2);
  const bodyLines = paragraphs
    .slice(1, -1)
    .flatMap((paragraph) => excerptToSpoken(paragraph, 1))
    .slice(0, 4);
  const closeLines = excerptToSpoken(paragraphs[paragraphs.length - 1] || "", 2);

  const lines = [
    "【社论复述口语范本】",
    "（です・ます体 · 先大声朗读，再合上正文自己复述）",
    "",
    `今日の${paper}の社説は、「${topic}」がテーマです。`,
    ...leadLines,
  ];

  if (bodyLines.length) {
    lines.push("", "この社説で特に気になったのは、次の点です。");
    bodyLines.forEach((line, index) => {
      const spoken = line
        .replace(/と言えます。$/, "と思います。")
        .replace(/です。$/, "んです。");
      lines.push(index === 0 ? spoken : `それから、${spoken}`);
    });
  }

  if (closeLines.length) {
    lines.push("", `${paper}の立場をまとめると、`);
    closeLines.forEach((line, index) => {
      const spoken = line
        .replace(/と言えます。$/, "と思います。")
        .replace(/なんです。$/, "だと思います。")
        .replace(/です。$/, "だと思います。");
      lines.push(index === 0 ? spoken : `あと、${spoken}`);
    });
  }

  return lines.join("\n");
}

function legacySpeakingScript(speaking = {}) {
  if (speaking.script && !isPlaceholderSpeakingScript(speaking.script)) {
    return speaking.script;
  }
  if (speaking.steps?.length) {
    const combined = speaking.steps
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((step) => step.script)
      .filter(Boolean)
      .join("\n\n");
    if (combined && !isPlaceholderSpeakingScript(combined)) return combined;
  }
  if (speaking.summary30s?.script && !isPlaceholderSpeakingScript(speaking.summary30s.script)) {
    return speaking.summary30s.script;
  }
  return "";
}

function ensureSpeakingSteps(speaking, { title, paragraphs, dateKey, newspaperLabel }) {
  const fresh = buildSpeakingExercises({ title, paragraphs, dateKey, newspaperLabel });
  if (!speaking) return fresh;

  const retellingSource = speaking.retelling || speaking;
  const previousScript = legacySpeakingScript(retellingSource);
  const keepPreviousScript = previousScript && !isPlaceholderSpeakingScript(previousScript);

  return {
    flowTitle: fresh.flowTitle,
    flowHint: fresh.flowHint,
    script: keepPreviousScript ? previousScript : fresh.script,
    recording: retellingSource.recording || speaking.recording || fresh.recording,
    done: retellingSource.done ?? speaking.done ?? speaking.summary30s?.done ?? false,
  };
}

function buildSpeakingExercises({ title, paragraphs, dateKey, newspaperLabel }) {
  return {
    flowTitle: "社论复述口语范本",
    flowHint: "先大声朗读下面的です・ます口语范文，再合上正文用自己的话复述一遍。",
    script: buildRetellingScript({ title, paragraphs, newspaperLabel }),
    recording: `phase2_editorial_training/editorial_speaking/recordings/${dateKey}/retelling.m4a`,
    done: false,
  };
}

function buildFetchedRecord({ listItem, article, dateKey, articleUrl = "" }) {
  const paragraphs = prependLeadParagraph(article.paragraphs, listItem?.lead || article.lead);
  const fullText = paragraphs.join("\n\n");
  return {
    date: dateKey,
    source: "asahi",
    section: "社説",
    title: article.title || listItem?.title || "",
    url: article.url || listItem?.url || articleUrl || "",
    publishedAt: article.publishedAt || listItem?.publishedAt || "",
    fetchedAt: new Date().toISOString(),
    lead: paragraphs[0] || listItem?.lead || "",
    paragraphs,
    fullText,
    storagePolicy: "local-only personal study archive; do not publish or redistribute",
  };
}

function buildReadingPatch(fetchedRecord) {
  const keyParagraphs = fetchedRecord.paragraphs.slice(0, Math.min(3, fetchedRecord.paragraphs.length));
  return {
    date: fetchedRecord.date,
    title: fetchedRecord.title,
    section: fetchedRecord.section,
    sourceUrl: fetchedRecord.url,
    fetchedPath: `phase2_editorial_training/editorial_readings/fetched/${fetchedRecord.date}.json`,
    extractedText: {
      title: fetchedRecord.title,
      lead: fetchedRecord.lead,
      keyParagraphs,
      proofread: false,
      proofreadNotes: "auto-fetched from Asahi web; compare with paper scan if available",
    },
    reading: {
      topic: cleanEditorialTitle(fetchedRecord.title),
      newspaperStance: fetchedRecord.paragraphs[fetchedRecord.paragraphs.length - 1] || "",
      keyReason: fetchedRecord.paragraphs[1] || "",
      summaryJa: "",
      readMinutes: 0,
    },
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function mergeReading(existing, patch) {
  return {
    ...existing,
    ...patch,
    extractedText: {
      ...existing.extractedText,
      ...patch.extractedText,
    },
    reading: {
      ...existing.reading,
      ...patch.reading,
      vocab: existing.reading?.vocab || patch.reading?.vocab || [],
    },
    images: existing.images || [],
  };
}

function mergeSpeaking(existing, { title, paragraphs, dateKey, newspaperLabel }) {
  const { ensureSpeakingModes } = require("./editorial_podcast_pipeline.js");
  return {
    ...existing,
    date: dateKey,
    linkedReading: `phase2_editorial_training/editorial_readings/text/${dateKey}.json`,
    source: "asahi-editorial-fetch",
    exercises: ensureSpeakingModes(existing.exercises, {
      title,
      paragraphs,
      dateKey,
      newspaperLabel: newspaperLabel || "朝日新聞",
    }),
  };
}

async function fetchAsahiEditorialForDate(options = {}) {
  const dateKey = options.date || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date: ${dateKey}`);
  }

  let listItem = null;
  if (!options.url) {
    const listHtml = await fetchText(ASAHI_LIST_URL);
    const listItems = parseAsahiEditorialList(listHtml);
    listItem = pickListItemForDate(listItems, dateKey);
    if (!listItem) {
      throw new Error(`No Asahi editorial found for ${dateKey}`);
    }
  }

  const articleUrl = normalizeEditorialUrl(options.url || listItem?.url || "");
  if (!articleUrl) {
    throw new Error("Missing article URL");
  }
  const articleHtml = await fetchText(articleUrl);
  const article = parseAsahiEditorialArticle(articleHtml);
  if (!article.paragraphs.length) {
    throw new Error(`No article paragraphs extracted from ${articleUrl}`);
  }

  const fetchedRecord = buildFetchedRecord({ listItem, article, dateKey, articleUrl });
  const readingPatch = buildReadingPatch(fetchedRecord);
  const speakingExercises = buildSpeakingExercises({
    title: fetchedRecord.title,
    paragraphs: fetchedRecord.paragraphs,
    dateKey,
  });

  const result = {
    dateKey,
    fetchedRecord,
    readingPatch,
    speakingExercises,
    paths: {
      fetched: path.join(FETCHED_DIR, `${dateKey}.json`),
      reading: path.join(READINGS_TEXT, `${dateKey}.json`),
      speaking: path.join(SPEAKING_LOGS, `${dateKey}.json`),
    },
  };

  if (options.dryRun) return result;

  writeJson(result.paths.fetched, fetchedRecord);

  const readingFile = result.paths.reading;
  const readingExisting = fs.existsSync(readingFile)
    ? JSON.parse(fs.readFileSync(readingFile, "utf8"))
    : JSON.parse(fs.readFileSync(path.join(READINGS_TEXT, "_template.json"), "utf8"));
  writeJson(readingFile, mergeReading(readingExisting, readingPatch));

  const speakingFile = result.paths.speaking;
  const speakingExisting = fs.existsSync(speakingFile)
    ? JSON.parse(fs.readFileSync(speakingFile, "utf8"))
    : JSON.parse(fs.readFileSync(path.join(SPEAKING_LOGS, "_template.json"), "utf8"));
  writeJson(
    speakingFile,
    mergeSpeaking(speakingExisting, {
      title: fetchedRecord.title,
      paragraphs: fetchedRecord.paragraphs,
      dateKey,
      newspaperLabel: "朝日新聞",
    }),
  );

  const rendered = renderEditorialDay({ date: dateKey });
  result.paths.view = rendered.outPath;

  return result;
}

if (require.main === module) {
  fetchAsahiEditorialForDate(parseArgs(process.argv.slice(2)))
    .then((result) => {
      console.log(`Fetched Asahi editorial: ${result.fetchedRecord.title}`);
      console.log(`Paragraphs: ${result.fetchedRecord.paragraphs.length}`);
      console.log(`Saved: ${path.relative(ROOT, result.paths.fetched)}`);
      console.log(`Updated: ${path.relative(ROOT, result.paths.reading)}`);
      console.log(`Updated: ${path.relative(ROOT, result.paths.speaking)}`);
      if (result.paths.view) {
        console.log(`Readable: ${path.relative(ROOT, result.paths.view)}`);
        console.log(`Open: npm run editorial:view -- --date ${result.dateKey}`);
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = {
  ASAHI_LIST_URL,
  addDays,
  buildFetchedRecord,
  buildReadingPatch,
  buildRetellingScript,
  buildSpeakingExercises,
  ensureSpeakingSteps,
  cleanEditorialTitle,
  convertToDesuMasu,
  fetchAsahiEditorialForDate,
  normalizeEditorialUrl,
  parseAsahiEditorialArticle,
  parseAsahiEditorialList,
  pickListItemForDate,
  dedupeParagraphs,
  extractEditorialParagraphs,
  prependLeadParagraph,
};
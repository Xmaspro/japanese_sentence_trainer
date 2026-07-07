const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const store = require("../tools/editorial_store.js");

test("sanitizeTitleForFilename keeps Japanese title text and removes illegal path chars", () => {
  assert.equal(
    store.sanitizeTitleForFilename("（社説）中国の民族新法　国外適用は容認できぬ"),
    "（社説）中国の民族新法　国外適用は容認できぬ",
  );
  assert.equal(store.sanitizeTitleForFilename('标题: 测试?'), "标题 测试");
});

test("assignBundleFileName uses article title for bundle file id", () => {
  const publishDate = "2099-12-31";
  const bundle = store.createEmptyBundle(publishDate);
  bundle.source.title = "（社説）社会保障の給付　サービスの議論がない";
  bundle.source.url = "https://www.asahi.com/articles/DA3S16496826.html";
  bundle.source.publishedAt = `${publishDate}T05:00:00+09:00`;

  const fileId = store.assignBundleFileName(bundle);
  assert.equal(fileId, "（社説）社会保障の給付　サービスの議論がない");
});

test("writeBundle stores different titles on the same publish date without overwriting", () => {
  const publishDate = "2099-12-30";
  const titleA = "（社説）記事A";
  const titleB = "（社説）記事B";
  const paths = [
    store.bundlePath({ publishDate, bundleFileId: titleA }),
    store.bundlePath({ publishDate, bundleFileId: titleB }),
  ];

  try {
    const bundleA = store.createEmptyBundle(publishDate);
    bundleA.source.title = titleA;
    bundleA.source.url = "https://www.asahi.com/articles/ARTICLE-A.html";
    bundleA.source.publishedAt = `${publishDate}T05:00:00+09:00`;
    store.writeBundle(bundleA);

    const bundleB = store.createEmptyBundle(publishDate);
    bundleB.source.title = titleB;
    bundleB.source.url = "https://www.asahi.com/articles/ARTICLE-B.html";
    bundleB.source.publishedAt = `${publishDate}T05:00:00+09:00`;
    store.writeBundle(bundleB);

    assert.equal(store.readBundle({ publishDate, bundleFileId: titleA }).source.title, titleA);
    assert.equal(store.readBundle({ publishDate, bundleFileId: titleB }).source.title, titleB);
  } finally {
    for (const filePath of paths) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const dirPath = path.join(store.BUNDLES_DIR, publishDate);
    if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
      fs.rmdirSync(dirPath);
    }
  }
});

test("findBundleByUrl locates bundles by source url instead of legacy url-* filenames", () => {
  const publishDate = "2099-12-29";
  const title = "（社説）URL 查找测试";
  const url = "https://www.asahi.com/articles/DA3S99999999.html";
  const filePath = store.bundlePath({ publishDate, bundleFileId: title });

  try {
    const bundle = store.createEmptyBundle(publishDate);
    bundle.source.title = title;
    bundle.source.url = url;
    bundle.source.publishedAt = `${publishDate}T05:00:00+09:00`;
    store.writeBundle(bundle);

    const found = store.findBundleByUrl(url);
    assert.equal(found?.source?.title, title);
    assert.equal(found?.id, title);
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const dirPath = path.join(store.BUNDLES_DIR, publishDate);
    if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
      fs.rmdirSync(dirPath);
    }
  }
});

test("shouldSyncLegacyFiles skips manual URL bundles", () => {
  assert.equal(store.shouldSyncLegacyFiles({ id: "（社説）記事A" }, { manualUrl: false }), true);
  assert.equal(store.shouldSyncLegacyFiles({ id: "（社説）記事A" }, { manualUrl: true }), false);
});

test("listBundleSummariesForDate and findBundleForRequest resolve a specific bundle id", () => {
  const publishDate = "2099-12-28";
  const titleA = "（社説）一覧A";
  const titleB = "（社説）一覧B";
  const paths = [
    store.bundlePath({ publishDate, bundleFileId: titleA }),
    store.bundlePath({ publishDate, bundleFileId: titleB }),
  ];

  try {
    const bundleA = store.createEmptyBundle(publishDate);
    bundleA.source.title = titleA;
    bundleA.source.url = "https://www.asahi.com/articles/LIST-A.html";
    bundleA.meta.status = "ready";
    store.writeBundle(bundleA);

    const bundleB = store.createEmptyBundle(publishDate);
    bundleB.source.title = titleB;
    bundleB.source.url = "https://www.asahi.com/articles/LIST-B.html";
    bundleB.meta.status = "fetched";
    store.writeBundle(bundleB);

    const summaries = store.listBundleSummariesForDate(publishDate);
    assert.equal(summaries.length, 2);
    assert.deepEqual(
      summaries.map((item) => item.title).sort(),
      [titleA, titleB].sort(),
    );

    const found = store.findBundleForRequest({ date: publishDate, id: titleB });
    assert.equal(found?.source?.title, titleB);
  } finally {
    for (const filePath of paths) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const dirPath = path.join(store.BUNDLES_DIR, publishDate);
    if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
      fs.rmdirSync(dirPath);
    }
  }
});

test("legacy editorial.json is migrated to a title-based filename on read", () => {
  const publishDate = "2099-11-30";
  const title = "旧格式";
  const legacyPath = store.bundlePath({ publishDate, bundleFileId: "editorial" });
  const migratedPath = store.bundlePath({ publishDate, bundleFileId: title });

  try {
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(
      legacyPath,
      `${JSON.stringify({
        date: publishDate,
        id: "editorial",
        source: {
          publishedAt: `${publishDate}T05:00:00+09:00`,
          title,
          url: "https://www.asahi.com/articles/LEGACY-01.html",
        },
        meta: { status: "ready" },
      })}\n`,
      "utf8",
    );

    const bundle = store.readBundle({ publishDate, bundleFileId: "editorial" });
    assert.equal(bundle.source.title, title);
    assert.equal(bundle.id, title);
    assert.equal(fs.existsSync(legacyPath), false);
    assert.equal(fs.existsSync(migratedPath), true);
  } finally {
    if (fs.existsSync(migratedPath)) fs.unlinkSync(migratedPath);
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
    const dirPath = path.join(store.BUNDLES_DIR, publishDate);
    if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
      fs.rmdirSync(dirPath);
    }
  }
});
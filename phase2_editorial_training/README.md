# Phase 2 — 社说阅读（纯阅读材料）

社说仅作为高级阅读与内容理解材料使用。口语练习功能已移除。

## 目录

```
phase2_editorial_training/
├── editorial_readings/          # 社说阅读（图片 + 提取文字）
│   ├── scans/YYYY-MM-DD/        # 手机扫描原图（不进 git）
│   └── text/YYYY-MM-DD.json     # 校对后的标题、导语、笔记
└── editorial_speaking/          # 旧口语数据（已废弃，仅历史参考）
    └── ...
```

## 每日流程（阅读为主）

1. 图书馆扫社说 → 图片放入 `editorial_readings/scans/今日日期/`
2. OCR 后校对 → 写入 `editorial_readings/text/今日日期.json`
3. 阅读 20-30 分钟（三遍法 + 分析）

## 轮流读报

| 星期 | 报纸 |
|------|------|
| 月・水・金 | 朝日新聞・社説 |
| 火・木・土 | 日本経済新聞・社説 |
| 日 | 复习阅读笔记 |

## 新建今日文件

```bash
npm run editorial:new-day
```

## 注意

- `scans/` 仅本地保存

## 新建今日文件

```bash
npm run editorial:new-day
npm run editorial:new-day -- --date 2026-07-06 --paper asahi
npm run editorial:new-day -- --date 2026-07-07 --paper nikkei
```

## 注意

- `scans/`、`recordings/` 仅本地保存，已加入 `.gitignore`
- `text/`、`logs/` 可提交 git，但不要粘贴报纸全文；只存标题、导语、自写摘要与笔记
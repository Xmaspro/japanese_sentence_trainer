# content_archive

This directory now stores raw mainstream-news fetches and derived trainer data.

## Layout

- `sources.json` - editable RSS source list and retention settings.
- `raw/YYYY-MM-DD/*.xml` - raw RSS responses from each source.
- `processed/YYYY-MM-DD/news_items.json` - normalized records and trainer items for one day.
- `trainer_items.json` - rolling 10-day bundle loaded by the browser trainer.
- `logs/YYYY-MM-DD.json` - fetch status for each source.

## Policy

The fetcher stores RSS titles, URLs, timestamps, source names, and short RSS descriptions. It does not store full article bodies.

Run manually:

```powershell
node tools\daily_news_fetcher.js
```

Install the 06:00 Windows scheduled task:

```powershell
powershell -ExecutionPolicy Bypass -File tools\install_daily_news_task.ps1
```

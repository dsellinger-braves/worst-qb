# Worst QB

A custom fantasy football game where **bad is good**. Each week, every team drafts two quarterbacks and scores points when those QBs play terribly: interceptions, sacks, fumbles, incompletions and team losses all earn points. Touchdowns and yards cost points.

## How it works
- **Frontend:** a static site (vanilla HTML/CSS/JS, no build step) using hash routing. Open `index.html` through any static server, e.g. `python -m http.server 5500`.
- **Backend:** [Supabase](https://supabase.com) (Postgres, Auth, Realtime for the live draft room).
- **Stats:** `scraper/update_stats.py` pulls live box scores, projections and betting odds from ESPN. A GitHub Actions cron runs it every 15 minutes during game windows.
- **Weekly recap:** `scraper/send_weekly_summary.py` writes a snarky recap with Gemini and emails it to league members who opted in.

## Features
- League creation/joining, per-league custom scoring weights, admin-controlled draft order
- Live, turn-based weekly draft room with Realtime sync, admin force-pick, auto-pick and undo
- Season standings, weekly and per-team breakdowns
- Global stats leaderboard, weekly projections with win probabilities, player profiles with game logs

## Docs
- [`AGENTS.md`](AGENTS.md): quick orientation and conventions (also read automatically by AI coding agents)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): routes, data model, scraper pipeline, ESPN API details
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md): open bugs and tech debt

## Python setup
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r scraper/requirements.txt
$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_SERVICE_KEY = "<service role key>"
python scraper/update_stats.py --year 2026
```
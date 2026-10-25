# Worst QB — Agent Guide

Custom fantasy football game: each week, league members draft **2 players (normally QBs)** and score points when those players play **badly** (INTs, sacks, fumbles, incompletions, team losses). Higher score = better for the fantasy team. Good QB games produce negative points.

> Deep dives: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (full reference) and [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) (bugs / tech debt — check before "fixing" something odd).

## Stack at a glance

| Layer | Tech | Location |
|---|---|---|
| Frontend | Static vanilla HTML/CSS/JS (ES modules, **no build step, no npm**) | `index.html`, `css/`, `js/` |
| Backend | Supabase (Postgres + Auth + Realtime), accessed directly from the browser | `js/supabase.js` |
| Data ingest | Python scraper hitting ESPN public APIs, run by GitHub Actions cron | `scraper/update_stats.py`, `.github/workflows/live_stats.yml` |
| Weekly email | Python + Gemini (`google-genai`) + Gmail SMTP, run manually | `scraper/send_weekly_summary.py` |
| Schema | Base schema + ad-hoc migration files run by hand in the Supabase SQL editor | `schema*.sql` |

## Running locally

- Frontend: serve the repo root over HTTP (ES modules won't load from `file://`). E.g. VS Code Live Server (port 5500, which the email footer link assumes) or `python -m http.server 5500`. It talks to the **production** Supabase project; there is no local/staging DB.
- Python: venv at `.venv/` (Windows: `.venv\Scripts\Activate.ps1`), deps in `scraper/requirements.txt`.
- Scripts need env vars `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (the email script also accepts `SUPABASE_SERVICE_ROLE_KEY` and loads `.env` via python-dotenv, plus `GEMINI_API_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`).
- No automated tests exist. `test_nfl.py` is a leftover scratch script for the retired `nfl_data_py` source.

## Frontend conventions (follow these when adding features)

- **Router** (`js/router.js`): hash-based, `#/<route>?k=v`. Routes are registered in `js/app.js` as `{ render(params) => htmlString, init(params) }`. `render` returns a template string injected via `innerHTML`; `init` wires events and fetches data. The default route (empty hash) is `rules`.
- **League context**: any route with `?league=<uuid>` shows the league sub-nav (`#league-nav`), and the router keeps the sub-nav links in sync. Pass `league` through links to keep the user in context.
- Views are **singleton object literals** that store state on themselves (e.g. `DraftView.state`, `LeagueDetailView.teams`).
- Inline `onclick="Foo.bar()"` handlers need the function on `window`. Existing views do `window.DraftView = DraftView`, `window.draftPlayer = ...`, `window.ProjectionsView = ...`. If you add inline handlers, expose them the same way or they will silently fail (several past commits fixed exactly this).
- Styling is mostly **inline styles** plus CSS variables in `css/style.css` (`--accent-primary` red, `--accent-secondary` sky blue, `--bg-secondary`, `--danger-color`, `--success-color`, `.glass-panel`, `.btn`, `.btn-primary`, `.form-input`, `.setting-row`, `.spinner`).
- **Supabase row limit**: PostgREST returns at most **1000 rows** per request. `projections.js`, `stats.js`, and `draft.js` use `.range()` pagination loops. `league_detail.js` and `dashboard.js` use chunked `.in('player_id', pickedIds)` queries.

## Domain rules that are easy to get wrong

- **Canonical Scoring**:
  - Unified across `js/scoring.js`, `scraper/update_stats.py`, and `js/views/rules.js`:
    - Interception: +5.0, Pick Six: +10.0, Fumble Lost: +4.0, Sack Taken: +1.0
    - Passing Yard: -0.05, Passing TD: -5.0, Rushing Yard: -0.1, Rushing TD: -5.0
    - Team Loss Bonus: +5.0 (supports `team_loss_prob * 5` for projections)
    - Completion Penalty: `multiplier * (1 - comp%)` (default multiplier 20.0)
    - No Pass Attempts Penalty: -20.0 (replaces entire score)
  - `calculateLeagueScore(stats, settings)` safely checks `Number.isFinite` so `0` weights do not fall back to defaults.
- **`season_type`** is `'regular'` or `'preseason'`, and week numbers overlap between the two. Always key stats by `(player_id, week, season_type)` and filter regular season when calculating league standings.
- **Player IDs**: current IDs are `espn-<espnAthleteId>`. Team aggregate "players" use `TEAM_<ABBR>_<season_type>` with position `TM_QB`.
- **`players.position`** is a `/`-joined list of ESPN eligible slots (e.g. `QB`, `RB/WR`, `TE`, `DST`), or `Unknown` / `TM_QB`. Use `.includes('QB')` for QB checks, and exclude `TM_QB` for individual leagues.
- **Projection raw stats are stuffed into `player_projections.opponent`** as a JSON string `{"opp": "DAL", "raw": {...}}`. Parse defensively (`opponent.startsWith('{')`).
- **Draft**: defaults to snake draft (Round 1: 1 → N; Round 2: N → 1, reversing order), with commissioner-configurable option for linear draft. Base order = `scoring_settings.draft_order_overrides[week]` if present, otherwise live inverse standings (worst team first).
- **League Lifecycle**: Admins can click **"Advance Week"** in League Home (`league_detail.js`) to advance `current_week`, reset `draft_status`, and persist current computed `season_points` into `league_members`. Standings are also computed dynamically across the app.

## Security & RLS

Run `schema_rls_and_security.sql` in Supabase to enforce RLS and allow public read for stats/players while protecting league data. Swap the anon key in `js/supabase.js`.

## Git hygiene

- `.venv/` is in `.gitignore` but ~8.7k venv files were committed earlier. Never `git add -A` blindly; check `git status` first.
- Commit style: short imperative summaries (e.g. "Fix draft room position bug and exit button formatting").

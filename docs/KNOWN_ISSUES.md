# Known Issues & Tech Debt

Status as of Oct 2026. **Check this list before "fixing" behavior that looks wrong**.

Legend: 🔴 high · 🟠 medium · 🟡 low · ✅ resolved

---

## ✅ 1. Service-role key replaced with public anon key (RESOLVED)
- **Anon Key Installed:** `js/supabase.js` now uses the project `anon` key instead of the `service_role` key.
- **RLS Policies:** `schema_rls_and_security.sql` is ready to run in Supabase SQL editor to protect leagues and grant public read for stats/players/projections.
- **Final Action for User:** Click "Rotate secret" in Supabase Dashboard (Project Settings -> API) for the service role key to revoke the old key exposed in git history.

---

## ✅ 2. Scoring weights unified across the codebase (RESOLVED)
- Unified canonical defaults:
  - INT: +5.0, Pick-6: +10.0, Fumble: +4.0, Pass Yd: -0.05, Pass TD: -5.0, Rush Yd: -0.1, Rush TD: -5.0, Sack: +1.0, Loss: +5.0 (supports `team_loss_prob`), Incompletion multiplier: 20.0 * (1 - comp%), No attempts: -20.0.
- Synchronized across `scraper/update_stats.py`, `js/scoring.js`, `js/views/rules.js`, `js/views/league_detail.js` (modal defaults), and `scraper/send_weekly_summary.py`.
- Fixed zero weight parsing: uses `Number.isFinite` so an admin setting a weight to `0` no longer silently reverts to default.
- Added `team_loss_prob` support to `calculateLeagueScore` so custom projection views account for moneyline win probability.

---

## ✅ 3. Unpaginated queries silently truncate at 1000 rows (RESOLVED)
- `league_detail.js`: Replaced unbounded `player_stats` query with targeted chunked queries for drafted player IDs filtering on `season_type = 'regular'`.
- `draft.js`: Implemented `fetchAllPaged()` loop with `.range()` pagination to fetch all ~3,000 players and projections without truncation.
- `dashboard.js`: Targeted chunked stats query to accurately calculate live season totals.

---

## ✅ 4. Preseason and regular-season stats collision (RESOLVED)
- `league_detail.js` and `send_weekly_summary.py` now explicitly filter `player_stats` with `.eq('season_type', 'regular')`.

---

## ✅ 5. Team-QB aggregation in the scraper (RESOLVED)
- Fixed `update_stats.py` loop to aggregate from `all_game_stats` directly with valid team identifiers and included `pick_sixes` in accumulated team stats.

---

## ✅ 6. League lifecycle & Live Standings (RESOLVED)
- Added an Admin **"Advance Week"** button in League Home (`league_detail.js`):
  - Calculates dynamic season standings for all teams.
  - Updates stored `season_points` in `league_members` (keeping weekly emails and reports fresh).
  - Advances `leagues.current_week` and resets `draft_status`.
- Standings are computed dynamically from actual picks and stats across League Home, Draft Room (for live draft order), and Dashboard.

---

## ✅ 7. Admin checks unified (RESOLVED)
- Both `league_detail.js` and `draft.js` now check either `league.created_by === userId` OR `myMember.is_admin === true`.

---

## ✅ 8. Undefined CSS variables (RESOLVED)
- Defined `--accent-secondary`, `--danger-color`, `--success-color`, and `--accent-error` in `css/style.css`.

---

## ✅ 9. Weekly email privacy & scoring (RESOLVED)
- Emails in `send_weekly_summary.py` are now sent individually to recipients so member emails are not exposed in a shared `To:` header.
- Points calculation in email recap now respects league `scoring_settings` and filters regular season games.

---

## 🟡 10. Remaining Tech Debt & Improvements
- **Realtime Pick Undo:** Draft room subscribes to INSERT on `draft_picks`. Subscribing to DELETE would automatically refresh other connected browsers when an admin undoes a pick without needing manual refresh.
- **Scraper Efficiency:** Scraper re-scrapes all 18 weeks on every 15-minute run. Could be optimized to only scrape the active week during game windows.
- **Git Hygiene:** Clean tracked `.venv` files (`git rm -r --cached .venv`).

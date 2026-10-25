import { supabase } from '../supabase.js';
import { calculateLeagueScore } from '../scoring.js';

export const ScoreboardView = {
    state: {
        selectedLeagueId: null,
        selectedWeek: 7,
        allLeagues: [],
        leagueInfo: null,
        members: [],
        picks: [],
        teamData: [],
        statsMap: {},
        projMap: {},
        liveStatsMap: {},
        gamesMap: {},
        autoRefreshTimer: null,
        isLoading: false,
        lastUpdated: null,
        sortMode: 'week_desc' // 'week_desc' or 'season_desc'
    },

    render: () => {
        return `
        <div class="view-container active glass-panel" style="padding-bottom: 3rem;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <h1 style="margin: 0; font-size: 2rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
                            🏆 <span style="background: linear-gradient(135deg, #ffffff 40%, var(--accent-primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Live League Scoreboard</span>
                        </h1>
                        <span id="sb-live-badge" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">
                            <span class="live-dot-small" style="background: #10b981;"></span>
                            LIVE REAL-TIME
                        </span>
                    </div>
                    <p style="color: var(--text-secondary); margin-top: 0.35rem; font-size: 0.95rem;">
                        Live NFL stats, boxscore scoring, and weekly team disaster rankings.
                    </p>
                </div>

                <!-- Controls Toolbar -->
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <label for="sb-league-select" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">League:</label>
                        <select id="sb-league-select" class="form-input" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; min-width: 170px;"></select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <label for="sb-week-select" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Week:</label>
                        <select id="sb-week-select" class="form-input" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; min-width: 100px;"></select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <label for="sb-sort-select" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Sort By:</label>
                        <select id="sb-sort-select" class="form-input" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; min-width: 140px;">
                            <option value="week_desc">Weekly Points (High to Low)</option>
                            <option value="season_desc">Season Total (High to Low)</option>
                        </select>
                    </div>

                    <button id="sb-refresh-btn" class="btn" style="background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); padding: 0.4rem 0.85rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem;">
                        <span id="sb-refresh-icon">🔄</span> Refresh
                    </button>
                    <span id="sb-last-updated" style="font-size: 0.75rem; color: var(--text-secondary);"></span>
                </div>
            </div>

            <!-- Summary Banners (High score, MVP disaster QB, Games Status) -->
            <div id="sb-summary-banner" style="margin-bottom: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;"></div>

            <!-- Scoreboard Content Area -->
            <div id="sb-content">
                <div class="loading-state" style="height: 350px;">
                    <div class="spinner"></div>
                    <p>Loading Live Gridiron Scoreboard...</p>
                </div>
            </div>
        </div>
        `;
    },

    init: async (params = {}) => {
        ScoreboardView.state.selectedLeagueId = params.league || null;
        if (params.week) {
            ScoreboardView.state.selectedWeek = parseInt(params.week) || 7;
        }

        // Attach global functions for inline actions if needed
        window.ScoreboardView = ScoreboardView;

        // Populate weeks dropdown (Weeks 1 to 18)
        const weekSelect = document.getElementById('sb-week-select');
        if (weekSelect) {
            let weekHtml = '';
            for (let w = 1; w <= 18; w++) {
                weekHtml += `<option value="${w}">Week ${w}</option>`;
            }
            weekSelect.innerHTML = weekHtml;
            weekSelect.value = ScoreboardView.state.selectedWeek;
            weekSelect.addEventListener('change', (e) => {
                ScoreboardView.state.selectedWeek = parseInt(e.target.value);
                const lId = ScoreboardView.state.selectedLeagueId;
                window.location.hash = `#/scoreboard?league=${lId}&week=${ScoreboardView.state.selectedWeek}`;
                ScoreboardView.loadData();
            });
        }

        const leagueSelect = document.getElementById('sb-league-select');
        if (leagueSelect) {
            leagueSelect.addEventListener('change', (e) => {
                ScoreboardView.state.selectedLeagueId = e.target.value;
                window.location.hash = `#/scoreboard?league=${e.target.value}&week=${ScoreboardView.state.selectedWeek}`;
                ScoreboardView.loadData();
            });
        }

        const sortSelect = document.getElementById('sb-sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                ScoreboardView.state.sortMode = e.target.value;
                ScoreboardView.renderScoreboard();
            });
        }

        const refreshBtn = document.getElementById('sb-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                ScoreboardView.loadData(false);
            });
        }

        // Load Initial Data
        await ScoreboardView.loadData();

        // Setup Auto-Refresh Interval every 30 seconds
        if (ScoreboardView.state.autoRefreshTimer) {
            clearInterval(ScoreboardView.state.autoRefreshTimer);
        }
        ScoreboardView.state.autoRefreshTimer = setInterval(() => {
            // Only refresh if still on the scoreboard page
            if (document.getElementById('sb-content')) {
                ScoreboardView.loadData(true);
            } else {
                clearInterval(ScoreboardView.state.autoRefreshTimer);
                ScoreboardView.state.autoRefreshTimer = null;
            }
        }, 30000);
    },

    parseEspnSummary: (gcData) => {
        if (!gcData) return null;
        const comps = gcData.header?.competitions?.[0] || {};
        const status = comps.status || {};
        const state = status.type?.state || 'pre';
        const detail = status.type?.detail || '';
        const isLive = state === 'in';
        const isFinal = state === 'post';

        const competitors = comps.competitors || [];
        const homeC = competitors.find(c => c.homeAway === 'home') || {};
        const awayC = competitors.find(c => c.homeAway === 'away') || {};

        const homeAbbr = homeC.team?.abbreviation;
        const awayAbbr = awayC.team?.abbreviation;

        let homeLossProb = 0.5;
        let awayLossProb = 0.5;
        let homeIsLoss = false;
        let awayIsLoss = false;

        if (isFinal) {
            const hScore = parseInt(homeC.score || 0);
            const aScore = parseInt(awayC.score || 0);
            homeIsLoss = hScore < aScore;
            awayIsLoss = aScore < hScore;
            homeLossProb = homeIsLoss ? 1.0 : (awayIsLoss ? 0.0 : 0.5);
            awayLossProb = awayIsLoss ? 1.0 : (homeIsLoss ? 0.0 : 0.5);
        } else if (isLive) {
            const wp = gcData.winprobability || [];
            if (wp.length > 0) {
                const lastWp = wp[wp.length - 1];
                const hWin = Number.isFinite(lastWp.homeWinPercentage) ? lastWp.homeWinPercentage : 0.5;
                homeLossProb = 1.0 - hWin;
                awayLossProb = hWin;
            }
        }

        // Parse pick-sixes from drives & plays
        const pickSixCounts = {};
        const drives = gcData.drives || {};
        const allDrives = [...(drives.previous || []), ...(drives.current ? [drives.current] : [])];
        allDrives.forEach(d => {
            (d.plays || []).forEach(p => {
                const txt = p.text || '';
                if (p.scoringPlay && txt.toUpperCase().includes('INTERCEPTED') && txt.toUpperCase().includes('TOUCHDOWN')) {
                    const match = txt.match(/(?:\]|\)|^\s*)\s*([A-Z]\.[A-Za-z\-\']+)\s+pass/i);
                    if (match) {
                        const name = match[1].toUpperCase();
                        pickSixCounts[name] = (pickSixCounts[name] || 0) + 1;
                    }
                }
            });
        });

        const parsedPlayers = {};
        const teamLiveStats = {};

        [homeAbbr, awayAbbr].filter(Boolean).forEach(abbr => {
            const lossProb = abbr === homeAbbr ? homeLossProb : awayLossProb;
            const isLoss = abbr === homeAbbr ? homeIsLoss : awayIsLoss;
            teamLiveStats[abbr] = {
                player_id: `TEAM_${abbr}_regular`,
                team: abbr,
                position: 'TM_QB',
                attempts: 0,
                completions: 0,
                passing_yards: 0,
                passing_tds: 0,
                interceptions: 0,
                pick_sixes: 0,
                rushing_yards: 0,
                rushing_tds: 0,
                fumbles_lost: 0,
                sacks: 0,
                team_loss_prob: lossProb,
                team_loss: isLoss,
                is_live: isLive,
                is_final: isFinal,
                detail: detail
            };
        });

        (gcData.boxscore?.players || []).forEach(tData => {
            const tabbr = tData.team?.abbreviation;
            const lossProb = tabbr === homeAbbr ? homeLossProb : awayLossProb;
            const isLoss = tabbr === homeAbbr ? homeIsLoss : awayIsLoss;

            // 1. Process Passing Statistics ONLY for QBs / Passers
            const passingGroup = (tData.statistics || []).find(cat => cat.name === 'passing');
            if (passingGroup) {
                const keys = passingGroup.keys || [];
                (passingGroup.athletes || []).forEach(ath => {
                    const aid = ath.athlete?.id;
                    if (!aid) return;
                    const pid = `espn-${aid}`;
                    const pname = ath.athlete?.displayName || '';
                    const headshot = ath.athlete?.headshot?.href || `https://a.espncdn.com/i/headshots/nfl/players/full/${aid}.png`;
                    const pos = ath.athlete?.position?.abbreviation || 'QB';

                    if (!parsedPlayers[pid]) {
                        parsedPlayers[pid] = {
                            player_id: pid,
                            name: pname,
                            team: tabbr,
                            position: pos,
                            attempts: 0,
                            completions: 0,
                            passing_yards: 0,
                            passing_tds: 0,
                            interceptions: 0,
                            pick_sixes: 0,
                            rushing_yards: 0,
                            rushing_tds: 0,
                            fumbles_lost: 0,
                            sacks: 0,
                            team_loss_prob: lossProb,
                            team_loss: isLoss,
                            is_live: isLive,
                            is_final: isFinal,
                            detail: detail,
                            headshot_url: headshot
                        };
                    }

                    const obj = parsedPlayers[pid];
                    const vals = ath.stats || [];
                    const sdict = {};
                    keys.forEach((k, i) => { sdict[k] = vals[i]; });

                    const cp = sdict['completions/passingAttempts'] || '0/0';
                    if (cp.includes('/')) {
                        const [c, a] = cp.split('/');
                        obj.completions = parseInt(c) || 0;
                        obj.attempts = parseInt(a) || 0;
                    }
                    obj.passing_yards = parseInt(sdict['passingYards']) || 0;
                    obj.passing_tds = parseInt(sdict['passingTouchdowns']) || 0;
                    obj.interceptions = parseInt(sdict['interceptions']) || 0;
                    const sck = sdict['sacks-sackYardsLost'] || '0-0';
                    obj.sacks = parseInt(sck.split('-')[0]) || 0;

                    Object.entries(pickSixCounts).forEach(([p6Name, cnt]) => {
                        const parts = p6Name.split('.');
                        if (parts.length === 2 && pname.toUpperCase().startsWith(parts[0]) && pname.toUpperCase().includes(parts[1])) {
                            obj.pick_sixes += cnt;
                        }
                    });
                });
            }

            // 2. Attach Rushing & Fumbles ONLY for QBs already in parsedPlayers
            ['rushing', 'fumbles'].forEach(targetCat => {
                const group = (tData.statistics || []).find(cat => cat.name === targetCat);
                if (!group) return;
                const keys = group.keys || [];
                (group.athletes || []).forEach(ath => {
                    const aid = ath.athlete?.id;
                    const pid = `espn-${aid}`;
                    if (!parsedPlayers[pid]) return;

                    const obj = parsedPlayers[pid];
                    const vals = ath.stats || [];
                    const sdict = {};
                    keys.forEach((k, i) => { sdict[k] = vals[i]; });

                    if (targetCat === 'rushing') {
                        obj.rushing_yards = parseInt(sdict['rushingYards']) || 0;
                        obj.rushing_tds = parseInt(sdict['rushingTouchdowns']) || 0;
                    } else if (targetCat === 'fumbles') {
                        obj.fumbles_lost = parseInt(sdict['fumblesLost']) || 0;
                    }
                });
            });
        });

        // Roll up into teamLiveStats
        Object.values(parsedPlayers).forEach(pl => {
            if (pl.team && teamLiveStats[pl.team] && pl.attempts > 0) {
                const tls = teamLiveStats[pl.team];
                tls.completions += pl.completions;
                tls.attempts += pl.attempts;
                tls.passing_yards += pl.passing_yards;
                tls.passing_tds += pl.passing_tds;
                tls.interceptions += pl.interceptions;
                tls.pick_sixes += pl.pick_sixes;
                tls.sacks += pl.sacks;
                tls.rushing_yards += pl.rushing_yards;
                tls.rushing_tds += pl.rushing_tds;
                tls.fumbles_lost += pl.fumbles_lost;
            }
        });

        return {
            eventId: gcData.header?.id,
            state,
            detail,
            isLive,
            isFinal,
            homeAbbr,
            awayAbbr,
            parsedPlayers,
            teamLiveStats
        };
    },

    loadData: async (isSilent = false) => {
        const container = document.getElementById('sb-content');
        if (!isSilent && container) {
            container.innerHTML = `
                <div class="loading-state" style="height: 350px;">
                    <div class="spinner"></div>
                    <p>Fetching real-time stats & scoreboard updates...</p>
                </div>
            `;
        }

        const refreshIcon = document.getElementById('sb-refresh-icon');
        if (refreshIcon) refreshIcon.style.animation = 'spin 1s linear infinite';

        try {
            // 1. Fetch available leagues for user or all leagues
            const { data: leaguesData } = await supabase.from('leagues').select('id, name, current_week, scoring_settings').order('created_at', { ascending: false });
            ScoreboardView.state.allLeagues = leaguesData || [];

            if (ScoreboardView.state.allLeagues.length === 0) {
                if (container) container.innerHTML = '<div style="padding: 2rem; text-align: center;">No leagues found. Create or join a league first!</div>';
                return;
            }

            // Determine active league ID
            let activeLeagueId = ScoreboardView.state.selectedLeagueId;
            if (!activeLeagueId || !ScoreboardView.state.allLeagues.some(l => l.id === activeLeagueId)) {
                activeLeagueId = ScoreboardView.state.allLeagues[0].id;
                ScoreboardView.state.selectedLeagueId = activeLeagueId;
            }

            const activeLeague = ScoreboardView.state.allLeagues.find(l => l.id === activeLeagueId);
            ScoreboardView.state.leagueInfo = activeLeague;

            // Populate League Dropdown
            const leagueSelect = document.getElementById('sb-league-select');
            if (leagueSelect && (!leagueSelect.children.length || leagueSelect.children.length !== ScoreboardView.state.allLeagues.length)) {
                leagueSelect.innerHTML = ScoreboardView.state.allLeagues.map(l => `
                    <option value="${l.id}" ${l.id === activeLeagueId ? 'selected' : ''}>${l.name}</option>
                `).join('');
            } else if (leagueSelect) {
                leagueSelect.value = activeLeagueId;
            }

            // Sync week if not manually set
            const currentWeek = ScoreboardView.state.selectedWeek || activeLeague.current_week || 7;
            ScoreboardView.state.selectedWeek = currentWeek;
            const weekSelect = document.getElementById('sb-week-select');
            if (weekSelect) weekSelect.value = currentWeek;

            // 2. Fetch league members
            const { data: members } = await supabase.from('league_members')
                .select('user_id, team_name, season_points, is_admin')
                .eq('league_id', activeLeagueId);
            ScoreboardView.state.members = members || [];

            // 3. Fetch this week's draft picks
            const { data: weekPicks } = await supabase.from('draft_picks')
                .select('week, pick_number, user_id, player_id, players(id, name, team, position, headshot_url)')
                .eq('league_id', activeLeagueId)
                .eq('week', currentWeek)
                .order('pick_number', { ascending: true });
            ScoreboardView.state.picks = weekPicks || [];

            // 4. Fetch all historical picks for this league to compute live season totals
            const { data: allLeaguePicks } = await supabase.from('draft_picks')
                .select('week, user_id, player_id')
                .eq('league_id', activeLeagueId);

            // 5. Fetch ESPN Scoreboard for current week
            const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${currentWeek}`;
            const espnRes = await fetch(espnUrl).then(r => r.json()).catch(() => ({ events: [] }));
            const events = espnRes.events || [];

            // Build map of NFL games
            const gamesMap = {};
            events.forEach(ev => {
                const comp = ev.competitions?.[0] || {};
                const status = comp.status?.type || {};
                const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
                const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
                const gameObj = {
                    id: ev.id,
                    name: ev.name,
                    shortName: ev.shortName,
                    state: status.state || 'pre',
                    detail: status.detail || 'Scheduled',
                    isLive: status.state === 'in',
                    isFinal: status.state === 'post',
                    homeAbbr: home.team?.abbreviation,
                    awayAbbr: away.team?.abbreviation,
                    homeScore: home.score || '0',
                    awayScore: away.score || '0'
                };
                if (gameObj.homeAbbr) gamesMap[gameObj.homeAbbr] = gameObj;
                if (gameObj.awayAbbr) gamesMap[gameObj.awayAbbr] = gameObj;
            });
            ScoreboardView.state.gamesMap = gamesMap;

            // 6. Fetch ESPN boxscore summaries for active or finished games
            const gamesToFetch = events.filter(ev => {
                const st = ev.competitions?.[0]?.status?.type?.state;
                return st === 'in' || st === 'post';
            });

            const liveStatsMap = {};
            if (gamesToFetch.length > 0) {
                const summaryPromises = gamesToFetch.map(ev => 
                    fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${ev.id}`)
                        .then(r => r.json())
                        .then(gcData => ScoreboardView.parseEspnSummary(gcData))
                        .catch(() => null)
                );
                const summaries = await Promise.all(summaryPromises);
                summaries.forEach(s => {
                    if (!s) return;
                    Object.assign(liveStatsMap, s.parsedPlayers);
                    // Also team stats
                    Object.entries(s.teamLiveStats || {}).forEach(([teamAbbr, tStat]) => {
                        liveStatsMap[`TEAM_${teamAbbr}_regular`] = tStat;
                    });
                });
            }
            ScoreboardView.state.liveStatsMap = liveStatsMap;

            // 7. Fetch Supabase player_stats for week & historical
            const allDraftedPlayerIds = [...new Set((allLeaguePicks || []).map(p => p.player_id).filter(Boolean))];
            const statsMap = {};
            if (allDraftedPlayerIds.length > 0) {
                const chunkSize = 200;
                for (let i = 0; i < allDraftedPlayerIds.length; i += chunkSize) {
                    const chunk = allDraftedPlayerIds.slice(i, i + chunkSize);
                    const { data: stData } = await supabase.from('player_stats')
                        .select('*')
                        .in('player_id', chunk)
                        .eq('season_type', 'regular');
                    if (stData) {
                        stData.forEach(s => {
                            statsMap[`${s.player_id}_${s.week}`] = s;
                        });
                    }
                }
            }
            ScoreboardView.state.statsMap = statsMap;

            // 8. Fetch player_projections for current week
            const projMap = {};
            const thisWeekPlayerIds = [...new Set((weekPicks || []).map(p => p.player_id).filter(Boolean))];
            if (thisWeekPlayerIds.length > 0) {
                const { data: projData } = await supabase.from('player_projections')
                    .select('*, players(id, name, team, position, headshot_url)')
                    .eq('week', currentWeek)
                    .in('player_id', thisWeekPlayerIds);
                if (projData) {
                    projData.forEach(pr => {
                        let raw = {};
                        let opp = 'TBD';
                        try {
                            if (pr.opponent && pr.opponent.startsWith('{')) {
                                const parsed = JSON.parse(pr.opponent);
                                raw = parsed.raw || {};
                                opp = parsed.opp || 'TBD';
                            } else {
                                opp = pr.opponent || 'TBD';
                            }
                        } catch(e) {}
                        projMap[pr.player_id] = {
                            ...pr,
                            rawStats: raw,
                            opp
                        };
                    });
                }
            }
            ScoreboardView.state.projMap = projMap;

            // 9. Calculate cumulative season points for each member
            const seasonTotals = {};
            (ScoreboardView.state.members || []).forEach(m => {
                seasonTotals[m.user_id] = 0;
            });

            // Historical weeks (excluding current week, which will use live calculations)
            (allLeaguePicks || []).forEach(p => {
                if (p.week !== currentWeek) {
                    const st = statsMap[`${p.player_id}_${p.week}`];
                    const pts = calculateLeagueScore(st, activeLeague.scoring_settings);
                    if (seasonTotals[p.user_id] !== undefined) {
                        seasonTotals[p.user_id] += pts;
                    }
                }
            });

            // 10. Process current week's picks for each team
            const scoringSettings = activeLeague.scoring_settings;
            const teamMap = {};
            (ScoreboardView.state.members || []).forEach(m => {
                teamMap[m.user_id] = {
                    userId: m.user_id,
                    teamName: m.team_name,
                    isAdmin: m.is_admin,
                    weeklyPoints: 0,
                    seasonPoints: seasonTotals[m.user_id] || 0,
                    picks: [],
                    hasLiveGame: false,
                    allFinal: true
                };
            });

            // Group picks by team
            (weekPicks || []).forEach(p => {
                const tObj = teamMap[p.user_id];
                if (!tObj) return;

                const pid = p.player_id;
                const pInfo = p.players || {};
                const liveStat = liveStatsMap[pid];
                const dbStat = statsMap[`${pid}_${currentWeek}`];
                const projObj = projMap[pid];
                const game = gamesMap[pInfo.team];

                let statToUse = null;
                let statSource = 'none'; // 'live', 'final', 'db', 'proj'
                let gameStatus = 'Upcoming';
                let isLive = false;
                let isFinal = false;

                if (liveStat) {
                    statToUse = liveStat;
                    statSource = liveStat.is_live ? 'live' : 'final';
                    isLive = liveStat.is_live;
                    isFinal = liveStat.is_final;
                    gameStatus = liveStat.detail || (isLive ? 'LIVE' : 'FINAL');
                } else if (dbStat) {
                    statToUse = dbStat;
                    statSource = 'db';
                    isFinal = true;
                    gameStatus = 'FINAL';
                } else if (game && (game.isLive || game.isFinal)) {
                    // Game is live or final, but player didn't record passing stats yet
                    statToUse = { attempts: 0, completions: 0, passing_yards: 0, passing_tds: 0, interceptions: 0, pick_sixes: 0, sacks: 0, rushing_yards: 0, rushing_tds: 0, fumbles_lost: 0, is_live: game.isLive, is_final: game.isFinal };
                    statSource = game.isLive ? 'live' : 'final';
                    isLive = game.isLive;
                    isFinal = game.isFinal;
                    gameStatus = game.detail || (game.isLive ? 'LIVE' : 'FINAL');
                } else if (projObj && projObj.rawStats) {
                    statToUse = { ...projObj.rawStats, is_proj: true };
                    statSource = 'proj';
                    gameStatus = game ? game.detail : (projObj.opp ? `vs ${projObj.opp}` : 'Upcoming');
                }

                if (isLive) {
                    tObj.hasLiveGame = true;
                    tObj.allFinal = false;
                } else if (!isFinal) {
                    tObj.allFinal = false;
                }

                const fantasyPoints = calculateLeagueScore(statToUse, scoringSettings);
                tObj.weeklyPoints += fantasyPoints;

                tObj.picks.push({
                    pickNumber: p.pick_number,
                    playerId: pid,
                    playerName: pInfo.name || 'Unknown Player',
                    team: pInfo.team || 'FA',
                    position: pInfo.position || 'QB',
                    headshotUrl: pInfo.headshot_url || (liveStat?.headshot_url || null),
                    opponent: projObj?.opp || (game ? (game.homeAbbr === pInfo.team ? `@ ${game.awayAbbr}` : `vs ${game.homeAbbr}`) : 'TBD'),
                    gameStatus,
                    isLive,
                    isFinal,
                    statSource,
                    stats: statToUse || {},
                    points: fantasyPoints
                });
            });

            // Update cumulative season points
            Object.values(teamMap).forEach(t => {
                t.seasonPoints += t.weeklyPoints;
            });

            ScoreboardView.state.teamData = Object.values(teamMap);
            ScoreboardView.state.lastUpdated = new Date();

            // Render view
            ScoreboardView.renderScoreboard();

        } catch (err) {
            console.error("Scoreboard load error:", err);
            if (container) {
                container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--danger-color);">Error loading scoreboard: ${err.message}. Please refresh.</div>`;
            }
        } finally {
            if (refreshIcon) refreshIcon.style.animation = 'none';
        }
    },

    renderScoreboard: () => {
        const container = document.getElementById('sb-content');
        const bannerContainer = document.getElementById('sb-summary-banner');
        const lastUpdatedEl = document.getElementById('sb-last-updated');

        if (lastUpdatedEl && ScoreboardView.state.lastUpdated) {
            const timeStr = ScoreboardView.state.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            lastUpdatedEl.innerText = `Updated ${timeStr}`;
        }

        const teams = [...ScoreboardView.state.teamData];
        if (teams.length === 0) {
            if (container) container.innerHTML = '<div style="padding: 2rem; text-align: center;">No teams found in this league.</div>';
            return;
        }

        // Sort teams
        if (ScoreboardView.state.sortMode === 'season_desc') {
            teams.sort((a, b) => b.seasonPoints - a.seasonPoints);
        } else {
            teams.sort((a, b) => b.weeklyPoints - a.weeklyPoints);
        }

        // Find Leader & Disaster MVP player
        const leader = teams[0];
        let worstQbPick = null;
        let maxPlayerPoints = -999;
        let liveGameCount = 0;
        let finalGameCount = 0;

        Object.values(ScoreboardView.state.gamesMap || {}).forEach(g => {
            if (g.isLive) liveGameCount++;
            if (g.isFinal) finalGameCount++;
        });
        // Divide by 2 because gamesMap has both home and away entries
        liveGameCount = Math.floor(liveGameCount / 2);
        finalGameCount = Math.floor(finalGameCount / 2);

        teams.forEach(t => {
            t.picks.forEach(p => {
                if (p.points > maxPlayerPoints) {
                    maxPlayerPoints = p.points;
                    worstQbPick = { ...p, teamName: t.teamName };
                }
            });
        });

        // 1. Render Summary Banners
        if (bannerContainer) {
            bannerContainer.innerHTML = `
                <!-- Weekly Leader Card -->
                <div class="glass-panel" style="padding: 1.25rem; display: flex; align-items: center; gap: 1rem; border-left: 4px solid var(--accent-primary);">
                    <div style="font-size: 2.2rem;">🥇</div>
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; letter-spacing: 0.05em;">Week ${ScoreboardView.state.selectedWeek} Leader</div>
                        <div style="font-size: 1.2rem; font-weight: 800; color: #fff;">${leader ? leader.teamName : 'TBD'}</div>
                        <div style="font-size: 0.95rem; font-weight: 700; color: var(--accent-primary);">${leader ? leader.weeklyPoints.toFixed(2) : '0.00'} pts</div>
                    </div>
                </div>

                <!-- Worst QB Disaster MVP Card -->
                <div class="glass-panel" style="padding: 1.25rem; display: flex; align-items: center; gap: 1rem; border-left: 4px solid #f59e0b;">
                    <div style="font-size: 2.2rem;">🔥</div>
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; letter-spacing: 0.05em;">Worst QB of the Week</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: #fff;">${worstQbPick ? worstQbPick.playerName : 'No picks yet'}</div>
                        <div style="font-size: 0.85rem; color: #fbbf24;">
                            ${worstQbPick ? `+${worstQbPick.points.toFixed(2)} pts • ${worstQbPick.team} (${worstQbPick.teamName})` : '-'}
                        </div>
                    </div>
                </div>

                <!-- Game Status Overview Card -->
                <div class="glass-panel" style="padding: 1.25rem; display: flex; align-items: center; gap: 1rem; border-left: 4px solid var(--accent-secondary);">
                    <div style="font-size: 2.2rem;">⏱️</div>
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; letter-spacing: 0.05em;">Gridiron Status</div>
                        <div style="font-size: 1.15rem; font-weight: 800; color: #fff;">
                            ${liveGameCount > 0 ? `<span style="color: #ef4444;"><span class="live-dot-small"></span> ${liveGameCount} Live Now</span>` : '0 Games In Progress'}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            ${finalGameCount} Final • Week ${ScoreboardView.state.selectedWeek}
                        </div>
                    </div>
                </div>
            `;
        }

        // 2. Render Scoreboard Team Cards
        if (container) {
            container.innerHTML = teams.map((team, idx) => {
                const rankNum = idx + 1;
                const rankClass = rankNum === 1 ? 'rank-1' : (rankNum === 2 ? 'rank-2' : (rankNum === 3 ? 'rank-3' : ''));
                
                // Live badge on team header if any pick is live
                const liveTag = team.hasLiveGame 
                    ? `<span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; font-weight: 800; color: #ef4444; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 0.2rem 0.5rem; border-radius: 9999px;"><span class="live-dot-small"></span> LIVE</span>` 
                    : (team.allFinal && team.picks.length === 2 ? `<span style="font-size: 0.75rem; font-weight: 600; color: #94a3b8; background: rgba(255,255,255,0.06); padding: 0.2rem 0.5rem; border-radius: 4px;">FINAL</span>` : '');

                // Ensure 2 slots are always visualized
                const pick1 = team.picks.find(p => p.pickNumber === 1) || team.picks[0] || null;
                const pick2 = team.picks.find(p => p.pickNumber === 2) || (team.picks.length > 1 ? team.picks[1] : null);

                return `
                <div class="sb-team-card">
                    <!-- Team Header -->
                    <div class="sb-team-header">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span class="sb-rank-pill ${rankClass}">#${rankNum}</span>
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">${team.teamName}</span>
                                    ${liveTag}
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">
                                    Season Standing: <strong style="color: var(--accent-secondary);">${team.seasonPoints.toFixed(2)} pts</strong>
                                </div>
                            </div>
                        </div>

                        <!-- Weekly Total Score Box -->
                        <div style="text-align: right;">
                            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; letter-spacing: 0.05em;">Weekly Total</div>
                            <div style="font-size: 1.8rem; font-weight: 900; color: var(--accent-primary); line-height: 1.1;">
                                ${team.weeklyPoints.toFixed(2)} <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary);">pts</span>
                            </div>
                        </div>
                    </div>

                    <!-- Picks & Full Stats Table -->
                    <div class="sb-stat-table-wrapper">
                        <table class="sb-stat-table">
                            <thead>
                                <tr>
                                    <th style="min-width: 220px;">QB / Player</th>
                                    <th>Matchup / Status</th>
                                    <th>CMP / ATT</th>
                                    <th>CMP %</th>
                                    <th>PASS YDS</th>
                                    <th>PASS TD</th>
                                    <th>INT</th>
                                    <th>PICK 6</th>
                                    <th>SCK</th>
                                    <th>RUSH YDS</th>
                                    <th>RUSH TD</th>
                                    <th>FUM</th>
                                    <th>TEAM LOSS</th>
                                    <th style="color: var(--accent-primary); font-weight: 800;">POINTS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ScoreboardView.renderPlayerStatRow(pick1, 1)}
                                ${ScoreboardView.renderPlayerStatRow(pick2, 2)}
                            </tbody>
                        </table>
                    </div>
                </div>
                `;
            }).join('');
        }
    },

    renderPlayerStatRow: (pick, slotNum) => {
        if (!pick) {
            return `
            <tr>
                <td colspan="14" style="text-align: center; padding: 0.85rem; color: var(--text-secondary); font-style: italic; background: rgba(0,0,0,0.15);">
                    Pick #${slotNum}: Empty (Not drafted yet)
                </td>
            </tr>
            `;
        }

        const s = pick.stats || {};
        const isProj = pick.statSource === 'proj';
        const formatVal = (val, isInteger = false) => {
            const num = parseFloat(val) || 0;
            if (isInteger || !isProj) return Math.round(num);
            return num % 1 === 0 ? num : num.toFixed(1);
        };

        const att = formatVal(s.attempts, true);
        const cmp = formatVal(s.completions, true);
        const compPct = (s.attempts && s.attempts > 0) ? (((s.completions || 0) / s.attempts) * 100).toFixed(1) + '%' : '0.0%';
        const pYds = formatVal(s.passing_yards, true);
        const pTds = formatVal(s.passing_tds);
        const rawInts = parseFloat(s.interceptions) || 0;
        const ints = formatVal(s.interceptions);
        const rawP6 = parseFloat(s.pick_sixes) || 0;
        const p6 = formatVal(s.pick_sixes);
        const rawSacks = parseFloat(s.sacks) || 0;
        const sacks = formatVal(s.sacks);
        const rYds = formatVal(s.rushing_yards, true);
        const rTds = formatVal(s.rushing_tds);
        const rawFum = parseFloat(s.fumbles_lost) || 0;
        const fum = formatVal(s.fumbles_lost);
        
        let lossDisplay = '-';
        if (s.team_loss_prob !== undefined && s.team_loss_prob > 0) {
            lossDisplay = `${Math.round(s.team_loss_prob * 100)}% prob`;
        } else if (s.team_loss) {
            lossDisplay = '<span class="stat-bad-highlight">LOSS (+5)</span>';
        } else if (pick.isFinal) {
            lossDisplay = '<span class="stat-good-highlight">WIN (0)</span>';
        }

        // Highlight bad stats (which are great in Worst QB!)
        const intDisplay = rawInts > 0 ? `<span class="stat-bad-highlight">${ints}</span>` : '0';
        const p6Display = rawP6 > 0 ? `<span class="stat-bad-highlight" style="background: rgba(239,68,68,0.3); border-color: #ef4444;">${p6}</span>` : '0';
        const sckDisplay = rawSacks > 0 ? `<span style="font-weight: 700; color: #f87171;">${sacks}</span>` : '0';
        const fumDisplay = rawFum > 0 ? `<span class="stat-bad-highlight">${fum}</span>` : '0';

        // Headshot
        const headshot = pick.headshotUrl 
            ? `<img src="${pick.headshotUrl}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; background: #fff; border: 1px solid var(--glass-border);" alt="${pick.playerName}">`
            : `<div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-size: 1rem;">🏈</div>`;

        // Game Status Pill
        let statusBadge = `<span style="font-size: 0.75rem; color: var(--text-secondary);">${pick.gameStatus}</span>`;
        if (pick.isLive) {
            statusBadge = `<span style="display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; font-weight: 700; color: #ef4444; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 0.15rem 0.45rem; border-radius: 4px;"><span class="live-dot-small"></span> ${pick.gameStatus}</span>`;
        } else if (pick.isFinal) {
            statusBadge = `<span style="font-size: 0.75rem; font-weight: 600; color: #94a3b8; background: rgba(255,255,255,0.06); padding: 0.15rem 0.45rem; border-radius: 4px;">FINAL</span>`;
        } else if (pick.statSource === 'proj') {
            statusBadge = `<span style="font-size: 0.75rem; font-weight: 600; color: var(--accent-secondary); background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); padding: 0.15rem 0.45rem; border-radius: 4px;">PROJ</span>`;
        }

        return `
        <tr style="transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 0.75rem 0.6rem; display: flex; align-items: center; gap: 0.75rem;">
                ${headshot}
                <div style="display: flex; flex-direction: column;">
                    <a href="#/player_profile?id=${pick.playerId}&league=${ScoreboardView.state.selectedLeagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 700; font-size: 0.95rem;">
                        ${pick.playerName}
                    </a>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${pick.position} • ${pick.team}</span>
                </div>
            </td>
            <td style="text-align: center;">${statusBadge}</td>
            <td>${cmp} / ${att}</td>
            <td>${compPct}</td>
            <td>${pYds}</td>
            <td>${pTds}</td>
            <td>${intDisplay}</td>
            <td>${p6Display}</td>
            <td>${sckDisplay}</td>
            <td>${rYds}</td>
            <td>${rTds}</td>
            <td>${fumDisplay}</td>
            <td>${lossDisplay}</td>
            <td style="font-weight: 800; font-size: 1.05rem; color: var(--accent-primary);">
                ${pick.points.toFixed(2)}
            </td>
        </tr>
        `;
    }
};

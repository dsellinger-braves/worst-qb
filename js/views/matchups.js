import { supabase } from '../supabase.js';
import { calculateLeagueScore, DEFAULT_SCORING } from '../scoring.js';

export const MatchupsView = {
    state: {
        selectedWeek: 7,
        selectedLeagueId: null,
        userLeagues: [],
        currentUserId: null,
        filterMode: 'ALL', // 'ALL', 'MY_TEAM', 'ROSTERED'
        autoRefreshInterval: null,
        loading: false,
        games: [],
        statsMap: {},
        projectionsMap: {},
        picksMap: {},
        leagueSettings: null,
        leagueScoringType: 'individual',
        gameStates: {},
        gameLossProbs: {}
    },

    render: () => `
        <div class="view-container active glass-panel" style="padding-bottom: 3rem;">
            <!-- Header & Controls -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1.5rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 1.5rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <h1 style="margin: 0;">NFL Gamecast & QB Tracker</h1>
                        <span id="live-indicator-badge" class="status-pill status-scheduled" style="display: inline-flex;">Week 7 Live Hub</span>
                    </div>
                    <p style="margin-top: 0.4rem; color: var(--text-secondary);">
                        Live NFL scores, starting quarterbacks, Worst QB fantasy scoring, and league ownership.
                    </p>
                </div>
                
                <!-- Quick controls -->
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">NFL Week:</label>
                        <select id="gamecast-week-select" class="form-input" style="font-weight: bold; min-width: 120px;" onchange="MatchupsView.onWeekChange(this.value)">
                            ${Array.from({ length: 18 }, (_, i) => i + 1).map(w => `<option value="${w}" ${w === 7 ? 'selected' : ''}>Week ${w}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Roster Ownership League:</label>
                        <select id="gamecast-league-select" class="form-input" style="min-width: 200px;" onchange="MatchupsView.onLeagueChange(this.value)">
                            <option value="">No League (Global / Free Agents)</option>
                        </select>
                    </div>

                    <div style="align-self: flex-end;">
                        <button id="gamecast-refresh-btn" class="btn" onclick="MatchupsView.loadData()" style="background: rgba(255,255,255,0.08); padding: 0.5rem 1rem;">
                            ↻ Refresh
                        </button>
                    </div>
                </div>
            </div>

            <!-- Filter Tabs & Stats Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-top: 1.25rem;">
                <div style="display: flex; gap: 0.5rem; background: rgba(0,0,0,0.3); padding: 0.3rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                    <button class="btn btn-sm filter-tab active" id="tab-filter-all" onclick="MatchupsView.setFilter('ALL')" style="font-size: 0.8rem; padding: 0.35rem 0.85rem; border-radius: 6px;">All Games</button>
                    <button class="btn btn-sm filter-tab" id="tab-filter-my" onclick="MatchupsView.setFilter('MY_TEAM')" style="font-size: 0.8rem; padding: 0.35rem 0.85rem; border-radius: 6px;">My Fantasy QBs</button>
                    <button class="btn btn-sm filter-tab" id="tab-filter-rostered" onclick="MatchupsView.setFilter('ROSTERED')" style="font-size: 0.8rem; padding: 0.35rem 0.85rem; border-radius: 6px;">Drafted QBs Only</button>
                </div>

                <div id="gamecast-meta-bar" style="font-size: 0.85rem; color: var(--text-secondary);">
                    Loading matchups...
                </div>
            </div>

            <!-- Games Grid -->
            <div id="gamecast-container">
                <div class="loading-state" style="height: 350px;">
                    <div class="spinner"></div>
                    <p>Fetching NFL scoreboard & quarterback rosters...</p>
                </div>
            </div>
        </div>
    `,

    init: async (params = {}) => {
        if (!supabase) return;

        // Clean up previous timer
        if (MatchupsView.state.autoRefreshInterval) {
            clearInterval(MatchupsView.state.autoRefreshInterval);
            MatchupsView.state.autoRefreshInterval = null;
        }

        // Set initial state from params
        MatchupsView.state.selectedWeek = parseInt(params.week) || 7;
        MatchupsView.state.selectedLeagueId = params.league || null;
        MatchupsView.state.filterMode = 'ALL';

        // Check logged in user
        const { data: { session } } = await supabase.auth.getSession();
        MatchupsView.state.currentUserId = session?.user?.id || null;

        // Populate league selector
        await MatchupsView.populateLeagues();

        // Load gamecast data
        await MatchupsView.loadData();

        // Auto-refresh every 30s when live hub is active
        MatchupsView.state.autoRefreshInterval = setInterval(() => {
            if (!document.getElementById('gamecast-container')) {
                clearInterval(MatchupsView.state.autoRefreshInterval);
                MatchupsView.state.autoRefreshInterval = null;
                return;
            }
            MatchupsView.loadData(true); // silent refresh
        }, 30000);
    },

    populateLeagues: async () => {
        try {
            const { data: leagues } = await supabase.from('leagues')
                .select('id, name, scoring_type')
                .order('name', { ascending: true });
                
            MatchupsView.state.userLeagues = leagues || [];
            
            const leagueSelect = document.getElementById('gamecast-league-select');
            if (!leagueSelect) return;

            let html = `<option value="">No League (Global / Free Agents)</option>`;
            (leagues || []).forEach(l => {
                const isSelected = l.id === MatchupsView.state.selectedLeagueId;
                html += `<option value="${l.id}" ${isSelected ? 'selected' : ''}>${l.name} (${l.scoring_type === 'team_qb' ? 'Team QB' : 'Indiv'})</option>`;
            });
            leagueSelect.innerHTML = html;

            // If league wasn't set but user is member of a league, default to first league
            if (!MatchupsView.state.selectedLeagueId && leagues && leagues.length > 0) {
                // If in user leagues, auto-select first one
                MatchupsView.state.selectedLeagueId = leagues[0].id;
                leagueSelect.value = leagues[0].id;
            }
        } catch (e) {
            console.error("Error populating leagues:", e);
        }
    },

    onWeekChange: (week) => {
        MatchupsView.state.selectedWeek = parseInt(week) || 7;
        MatchupsView.loadData();
    },

    onLeagueChange: (leagueId) => {
        MatchupsView.state.selectedLeagueId = leagueId || null;
        MatchupsView.loadData();
    },

    setFilter: (mode) => {
        MatchupsView.state.filterMode = mode;
        ['all', 'my', 'rostered'].forEach(tab => {
            const el = document.getElementById(`tab-filter-${tab}`);
            if (el) el.classList.remove('active');
        });
        const activeTab = document.getElementById(`tab-filter-${mode === 'ALL' ? 'all' : mode === 'MY_TEAM' ? 'my' : 'rostered'}`);
        if (activeTab) activeTab.classList.add('active');
        MatchupsView.renderGames();
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
                players: {
                    id: `TEAM_${abbr}_regular`,
                    name: `${abbr} QBs`,
                    team: abbr,
                    position: 'TM_QB',
                    headshot_url: `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${abbr.toLowerCase()}.png`
                }
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
                            players: {
                                id: pid,
                                name: pname,
                                team: tabbr,
                                position: pos,
                                headshot_url: headshot
                            }
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
                    if (!parsedPlayers[pid]) return; // ignore non-passers

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
            homeLossProb,
            awayLossProb,
            parsedPlayers,
            teamLiveStats
        };
    },

    loadData: async (isSilent = false) => {
        const week = MatchupsView.state.selectedWeek;
        const leagueId = MatchupsView.state.selectedLeagueId;
        const container = document.getElementById('gamecast-container');
        const metaBar = document.getElementById('gamecast-meta-bar');

        if (!isSilent && container) {
            container.innerHTML = `
                <div class="loading-state" style="height: 350px;">
                    <div class="spinner"></div>
                    <p>Updating live scores & QB duels for Week ${week}...</p>
                </div>
            `;
        }

        try {
            // 1. Fetch ESPN Scoreboard for Week
            const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=${week}`;
            const espnPromise = fetch(espnUrl).then(r => r.json()).catch(() => ({ events: [] }));

            // 2. Fetch Supabase player_stats for week
            const statsPromise = supabase.from('player_stats')
                .select('*, players(id, name, team, position, headshot_url)')
                .eq('week', week)
                .eq('season_type', 'regular');

            // 3. Fetch Supabase player_projections for week
            const projPromise = supabase.from('player_projections')
                .select('*, players(id, name, team, position, headshot_url)')
                .eq('week', week);

            // 4. Fetch league info & picks if league selected
            let picksPromise = Promise.resolve({ data: [] });
            let membersPromise = Promise.resolve({ data: [] });
            let leaguePromise = Promise.resolve({ data: null });

            if (leagueId) {
                picksPromise = supabase.from('draft_picks').select('*').eq('league_id', leagueId).eq('week', week);
                membersPromise = supabase.from('league_members').select('*').eq('league_id', leagueId);
                leaguePromise = supabase.from('leagues').select('*').eq('id', leagueId).single();
            }

            const [espnData, statsRes, projRes, picksRes, membersRes, leagueRes] = await Promise.all([
                espnPromise, statsPromise, projPromise, picksPromise, membersPromise, leaguePromise
            ]);

            // Save games
            MatchupsView.state.games = espnData.events || [];

            // 5. Fetch live / actual game summaries directly from ESPN
            // In-progress games always fetch live boxscores. Completed games fetch if not yet in DB.
            const dbTeams = new Set((statsRes.data || []).map(s => s.players?.team).filter(Boolean));
            const gamesToFetch = (espnData.events || []).filter(ev => {
                const st = ev.status?.type?.state;
                if (st === 'in') return true;
                if (st === 'post') {
                    const comp = ev.competitions?.[0];
                    const away = comp?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation;
                    const home = comp?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation;
                    return !(dbTeams.has(away) && dbTeams.has(home));
                }
                return false;
            });

            const summaries = await Promise.all(
                gamesToFetch.map(g => 
                    fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${g.id}`)
                        .then(r => r.json())
                        .catch(err => {
                            console.warn(`Failed fetching summary for event ${g.id}:`, err);
                            return null;
                        })
                )
            );

            // Parse each summary
            const liveParsedPlayers = {};
            const liveTeamStats = {};
            const gameStates = {};
            const gameLossProbs = {};

            summaries.forEach(gcData => {
                if (!gcData) return;
                const parsed = MatchupsView.parseEspnSummary(gcData);
                if (!parsed) return;

                if (parsed.homeAbbr) {
                    gameStates[parsed.homeAbbr] = { isLive: parsed.isLive, isFinal: parsed.isFinal, statusDetail: parsed.detail };
                    gameLossProbs[parsed.homeAbbr] = parsed.homeLossProb;
                }
                if (parsed.awayAbbr) {
                    gameStates[parsed.awayAbbr] = { isLive: parsed.isLive, isFinal: parsed.isFinal, statusDetail: parsed.detail };
                    gameLossProbs[parsed.awayAbbr] = parsed.awayLossProb;
                }

                Object.assign(liveParsedPlayers, parsed.parsedPlayers);
                Object.assign(liveTeamStats, parsed.teamLiveStats);
            });

            // Also note states for games that weren't fetched (e.g. pre-game scheduled or already finalized in DB)
            (espnData.events || []).forEach(ev => {
                const comp = ev.competitions?.[0];
                const away = comp?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation;
                const home = comp?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation;
                const st = ev.status?.type?.state;
                const detail = ev.status?.type?.detail || '';
                [away, home].filter(Boolean).forEach(abbr => {
                    if (!gameStates[abbr]) {
                        gameStates[abbr] = { isLive: st === 'in', isFinal: st === 'post', statusDetail: detail };
                    }
                });
            });

            MatchupsView.state.gameStates = gameStates;
            MatchupsView.state.gameLossProbs = gameLossProbs;

            // Build stats map by team and player_id (DB stats first, overwritten by live actuals)
            const statsMap = {};
            (statsRes.data || []).forEach(s => {
                statsMap[s.player_id] = s;
            });
            Object.entries(liveParsedPlayers).forEach(([pid, stat]) => {
                statsMap[pid] = stat;
            });
            Object.entries(liveTeamStats).forEach(([pid, stat]) => {
                statsMap[stat.player_id] = stat;
            });
            MatchupsView.state.statsMap = statsMap;

            // Merge allStats array: retain DB stats for players not live, then append live stats
            const livePids = new Set(Object.keys(liveParsedPlayers));
            const mergedAllStats = (statsRes.data || []).filter(s => !livePids.has(s.player_id));
            Object.values(liveParsedPlayers).forEach(lp => mergedAllStats.push(lp));
            MatchupsView.state.allStats = mergedAllStats;

            // Build projections map
            const projectionsMap = {};
            (projRes.data || []).forEach(p => {
                projectionsMap[p.player_id] = p;
            });
            MatchupsView.state.projectionsMap = projectionsMap;
            MatchupsView.state.allProjections = projRes.data || [];

            // League scoring settings & members
            MatchupsView.state.leagueSettings = leagueRes?.data?.scoring_settings || DEFAULT_SCORING;
            MatchupsView.state.leagueScoringType = leagueRes?.data?.scoring_type || 'individual';

            // Build ownership map: player_id -> { teamName, userId, pickNumber, isMyTeam }
            const members = membersRes.data || [];
            const membersById = {};
            members.forEach(m => { membersById[m.user_id] = m; });

            const picksMap = {};
            (picksRes.data || []).forEach(p => {
                const member = membersById[p.user_id];
                picksMap[p.player_id] = {
                    teamName: member?.team_name || 'Team',
                    userId: p.user_id,
                    pickNumber: p.pick_number,
                    isMyTeam: p.user_id === MatchupsView.state.currentUserId
                };
            });
            MatchupsView.state.picksMap = picksMap;

            // Update meta bar
            const liveCount = MatchupsView.state.games.filter(g => g.status?.type?.state === 'in').length;
            const finalCount = MatchupsView.state.games.filter(g => g.status?.type?.state === 'post').length;
            const scheduledCount = MatchupsView.state.games.filter(g => g.status?.type?.state === 'pre').length;
            
            if (metaBar) {
                metaBar.innerHTML = `
                    <span><strong>${MatchupsView.state.games.length} Games:</strong> ${liveCount > 0 ? `<span style="color: #ef4444; font-weight: bold;">${liveCount} Live</span> • ` : ''}${finalCount} Final • ${scheduledCount} Upcoming</span>
                    <span style="margin-left: 0.75rem; color: rgba(255,255,255,0.4); font-size: 0.8rem;">Updated ${new Date().toLocaleTimeString()}</span>
                `;
            }

            // Update header badge
            const badge = document.getElementById('live-indicator-badge');
            if (badge) {
                if (liveCount > 0) {
                    badge.className = 'status-pill status-live';
                    badge.innerHTML = `<span class="live-dot"></span> ${liveCount} GAME${liveCount > 1 ? 'S' : ''} LIVE NOW`;
                } else if (finalCount === MatchupsView.state.games.length && finalCount > 0) {
                    badge.className = 'status-pill status-final';
                    badge.innerHTML = `Week ${week} Complete`;
                } else {
                    badge.className = 'status-pill status-scheduled';
                    badge.innerHTML = `Week ${week} Matchups`;
                }
            }

            MatchupsView.renderGames();

        } catch (err) {
            console.error("Error loading Gamecast data:", err);
            if (container) {
                container.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--accent-primary);">Error loading scoreboard: ${err.message}</div>`;
            }
        }
    },

    getProjectedAttempts: (pr) => {
        if (!pr || !pr.opponent) return 0;
        try {
            if (typeof pr.opponent === 'string' && pr.opponent.startsWith('{')) {
                const parsed = JSON.parse(pr.opponent);
                return parseFloat(parsed?.raw?.attempts) || 0;
            }
        } catch (e) {
            return 0;
        }
        return 0;
    },

    findQuarterbacksForTeam: (teamAbbr) => {
        const isTeamQBMode = MatchupsView.state.leagueScoringType === 'team_qb';
        const teamQBPid = `TEAM_${teamAbbr}_regular`;
        const gameState = MatchupsView.state.gameStates?.[teamAbbr];
        const isLiveGame = !!gameState?.isLive;
        const isFinalGame = !!gameState?.isFinal;

        // If in Team QB mode, return the Team QB record
        if (isTeamQBMode) {
            const teamStat = MatchupsView.state.statsMap[teamQBPid];
            const ownership = MatchupsView.state.picksMap[teamQBPid] || null;
            
            // Also find actual passers for context
            const subPassers = MatchupsView.state.allStats.filter(s => {
                const pos = s.players?.position || '';
                const isQB = pos.includes('QB') || (s.attempts && s.attempts > 0);
                const proj = MatchupsView.state.projectionsMap[s.player_id] || null;
                const projAtt = MatchupsView.getProjectedAttempts(proj);
                const hasPasses = (s.attempts && s.attempts > 0) || projAtt > 0 || s.is_live;
                return s.players?.team === teamAbbr && isQB && s.player_id !== teamQBPid && hasPasses;
            });

            return [{
                id: teamQBPid,
                name: `${teamAbbr} QBs`,
                team: teamAbbr,
                position: 'TM_QB',
                headshot: `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/${teamAbbr.toLowerCase()}.png`,
                isTeamQB: true,
                stat: teamStat || null,
                projection: null,
                ownership: ownership,
                subPassers: subPassers
            }];
        }

        // Individual QB Mode: Find actuals first, then projections
        const qbs = [];
        const seenPids = new Set();

        // 1. Any QB from allStats for this team who threw passes, has live stats, or is projected to throw passes
        MatchupsView.state.allStats.forEach(s => {
            const p = s.players;
            if (!p) return;
            const pos = p.position || '';
            const isQB = pos.includes('QB') || (s.attempts && s.attempts > 0);
            if (p.team === teamAbbr && isQB && p.position !== 'TM_QB') {
                const proj = MatchupsView.state.projectionsMap[s.player_id] || null;
                const projAtt = MatchupsView.getProjectedAttempts(proj);
                const actualAtt = s.attempts || 0;

                // Only include if they threw passes in the game, have live stats, or are projected to throw passes
                if (actualAtt > 0 || projAtt > 0 || s.is_live) {
                    seenPids.add(s.player_id);
                    qbs.push({
                        id: s.player_id,
                        name: p.name,
                        team: p.team,
                        position: 'QB',
                        headshot: p.headshot_url,
                        stat: s,
                        projection: proj,
                        ownership: MatchupsView.state.picksMap[s.player_id] || null
                    });
                }
            }
        });

        // 2. Projected QBs for this team who are projected to throw passes (> 0 attempts)
        MatchupsView.state.allProjections.forEach(pr => {
            const p = pr.players;
            if (!p) return;
            const pos = p.position || '';
            const isQB = pos.includes('QB');
            if (p.team === teamAbbr && isQB && p.position !== 'TM_QB') {
                if (!seenPids.has(pr.player_id)) {
                    const projAtt = MatchupsView.getProjectedAttempts(pr);
                    // Filter out any player who is not projected to throw passes
                    if (projAtt > 0) {
                        seenPids.add(pr.player_id);

                        let inGameStat = null;
                        if (isLiveGame) {
                            // In a live game, provide in-game live stat so actuals display
                            inGameStat = {
                                player_id: pr.player_id,
                                week: MatchupsView.state.selectedWeek,
                                season_type: 'regular',
                                name: p.name,
                                team: teamAbbr,
                                position: 'QB',
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
                                team_loss_prob: MatchupsView.state.gameLossProbs?.[teamAbbr] ?? 0.5,
                                team_loss: false,
                                is_live: true,
                                is_final: false,
                                players: p
                            };
                        } else if (isFinalGame) {
                            // In a completed game, if they had 0 attempts:
                            // If drafted, track as 0-attempts (-20.0 penalty)
                            if (MatchupsView.state.picksMap[pr.player_id]) {
                                inGameStat = {
                                    player_id: pr.player_id,
                                    week: MatchupsView.state.selectedWeek,
                                    season_type: 'regular',
                                    name: p.name,
                                    team: teamAbbr,
                                    position: 'QB',
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
                                    team_loss_prob: 0,
                                    team_loss: false,
                                    is_live: false,
                                    is_final: true,
                                    players: p
                                };
                            }
                        }

                        qbs.push({
                            id: pr.player_id,
                            name: p.name,
                            team: p.team,
                            position: 'QB',
                            headshot: p.headshot_url,
                            stat: inGameStat,
                            projection: pr,
                            ownership: MatchupsView.state.picksMap[pr.player_id] || null
                        });
                    }
                }
            }
        });

        // Sort: QBs with stats first (by attempts desc), then by projection points desc
        qbs.sort((a, b) => {
            const attA = a.stat?.attempts || 0;
            const attB = b.stat?.attempts || 0;
            if (attA !== attB) return attB - attA;

            const projA = a.projection?.projected_custom_points || 0;
            const projB = b.projection?.projected_custom_points || 0;
            return projB - projA;
        });

        return qbs;
    },

    renderGames: () => {
        const container = document.getElementById('gamecast-container');
        if (!container) return;

        const events = MatchupsView.state.games;
        if (!events || events.length === 0) {
            container.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-secondary);">No NFL games scheduled for Week ${MatchupsView.state.selectedWeek}.</div>`;
            return;
        }

        let filteredEvents = events.filter(event => {
            const comp = event.competitions?.[0];
            if (!comp) return false;
            const away = comp.competitors.find(c => c.homeAway === 'away');
            const home = comp.competitors.find(c => c.homeAway === 'home');
            const awayQBs = MatchupsView.findQuarterbacksForTeam(away?.team?.abbreviation);
            const homeQBs = MatchupsView.findQuarterbacksForTeam(home?.team?.abbreviation);
            const allQBs = [...awayQBs, ...homeQBs];

            if (MatchupsView.state.filterMode === 'MY_TEAM') {
                return allQBs.some(qb => qb.ownership?.isMyTeam);
            }
            if (MatchupsView.state.filterMode === 'ROSTERED') {
                return allQBs.some(qb => !!qb.ownership);
            }
            return true; // 'ALL'
        });

        if (filteredEvents.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-secondary); background: rgba(0,0,0,0.2); border-radius: 8px;">
                    <p style="font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem;">No games match your filter.</p>
                    <p style="font-size: 0.9rem;">None of the quarterbacks in this week's games matched your filter criteria.</p>
                    <button class="btn btn-sm btn-primary" onclick="MatchupsView.setFilter('ALL')" style="margin-top: 1rem;">Show All Games</button>
                </div>
            `;
            return;
        }

        let html = `<div class="gamecast-grid">`;
        filteredEvents.forEach(event => {
            html += MatchupsView.renderGameCard(event);
        });
        html += `</div>`;

        container.innerHTML = html;
    },

    renderGameCard: (event) => {
        const comp = event.competitions?.[0] || {};
        const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
        const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
        const status = event.status || {};
        const statusState = status.type?.state || 'pre'; // 'pre', 'in', 'post'
        const statusDetail = status.type?.detail || 'Scheduled';
        const odds = comp.odds?.[0]?.details || null;
        const broadcast = comp.broadcasts?.[0]?.names?.[0] || null;

        const isLive = statusState === 'in';
        const isFinal = statusState === 'post';

        // QBs for each team
        const awayQBs = MatchupsView.findQuarterbacksForTeam(away.team?.abbreviation);
        const homeQBs = MatchupsView.findQuarterbacksForTeam(home.team?.abbreviation);

        // Score display
        const awayScore = away.score !== undefined ? away.score : '-';
        const homeScore = home.score !== undefined ? home.score : '-';
        const awayWon = isFinal && parseInt(awayScore) > parseInt(homeScore);
        const homeWon = isFinal && parseInt(homeScore) > parseInt(awayScore);

        return `
            <div class="game-card">
                <!-- Card Header -->
                <div class="game-card-header">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${isLive 
                            ? `<span class="status-pill status-live"><span class="live-dot"></span> ${statusDetail}</span>` 
                            : isFinal 
                            ? `<span class="status-pill status-final">${statusDetail}</span>` 
                            : `<span class="status-pill status-scheduled">📅 ${statusDetail}</span>`
                        }
                        ${broadcast ? `<span class="broadcast-badge">📺 ${broadcast}</span>` : ''}
                    </div>

                    ${odds ? `<div class="odds-badge">${odds}</div>` : ''}
                </div>

                <!-- Scoreboard Strip -->
                <div class="scoreboard-strip">
                    <!-- Away Team -->
                    <div class="team-box away">
                        <img src="${away.team?.logo || ''}" alt="${away.team?.abbreviation}" class="team-logo" onerror="this.style.opacity='0.2'">
                        <div class="team-meta">
                            <span class="team-abbr">${away.team?.abbreviation || 'AWAY'}</span>
                            <span class="team-record">${away.records?.[0]?.summary || '-'}</span>
                        </div>
                    </div>

                    <!-- Score Center -->
                    <div class="vs-score-divider">
                        ${isLive || isFinal ? `
                            <div class="score-display">
                                <span class="${awayWon ? 'winning' : ''}">${awayScore}</span>
                                <span style="color: rgba(255,255,255,0.2); font-weight: 300;">-</span>
                                <span class="${homeWon ? 'winning' : ''}">${homeScore}</span>
                            </div>
                        ` : `
                            <span style="font-size: 0.85rem; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 1.5px;">VS</span>
                        `}
                    </div>

                    <!-- Home Team -->
                    <div class="team-box home">
                        <img src="${home.team?.logo || ''}" alt="${home.team?.abbreviation}" class="team-logo" onerror="this.style.opacity='0.2'">
                        <div class="team-meta">
                            <span class="team-abbr">${home.team?.abbreviation || 'HOME'}</span>
                            <span class="team-record">${home.records?.[0]?.summary || '-'}</span>
                        </div>
                    </div>
                </div>

                <!-- Quarterback Matchup Section -->
                <div class="qb-section">
                    <div class="qb-section-header">
                        <span>Quarterback Duel</span>
                        <span>Fantasy Roster & Points</span>
                    </div>

                    <div class="qb-duel-grid">
                        <!-- Away QB Column -->
                        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                            <div style="font-size: 0.7rem; font-weight: 800; color: var(--accent-secondary); text-transform: uppercase;">
                                ${away.team?.abbreviation} Passer(s)
                            </div>
                            ${awayQBs.length > 0 ? awayQBs.map(qb => MatchupsView.renderQBCard(qb, { isLive, isFinal, statusDetail })).join('') : `<div style="font-size: 0.75rem; color: var(--text-secondary); padding: 0.5rem;">No active QB projected</div>`}
                        </div>

                        <!-- Home QB Column -->
                        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                            <div style="font-size: 0.7rem; font-weight: 800; color: var(--accent-secondary); text-transform: uppercase;">
                                ${home.team?.abbreviation} Passer(s)
                            </div>
                            ${homeQBs.length > 0 ? homeQBs.map(qb => MatchupsView.renderQBCard(qb, { isLive, isFinal, statusDetail })).join('') : `<div style="font-size: 0.75rem; color: var(--text-secondary); padding: 0.5rem;">No active QB projected</div>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderQBCard: (qb, gameInfo = {}) => {
        const leagueId = MatchupsView.state.selectedLeagueId;
        const leagueSettings = MatchupsView.state.leagueSettings;

        // Calculate Fantasy Score
        let displayPoints = null;
        let isProjected = false;
        const isLive = !!qb.stat?.is_live || (gameInfo.isLive && qb.stat);
        const isFinal = !!qb.stat?.is_final || (gameInfo.isFinal && qb.stat);

        if (qb.stat) {
            displayPoints = calculateLeagueScore(qb.stat, leagueSettings);
        } else if (qb.projection) {
            isProjected = true;
            let raw = {};
            try {
                if (qb.projection.opponent && qb.projection.opponent.startsWith('{')) {
                    raw = JSON.parse(qb.projection.opponent).raw || {};
                }
            } catch(e) {}
            displayPoints = calculateLeagueScore(raw, leagueSettings) || qb.projection.projected_custom_points || 0;
        }

        // Tag Class & Prefix for Points
        let tagClass = 'worst-qb-tag';
        let ptsPrefix = '';
        if (isLive) {
            tagClass = 'worst-qb-tag live';
            ptsPrefix = '<span class="live-dot-small"></span> ';
        } else if (isProjected) {
            tagClass = 'worst-qb-tag projected';
            ptsPrefix = 'Proj ';
        } else if (isFinal) {
            tagClass = 'worst-qb-tag final';
        }

        // Ownership Badge
        let ownershipHtml = '';
        if (qb.ownership) {
            if (qb.ownership.isMyTeam) {
                ownershipHtml = `<span class="fantasy-badge my-team" title="Drafted on your fantasy team">⭐ YOUR TEAM: ${qb.ownership.teamName}</span>`;
            } else {
                ownershipHtml = `<span class="fantasy-badge opponent-team" title="Drafted by ${qb.ownership.teamName}">🎯 ${qb.ownership.teamName} (Pick ${qb.ownership.pickNumber})</span>`;
            }
        } else {
            ownershipHtml = `<span class="fantasy-badge free-agent">⚪ Available Free Agent</span>`;
        }

        // Stat lines
        let statsLine = '';
        if (qb.stat) {
            const s = qb.stat;
            const att = s.attempts || 0;
            const cmp = s.completions || 0;
            const compPct = att > 0 ? Math.round((cmp / att) * 100) : 0;

            statsLine = `
                <div class="qb-stats-summary">
                    ${isLive ? '<span style="color: #ef4444; font-weight: 800; margin-right: 0.35rem;">● LIVE:</span>' : ''}
                    <strong>${cmp}/${att}</strong> (${compPct}%) • <strong>${s.passing_yards || 0}</strong> yds • 
                    <span style="color: ${s.passing_tds > 0 ? '#10b981' : 'inherit'}">${s.passing_tds || 0} TD</span> • 
                    <span style="color: ${s.interceptions > 0 ? 'var(--accent-primary)' : 'inherit'}; font-weight: bold;">${s.interceptions || 0} INT</span> 
                    ${s.pick_sixes > 0 ? `• <span style="color: #f43f5e; font-weight: 900;">${s.pick_sixes} P6</span>` : ''} 
                    • ${s.sacks || 0} Sck
                    ${(s.rushing_yards || s.rushing_tds) ? `• ${s.rushing_yards || 0} rush yds ${s.rushing_tds ? `(${s.rushing_tds} rush TD)` : ''}` : ''}
                    ${s.team_loss_prob !== undefined && isLive ? `• <span style="color: #fbbf24; font-size: 0.75rem;" title="Live Loss Probability">${Math.round(s.team_loss_prob * 100)}% loss prob</span>` : ''}
                    ${s.team_loss && !isLive ? `• <span style="color: var(--accent-primary); font-weight: bold;">Loss (+5)</span>` : ''}
                </div>
            `;
        } else if (qb.projection) {
            let raw = {};
            try {
                if (qb.projection.opponent && qb.projection.opponent.startsWith('{')) {
                    raw = JSON.parse(qb.projection.opponent).raw || {};
                }
            } catch(e) {}
            statsLine = `
                <div class="qb-stats-summary" style="opacity: 0.85;">
                    Proj: ${(raw.completions || 0).toFixed(0)}/${(raw.attempts || 0).toFixed(0)} (${(raw.passing_yards || 0).toFixed(0)} yds) • 
                    ${(raw.interceptions || 0).toFixed(1)} INT • ${(raw.sacks || 0).toFixed(1)} Sck
                </div>
            `;
        } else {
            statsLine = `<div class="qb-stats-summary" style="opacity: 0.6;">No projection data available</div>`;
        }

        const profileLink = leagueId 
            ? `#/player_profile?id=${qb.id}&league=${leagueId}`
            : `#/player_profile?id=${qb.id}`;

        const fallbackImg = `https://a.espncdn.com/i/headshots/nfl/players/full/${qb.id.replace('espn-', '')}.png`;

        return `
            <div class="qb-card">
                <div class="qb-card-top">
                    <img src="${qb.headshot || fallbackImg}" alt="${qb.name}" class="qb-avatar" onerror="this.src='https://a.espncdn.com/combiner/i?img=/i/headshots/nophoto.png&w=100&h=100'">
                    <div class="qb-details">
                        <a href="${profileLink}" class="qb-name-link" title="View ${qb.name}'s Profile & Game Log">${qb.name}</a>
                        <span class="qb-pos-team">${qb.team} • ${qb.position}</span>
                    </div>
                </div>

                <!-- Roster Ownership Status -->
                <div>
                    ${ownershipHtml}
                </div>

                <!-- Fantasy Points Row -->
                <div class="qb-points-row">
                    <span style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700;">Worst QB Pts:</span>
                    <span class="${tagClass}">
                        ${displayPoints !== null ? `${ptsPrefix}${displayPoints.toFixed(2)}` : '--'} pts
                    </span>
                </div>

                <!-- Actual or Projected Stat Summary -->
                ${statsLine}
            </div>
        `;
    }
};

window.MatchupsView = MatchupsView;

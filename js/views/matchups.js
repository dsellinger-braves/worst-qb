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
        leagueScoringType: 'individual'
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

        // Auto-refresh every 45s
        MatchupsView.state.autoRefreshInterval = setInterval(() => {
            MatchupsView.loadData(true); // silent refresh
        }, 45000);
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

            // Build stats map by team and player_id
            const statsMap = {};
            (statsRes.data || []).forEach(s => {
                statsMap[s.player_id] = s;
            });
            MatchupsView.state.statsMap = statsMap;
            MatchupsView.state.allStats = statsRes.data || [];

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

    findQuarterbacksForTeam: (teamAbbr) => {
        const isTeamQBMode = MatchupsView.state.leagueScoringType === 'team_qb';
        const teamQBPid = `TEAM_${teamAbbr}_regular`;

        // If in Team QB mode, return the Team QB record
        if (isTeamQBMode) {
            const teamStat = MatchupsView.state.statsMap[teamQBPid];
            const ownership = MatchupsView.state.picksMap[teamQBPid] || null;
            
            // Also find actual passers for context
            const subPassers = MatchupsView.state.allStats.filter(s => {
                const pos = s.players?.position || '';
                const isQB = pos.includes('QB') || (s.attempts && s.attempts > 0);
                return s.players?.team === teamAbbr && isQB && s.player_id !== teamQBPid;
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

        // 1. Any QB from player_stats for this team
        MatchupsView.state.allStats.forEach(s => {
            const p = s.players;
            if (!p) return;
            const pos = p.position || '';
            const isQB = pos.includes('QB') || (s.attempts && s.attempts > 0);
            if (p.team === teamAbbr && isQB && p.position !== 'TM_QB') {
                seenPids.add(s.player_id);
                qbs.push({
                    id: s.player_id,
                    name: p.name,
                    team: p.team,
                    position: 'QB',
                    headshot: p.headshot_url,
                    stat: s,
                    projection: MatchupsView.state.projectionsMap[s.player_id] || null,
                    ownership: MatchupsView.state.picksMap[s.player_id] || null
                });
            }
        });

        // 2. Projected QBs for this team if not already included
        MatchupsView.state.allProjections.forEach(pr => {
            const p = pr.players;
            if (!p) return;
            const pos = p.position || '';
            const isQB = pos.includes('QB');
            if (p.team === teamAbbr && isQB && p.position !== 'TM_QB') {
                if (!seenPids.has(pr.player_id)) {
                    seenPids.add(pr.player_id);
                    qbs.push({
                        id: pr.player_id,
                        name: p.name,
                        team: p.team,
                        position: 'QB',
                        headshot: p.headshot_url,
                        stat: null,
                        projection: pr,
                        ownership: MatchupsView.state.picksMap[pr.player_id] || null
                    });
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
                            ${awayQBs.length > 0 ? awayQBs.map(qb => MatchupsView.renderQBCard(qb, isLive || isFinal)).join('') : `<div style="font-size: 0.75rem; color: var(--text-secondary); padding: 0.5rem;">No active QB projected</div>`}
                        </div>

                        <!-- Home QB Column -->
                        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                            <div style="font-size: 0.7rem; font-weight: 800; color: var(--accent-secondary); text-transform: uppercase;">
                                ${home.team?.abbreviation} Passer(s)
                            </div>
                            ${homeQBs.length > 0 ? homeQBs.map(qb => MatchupsView.renderQBCard(qb, isLive || isFinal)).join('') : `<div style="font-size: 0.75rem; color: var(--text-secondary); padding: 0.5rem;">No active QB projected</div>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderQBCard: (qb, hasActuals) => {
        const leagueId = MatchupsView.state.selectedLeagueId;
        const leagueSettings = MatchupsView.state.leagueSettings;

        // Calculate Fantasy Score
        let displayPoints = null;
        let isProjected = false;

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
            statsLine = `
                <div class="qb-stats-summary">
                    <strong>${s.completions || 0}/${s.attempts || 0}</strong> • <strong>${s.passing_yards || 0}</strong> yds • 
                    <span style="color: ${s.passing_tds > 0 ? '#10b981' : 'inherit'}">${s.passing_tds || 0} TD</span> • 
                    <span style="color: ${s.interceptions > 0 ? 'var(--accent-primary)' : 'inherit'}; font-weight: bold;">${s.interceptions || 0} INT</span> 
                    ${s.pick_sixes > 0 ? `• <span style="color: #f43f5e; font-weight: 900;">${s.pick_sixes} P6</span>` : ''} 
                    • ${s.sacks || 0} Sck
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
                    <span class="worst-qb-tag ${isProjected ? 'projected' : ''}">
                        ${displayPoints !== null ? `${isProjected ? 'Proj ' : ''}${displayPoints.toFixed(2)}` : '--'} pts
                    </span>
                </div>

                <!-- Actual or Projected Stat Summary -->
                ${statsLine}
            </div>
        `;
    }
};

window.MatchupsView = MatchupsView;

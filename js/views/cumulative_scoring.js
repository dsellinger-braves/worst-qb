import { supabase } from '../supabase.js';
import { calculateLeagueScoreBreakdown } from '../scoring.js?v=1.8';

export const CumulativeScoringView = {
    state: {
        selectedLeagueId: null,
        league: null,
        allLeagues: [],
        members: [],
        picks: [],
        statsMap: {},
        teamsSummary: [],
        activeMode: 'categories', // 'categories', 'weeks', 'players'
        weekMode: 'weekly', // 'weekly' or 'cumulative'
        sortCol: 'total_points',
        sortAsc: false,
        maxWeek: 1
    },

    render: () => `
        <div class="view-container active glass-panel" style="padding-bottom: 3rem;">
            <!-- Header Section -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <h1 style="margin: 0; font-size: 2rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
                        📊 <span style="background: linear-gradient(135deg, #ffffff 40%, var(--accent-primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Cumulative Season Scoring</span>
                    </h1>
                    <p style="color: var(--text-secondary); margin-top: 0.35rem; font-size: 0.95rem;">
                        Comprehensive cumulative scoring breakdown across all scoring categories and weeks by drafting team.
                    </p>
                </div>

                <!-- Controls Toolbar -->
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <label for="cs-league-select" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">League:</label>
                        <select id="cs-league-select" class="form-input" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; min-width: 180px;"></select>
                    </div>

                    <a id="cs-scoreboard-link" href="#/scoreboard" class="btn" style="background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); padding: 0.4rem 0.85rem; font-size: 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
                        ⚡ Live Scoreboard
                    </a>
                    <a id="cs-league-link" href="#/league_detail" class="btn" style="background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); padding: 0.4rem 0.85rem; font-size: 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
                        🏠 League Home
                    </a>
                </div>
            </div>

            <!-- Season Highlights Banner -->
            <div id="cs-highlights-banner" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;"></div>

            <!-- View Modes Sub-Tabs -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn cs-tab-btn active" data-mode="categories" style="padding: 0.45rem 1rem; font-size: 0.85rem; border-radius: 6px; font-weight: 600;">
                        📋 Scoring Category Breakdown
                    </button>
                    <button class="btn cs-tab-btn" data-mode="weeks" style="padding: 0.45rem 1rem; font-size: 0.85rem; border-radius: 6px; font-weight: 600; background: transparent; color: var(--text-secondary);">
                        📈 Week-by-Week Matrix
                    </button>
                    <button class="btn cs-tab-btn" data-mode="players" style="padding: 0.45rem 1rem; font-size: 0.85rem; border-radius: 6px; font-weight: 600; background: transparent; color: var(--text-secondary);">
                        🏈 Player Contributions
                    </button>
                </div>

                <div id="cs-sub-controls" style="display: flex; gap: 0.5rem; align-items: center;">
                    <!-- Injected for week matrix mode -->
                </div>
            </div>

            <!-- Main Content Container -->
            <div id="cs-table-container" style="overflow-x: auto;">
                <div class="loading-state" style="height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <div class="spinner"></div>
                    <p style="margin-top: 1rem; color: var(--text-secondary);">Loading cumulative scoring data...</p>
                </div>
            </div>
        </div>
    `,

    init: async (params = {}) => {
        window.CumulativeScoringView = CumulativeScoringView;
        const targetLeagueId = params.league || params.id || null;

        if (!supabase) return;

        // Fetch leagues
        const { data: leagues } = await supabase.from('leagues').select('id, name, current_week, scoring_settings').order('created_at', { ascending: false });
        CumulativeScoringView.state.allLeagues = leagues || [];

        if (!leagues || leagues.length === 0) {
            document.getElementById('cs-table-container').innerHTML = '<p style="text-align: center; padding: 2rem;">No leagues found.</p>';
            return;
        }

        const activeLeague = leagues.find(l => l.id === targetLeagueId) || leagues[0];
        CumulativeScoringView.state.selectedLeagueId = activeLeague.id;
        CumulativeScoringView.state.league = activeLeague;

        // Setup dropdown
        const selectEl = document.getElementById('cs-league-select');
        selectEl.innerHTML = leagues.map(l => `<option value="${l.id}" ${l.id === activeLeague.id ? 'selected' : ''}>${l.name}</option>`).join('');
        selectEl.onchange = (e) => {
            window.location.hash = `#/cumulative?league=${e.target.value}`;
        };

        // Update links
        const sbLink = document.getElementById('cs-scoreboard-link');
        const lgLink = document.getElementById('cs-league-link');
        if (sbLink) sbLink.href = `#/scoreboard?league=${activeLeague.id}`;
        if (lgLink) lgLink.href = `#/league_detail?league=${activeLeague.id}`;

        // Setup Mode Tabs
        document.querySelectorAll('.cs-tab-btn').forEach(btn => {
            btn.onclick = (e) => {
                const mode = e.currentTarget.getAttribute('data-mode');
                CumulativeScoringView.setMode(mode);
            };
        });

        await CumulativeScoringView.loadData();
    },

    setMode: (mode) => {
        CumulativeScoringView.state.activeMode = mode;
        document.querySelectorAll('.cs-tab-btn').forEach(btn => {
            if (btn.getAttribute('data-mode') === mode) {
                btn.classList.add('active');
                btn.style.background = 'var(--accent-primary)';
                btn.style.color = '#fff';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.color = 'var(--text-secondary)';
            }
        });
        CumulativeScoringView.renderActiveMode();
    },

    loadData: async () => {
        const leagueId = CumulativeScoringView.state.selectedLeagueId;
        const league = CumulativeScoringView.state.league;
        const settings = league.scoring_settings || {};

        // Fetch members
        const { data: members } = await supabase.from('league_members')
            .select('user_id, team_name, season_points, is_admin')
            .eq('league_id', leagueId);

        CumulativeScoringView.state.members = members || [];

        // Fetch all draft picks
        const { data: picks } = await supabase.from('draft_picks')
            .select('week, pick_number, user_id, player_id, players(id, name, team, position)')
            .eq('league_id', leagueId)
            .order('week', { ascending: true });

        CumulativeScoringView.state.picks = picks || [];

        // Fetch regular season stats
        const pickedPlayerIds = [...new Set((picks || []).map(p => p.player_id).filter(Boolean))];
        const statsMap = {};
        if (pickedPlayerIds.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < pickedPlayerIds.length; i += chunkSize) {
                const chunk = pickedPlayerIds.slice(i, i + chunkSize);
                const { data: stData } = await supabase.from('player_stats')
                    .select('*')
                    .in('player_id', chunk)
                    .eq('season_type', 'regular');
                if (stData) {
                    stData.forEach(s => { statsMap[`${s.player_id}_${s.week}`] = s; });
                }
            }
        }
        CumulativeScoringView.state.statsMap = statsMap;

        // Determine max week drafted
        const draftedWeeks = (picks || []).map(p => p.week).filter(Boolean);
        CumulativeScoringView.state.maxWeek = draftedWeeks.length > 0 ? Math.max(...draftedWeeks) : (league.current_week || 1);

        // Compute summary for every drafting team
        const teamsSummary = (members || []).map(m => {
            const theirPicks = (picks || []).filter(p => p.user_id === m.user_id);
            
            // Accumulator for category totals
            const totals = {
                attempts: 0,
                completions: 0,
                passing_yards: 0,
                passing_yards_pts: 0,
                passing_tds: 0,
                passing_tds_pts: 0,
                interceptions: 0,
                interceptions_pts: 0,
                pick_sixes: 0,
                pick_sixes_pts: 0,
                rushing_yards: 0,
                rushing_yards_pts: 0,
                rushing_tds: 0,
                rushing_tds_pts: 0,
                fumbles_lost: 0,
                fumbles_lost_pts: 0,
                sacks: 0,
                sacks_pts: 0,
                team_losses: 0,
                team_loss_pts: 0,
                comp_penalty_pts: 0,
                no_attempts_pts: 0,
                total_points: 0
            };

            const weeks = {};
            const playerMap = {};

            theirPicks.forEach(p => {
                const stat = statsMap[`${p.player_id}_${p.week}`];
                const b = calculateLeagueScoreBreakdown(stat, settings);
                
                // Add to category totals
                for (const key in totals) {
                    totals[key] += (b[key] || 0);
                }

                // Add to weekly total
                weeks[p.week] = (weeks[p.week] || 0) + b.total_points;

                // Add to player breakdown
                const pid = p.player_id;
                if (!playerMap[pid]) {
                    playerMap[pid] = {
                        player_id: pid,
                        player_name: p.players?.name || 'Unknown',
                        team: p.players?.team || '-',
                        starts: 0,
                        points: 0,
                        ints: 0,
                        sacks: 0,
                        pick_sixes: 0
                    };
                }
                playerMap[pid].starts++;
                playerMap[pid].points += b.total_points;
                playerMap[pid].ints += b.interceptions;
                playerMap[pid].sacks += b.sacks;
                playerMap[pid].pick_sixes += b.pick_sixes;
            });

            const weeksArray = Object.values(weeks);
            const avgPerWeek = weeksArray.length > 0 ? (totals.total_points / weeksArray.length) : 0;
            const maxWeekPts = weeksArray.length > 0 ? Math.max(...weeksArray) : 0;
            const minWeekPts = weeksArray.length > 0 ? Math.min(...weeksArray) : 0;

            return {
                user_id: m.user_id,
                team_name: m.team_name,
                is_admin: m.is_admin,
                totals,
                total_points: totals.total_points,
                weeks,
                avgPerWeek,
                maxWeekPts,
                minWeekPts,
                picksCount: theirPicks.length,
                playersList: Object.values(playerMap).sort((a, b) => b.points - a.points)
            };
        });

        // Default sort by total_points descending (highest fantasy disaster score is rank 1)
        teamsSummary.sort((a, b) => b.total_points - a.total_points);
        CumulativeScoringView.state.teamsSummary = teamsSummary;

        CumulativeScoringView.renderHighlights();
        CumulativeScoringView.renderActiveMode();
    },

    renderHighlights: () => {
        const { teamsSummary } = CumulativeScoringView.state;
        const banner = document.getElementById('cs-highlights-banner');
        if (!banner) return;

        if (teamsSummary.length === 0) {
            banner.innerHTML = '';
            return;
        }

        // 1. Leader (Highest fantasy points)
        const leader = teamsSummary[0];

        // 2. Most Sacks Taken
        const sackLeader = [...teamsSummary].sort((a, b) => b.totals.sacks - a.totals.sacks)[0];

        // 3. Most INTs Gifted
        const intLeader = [...teamsSummary].sort((a, b) => b.totals.interceptions - a.totals.interceptions)[0];

        // 4. Highest Single Week Score
        const maxSingleWeek = [...teamsSummary].sort((a, b) => b.maxWeekPts - a.maxWeekPts)[0];

        banner.innerHTML = `
            <div style="background: rgba(220, 38, 38, 0.12); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px; padding: 1rem 1.25rem;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-primary); font-weight: 700;">👑 Season Leader</span>
                <div style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-top: 0.25rem;">${leader.team_name}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${leader.total_points.toFixed(2)} total pts (${leader.avgPerWeek.toFixed(2)}/wk)</div>
            </div>

            <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 1rem 1.25rem;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #fbbf24; font-weight: 700;">🎯 Turnover Maestro</span>
                <div style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-top: 0.25rem;">${intLeader.team_name}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${intLeader.totals.interceptions} INTs (${intLeader.totals.interceptions_pts.toFixed(1)} pts) • ${intLeader.totals.pick_sixes} Pick-6s</div>
            </div>

            <div style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 1rem 1.25rem;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-secondary); font-weight: 700;">🛡️ Sack Magnet</span>
                <div style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-top: 0.25rem;">${sackLeader.team_name}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${sackLeader.totals.sacks} Sacks Taken (${sackLeader.totals.sacks_pts.toFixed(1)} pts)</div>
            </div>

            <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 1rem 1.25rem;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #10b981; font-weight: 700;">💥 Single-Week Explosion</span>
                <div style="font-size: 1.35rem; font-weight: 800; color: #fff; margin-top: 0.25rem;">${maxSingleWeek.team_name}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">${maxSingleWeek.maxWeekPts.toFixed(2)} pts in single best week</div>
            </div>
        `;
    },

    renderActiveMode: () => {
        const { activeMode } = CumulativeScoringView.state;
        const subControls = document.getElementById('cs-sub-controls');
        if (subControls) subControls.innerHTML = '';

        if (activeMode === 'categories') {
            CumulativeScoringView.renderCategoriesTable();
        } else if (activeMode === 'weeks') {
            CumulativeScoringView.renderWeeksTable();
        } else if (activeMode === 'players') {
            CumulativeScoringView.renderPlayersView();
        }
    },

    // Sort helper
    setSort: (col) => {
        if (CumulativeScoringView.state.sortCol === col) {
            CumulativeScoringView.state.sortAsc = !CumulativeScoringView.state.sortAsc;
        } else {
            CumulativeScoringView.state.sortCol = col;
            CumulativeScoringView.state.sortAsc = false;
        }
        CumulativeScoringView.renderActiveMode();
    },

    // Mode 1: Comprehensive Category Breakdown Table
    renderCategoriesTable: () => {
        const container = document.getElementById('cs-table-container');
        const { teamsSummary, sortCol, sortAsc } = CumulativeScoringView.state;

        if (teamsSummary.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">No drafted picks or teams found.</p>';
            return;
        }

        // Apply sorting
        const sorted = [...teamsSummary].sort((a, b) => {
            let valA, valB;
            if (colMap[sortCol]) {
                valA = colMap[sortCol](a);
                valB = colMap[sortCol](b);
            } else if (sortCol === 'team_name') {
                valA = a.team_name.toLowerCase();
                valB = b.team_name.toLowerCase();
                return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                valA = a.totals[sortCol] ?? a[sortCol] ?? 0;
                valB = b.totals[sortCol] ?? b[sortCol] ?? 0;
            }
            return sortAsc ? valA - valB : valB - valA;
        });

        const sortIndicator = (col) => {
            if (sortCol !== col) return '<span style="opacity: 0.3; font-size: 0.75rem;">↕</span>';
            return sortAsc ? ' ▲' : ' ▼';
        };

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; min-width: 950px; text-align: right; font-size: 0.85rem;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--glass-border); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: var(--text-secondary); background: rgba(0,0,0,0.3);">
                        <th style="padding: 0.85rem 0.75rem; text-align: left; cursor: pointer;" onclick="CumulativeScoringView.setSort('rank')">Rank</th>
                        <th style="padding: 0.85rem 0.75rem; text-align: left; cursor: pointer;" onclick="CumulativeScoringView.setSort('team_name')">Drafting Team ${sortIndicator('team_name')}</th>
                        <th style="padding: 0.85rem 0.75rem; color: var(--accent-primary); font-weight: 800; cursor: pointer;" onclick="CumulativeScoringView.setSort('total_points')">Total Season Pts ${sortIndicator('total_points')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('interceptions')">INTs (+5) ${sortIndicator('interceptions')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('pick_sixes')">Pick-6 (+10) ${sortIndicator('pick_sixes')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('sacks')">Sacks (+1) ${sortIndicator('sacks')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('fumbles_lost')">Fumbles (+4) ${sortIndicator('fumbles_lost')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('team_losses')">Losses (+5) ${sortIndicator('team_losses')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('comp_penalty_pts')">Comp% Pen ${sortIndicator('comp_penalty_pts')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('passing_yards')">Pass Yds (-0.05) ${sortIndicator('passing_yards')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('passing_tds')">Pass TDs (-5) ${sortIndicator('passing_tds')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('rushing_yards')">Rush Yds (-0.1) ${sortIndicator('rushing_yards')}</th>
                        <th style="padding: 0.85rem 0.5rem; cursor: pointer;" onclick="CumulativeScoringView.setSort('rushing_tds')">Rush TDs (-5) ${sortIndicator('rushing_tds')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map((t, idx) => {
                        const tot = t.totals;
                        return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 0.85rem 0.75rem; text-align: left; font-weight: 700; color: var(--text-secondary);">${idx + 1}</td>
                            <td style="padding: 0.85rem 0.75rem; text-align: left; font-weight: 700; color: #fff;">
                                <div>${t.team_name}</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: normal;">${t.picksCount} player starts</div>
                            </td>
                            <td style="padding: 0.85rem 0.75rem; color: var(--accent-primary); font-weight: 800; font-size: 1.15rem;">
                                ${t.total_points.toFixed(2)}
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <strong>${tot.interceptions}</strong>
                                <div style="font-size: 0.75rem; color: #10b981;">+${tot.interceptions_pts.toFixed(1)}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <strong>${tot.pick_sixes}</strong>
                                <div style="font-size: 0.75rem; color: #10b981;">+${tot.pick_sixes_pts.toFixed(1)}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <strong>${tot.sacks}</strong>
                                <div style="font-size: 0.75rem; color: #10b981;">+${tot.sacks_pts.toFixed(1)}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <strong>${tot.fumbles_lost}</strong>
                                <div style="font-size: 0.75rem; color: #10b981;">+${tot.fumbles_lost_pts.toFixed(1)}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <strong>${tot.team_losses}</strong>
                                <div style="font-size: 0.75rem; color: #10b981;">+${tot.team_loss_pts.toFixed(1)}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem; color: #10b981;">
                                +${tot.comp_penalty_pts.toFixed(1)}
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <span>${tot.passing_yards.toLocaleString()}</span>
                                <div style="font-size: 0.75rem; color: #f87171;">${tot.passing_yards_pts.toFixed(1)}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <span>${tot.passing_tds}</span>
                                <div style="font-size: 0.75rem; color: #f87171;">${tot.passing_tds_pts.toFixed(1)}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <span>${tot.rushing_yards}</span>
                                <div style="font-size: 0.75rem; color: #f87171;">${tot.rushing_yards_pts.toFixed(1)}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem;">
                                <span>${tot.rushing_tds}</span>
                                <div style="font-size: 0.75rem; color: #f87171;">${tot.rushing_tds_pts.toFixed(1)}</div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    // Mode 2: Week-by-Week Matrix
    renderWeeksTable: () => {
        const container = document.getElementById('cs-table-container');
        const subControls = document.getElementById('cs-sub-controls');
        const { teamsSummary, maxWeek, weekMode } = CumulativeScoringView.state;

        if (subControls) {
            subControls.innerHTML = `
                <div style="display: flex; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 0.2rem; border: 1px solid var(--glass-border);">
                    <button class="btn" onclick="CumulativeScoringView.setWeekMode('weekly')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; border-radius: 4px; ${weekMode === 'weekly' ? 'background: var(--accent-primary); color: #fff;' : 'background: transparent; color: var(--text-secondary);'} border: none;">
                        Weekly Pts
                    </button>
                    <button class="btn" onclick="CumulativeScoringView.setWeekMode('cumulative')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; border-radius: 4px; ${weekMode === 'cumulative' ? 'background: var(--accent-primary); color: #fff;' : 'background: transparent; color: var(--text-secondary);'} border: none;">
                        Running Total
                    </button>
                </div>
            `;
        }

        const sorted = [...teamsSummary].sort((a, b) => b.total_points - a.total_points);

        const weeksHeaders = [];
        for (let w = 1; w <= maxWeek; w++) {
            weeksHeaders.push(`<th style="padding: 0.75rem 0.5rem; text-align: right; min-width: 65px;">Wk ${w}</th>`);
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; min-width: 800px; text-align: right; font-size: 0.85rem;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--glass-border); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: var(--text-secondary); background: rgba(0,0,0,0.3);">
                        <th style="padding: 0.85rem 0.75rem; text-align: left;">Rank</th>
                        <th style="padding: 0.85rem 0.75rem; text-align: left;">Drafting Team</th>
                        <th style="padding: 0.85rem 0.75rem; color: var(--accent-primary); font-weight: 800;">Season Total</th>
                        <th style="padding: 0.85rem 0.5rem;">Avg/Wk</th>
                        ${weeksHeaders.join('')}
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map((t, idx) => {
                        let runningSum = 0;
                        const weekCells = [];
                        for (let w = 1; w <= maxWeek; w++) {
                            const wPts = t.weeks[w] || 0;
                            runningSum += wPts;
                            const displayVal = weekMode === 'cumulative' ? runningSum : wPts;
                            const color = wPts > 20 ? 'var(--accent-primary)' : (wPts < 0 ? '#f87171' : 'inherit');
                            weekCells.push(`
                                <td style="padding: 0.75rem 0.5rem; font-weight: 600; color: ${color};">
                                    ${displayVal !== 0 ? displayVal.toFixed(1) : '<span style="color: rgba(255,255,255,0.2);">-</span>'}
                                </td>
                            `);
                        }

                        return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 0.85rem 0.75rem; text-align: left; font-weight: 700; color: var(--text-secondary);">${idx + 1}</td>
                            <td style="padding: 0.85rem 0.75rem; text-align: left; font-weight: 700; color: #fff;">${t.team_name}</td>
                            <td style="padding: 0.85rem 0.75rem; color: var(--accent-primary); font-weight: 800; font-size: 1.1rem;">${t.total_points.toFixed(2)}</td>
                            <td style="padding: 0.85rem 0.5rem; font-weight: 600; color: var(--accent-secondary);">${t.avgPerWeek.toFixed(2)}</td>
                            ${weekCells.join('')}
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    setWeekMode: (mode) => {
        CumulativeScoringView.state.weekMode = mode;
        CumulativeScoringView.renderWeeksTable();
    },

    // Mode 3: Player Contributions by Drafting Team
    renderPlayersView: () => {
        const container = document.getElementById('cs-table-container');
        const { teamsSummary } = CumulativeScoringView.state;

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                ${teamsSummary.map((t, idx) => `
                    <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--glass-border); border-radius: 8px; padding: 1.25rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.75rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 1.2rem; font-weight: 800; color: var(--accent-primary);">#${idx + 1}</span>
                                <span style="font-size: 1.25rem; font-weight: 700; color: #fff;">${t.team_name}</span>
                            </div>
                            <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-primary);">
                                ${t.total_points.toFixed(2)} Season Pts
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem;">
                            ${t.playersList.map(p => `
                                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 6px; padding: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <a href="#/player_profile?id=${p.player_id}&league=${CumulativeScoringView.state.selectedLeagueId}" style="color: #fff; font-weight: 700; text-decoration: none;">
                                            ${p.player_name}
                                        </a>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">
                                            ${p.team} • ${p.starts} game${p.starts > 1 ? 's' : ''} started
                                        </div>
                                        <div style="font-size: 0.75rem; color: var(--accent-secondary); margin-top: 0.15rem;">
                                            ${p.ints} INTs • ${p.sacks} Sacks
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <span style="font-weight: 800; font-size: 1.05rem; color: ${p.points >= 0 ? 'var(--accent-primary)' : '#f87171'};">
                                            ${p.points.toFixed(2)}
                                        </span>
                                        <div style="font-size: 0.7rem; color: var(--text-secondary);">pts</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

const colMap = {
    rank: (t) => t.total_points,
    total_points: (t) => t.total_points,
    interceptions: (t) => t.totals.interceptions,
    pick_sixes: (t) => t.totals.pick_sixes,
    sacks: (t) => t.totals.sacks,
    fumbles_lost: (t) => t.totals.fumbles_lost,
    team_losses: (t) => t.totals.team_losses,
    comp_penalty_pts: (t) => t.totals.comp_penalty_pts,
    passing_yards: (t) => t.totals.passing_yards,
    passing_tds: (t) => t.totals.passing_tds,
    rushing_yards: (t) => t.totals.rushing_yards,
    rushing_tds: (t) => t.totals.rushing_tds
};

window.CumulativeScoringView = CumulativeScoringView;

import { supabase } from '../supabase.js';
import { calculateLeagueScore } from '../scoring.js';

export const LeagueDetailView = {
    render: () => `
        <div class="view-container active glass-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h1 id="ld-title">Loading League...</h1>
                    <p id="ld-status" style="color: var(--text-secondary);"></p>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button id="ld-settings-btn" class="btn" style="display: none;">League Settings</button>
                    <button id="ld-draft-btn" class="btn btn-primary" style="display: none;">Enter Draft Room</button>
                </div>
            </div>
            
            <!-- Tabs -->
            <div class="tabs" style="display: flex; gap: 1rem; border-bottom: 1px solid var(--glass-border); margin-bottom: 2rem; overflow-x: auto;">
                <button class="tab-btn active" data-tab="standings" style="background: none; border: none; color: var(--text-primary); padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid var(--accent-primary); font-weight: bold;">Season Standings</button>
                <button class="tab-btn" data-tab="weekly" style="background: none; border: none; color: var(--text-secondary); padding: 0.5rem 1rem; cursor: pointer; font-weight: bold;">Weekly Performance</button>
                <button class="tab-btn" data-tab="team" style="background: none; border: none; color: var(--text-secondary); padding: 0.5rem 1rem; cursor: pointer; font-weight: bold;">Team Performance</button>
            </div>
            
            <!-- Tab Content: Standings -->
            <div id="tab-standings" class="tab-content" style="display: block;">
                <h2>Teams & Standings</h2>
                <div id="ld-teams" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                    Loading teams...
                </div>
            </div>
            
            <!-- Tab Content: Weekly -->
            <div id="tab-weekly" class="tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                    <h2>Weekly Dashboard</h2>
                    <div>
                        <label for="ld-week-select" style="font-weight: bold;">Select Week: </label>
                        <select id="ld-week-select" style="background: rgba(0,0,0,0.5); color: var(--text-primary); border: 1px solid var(--glass-border); padding: 0.5rem; border-radius: 4px; min-width: 100px;">
                            <option value="">Loading...</option>
                        </select>
                    </div>
                </div>
                <div id="ld-weekly-content" style="overflow-x: auto;"></div>
            </div>
            
            <!-- Tab Content: Team -->
            <div id="tab-team" class="tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                    <h2>Team Dashboard</h2>
                    <div>
                        <label for="ld-team-select" style="font-weight: bold;">Select Team: </label>
                        <select id="ld-team-select" style="background: rgba(0,0,0,0.5); color: var(--text-primary); border: 1px solid var(--glass-border); padding: 0.5rem; border-radius: 4px; min-width: 200px;">
                            <option value="">Loading...</option>
                        </select>
                    </div>
                </div>
                <div id="ld-team-content" style="overflow-x: auto;"></div>
            </div>
            
            <!-- Settings Modal -->
            <div id="ld-settings-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center; padding: 1rem;">
                <div class="glass-panel" style="max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h2>League Scoring Settings</h2>
                        <button id="ld-settings-close" class="btn" style="padding: 0.2rem 0.5rem;">✕</button>
                    </div>
                    <form id="ld-settings-form">
                        <div style="margin-bottom: 2rem;">
                            <h3 style="margin-top: 1rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Passing</h3>
                            <div class="setting-row">
                                <label>Pass Yds</label>
                                <input type="number" step="0.01" id="s-pass-yds" class="form-input" style="width: 100px; text-align: right;">
                            </div>
                            <div class="setting-row">
                                <label>Pass TDs</label>
                                <input type="number" step="0.1" id="s-pass-tds" class="form-input" style="width: 100px; text-align: right;">
                            </div>
                            <div class="setting-row">
                                <label>Interceptions</label>
                                <input type="number" step="0.1" id="s-ints" class="form-input" style="width: 100px; text-align: right;">
                            </div>
                            <div class="setting-row">
                                <label>Pick Sixes</label>
                                <input type="number" step="0.1" id="s-pick-sixes" class="form-input" style="width: 100px; text-align: right;">
                            </div>
                            <div class="setting-row">
                                <label>Completion % Penalty Multiplier</label>
                                <input type="number" step="0.1" id="s-comp-mult" class="form-input" style="width: 100px; text-align: right;">
                            </div>

                            <h3 style="margin-top: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Rushing & Sacks</h3>
                            <div class="setting-row">
                                <label>Rush Yds</label>
                                <input type="number" step="0.01" id="s-rush-yds" class="form-input" style="width: 100px; text-align: right;">
                            </div>
                            <div class="setting-row">
                                <label>Rush TDs</label>
                                <input type="number" step="0.1" id="s-rush-tds" class="form-input" style="width: 100px; text-align: right;">
                            </div>
                            <div class="setting-row">
                                <label>Fumbles Lost</label>
                                <input type="number" step="0.1" id="s-fumbles" class="form-input" style="width: 100px; text-align: right;">
                            </div>
                            <div class="setting-row">
                                <label>Sacks Taken</label>
                                <input type="number" step="0.1" id="s-sacks" class="form-input" style="width: 100px; text-align: right;">
                            </div>

                            <h3 style="margin-top: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Custom Rules</h3>
                            <div class="setting-row">
                                <label>Team Loss Bonus</label>
                                <input type="number" step="0.1" id="s-team-loss" class="form-input" style="width: 100px; text-align: right;">
                            </div>
                            <div class="setting-row">
                                <label>Golden Penalty (No Pass Attempts)</label>
                                <input type="number" step="0.1" id="s-no-att" class="form-input" style="width: 100px; text-align: right;">
                            </div>

                            <h3 style="margin-top: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Draft Order Override (Week <span id="s-draft-order-week"></span>)</h3>
                            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Drag and drop to manually set the draft order for the current active week. Leave default to use standings.</p>
                            <ul id="s-draft-order-list" style="list-style: none; padding: 0; margin-bottom: 2rem; display: flex; flex-direction: column; gap: 0.5rem;">
                                <!-- Draggable items injected here -->
                            </ul>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Save Settings & Order</button>
                    </form>
                </div>
            </div>
            
        </div>
    `,
    init: async (params) => {
        if (!supabase || !params || !params.id) return;
        const leagueId = params.id;
        
        // --- State Variables ---
        LeagueDetailView.leagueId = leagueId;
        LeagueDetailView.teams = [];
        LeagueDetailView.picksByWeek = {};
        LeagueDetailView.picksByTeam = {};
        LeagueDetailView.maxWeek = 1;

        // Fetch League info
        const { data: league, error: lErr } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
        if (lErr) return document.getElementById('ld-title').innerText = "Error loading league";
        
        document.getElementById('ld-title').innerText = league.name;
        document.getElementById('ld-status').innerText = `Week ${league.current_week} | Draft Status: ${league.draft_status}`;
        LeagueDetailView.maxWeek = league.current_week > 18 ? 18 : league.current_week;
        
        // Show Draft Button and route it via hash
        const draftBtn = document.getElementById('ld-draft-btn');
        draftBtn.style.display = 'block';
        draftBtn.addEventListener('click', () => {
            window.location.hash = '#/draft';
        });

        // Fetch Teams and check admin status
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session ? session.user.id : null;
        let isAdmin = false;

        const { data: teams, error: tErr } = await supabase.from('league_members')
            .select('user_id, team_name, season_points, is_admin')
            .eq('league_id', leagueId);
        if (teams) {
            LeagueDetailView.teams = teams;
            // Check if current user is admin
            const myMember = teams.find(t => t.user_id === currentUserId);
            if (myMember && myMember.is_admin) isAdmin = true;
        }

        // Setup Admin Settings UI
        if (isAdmin) {
            const settingsBtn = document.getElementById('ld-settings-btn');
            settingsBtn.style.display = 'block';
            LeagueDetailView.setupAdminSettings(league);
        }

        // Fetch Draft Picks
        const { data: picks, error: pErr } = await supabase.from('draft_picks')
            .select('week, pick_number, user_id, player_id, players(name, id)')
            .eq('league_id', leagueId)
            .order('week', { ascending: true });
            
        if (pErr) console.error("Error fetching picks:", pErr);
            
        // Fetch ALL Player Stats to calculate dynamic points
        const { data: statsData } = await supabase.from('player_stats')
            .select('*');
            
        const statsMap = {}; // key: "player_id_week" -> stats object
        if (statsData) {
            statsData.forEach(s => {
                statsMap[`${s.player_id}_${s.week}`] = s;
            });
        }
        
        if (picks && picks.length > 0) {
            // Reset dynamic season points for recalculation
            LeagueDetailView.teams.forEach(t => t.season_points = 0);

            // Create a lookup map for team names based on user_id
            const teamMap = {};
            if (LeagueDetailView.teams) {
                LeagueDetailView.teams.forEach(t => {
                    teamMap[t.user_id] = t.team_name;
                });
            }

            // Group picks by week
            LeagueDetailView.picksByWeek = picks.reduce((acc, pick) => {
                acc[pick.week] = acc[pick.week] || [];
                // Attach dynamic points using league settings
                const stats = statsMap[`${pick.player_id}_${pick.week}`];
                pick.points = calculateLeagueScore(stats, league.scoring_settings);
                pick.team_name = teamMap[pick.user_id] || 'Unknown Team';
                acc[pick.week].push(pick);
                return acc;
            }, {});
            
            // Group picks by team and update dynamic standings
            LeagueDetailView.picksByTeam = picks.reduce((acc, pick) => {
                acc[pick.user_id] = acc[pick.user_id] || { team_name: pick.team_name, weeks: {} };
                acc[pick.user_id].weeks[pick.week] = acc[pick.user_id].weeks[pick.week] || [];
                acc[pick.user_id].weeks[pick.week].push(pick);
                
                // Add to dynamic team standings
                const teamObj = LeagueDetailView.teams.find(t => t.user_id === pick.user_id);
                if (teamObj) {
                    teamObj.season_points += pick.points;
                }
                
                return acc;
            }, {});
            
            // Re-sort teams based on newly calculated dynamic points
            LeagueDetailView.teams.sort((a, b) => b.season_points - a.season_points);
            
            // Update max week based on picks
            const draftedWeeks = Object.keys(LeagueDetailView.picksByWeek).map(Number);
            if (draftedWeeks.length > 0) {
                LeagueDetailView.maxWeek = Math.max(...draftedWeeks);
            }
        }

        // Setup Event Listeners
        LeagueDetailView.setupTabs();
        LeagueDetailView.setupSelectors();

        // Initial Renders
        LeagueDetailView.renderStandings();
        LeagueDetailView.renderWeeklyView(LeagueDetailView.maxWeek);
        if (LeagueDetailView.teams.length > 0) {
            LeagueDetailView.renderTeamView(LeagueDetailView.teams[0].user_id);
        }
    },
    setupAdminSettings: (league) => {
        const modal = document.getElementById('ld-settings-modal');
        document.getElementById('ld-settings-btn').onclick = () => {
            const s = league.scoring_settings || {};
            document.getElementById('s-pass-yds').value = s.pass_yds ?? -0.05;
            document.getElementById('s-pass-tds').value = s.pass_tds ?? -5.0;
            document.getElementById('s-ints').value = s.ints ?? 3.0;
            document.getElementById('s-pick-sixes').value = s.pick_sixes ?? 5.0;
            document.getElementById('s-rush-yds').value = s.rush_yds ?? -0.1;
            document.getElementById('s-rush-tds').value = s.rush_tds ?? -5.0;
            document.getElementById('s-fumbles').value = s.fumbles_lost ?? 3.0;
            document.getElementById('s-sacks').value = s.sacks ?? 1.0;
            document.getElementById('s-team-loss').value = s.team_loss ?? 5.0;
            document.getElementById('s-no-att').value = s.no_attempts ?? -20.0;
            document.getElementById('s-comp-mult').value = s.completion_penalty_multiplier ?? 20.0;
            
            // Draft Order
            document.getElementById('s-draft-order-week').innerText = league.current_week;
            const draftList = document.getElementById('s-draft-order-list');
            const existingOverrides = s.draft_order_overrides || {};
            const currentOverride = existingOverrides[league.current_week];
            
            let orderedTeams = [...LeagueDetailView.teams];
            if (currentOverride) {
                orderedTeams.sort((a, b) => {
                    const idxA = currentOverride.indexOf(a.user_id);
                    const idxB = currentOverride.indexOf(b.user_id);
                    if (idxA === -1 && idxB === -1) return 0;
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            } else {
                orderedTeams.sort((a, b) => a.season_points - b.season_points);
            }
            
            draftList.innerHTML = orderedTeams.map((t, i) => `
                <li class="draft-order-item" draggable="true" data-userid="${t.user_id}" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 4px; display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none;">
                    <span><span class="order-num" style="color: var(--text-secondary); margin-right: 0.5rem;">${i + 1}.</span> ${t.team_name}</span>
                    <span style="color: var(--text-secondary);">☰</span>
                </li>
            `).join('');

            // Drag and Drop Logic
            let draggedItem = null;
            draftList.querySelectorAll('.draft-order-item').forEach(item => {
                item.addEventListener('dragstart', () => {
                    draggedItem = item;
                    setTimeout(() => item.style.opacity = '0.5', 0);
                });
                item.addEventListener('dragend', () => {
                    setTimeout(() => {
                        draggedItem.style.opacity = '1';
                        draggedItem = null;
                        draftList.querySelectorAll('.draft-order-item').forEach((li, idx) => {
                            li.querySelector('.order-num').innerText = `${idx + 1}.`;
                        });
                    }, 0);
                });
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const afterElement = [...draftList.querySelectorAll('.draft-order-item:not(.dragging)')].find(child => {
                        return e.clientY <= child.getBoundingClientRect().top + child.offsetHeight / 2;
                    });
                    if (afterElement == null) {
                        draftList.appendChild(draggedItem);
                    } else {
                        draftList.insertBefore(draggedItem, afterElement);
                    }
                });
            });

            modal.style.display = 'flex';
        };
        
        document.getElementById('ld-settings-close').onclick = () => modal.style.display = 'none';
        
        document.getElementById('ld-settings-form').onsubmit = async (e) => {
            e.preventDefault();
            
            const newOverrides = {};
            const draftList = document.getElementById('s-draft-order-list');
            draftList.querySelectorAll('.draft-order-item').forEach(item => {
                const uid = item.getAttribute('data-userid');
                if (!newOverrides[league.current_week]) newOverrides[league.current_week] = [];
                newOverrides[league.current_week].push(uid);
            });
            
            const existingOverrides = league.scoring_settings?.draft_order_overrides || {};
            
            const newSettings = {
                pass_yds: parseFloat(document.getElementById('s-pass-yds').value),
                pass_tds: parseFloat(document.getElementById('s-pass-tds').value),
                ints: parseFloat(document.getElementById('s-ints').value),
                pick_sixes: parseFloat(document.getElementById('s-pick-sixes').value),
                rush_yds: parseFloat(document.getElementById('s-rush-yds').value),
                rush_tds: parseFloat(document.getElementById('s-rush-tds').value),
                fumbles_lost: parseFloat(document.getElementById('s-fumbles').value),
                sacks: parseFloat(document.getElementById('s-sacks').value),
                team_loss: parseFloat(document.getElementById('s-team-loss').value),
                no_attempts: parseFloat(document.getElementById('s-no-att').value),
                completion_penalty_multiplier: parseFloat(document.getElementById('s-comp-mult').value),
                draft_order_overrides: {
                    ...existingOverrides,
                    ...newOverrides
                }
            };
            
            const { error } = await supabase.from('leagues').update({ scoring_settings: newSettings }).eq('id', league.id);
            if (error) {
                alert("Error saving settings.");
            } else {
                modal.style.display = 'none';
                LeagueDetailView.init({ id: league.id }); // Reload to recalculate
            }
        };
    },

    setupTabs: () => {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update button styles
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.color = 'var(--text-secondary)';
                    b.style.borderBottom = 'none';
                });
                e.target.classList.add('active');
                e.target.style.color = 'var(--text-primary)';
                e.target.style.borderBottom = '2px solid var(--accent-primary)';
                
                // Show content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = 'none';
                });
                const targetId = `tab-${e.target.getAttribute('data-tab')}`;
                document.getElementById(targetId).style.display = 'block';
            });
        });
    },
    
    setupSelectors: () => {
        // Week Selector
        const weekSelect = document.getElementById('ld-week-select');
        let weekOptions = '';
        for (let w = 1; w <= 18; w++) {
            const hasData = LeagueDetailView.picksByWeek[w] ? '' : ' (No Picks)';
            weekOptions += `<option value="${w}" ${w === LeagueDetailView.maxWeek ? 'selected' : ''}>Week ${w}${hasData}</option>`;
        }
        weekSelect.innerHTML = weekOptions;
        weekSelect.addEventListener('change', (e) => {
            LeagueDetailView.renderWeeklyView(parseInt(e.target.value));
        });
        
        // Team Selector
        const teamSelect = document.getElementById('ld-team-select');
        let teamOptions = '';
        LeagueDetailView.teams.forEach(t => {
            teamOptions += `<option value="${t.user_id}">${t.team_name}</option>`;
        });
        teamSelect.innerHTML = teamOptions;
        teamSelect.addEventListener('change', (e) => {
            LeagueDetailView.renderTeamView(e.target.value);
        });
    },
    
    renderStandings: () => {
        const teamsContainer = document.getElementById('ld-teams');
        if (LeagueDetailView.teams.length === 0) {
            teamsContainer.innerHTML = '<p>No teams in this league yet.</p>';
            return;
        }
        teamsContainer.innerHTML = LeagueDetailView.teams.map((t, idx) => `
            <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 1.2rem;"><strong>${idx + 1}. ${t.team_name}</strong></div>
                <div style="color: var(--accent-primary); font-weight: bold; font-size: 1.5rem;">${t.season_points.toFixed(2)} pts</div>
            </div>
        `).join('');
    },
    
    renderWeeklyView: (week) => {
        const container = document.getElementById('ld-weekly-content');
        const picks = LeagueDetailView.picksByWeek[week];
        
        if (!picks || picks.length === 0) {
            container.innerHTML = `<div style="padding: 2rem; text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px;">No draft picks recorded for Week ${week}.</div>`;
            return;
        }
        
        // Group by team
        const teamsData = {};
        picks.forEach(p => {
            if (!teamsData[p.user_id]) {
                teamsData[p.user_id] = { team_name: p.team_name, picks: [], totalPoints: 0 };
            }
            teamsData[p.user_id].picks.push(p);
            teamsData[p.user_id].totalPoints += p.points;
        });
        
        // Sort teams by weekly points (descending)
        const sortedTeams = Object.values(teamsData).sort((a, b) => b.totalPoints - a.totalPoints);
        
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                <tr style="border-bottom: 2px solid var(--glass-border); text-align: left;">
                    <th style="padding: 1rem 0.5rem;">Rank</th>
                    <th style="padding: 1rem 0.5rem;">Team</th>
                    <th style="padding: 1rem 0.5rem;">Pick 1</th>
                    <th style="padding: 1rem 0.5rem;">Pick 2</th>
                    <th style="padding: 1rem 0.5rem; color: var(--accent-primary);">Weekly Total</th>
                </tr>
                ${sortedTeams.map((t, idx) => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 1rem 0.5rem; font-weight: bold;">${idx + 1}</td>
                        <td style="padding: 1rem 0.5rem;">${t.team_name}</td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#/player_profile?id=${t.picks[0]?.players?.id}&league=${LeagueDetailView.leagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${t.picks[0]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${t.picks[0] ? t.picks[0].points.toFixed(2) : '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#/player_profile?id=${t.picks[1]?.players?.id}&league=${LeagueDetailView.leagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${t.picks[1]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${t.picks[1] ? t.picks[1].points.toFixed(2) : '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold; font-size: 1.1rem;">${t.totalPoints.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    },
    
    renderTeamView: (userId) => {
        const container = document.getElementById('ld-team-content');
        const teamData = LeagueDetailView.picksByTeam[userId];
        
        if (!teamData) {
            container.innerHTML = `<div style="padding: 2rem; text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px;">No draft history found for this team.</div>`;
            return;
        }
        
        const weeks = Object.keys(teamData.weeks).map(Number).sort((a, b) => a - b);
        let cumulativePoints = 0;
        
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                <tr style="border-bottom: 2px solid var(--glass-border); text-align: left;">
                    <th style="padding: 1rem 0.5rem;">Week</th>
                    <th style="padding: 1rem 0.5rem;">Pick 1</th>
                    <th style="padding: 1rem 0.5rem;">Pick 2</th>
                    <th style="padding: 1rem 0.5rem; color: var(--accent-primary);">Weekly Pts</th>
                    <th style="padding: 1rem 0.5rem;">Season Pts</th>
                </tr>
                ${weeks.map(w => {
                    const picks = teamData.weeks[w];
                    const wPts = picks.reduce((sum, p) => sum + p.points, 0);
                    cumulativePoints += wPts;
                    return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 1rem 0.5rem; font-weight: bold;">Week ${w}</td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#/player_profile?id=${picks[0]?.players?.id}&league=${LeagueDetailView.leagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${picks[0]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${picks[0] ? picks[0].points.toFixed(2) : '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#/player_profile?id=${picks[1]?.players?.id}&league=${LeagueDetailView.leagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${picks[1]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${picks[1] ? picks[1].points.toFixed(2) : '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold; font-size: 1.1rem;">${wPts.toFixed(2)}</td>
                        <td style="padding: 1rem 0.5rem; font-weight: bold;">${cumulativePoints.toFixed(2)}</td>
                    </tr>
                    `;
                }).join('')}
            </table>
        `;
    }
};

import { supabase } from '../supabase.js';

export const LeagueDetailView = {
    render: () => `
        <div class="view-container active glass-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h1 id="ld-title">Loading League...</h1>
                    <p id="ld-status" style="color: var(--text-secondary);"></p>
                </div>
                <button id="ld-draft-btn" class="btn btn-primary" style="display: none;">Enter Draft Room</button>
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
        
        // Show Draft Button and route it to draft
        const draftBtn = document.getElementById('ld-draft-btn');
        draftBtn.style.display = 'block';
        draftBtn.addEventListener('click', () => {
            const event = new MouseEvent('click', { bubbles: true, cancelable: true });
            const link = document.createElement('a');
            link.href = "#";
            link.className = 'nav-link';
            link.setAttribute('data-route', 'draft');
            document.body.appendChild(link);
            link.dispatchEvent(event);
            link.remove();
        });

        // Fetch Teams
        const { data: teams, error: tErr } = await supabase.from('league_members')
            .select('user_id, team_name, season_points')
            .eq('league_id', leagueId)
            .order('season_points', { ascending: false });
        if (teams) LeagueDetailView.teams = teams;

        // Fetch Draft Picks
        const { data: picks, error: pErr } = await supabase.from('draft_picks')
            .select('week, pick_number, user_id, player_id, players(name, id), league_members!inner(team_name)')
            .eq('league_id', leagueId)
            .eq('league_members.league_id', leagueId)
            .order('week', { ascending: true });
            
        // Fetch Player Stats to attach points to picks
        const { data: statsData } = await supabase.from('player_stats')
            .select('player_id, week, custom_points');
            
        const statsMap = {}; // key: "player_id_week" -> custom_points
        if (statsData) {
            statsData.forEach(s => {
                statsMap[`${s.player_id}_${s.week}`] = s.custom_points;
            });
        }
        
        if (picks && picks.length > 0) {
            // Group picks by week
            LeagueDetailView.picksByWeek = picks.reduce((acc, pick) => {
                acc[pick.week] = acc[pick.week] || [];
                // Attach points
                pick.points = statsMap[`${pick.player_id}_${pick.week}`] || 0;
                acc[pick.week].push(pick);
                return acc;
            }, {});
            
            // Group picks by team (user_id)
            LeagueDetailView.picksByTeam = picks.reduce((acc, pick) => {
                acc[pick.user_id] = acc[pick.user_id] || { team_name: pick.league_members.team_name, weeks: {} };
                acc[pick.user_id].weeks[pick.week] = acc[pick.user_id].weeks[pick.week] || [];
                acc[pick.user_id].weeks[pick.week].push(pick);
                return acc;
            }, {});
            
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
                teamsData[p.user_id] = { team_name: p.league_members.team_name, picks: [], totalPoints: 0 };
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
                            <a href="#" data-route="player_profile" data-id="${t.picks[0]?.players?.id}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${t.picks[0]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${t.picks[0]?.points.toFixed(2) || '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#" data-route="player_profile" data-id="${t.picks[1]?.players?.id}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${t.picks[1]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${t.picks[1]?.points.toFixed(2) || '0.00'} pts</span>
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
                            <a href="#" data-route="player_profile" data-id="${picks[0]?.players?.id}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${picks[0]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${picks[0]?.points.toFixed(2) || '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#" data-route="player_profile" data-id="${picks[1]?.players?.id}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${picks[1]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${picks[1]?.points.toFixed(2) || '0.00'} pts</span>
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

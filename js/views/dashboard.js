import { supabase } from '../supabase.js';
import { calculateLeagueScore } from '../scoring.js';

export const DashboardView = {
    render: () => `
        <div class="view-container active glass-panel">
            <h1>Your Dashboard</h1>
            <div id="user-info">
                <p>Loading user info...</p>
            </div>
            
            <div style="margin-top: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                    <h2 style="margin: 0;">Your Leagues</h2>
                    <a href="#/leagues" class="btn btn-primary" style="text-decoration: none; font-size: 0.9rem;">+ Join or Create League</a>
                </div>
                <div id="user-leagues-list" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                    <!-- Populated dynamically -->
                </div>
            </div>
        </div>
    `,
    init: async () => {
        const userInfoEl = document.getElementById('user-info');
        if (!supabase) {
            userInfoEl.innerHTML = '<p style="color: var(--accent-primary)">Supabase not configured! Please add URL and Key in js/supabase.js</p>';
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            userInfoEl.innerHTML = `<p>Welcome, ${session.user.email}!</p>`;
            // Fetch leagues
            const { data, error } = await supabase
                .from('league_members')
                .select('league_id, leagues(id, name, current_week, scoring_settings), season_points, team_name')
                .eq('user_id', session.user.id);
                
            if (data && data.length > 0) {
                // Fetch user's draft picks across all their leagues to compute live season points
                const { data: userPicks } = await supabase
                    .from('draft_picks')
                    .select('league_id, week, player_id')
                    .eq('user_id', session.user.id);

                const pickedPlayerIds = [...new Set((userPicks || []).map(p => p.player_id).filter(Boolean))];
                const statsMap = {};
                if (pickedPlayerIds.length > 0) {
                    const chunkSize = 200;
                    for (let i = 0; i < pickedPlayerIds.length; i += chunkSize) {
                        const chunk = pickedPlayerIds.slice(i, i + chunkSize);
                        const { data: statsData } = await supabase.from('player_stats')
                            .select('*')
                            .in('player_id', chunk)
                            .eq('season_type', 'regular');
                        if (statsData) {
                            statsData.forEach(s => {
                                statsMap[`${s.player_id}_${s.week}`] = s;
                            });
                        }
                    }
                }

                // Calculate live season points for each league
                const livePointsByLeague = {};
                (userPicks || []).forEach(p => {
                    const leagueObj = data.find(m => m.league_id === p.league_id)?.leagues;
                    const st = statsMap[`${p.player_id}_${p.week}`];
                    const pts = calculateLeagueScore(st, leagueObj?.scoring_settings);
                    livePointsByLeague[p.league_id] = (livePointsByLeague[p.league_id] || 0) + pts;
                });

                document.getElementById('user-leagues-list').innerHTML = data.map(m => {
                    const livePts = livePointsByLeague[m.league_id] !== undefined 
                        ? livePointsByLeague[m.league_id] 
                        : (m.season_points || 0);

                    return `
                    <a href="#/league_detail?league=${m.league_id}" style="text-decoration: none; color: inherit; display: block;">
                        <div style="background: rgba(0,0,0,0.4); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--glass-border); transition: all 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.6)'; this.style.borderColor='var(--accent-primary)';" onmouseout="this.style.background='rgba(0,0,0,0.4)'; this.style.borderColor='var(--glass-border)';">
                            <h3 style="margin-bottom: 0.5rem; color: var(--accent-primary); font-size: 1.5rem;">${m.leagues?.name || 'League'}</h3>
                            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">Week ${m.leagues?.current_week || 1}</p>
                            <div style="display: flex; gap: 2rem;">
                                <span><strong>Team:</strong> ${m.team_name}</span>
                                <span><strong>Season Points:</strong> ${livePts.toFixed(2)}</span>
                            </div>
                        </div>
                    </a>
                `;}).join('');
            } else {
                document.getElementById('user-leagues-list').innerHTML = `
                    <p style="color: var(--text-secondary);">You are not in any leagues yet.</p>
                    <div><a href="#/leagues" class="btn btn-primary" style="text-decoration: none;">Browse or Create a League</a></div>
                `;
            }
        } else {
            userInfoEl.innerHTML = '<p>Please login to view your dashboard.</p>';
        }
    }
};

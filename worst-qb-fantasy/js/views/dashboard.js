import { supabase } from '../supabase.js';

export const DashboardView = {
    render: () => `
        <div class="view-container active glass-panel">
            <h1>Your Dashboard</h1>
            <div id="user-info">
                <p>Loading user info...</p>
            </div>
            
            <div style="margin-top: 2rem;">
                <h2>Your Leagues</h2>
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
                .select('leagues(name, current_week), season_points, team_name')
                .eq('user_id', session.user.id);
                
            if (data && data.length > 0) {
                document.getElementById('user-leagues-list').innerHTML = data.map(m => `
                    <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                        <h3>${m.leagues.name} (Week ${m.leagues.current_week})</h3>
                        <p>Team: ${m.team_name} | Season Points: ${m.season_points}</p>
                    </div>
                `).join('');
            } else {
                document.getElementById('user-leagues-list').innerHTML = '<p>You are not in any leagues yet.</p>';
            }
        } else {
            userInfoEl.innerHTML = '<p>Please login to view your dashboard.</p>';
        }
    }
};

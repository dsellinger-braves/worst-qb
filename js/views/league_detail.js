import { supabase } from '../supabase.js';

export const LeagueDetailView = {
    render: () => `
        <div class="view-container active glass-panel">
            <h1 id="ld-title">Loading League...</h1>
            <p id="ld-status" style="color: var(--text-secondary);"></p>
            
            <div style="margin-top: 2rem;">
                <h2>Teams & Standings</h2>
                <div id="ld-teams" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                    Loading teams...
                </div>
            </div>
            
            <div style="margin-top: 3rem;">
                <h2>Weekly Draft History</h2>
                <div id="ld-history" style="margin-top: 1rem;">
                    Loading draft history...
                </div>
            </div>
        </div>
    `,
    init: async (params) => {
        if (!supabase || !params || !params.id) return;
        const leagueId = params.id;

        // Fetch League info
        const { data: league, error: lErr } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
        if (lErr) return document.getElementById('ld-title').innerText = "Error loading league";
        
        document.getElementById('ld-title').innerText = league.name;
        document.getElementById('ld-status').innerText = `Week ${league.current_week} | Draft Status: ${league.draft_status}`;

        // Fetch Teams
        const { data: teams, error: tErr } = await supabase.from('league_members')
            .select('user_id, team_name, season_points')
            .eq('league_id', leagueId)
            .order('season_points', { ascending: false });
            
        if (teams) {
            document.getElementById('ld-teams').innerHTML = teams.map((t, idx) => `
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between;">
                    <div><strong>${idx + 1}. ${t.team_name}</strong></div>
                    <div style="color: var(--accent-primary); font-weight: bold;">${t.season_points} pts</div>
                </div>
            `).join('');
        }

        // Fetch Draft Picks
        const { data: picks, error: pErr } = await supabase.from('draft_picks')
            .select('week, pick_number, user_id, players(name, id), league_members!inner(team_name)')
            .eq('league_id', leagueId)
            .eq('league_members.league_id', leagueId)
            .order('week', { ascending: false });
            
        if (picks && picks.length > 0) {
            // Group by week
            const picksByWeek = picks.reduce((acc, pick) => {
                acc[pick.week] = acc[pick.week] || [];
                acc[pick.week].push(pick);
                return acc;
            }, {});

            document.getElementById('ld-history').innerHTML = Object.keys(picksByWeek).map(week => `
                <div style="margin-bottom: 2rem;">
                    <h3>Week ${week}</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem;">
                        <tr style="border-bottom: 1px solid var(--glass-border); text-align: left;">
                            <th style="padding: 0.5rem;">Team</th>
                            <th style="padding: 0.5rem;">Pick 1</th>
                            <th style="padding: 0.5rem;">Pick 2</th>
                        </tr>
                        ${
                            // Group by user inside the week
                            Object.values(picksByWeek[week].reduce((uAcc, p) => {
                                uAcc[p.user_id] = uAcc[p.user_id] || { team: p.league_members.team_name, picks: [] };
                                uAcc[p.user_id].picks.push(p);
                                return uAcc;
                            }, {})).map(u => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                    <td style="padding: 0.5rem;">${u.team}</td>
                                    <td style="padding: 0.5rem;"><a href="#" data-route="player_profile" data-id="${u.picks[0]?.players?.id}" style="color: var(--text-primary);">${u.picks[0]?.players?.name || '-'}</a></td>
                                    <td style="padding: 0.5rem;"><a href="#" data-route="player_profile" data-id="${u.picks[1]?.players?.id}" style="color: var(--text-primary);">${u.picks[1]?.players?.name || '-'}</a></td>
                                </tr>
                            `).join('')
                        }
                    </table>
                </div>
            `).join('');
        } else {
            document.getElementById('ld-history').innerHTML = "<p>No draft history yet.</p>";
        }
    }
};

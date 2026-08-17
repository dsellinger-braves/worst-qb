import { supabase } from '../supabase.js';

export const LeaguesView = {
    render: () => `
        <div class="view-container active glass-panel">
            <h1>Leagues</h1>
            <p>Join or create a Worst QB Fantasy league.</p>
            
            <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                <button id="create-league-btn" class="btn btn-primary">Create New League</button>
            </div>

            <div style="margin-top: 2rem;">
                <h2>Available Leagues</h2>
                <div id="all-leagues-list" style="margin-top: 1rem;">
                    Loading leagues...
                </div>
            </div>
        </div>
    `,
    init: async () => {
        if (!supabase) return;
        
        const fetchLeagues = async () => {
            const { data, error } = await supabase.from('leagues').select('*').order('created_at', { ascending: false });
            const listEl = document.getElementById('all-leagues-list');
            if (error) {
                listEl.innerHTML = `<p style="color: var(--accent-primary)">Error loading leagues.</p>`;
                return;
            }
            if (data.length === 0) {
                listEl.innerHTML = `<p>No leagues found.</p>`;
                return;
            }
            listEl.innerHTML = data.map(league => `
                <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3><a href="#/league_detail?id=${league.id}" style="color: var(--text-primary); text-decoration: none;">${league.name} <span style="font-size: 0.8rem;">(View Details)</span></a></h3>
                        <p>Status: ${league.draft_status} | Scoring: ${league.scoring_type === 'team_qb' ? 'Team QBs' : 'Individual QBs'}</p>
                    </div>
                    <button class="btn join-league-btn" data-id="${league.id}" style="background: var(--glass-border); color: white;">Join</button>
                </div>
            `).join('');

            // Attach event listeners for join buttons
            document.querySelectorAll('.join-league-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const leagueId = e.target.getAttribute('data-id');
                    const teamName = prompt("Enter your Team Name for this league:");
                    if (!teamName) return;

                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return alert("You must be logged in to join a league!");

                    const { error } = await supabase.from('league_members').insert([
                        { league_id: leagueId, user_id: session.user.id, team_name: teamName }
                    ]);

                    if (error) {
                        if (error.code === '23505') { // Unique violation
                            alert("You are already a member of this league!");
                        } else {
                            alert("Error joining league: " + error.message);
                        }
                    } else {
                        alert("Successfully joined the league!");
                    }
                });
            });
        };

        fetchLeagues();

        document.getElementById('create-league-btn').addEventListener('click', async () => {
            const leagueName = prompt("Enter league name:");
            if (leagueName) {
                const isTeam = confirm("Should this league use Team QB scoring (draft all QBs on a team)? Click OK for Team QBs, or Cancel for Individual QBs.");
                const scoringType = isTeam ? 'team_qb' : 'individual';
                
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return alert("Must be logged in!");
                
                const { data: newLeague, error: lError } = await supabase.from('leagues').insert([
                    { name: leagueName, created_by: session.user.id, scoring_type: scoringType }
                ]).select();
                
                if (lError) {
                    alert("Error creating league: " + lError.message);
                } else if (newLeague && newLeague.length > 0) {
                    const teamName = prompt("League created! Enter your Team Name to join as the Admin:");
                    if (teamName) {
                        await supabase.from('league_members').insert([
                            { league_id: newLeague[0].id, user_id: session.user.id, team_name: teamName, is_admin: true }
                        ]);
                    }
                    fetchLeagues();
                }
            }
        });
    }
};

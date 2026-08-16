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
                        <h3>${league.name}</h3>
                        <p>Status: ${league.draft_status}</p>
                    </div>
                    <button class="btn" style="background: var(--glass-border); color: white;" onclick="alert('Join logic to be implemented')">Join</button>
                </div>
            `).join('');
        };

        fetchLeagues();

        document.getElementById('create-league-btn').addEventListener('click', async () => {
            const leagueName = prompt("Enter league name:");
            if (leagueName) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return alert("Must be logged in!");
                
                const { error } = await supabase.from('leagues').insert([
                    { name: leagueName, created_by: session.user.id }
                ]);
                if (error) alert("Error creating league");
                else fetchLeagues();
            }
        });
    }
};

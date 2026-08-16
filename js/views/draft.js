import { supabase } from '../supabase.js';

export const DraftView = {
    render: () => `
        <div class="view-container active glass-panel">
            <h1>Live Draft Room</h1>
            <p>Select your 2 QBs for this week. Remember, you want the WORST performance!</p>
            
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; margin-top: 2rem;">
                <div class="draft-board" style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px;">
                    <h3>Eligible QBs</h3>
                    <div id="qb-list" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 500px; overflow-y: auto;">
                        <p>Loading players...</p>
                    </div>
                </div>
                
                <div class="draft-status">
                    <h3>Your Picks (Week <span id="draft-week">1</span>)</h3>
                    <div id="your-picks" style="margin-top: 1rem; display: flex; gap: 1rem;">
                        <div style="flex: 1; padding: 2rem; border: 2px dashed var(--glass-border); text-align: center; border-radius: 8px;">
                            Pick 1 <br/> <span style="font-size: 0.8rem; color: var(--text-secondary)">Empty</span>
                        </div>
                        <div style="flex: 1; padding: 2rem; border: 2px dashed var(--glass-border); text-align: center; border-radius: 8px;">
                            Pick 2 <br/> <span style="font-size: 0.8rem; color: var(--text-secondary)">Empty</span>
                        </div>
                    </div>
                    
                    <h3 style="margin-top: 2rem;">Draft Order Tracker</h3>
                    <p style="color: var(--accent-success); margin-top: 0.5rem;">Supabase Realtime Draft Sync Status: <span id="realtime-status">Connecting...</span></p>
                </div>
            </div>
        </div>
    `,
    init: async () => {
        if (!supabase) return;
        
        // Clean up any existing channels to prevent "channel already exists" errors on revisit
        await supabase.removeAllChannels();
        
        // Subscribe to real-time draft picks
        const channel = supabase.channel('draft_room')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'draft_picks' }, payload => {
                console.log('New pick!', payload);
                // Here we would update the UI to show a player was taken
            })
            .subscribe((status) => {
                const statusEl = document.getElementById('realtime-status');
                if (status === 'SUBSCRIBED') {
                    statusEl.innerText = 'Connected';
                } else {
                    statusEl.innerText = 'Disconnected';
                    statusEl.style.color = 'var(--accent-primary)';
                }
            });

        // Fetch the user's first league to determine scoring type
        const { data: { session } } = await supabase.auth.getSession();
        let isTeamLeague = false;
        if (session) {
            const { data: userLeagues } = await supabase
                .from('league_members')
                .select('leagues(scoring_type)')
                .eq('user_id', session.user.id)
                .limit(1);
            if (userLeagues && userLeagues.length > 0 && userLeagues[0].leagues?.scoring_type === 'team_qb') {
                isTeamLeague = true;
            }
        }

        const playerPosition = isTeamLeague ? 'TM_QB' : 'QB';

        // Fetch players and latest projections
        const [{ data: players }, { data: projections }] = await Promise.all([
            supabase.from('players').select('*').eq('position', playerPosition).limit(50),
            supabase.from('player_projections').select('*')
        ]);
        
        let maxWeek = 0;
        const projMap = {};
        if (projections && projections.length > 0) {
            maxWeek = Math.max(...projections.map(p => p.week));
            projections.filter(p => p.week === maxWeek).forEach(p => {
                projMap[p.player_id] = p.projected_custom_points;
            });
        }
        
        const qbList = document.getElementById('qb-list');
        if (players && players.length > 0) {
            // Sort by projected points descending (worst QBs at the top)
            players.sort((a, b) => (projMap[b.id] || 0) - (projMap[a.id] || 0));
            
            qbList.innerHTML = players.map(p => {
                const proj = projMap[p.id] ? projMap[p.id].toFixed(2) : 'N/A';
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--glass-bg); border-radius: 4px;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600;">${p.name} (${p.team})</span>
                        <span style="font-size: 0.8rem; color: var(--accent-primary);">Proj: ${proj} pts</span>
                    </div>
                    <button class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">Draft</button>
                </div>
            `}).join('');
        } else {
            qbList.innerHTML = '<p style="color: var(--text-secondary)">No active QBs found in database.</p>';
        }
    }
};

import { supabase } from '../supabase.js';

export const ProjectionsView = {
    render: () => `
        <div class="view-container active glass-panel">
            <h1>Weekly Projections</h1>
            <p>Projected Worst QB points for the upcoming week based on CBS Sports.</p>
            
            <div style="margin-top: 2rem; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--glass-border); cursor: pointer;" id="proj-header-row">
                            <th style="padding: 1rem 0.5rem;" data-sort="rank">Rank ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="name">Player ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="team">Team ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="opponent">Opponent ↕</th>
                            <th style="padding: 1rem 0.5rem; color: var(--accent-primary);" data-sort="pts">Projected Pts ↕</th>
                        </tr>
                    </thead>
                    <tbody id="proj-table-body">
                        <tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading projections...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `,
    init: async () => {
        if (!supabase) return;

        // Fetch projections
        const { data, error } = await supabase.from('player_projections')
            .select('*, players(name, team, headshot_url)');
            
        if (error) {
            document.getElementById('proj-table-body').innerHTML = `<tr><td colspan="5">Error loading projections.</td></tr>`;
            return;
        }
        
        // Find the latest week
        const maxWeek = data.length > 0 ? Math.max(...data.map(d => d.week)) : 0;
        const currentData = data.filter(d => d.week === maxWeek).map(d => ({
            id: d.player_id,
            name: d.players?.name || 'Unknown',
            team: d.players?.team || '-',
            headshot: d.players?.headshot_url || '',
            opponent: d.opponent || 'TBD',
            pts: d.projected_custom_points || 0
        }));

        currentData.sort((a, b) => b.pts - a.pts); // worst QB points first
        
        ProjectionsView.currentData = currentData;
        ProjectionsView.sortCol = 'pts';
        ProjectionsView.sortAsc = false;
        
        ProjectionsView.renderTable();
        
        // Add sorting listeners
        document.getElementById('proj-header-row').querySelectorAll('th').forEach(th => {
            th.addEventListener('click', (e) => {
                const col = e.target.getAttribute('data-sort');
                if (!col) return;
                
                if (ProjectionsView.sortCol === col) {
                    ProjectionsView.sortAsc = !ProjectionsView.sortAsc;
                } else {
                    ProjectionsView.sortCol = col;
                    ProjectionsView.sortAsc = col === 'name' || col === 'team' || col === 'rank';
                }
                
                ProjectionsView.currentData.sort((a, b) => {
                    let valA = a[col];
                    let valB = b[col];
                    if (col === 'rank') { valA = a.pts; valB = b.pts; }
                    
                    if (valA < valB) return ProjectionsView.sortAsc ? -1 : 1;
                    if (valA > valB) return ProjectionsView.sortAsc ? 1 : -1;
                    return 0;
                });
                
                if (col === 'rank') ProjectionsView.currentData.reverse();
                
                ProjectionsView.renderTable();
            });
        });
    },
    renderTable: () => {
        const tbody = document.getElementById('proj-table-body');
        if (!ProjectionsView.currentData || ProjectionsView.currentData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No projections found.</td></tr>`;
            return;
        }

        tbody.innerHTML = ProjectionsView.currentData.map((p, idx) => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${idx + 1}</td>
                <td style="padding: 1rem 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    ${p.headshot ? `<img src="${p.headshot}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #fff;">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--glass-border);"></div>`}
                    <a href="#" data-route="player_profile" data-id="${p.id}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${p.name}</a>
                </td>
                <td style="padding: 1rem 0.5rem;">${p.team}</td>
                <td style="padding: 1rem 0.5rem;">${p.opponent}</td>
                <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold;">${p.pts.toFixed(2)}</td>
            </tr>
        `).join('');
    }
};

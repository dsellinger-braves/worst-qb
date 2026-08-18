import { supabase } from '../supabase.js';

export const ProjectionsView = {
    render: () => `
        <div class="view-container active glass-panel">
            <h1>Weekly Projections</h1>
            <p>Projected Worst QB points for the upcoming week based on ESPN.</p>
            
            <div style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem; flex-wrap: wrap;">
                <select id="proj-week-filter" class="input" style="width: auto; background: rgba(0,0,0,0.5);" onchange="ProjectionsView.processAndRender()"></select>
                <select id="proj-position-filter" class="input" style="width: auto; background: rgba(0,0,0,0.5);" onchange="ProjectionsView.processAndRender()">
                    <option value="QB">QBs Only</option>
                    <option value="NON_QB">Non-QBs Only</option>
                    <option value="ALL">All Players</option>
                </select>
                <input type="text" id="proj-search" class="input" placeholder="Search players..." style="flex: 1; min-width: 200px;" onkeyup="ProjectionsView.handleFilter()">
                <input type="number" id="proj-min-attempts" class="input" placeholder="Min Proj Attempts" style="width: 150px;" onkeyup="ProjectionsView.handleFilter()" onchange="ProjectionsView.handleFilter()" min="0" step="1">
            </div>

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
            .select('*, players(name, team, position, headshot_url)');
            
        if (error) {
            document.getElementById('proj-table-body').innerHTML = `<tr><td colspan="5">Error loading projections.</td></tr>`;
            return;
        }
        
        ProjectionsView.rawData = data || [];
        
        const availableWeeks = [...new Set(ProjectionsView.rawData.map(d => d.week))].sort((a,b) => a - b);
        const weekSelect = document.getElementById('proj-week-filter');
        weekSelect.innerHTML = availableWeeks.map(w => `<option value="${w}">Week ${w}</option>`).join('');
        if (availableWeeks.length > 0) weekSelect.value = availableWeeks[0]; // Default to upcoming week
        
        ProjectionsView.sortCol = 'pts';
        ProjectionsView.sortAsc = false;
        
        ProjectionsView.processAndRender = () => {
            const selectedWeek = parseInt(document.getElementById('proj-week-filter').value) || 0;
            const selectedPos = document.getElementById('proj-position-filter').value;
            
            const currentData = ProjectionsView.rawData.filter(d => {
                if (d.week !== selectedWeek) return false;
                const pos = d.players?.position || 'UNKNOWN';
                if (selectedPos === 'QB') return pos === 'QB' || pos === 'TM_QB';
                if (selectedPos === 'NON_QB') return pos !== 'QB' && pos !== 'TM_QB';
                return true; // ALL
            }).map(d => {
                let oppName = d.opponent || 'TBD';
                let rawStats = {};
                try {
                    if (d.opponent && d.opponent.startsWith('{')) {
                        const parsed = JSON.parse(d.opponent);
                        oppName = parsed.opp || 'TBD';
                        rawStats = parsed.raw || {};
                    }
                } catch(e) {}
                
                return {
                    id: d.player_id,
                    name: d.players?.name || 'Unknown',
                    team: d.players?.team || '-',
                    headshot: d.players?.headshot_url || '',
                    opponent: oppName,
                    raw: rawStats,
                    pts: d.projected_custom_points || 0
                };
            });
    
            currentData.sort((a, b) => b.pts - a.pts);
            ProjectionsView.currentData = currentData;
            
            // Re-apply sorting if changed
            if (ProjectionsView.sortCol !== 'pts' || ProjectionsView.sortAsc !== false) {
                ProjectionsView.currentData.sort((a, b) => {
                    let valA = a[ProjectionsView.sortCol];
                    let valB = b[ProjectionsView.sortCol];
                    if (ProjectionsView.sortCol === 'rank') { valA = a.pts; valB = b.pts; }
                    
                    if (valA < valB) return ProjectionsView.sortAsc ? -1 : 1;
                    if (valA > valB) return ProjectionsView.sortAsc ? 1 : -1;
                    return 0;
                });
                if (ProjectionsView.sortCol === 'rank') ProjectionsView.currentData.reverse();
            }
            
            ProjectionsView.renderTable();
        };

        ProjectionsView.processAndRender();
        
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
    handleFilter: () => {
        ProjectionsView.renderTable();
    },
    renderTable: () => {
        const tbody = document.getElementById('proj-table-body');
        const searchQuery = (document.getElementById('proj-search')?.value || '').toLowerCase();
        const minAtts = parseFloat(document.getElementById('proj-min-attempts')?.value) || 0;

        let filtered = ProjectionsView.currentData || [];
        
        if (searchQuery) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(searchQuery) || 
                p.team.toLowerCase().includes(searchQuery)
            );
        }
        
        if (minAtts > 0) {
            filtered = filtered.filter(p => (p.raw?.attempts || 0) >= minAtts);
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem;">No projections found.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((p, idx) => `
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

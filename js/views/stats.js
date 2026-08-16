import { supabase } from '../supabase.js';

export const StatsView = {
    render: () => `
        <div class="view-container active glass-panel">
            <h1>Global QB Leaderboard</h1>
            <p>Year-To-Date (YTD) stats for all eligible quarterbacks.</p>
            
            <div style="margin-top: 2rem; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--glass-border); cursor: pointer;" id="stats-header-row">
                            <th style="padding: 1rem 0.5rem;" data-sort="rank">Rank ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="name">Player ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="team">Team ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="passYds">Pass Yds ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="passTd">Pass TD ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="ints">INT ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="sacks">Sacks ↕</th>
                            <th style="padding: 1rem 0.5rem;" data-sort="fumbles">Fumbles ↕</th>
                            <th style="padding: 1rem 0.5rem; color: var(--accent-primary);" data-sort="customPoints">Worst QB Pts ↕</th>
                        </tr>
                    </thead>
                    <tbody id="stats-table-body">
                        <tr><td colspan="9" style="text-align: center; padding: 2rem;">Loading stats...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `,
    init: async () => {
        if (!supabase) return;

        // Fetch all stats and players
        const { data, error } = await supabase.from('player_stats')
            .select('*, players(name, team, headshot_url)');
            
        if (error) {
            document.getElementById('stats-table-body').innerHTML = `<tr><td colspan="9">Error loading stats.</td></tr>`;
            return;
        }

        // Aggregate stats by player
        const aggregated = data.reduce((acc, stat) => {
            const pid = stat.player_id;
            if (!acc[pid]) {
                acc[pid] = {
                    id: pid,
                    name: stat.players?.name || 'Unknown',
                    team: stat.players?.team || '-',
                    headshot: stat.players?.headshot_url || '',
                    passYds: 0,
                    passTd: 0,
                    ints: 0,
                    sacks: 0,
                    fumbles: 0,
                    customPoints: 0
                };
            }
            acc[pid].passYds += stat.passing_yards || 0;
            acc[pid].passTd += stat.passing_tds || 0;
            acc[pid].ints += stat.interceptions || 0;
            acc[pid].sacks += stat.sacks || 0;
            acc[pid].fumbles += stat.fumbles_lost || 0;
            acc[pid].customPoints += stat.custom_points || 0;
            return acc;
        }, {});

        // Convert to array and sort by customPoints descending (worst QBs first)
        const sorted = Object.values(aggregated).sort((a, b) => b.customPoints - a.customPoints);

        // Store sorted array globally for the view
        StatsView.currentData = sorted;
        StatsView.sortCol = 'customPoints';
        StatsView.sortAsc = false;
        
        StatsView.renderTable();

        // Add event listeners to headers
        document.getElementById('stats-header-row').querySelectorAll('th').forEach(th => {
            th.addEventListener('click', (e) => {
                const col = e.target.getAttribute('data-sort');
                if (!col) return;
                
                if (StatsView.sortCol === col) {
                    StatsView.sortAsc = !StatsView.sortAsc;
                } else {
                    StatsView.sortCol = col;
                    StatsView.sortAsc = col === 'name' || col === 'team' || col === 'rank'; // Default asc for text/rank
                }
                
                StatsView.currentData.sort((a, b) => {
                    let valA = a[col];
                    let valB = b[col];
                    if (col === 'rank') { valA = a.customPoints; valB = b.customPoints; } // rank is derived from points
                    
                    if (valA < valB) return StatsView.sortAsc ? -1 : 1;
                    if (valA > valB) return StatsView.sortAsc ? 1 : -1;
                    return 0;
                });
                
                if (col === 'rank') StatsView.currentData.reverse(); // Because higher points = better rank (lower number)
                
                StatsView.renderTable();
            });
        });
    },
    
    renderTable: () => {
        const tbody = document.getElementById('stats-table-body');
        if (!StatsView.currentData || StatsView.currentData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem;">No stats recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = StatsView.currentData.map((p, idx) => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${idx + 1}</td>
                <td style="padding: 1rem 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    ${p.headshot ? `<img src="${p.headshot}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #fff;">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--glass-border);"></div>`}
                    <a href="#" data-route="player_profile" data-id="${p.id}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${p.name}</a>
                </td>
                <td style="padding: 1rem 0.5rem;">${p.team}</td>
                <td style="padding: 1rem 0.5rem;">${p.passYds}</td>
                <td style="padding: 1rem 0.5rem;">${p.passTd}</td>
                <td style="padding: 1rem 0.5rem;">${p.ints}</td>
                <td style="padding: 1rem 0.5rem;">${p.sacks}</td>
                <td style="padding: 1rem 0.5rem;">${p.fumbles}</td>
                <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold;">${p.customPoints.toFixed(2)}</td>
            </tr>
        `).join('');
    }
};

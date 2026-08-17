import { supabase } from '../supabase.js';

export const PlayerProfileView = {
    render: () => `
        <div class="view-container active">
            <div id="pp-header" class="glass-panel" style="display: flex; gap: 2rem; align-items: center; margin-bottom: 2rem; padding: 2rem;">
                <div id="pp-headshot" style="width: 150px; height: 150px; border-radius: 50%; background: var(--glass-border); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <div class="spinner"></div>
                </div>
                <div>
                    <h1 id="pp-name" style="margin-bottom: 0.5rem;">Loading Player...</h1>
                    <div id="pp-bio" style="color: var(--text-secondary); display: flex; gap: 1rem; flex-wrap: wrap;">
                        <!-- Bio injected here -->
                    </div>
                </div>
            </div>
            
            <div class="glass-panel">
                <h2>Game Log</h2>
                <div style="margin-top: 1.5rem; overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--glass-border);">
                                <th style="padding: 1rem 0.5rem;">Week</th>
                                <th style="padding: 1rem 0.5rem;">Result</th>
                                <th style="padding: 1rem 0.5rem;">Comp/Att</th>
                                <th style="padding: 1rem 0.5rem;">Pass Yds</th>
                                <th style="padding: 1rem 0.5rem;">Pass TD</th>
                                <th style="padding: 1rem 0.5rem;">INT</th>
                                <th style="padding: 1rem 0.5rem;">Sacks</th>
                                <th style="padding: 1rem 0.5rem;">Fumbles</th>
                                <th style="padding: 1rem 0.5rem; color: var(--accent-primary);">Fantasy Pts</th>
                            </tr>
                        </thead>
                        <tbody id="pp-gamelog">
                            <tr><td colspan="9" style="text-align: center; padding: 2rem;">Loading game log...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `,
    init: async (params) => {
        if (!supabase || !params || !params.id) return;
        const playerId = params.id;

        // Fetch Player Bio
        const { data: player, error: pErr } = await supabase.from('players').select('*').eq('id', playerId).single();
        if (pErr) return document.getElementById('pp-name').innerText = "Player not found";
        
        document.getElementById('pp-name').innerText = player.name;
        if (player.headshot_url) {
            document.getElementById('pp-headshot').innerHTML = `<img src="${player.headshot_url}" style="width: 100%; height: 100%; object-fit: cover; background: #fff;">`;
        } else {
            document.getElementById('pp-headshot').innerHTML = `<span style="font-size: 3rem; color: var(--text-secondary);">🏈</span>`;
        }
        
        const formatHeight = (h) => {
            if (!h) return '';
            const num = parseInt(h, 10);
            if (!isNaN(num)) {
                const feet = Math.floor(num / 12);
                const inches = num % 12;
                return `${feet}'${inches}"`;
            }
            return h;
        };

        document.getElementById('pp-bio').innerHTML = `
            <span><strong>Team:</strong> ${player.team || '-'}</span>
            <span><strong>Position:</strong> ${player.position || 'QB'}</span>
            ${player.height ? `<span><strong>Height:</strong> ${formatHeight(player.height)}</span>` : ''}
            ${player.weight ? `<span><strong>Weight:</strong> ${player.weight} lbs</span>` : ''}
            ${player.age ? `<span><strong>Age:</strong> ${player.age}</span>` : ''}
            ${player.college ? `<span><strong>College:</strong> ${player.college}</span>` : ''}
        `;

        // Fetch Game Log
        const { data: stats, error: sErr } = await supabase.from('player_stats')
            .select('*')
            .eq('player_id', playerId)
            .order('week', { ascending: true });
            
        const tbody = document.getElementById('pp-gamelog');
        
        if (sErr || !stats || stats.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem;">No games played yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = stats.map(s => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${s.week}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${s.team_loss ? '<span style="color: var(--accent-primary)">L</span>' : '<span style="color: var(--accent-success)">W</span>'}</td>
                <td style="padding: 1rem 0.5rem;">${s.completions || 0} / ${s.attempts || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.passing_yards || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.passing_tds || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.interceptions || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.sacks || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.fumbles_lost || 0}</td>
                <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold;">${s.custom_points ? s.custom_points.toFixed(2) : '0.00'}</td>
            </tr>
        `).join('');
        
        // Add a totals row
        const totals = stats.reduce((acc, s) => {
            acc.comp += s.completions || 0;
            acc.att += s.attempts || 0;
            acc.yds += s.passing_yards || 0;
            acc.tds += s.passing_tds || 0;
            acc.ints += s.interceptions || 0;
            acc.sacks += s.sacks || 0;
            acc.fumbles += s.fumbles_lost || 0;
            acc.pts += s.custom_points || 0;
            return acc;
        }, { comp: 0, att: 0, yds: 0, tds: 0, ints: 0, sacks: 0, fumbles: 0, pts: 0 });
        
        tbody.innerHTML += `
            <tr style="background: rgba(255,255,255,0.05); border-top: 2px solid var(--glass-border);">
                <td style="padding: 1rem 0.5rem; font-weight: bold;">Total</td>
                <td style="padding: 1rem 0.5rem;">-</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totals.comp} / ${totals.att}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totals.yds}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totals.tds}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totals.ints}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totals.sacks}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totals.fumbles}</td>
                <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold;">${totals.pts.toFixed(2)}</td>
            </tr>
        `;
    }
};

import { supabase } from '../supabase.js';
import { calculateLeagueScore } from '../scoring.js';

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
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--glass-border); padding-bottom: 1rem;">
                    <button class="btn" id="tab-gamelog" onclick="switchProfileTab('gamelog')" style="background: rgba(255,255,255,0.1); color: var(--text-secondary);">Historical Game Logs</button>
                    <button class="btn btn-primary" id="tab-projections" onclick="switchProfileTab('projections')">2026 Projections</button>
                </div>

                <div id="view-gamelog" style="display: none;">
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--glass-border);">
                                    <th style="padding: 1rem 0.5rem;">Week</th>
                                    <th style="padding: 1rem 0.5rem;">Comp/Att</th>
                                    <th style="padding: 1rem 0.5rem;">Pass Yds</th>
                                    <th style="padding: 1rem 0.5rem;">Pass TD</th>
                                    <th style="padding: 1rem 0.5rem;">INT</th>
                                    <th style="padding: 1rem 0.5rem;">Sacks</th>
                                    <th style="padding: 1rem 0.5rem;">Fumbles</th>
                                    <th style="padding: 1rem 0.5rem;">Result</th>
                                    <th style="padding: 1rem 0.5rem; color: var(--accent-primary);">Fantasy Pts</th>
                                </tr>
                            </thead>
                            <tbody id="pp-gamelog">
                                <tr><td colspan="9" style="text-align: center; padding: 2rem;">Loading game log...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div id="view-projections">
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--glass-border);">
                                    <th style="padding: 1rem 0.5rem;">Week</th>
                                    <th style="padding: 1rem 0.5rem;">Comp/Att</th>
                                    <th style="padding: 1rem 0.5rem;">Pass Yds</th>
                                    <th style="padding: 1rem 0.5rem;">Pass TD</th>
                                    <th style="padding: 1rem 0.5rem;">INT</th>
                                    <th style="padding: 1rem 0.5rem;">Rush Yds</th>
                                    <th style="padding: 1rem 0.5rem;">Rush TD</th>
                                    <th style="padding: 1rem 0.5rem;">Fumbles</th>
                                    <th style="padding: 1rem 0.5rem; color: var(--accent-primary);">Proj Pts</th>
                                </tr>
                            </thead>
                            <tbody id="pp-projections">
                                <tr><td colspan="9" style="text-align: center; padding: 2rem;">Loading projections...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `,
    init: async (params) => {
        window.switchProfileTab = (tab) => {
            document.getElementById('view-gamelog').style.display = tab === 'gamelog' ? 'block' : 'none';
            document.getElementById('view-projections').style.display = tab === 'projections' ? 'block' : 'none';
            
            document.getElementById('tab-gamelog').className = tab === 'gamelog' ? 'btn btn-primary' : 'btn';
            document.getElementById('tab-gamelog').style = tab === 'gamelog' ? '' : 'background: rgba(255,255,255,0.1); color: var(--text-secondary);';
            
            document.getElementById('tab-projections').className = tab === 'projections' ? 'btn btn-primary' : 'btn';
            document.getElementById('tab-projections').style = tab === 'projections' ? '' : 'background: rgba(255,255,255,0.1); color: var(--text-secondary);';
        };

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

        // Check for League context to use dynamic scoring
        let leagueSettings = null;
        if (params.league) {
            const { data: league } = await supabase.from('leagues').select('scoring_settings').eq('id', params.league).single();
            if (league && league.scoring_settings) {
                leagueSettings = league.scoring_settings;
                // Add league badge to header
                document.getElementById('pp-bio').innerHTML += `<span style="color: var(--accent-primary); font-weight: bold; border: 1px solid var(--accent-primary); padding: 0.1rem 0.4rem; border-radius: 4px;">Viewing with Custom League Scoring</span>`;
            }
        }

        // Fetch Game Log
        const { data: stats, error: sErr } = await supabase.from('player_stats')
            .select('*')
            .eq('player_id', playerId)
            .order('season_type', { ascending: true })
            .order('week', { ascending: true });
            
        const tbody = document.getElementById('pp-gamelog');
        
        if (sErr || !stats || stats.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem;">No games played yet.</td></tr>`;
            return;
        }

        let totalCmp = 0, totalAtt = 0, totalYds = 0, totalTds = 0, totalInt = 0, totalSack = 0, totalFum = 0, totalPts = 0;

        tbody.innerHTML = stats.map(s => {
            const isPre = s.season_type === 'preseason';
            const pts = leagueSettings ? calculateLeagueScore(s, leagueSettings) : (s.custom_points || 0);
            
            if (!isPre) {
                totalCmp += s.completions || 0;
                totalAtt += s.attempts || 0;
                totalYds += s.passing_yards || 0;
                totalTds += s.passing_tds || 0;
                totalInt += s.interceptions || 0;
                totalSack += s.sacks || 0;
                totalFum += s.fumbles_lost || 0;
                totalPts += pts;
            }
            
            const rowBg = isPre ? 'rgba(128, 0, 128, 0.15)' : 'transparent';
            const hoverBg = isPre ? 'rgba(128, 0, 128, 0.25)' : 'rgba(255,255,255,0.05)';
            const borderBottom = isPre ? 'none' : '1px solid rgba(255,255,255,0.05)';
            
            return `
            <tr style="background: ${rowBg}; border-bottom: ${borderBottom}; transition: background 0.2s;" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
                <td style="padding: 1rem 0.5rem; font-weight: bold;">
                    ${s.week} 
                    ${isPre ? '<span style="font-size: 0.7rem; background: var(--accent-secondary); color: white; padding: 0.1rem 0.3rem; border-radius: 4px; margin-left: 0.5rem;">PRE</span>' : ''}
                </td>
                <td style="padding: 1rem 0.5rem;">${s.completions || 0} / ${s.attempts || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.passing_yards || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.passing_tds || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.interceptions || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.sacks || 0}</td>
                <td style="padding: 1rem 0.5rem;">${s.fumbles_lost || 0}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${s.team_loss ? '<span style="color: var(--accent-primary)">L</span>' : '<span style="color: var(--accent-success)">W</span>'}</td>
                <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold;">${pts.toFixed(2)}</td>
            </tr>
            `;
        }).join('');
        
        tbody.innerHTML += `
            <tr style="background: rgba(255,255,255,0.05); border-top: 2px solid var(--glass-border);">
                <td style="padding: 1rem 0.5rem; font-weight: bold;">Total (Reg Season)</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totalCmp} / ${totalAtt}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totalYds}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totalTds}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totalInt}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totalSack}</td>
                <td style="padding: 1rem 0.5rem; font-weight: bold;">${totalFum}</td>
                <td style="padding: 1rem 0.5rem;">-</td>
                <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold;">${totalPts.toFixed(2)}</td>
            </tr>
        `;

        // Fetch Projections
        const { data: projections, error: projErr } = await supabase.from('player_projections')
            .select('*')
            .eq('player_id', player.id || playerId)
            .order('week', { ascending: true });
            
        const projTbody = document.getElementById('pp-projections');
        
        if (projErr || !projections || projections.length === 0) {
            projTbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem;">No projections available.</td></tr>`;
        } else {
            projTbody.innerHTML = projections.map(p => {
                let raw = {};
                try {
                    if (p.opponent && p.opponent.startsWith('{')) {
                        raw = JSON.parse(p.opponent).raw || {};
                    }
                } catch(e) {}
                
                // If there are no projections for this week (e.g. bye week), skip or show empty
                if (Object.keys(raw).length === 0 && p.projected_custom_points === 0) {
                    return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 1rem 0.5rem; font-weight: bold;">${p.week}</td>
                        <td colspan="8" style="padding: 1rem 0.5rem; color: var(--text-secondary); text-align: center;">BYE</td>
                    </tr>
                    `;
                }
                
                const pts = leagueSettings ? calculateLeagueScore(raw, leagueSettings) : p.projected_custom_points;
                
                return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 1rem 0.5rem; font-weight: bold;">${p.week}</td>
                    <td style="padding: 1rem 0.5rem;">${(raw.completions || 0).toFixed(1)} / ${(raw.attempts || 0).toFixed(1)}</td>
                    <td style="padding: 1rem 0.5rem;">${(raw.passing_yards || 0).toFixed(1)}</td>
                    <td style="padding: 1rem 0.5rem;">${(raw.passing_tds || 0).toFixed(1)}</td>
                    <td style="padding: 1rem 0.5rem;">${(raw.interceptions || 0).toFixed(1)}</td>
                    <td style="padding: 1rem 0.5rem;">${(raw.rushing_yards || 0).toFixed(1)}</td>
                    <td style="padding: 1rem 0.5rem;">${(raw.rushing_tds || 0).toFixed(1)}</td>
                    <td style="padding: 1rem 0.5rem;">${(raw.fumbles_lost || 0).toFixed(1)}</td>
                    <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold;">${pts.toFixed(2)}</td>
                </tr>
                `;
            }).join('');
        }
    }
};

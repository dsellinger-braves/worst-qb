export const RulesView = {
    render: () => `
        <div class="view-container active glass-panel" style="max-width: 800px; margin: 0 auto;">
            <h1>Rules & Scoring Methodology</h1>
            <p style="margin-top: 1rem; line-height: 1.6; color: #ccc;">Welcome to Worst QB! In this league, bad is good and good is terrible. The goal is to draft and start quarterbacks who actively harm their team's chances of winning.</p>
            
            <div style="margin-top: 2rem;">
                <h2>Scoring System</h2>
                <table class="stats-table" style="width: 100%; margin-top: 1rem; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--glass-border); text-align: left;">
                            <th style="padding: 0.75rem 0.5rem;">Stat Category</th>
                            <th style="padding: 0.75rem 0.5rem;">Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Interception</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-primary); font-weight: bold;">+5.0</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Pick Six</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-primary); font-weight: bold;">+10.0</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Fumble Lost</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-primary); font-weight: bold;">+4.0</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Sack Taken</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-primary); font-weight: bold;">+1.0</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Incompletion Penalty (Comp % Multiplier)</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-primary); font-weight: bold;">+20.0 × (1 − Comp%)</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Team Loss Bonus</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-primary); font-weight: bold;">+5.0</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Passing Yard</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-secondary); font-weight: bold;">-0.05</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Passing Touchdown</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-secondary); font-weight: bold;">-5.0</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Rushing Yard</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-secondary); font-weight: bold;">-0.10</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.75rem 0.5rem;">Rushing Touchdown</td>
                            <td style="padding: 0.75rem 0.5rem; color: var(--accent-secondary); font-weight: bold;">-5.0</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 2rem; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--accent-primary); padding: 1.5rem; border-radius: 8px;">
                <h3 style="color: var(--accent-primary); margin-bottom: 0.5rem;">⚠️ The Golden Penalty: No Pass Attempts</h3>
                <p style="color: #ccc; line-height: 1.5;">If a drafted player finishes the week with <strong>zero pass attempts</strong>, their total score is automatically set to <strong style="color: var(--accent-primary)">-20.0 points</strong>, regardless of any rushing yards, touchdowns, or other stats. They must actually attempt passes to be eligible for normal Worst QB scoring!</p>
            </div>

            <div style="margin-top: 2rem;">
                <h2>Roster & Game Rules</h2>
                <ul style="margin-left: 2rem; margin-top: 1rem; line-height: 1.6; color: #ccc;">
                    <li><strong>Starting Lineup:</strong> 2 QBs per week.</li>
                    <li><strong>Linear Draft:</strong> 2 rounds per week in inverse order of season standings (worst team picks first).</li>
                    <li><strong>Unique Picks:</strong> A player cannot be drafted more than once per league in any given week.</li>
                    <li><strong>Negative Point Floors:</strong> If a QB has a good game, they will score negative points. This hurts your weekly and season total!</li>
                    <li><strong>The Golden Rule:</strong> The worse they play, the better you score. Aim for turnover-prone starters, struggling backups, or heavy underdogs!</li>
                </ul>
            </div>
        </div>
    `,
    init: () => {}
};

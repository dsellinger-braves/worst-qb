export const RulesView = {
    render: () => `
        <div class="view-container active glass-panel" style="max-width: 800px; margin: 0 auto;">
            <h1>Rules & Scoring Methodology</h1>
            <p style="margin-top: 1rem; line-height: 1.6; color: #ccc;">Welcome to Worst QB! In this league, bad is good and good is terrible. The goal is to draft and start quarterbacks who actively harm their team's chances of winning.</p>
            
            <div style="margin-top: 2rem;">
                <h2>Scoring System</h2>
                <table class="stats-table" style="width: 100%; margin-top: 1rem;">
                    <thead>
                        <tr>
                            <th>Stat Category</th>
                            <th>Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Interception</td>
                            <td style="color: var(--accent-primary)">+3.0</td>
                        </tr>
                        <tr>
                            <td>No Pass Attempts</td>
                            <td style="color: var(--accent-secondary)">-20.0</td>
                        </tr>
                        <tr>
                            <td>Fumble Lost</td>
                            <td style="color: var(--accent-primary)">+3.0</td>
                        </tr>
                        <tr>
                            <td>Sack Taken</td>
                            <td style="color: var(--accent-primary)">+1.0</td>
                        </tr>
                        <tr>
                            <td>Incompletion</td>
                            <td style="color: var(--accent-primary)">+0.5</td>
                        </tr>
                        <tr>
                            <td>Pick Six</td>
                            <td style="color: var(--accent-primary)">+6.0</td>
                        </tr>
                        <tr>
                            <td>Passing Yard</td>
                            <td style="color: var(--accent-secondary)">-0.04</td>
                        </tr>
                        <tr>
                            <td>Passing Touchdown</td>
                            <td style="color: var(--accent-secondary)">-4.0</td>
                        </tr>
                        <tr>
                            <td>Rushing Yard</td>
                            <td style="color: var(--accent-secondary)">-0.1</td>
                        </tr>
                        <tr>
                            <td>Rushing Touchdown</td>
                            <td style="color: var(--accent-secondary)">-6.0</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 2rem;">
                <h2>Roster & Game Rules</h2>
                <ul style="margin-left: 2rem; margin-top: 1rem; line-height: 1.6; color: #ccc;">
                    <li><strong>Starting Lineup:</strong> 2 QBs per week.</li>
                    <li><strong>Benched Players:</strong> Benched players do not accumulate points.</li>
                    <li><strong>Negative Point Floors:</strong> If a QB has a good game, they will score negative points. This hurts your weekly total!</li>
                    <li><strong>The Golden Rule:</strong> The worse they play, the better you score. Aim for the backups who get forced into action or starters on a terrible streak!</li>
                </ul>
            </div>
        </div>
    `,
    init: () => {}
};

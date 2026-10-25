export const DEFAULT_SCORING = {
    pass_yds: -0.05,
    pass_tds: -5.0,
    ints: 5.0,
    pick_sixes: 10.0,
    rush_yds: -0.1,
    rush_tds: -5.0,
    fumbles_lost: 4.0,
    sacks: 1.0,
    team_loss: 5.0,
    no_attempts: -20.0,
    completion_penalty_multiplier: 20.0
};

export function getScoringSetting(settings, key) {
    if (!settings) return DEFAULT_SCORING[key];
    const val = parseFloat(settings[key]);
    return Number.isFinite(val) ? val : DEFAULT_SCORING[key];
}

export function calculateLeagueScore(stats, settings) {
    if (!stats) return 0.0;
    
    const attempts = stats.attempts || 0;
    
    // Check for "No Pass Attempts" penalty
    if (attempts <= 0) {
        if (stats.is_live) {
            let points = 0.0;
            points += (stats.passing_yards || 0) * getScoringSetting(settings, 'pass_yds');
            points += (stats.passing_tds || 0) * getScoringSetting(settings, 'pass_tds');
            points += (stats.interceptions || 0) * getScoringSetting(settings, 'ints');
            points += (stats.pick_sixes || 0) * getScoringSetting(settings, 'pick_sixes');
            points += (stats.rushing_yards || 0) * getScoringSetting(settings, 'rush_yds');
            points += (stats.rushing_tds || 0) * getScoringSetting(settings, 'rush_tds');
            points += (stats.fumbles_lost || 0) * getScoringSetting(settings, 'fumbles_lost');
            points += (stats.sacks || 0) * getScoringSetting(settings, 'sacks');
            const teamLossMultiplier = getScoringSetting(settings, 'team_loss');
            if (stats.team_loss_prob !== undefined && stats.team_loss_prob > 0) {
                points += teamLossMultiplier * stats.team_loss_prob;
            } else if (stats.team_loss) {
                points += teamLossMultiplier;
            }
            return points;
        }
        return getScoringSetting(settings, 'no_attempts');
    }
    
    let points = 0.0;
    
    // Standard Stats
    points += (stats.passing_yards || 0) * getScoringSetting(settings, 'pass_yds');
    points += (stats.passing_tds || 0) * getScoringSetting(settings, 'pass_tds');
    points += (stats.interceptions || 0) * getScoringSetting(settings, 'ints');
    points += (stats.pick_sixes || 0) * getScoringSetting(settings, 'pick_sixes');
    points += (stats.rushing_yards || 0) * getScoringSetting(settings, 'rush_yds');
    points += (stats.rushing_tds || 0) * getScoringSetting(settings, 'rush_tds');
    points += (stats.fumbles_lost || 0) * getScoringSetting(settings, 'fumbles_lost');
    points += (stats.sacks || 0) * getScoringSetting(settings, 'sacks');
    
    // Team Loss Bonus: supports actuals or projected probability
    const teamLossMultiplier = getScoringSetting(settings, 'team_loss');
    if (stats.team_loss_prob !== undefined && stats.team_loss_prob > 0) {
        points += teamLossMultiplier * stats.team_loss_prob;
    } else if (stats.team_loss) {
        points += teamLossMultiplier;
    }
    
    // Completion Percentage Penalty
    const compPct = (stats.completions || 0) / attempts;
    const compMultiplier = getScoringSetting(settings, 'completion_penalty_multiplier');
    points += compMultiplier * (1 - compPct);
    
    return points;
}

export function computeStandingsFromPicks(members = [], picks = [], statsMap = {}, settings = DEFAULT_SCORING) {
    const scoresByUser = {};
    members.forEach(m => {
        scoresByUser[m.user_id] = {
            user_id: m.user_id,
            team_name: m.team_name,
            season_points: 0,
            is_admin: !!m.is_admin
        };
    });

    picks.forEach(p => {
        const key = `${p.player_id}_${p.week}`;
        const stat = statsMap[key];
        const pts = calculateLeagueScore(stat, settings);
        if (scoresByUser[p.user_id]) {
            scoresByUser[p.user_id].season_points += pts;
        }
    });

    return Object.values(scoresByUser).sort((a, b) => b.season_points - a.season_points);
}

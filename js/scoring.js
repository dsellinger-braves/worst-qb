export function calculateLeagueScore(stats, settings) {
    if (!stats || !settings) return 0.0;
    
    // Check for "No Pass Attempts" penalty
    if (stats.attempts <= 0) {
        return parseFloat(settings.no_attempts) || -20.0;
    }
    
    let points = 0.0;
    
    // Standard Stats
    points += (stats.passing_yards || 0) * (parseFloat(settings.pass_yds) || -0.05);
    points += (stats.passing_tds || 0) * (parseFloat(settings.pass_tds) || -5.0);
    points += (stats.interceptions || 0) * (parseFloat(settings.ints) || 3.0);
    points += (stats.pick_sixes || 0) * (parseFloat(settings.pick_sixes) || 5.0);
    points += (stats.rushing_yards || 0) * (parseFloat(settings.rush_yds) || -0.1);
    points += (stats.rushing_tds || 0) * (parseFloat(settings.rush_tds) || -5.0);
    points += (stats.fumbles_lost || 0) * (parseFloat(settings.fumbles_lost) || 3.0);
    points += (stats.sacks || 0) * (parseFloat(settings.sacks) || 1.0);
    
    // Team Loss Bonus
    if (stats.team_loss) {
        points += parseFloat(settings.team_loss) || 5.0;
    }
    
    // Completion Percentage Penalty
    const compPct = (stats.completions || 0) / stats.attempts;
    const compMultiplier = parseFloat(settings.completion_penalty_multiplier) || 20.0;
    points += compMultiplier * (1 - compPct);
    
    return points;
}

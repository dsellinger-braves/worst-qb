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

export function calculateLeagueScoreBreakdown(stats, settings) {
    const emptyBreakdown = {
        attempts: 0,
        completions: 0,
        passing_yards: 0,
        passing_yards_pts: 0,
        passing_tds: 0,
        passing_tds_pts: 0,
        interceptions: 0,
        interceptions_pts: 0,
        pick_sixes: 0,
        pick_sixes_pts: 0,
        rushing_yards: 0,
        rushing_yards_pts: 0,
        rushing_tds: 0,
        rushing_tds_pts: 0,
        fumbles_lost: 0,
        fumbles_lost_pts: 0,
        sacks: 0,
        sacks_pts: 0,
        team_losses: 0,
        team_loss_pts: 0,
        comp_penalty_pts: 0,
        no_attempts_pts: 0,
        total_points: 0
    };

    if (!stats) return emptyBreakdown;

    const attempts = stats.attempts || 0;
    const passYds = stats.passing_yards || 0;
    const passTds = stats.passing_tds || 0;
    const ints = stats.interceptions || 0;
    const pickSixes = stats.pick_sixes || 0;
    const rushYds = stats.rushing_yards || 0;
    const rushTds = stats.rushing_tds || 0;
    const fumbles = stats.fumbles_lost || 0;
    const sacks = stats.sacks || 0;
    const teamLossMultiplier = getScoringSetting(settings, 'team_loss');

    let teamLossPts = 0;
    let teamLosses = 0;
    if (stats.team_loss_prob !== undefined && stats.team_loss_prob > 0) {
        teamLossPts = teamLossMultiplier * stats.team_loss_prob;
        teamLosses = stats.team_loss_prob >= 0.5 ? 1 : 0;
    } else if (stats.team_loss) {
        teamLossPts = teamLossMultiplier;
        teamLosses = 1;
    }

    if (attempts <= 0) {
        if (stats.is_live) {
            const pyPts = passYds * getScoringSetting(settings, 'pass_yds');
            const ptPts = passTds * getScoringSetting(settings, 'pass_tds');
            const intPts = ints * getScoringSetting(settings, 'ints');
            const p6Pts = pickSixes * getScoringSetting(settings, 'pick_sixes');
            const ryPts = rushYds * getScoringSetting(settings, 'rush_yds');
            const rtPts = rushTds * getScoringSetting(settings, 'rush_tds');
            const fPts = fumbles * getScoringSetting(settings, 'fumbles_lost');
            const sPts = sacks * getScoringSetting(settings, 'sacks');
            const total = pyPts + ptPts + intPts + p6Pts + ryPts + rtPts + fPts + sPts + teamLossPts;
            return {
                attempts: 0,
                completions: 0,
                passing_yards: passYds,
                passing_yards_pts: pyPts,
                passing_tds: passTds,
                passing_tds_pts: ptPts,
                interceptions: ints,
                interceptions_pts: intPts,
                pick_sixes: pickSixes,
                pick_sixes_pts: p6Pts,
                rushing_yards: rushYds,
                rushing_yards_pts: ryPts,
                rushing_tds: rushTds,
                rushing_tds_pts: rtPts,
                fumbles_lost: fumbles,
                fumbles_lost_pts: fPts,
                sacks: sacks,
                sacks_pts: sPts,
                team_losses: teamLosses,
                team_loss_pts: teamLossPts,
                comp_penalty_pts: 0,
                no_attempts_pts: 0,
                total_points: total
            };
        }
        const noAttPts = getScoringSetting(settings, 'no_attempts');
        return {
            ...emptyBreakdown,
            no_attempts_pts: noAttPts,
            total_points: noAttPts
        };
    }

    const pyPts = passYds * getScoringSetting(settings, 'pass_yds');
    const ptPts = passTds * getScoringSetting(settings, 'pass_tds');
    const intPts = ints * getScoringSetting(settings, 'ints');
    const p6Pts = pickSixes * getScoringSetting(settings, 'pick_sixes');
    const ryPts = rushYds * getScoringSetting(settings, 'rush_yds');
    const rtPts = rushTds * getScoringSetting(settings, 'rush_tds');
    const fPts = fumbles * getScoringSetting(settings, 'fumbles_lost');
    const sPts = sacks * getScoringSetting(settings, 'sacks');

    const compPct = (stats.completions || 0) / attempts;
    const compMultiplier = getScoringSetting(settings, 'completion_penalty_multiplier');
    const compPenaltyPts = compMultiplier * (1 - compPct);

    const total = pyPts + ptPts + intPts + p6Pts + ryPts + rtPts + fPts + sPts + teamLossPts + compPenaltyPts;

    return {
        attempts,
        completions: stats.completions || 0,
        passing_yards: passYds,
        passing_yards_pts: pyPts,
        passing_tds: passTds,
        passing_tds_pts: ptPts,
        interceptions: ints,
        interceptions_pts: intPts,
        pick_sixes: pickSixes,
        pick_sixes_pts: p6Pts,
        rushing_yards: rushYds,
        rushing_yards_pts: ryPts,
        rushing_tds: rushTds,
        rushing_tds_pts: rtPts,
        fumbles_lost: fumbles,
        fumbles_lost_pts: fPts,
        sacks: sacks,
        sacks_pts: sPts,
        team_losses: teamLosses,
        team_loss_pts: teamLossPts,
        comp_penalty_pts: compPenaltyPts,
        no_attempts_pts: 0,
        total_points: total
    };
}

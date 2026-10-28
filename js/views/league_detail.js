import { supabase } from '../supabase.js';
import { calculateLeagueScore, calculateLeagueScoreBreakdown } from '../scoring.js?v=1.8';
import { ClaimManager } from '../claim.js?v=1.7';
import { PickOfPicks } from '../pick_of_picks.js?v=1.7';

export const LeagueDetailView = {
    render: () => `
        <div class="view-container active glass-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h1 id="ld-title">Loading League...</h1>
                    <p id="ld-status" style="color: var(--text-secondary);"></p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <button id="ld-pick-picks-btn" class="btn" style="display: none; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">🎯 Pick of the Picks</button>
                    <button id="ld-advance-week-btn" class="btn" style="display: none; background: rgba(56, 189, 248, 0.2); color: var(--accent-secondary); border: 1px solid var(--accent-secondary);">Advance Week</button>
                    <button id="ld-settings-btn" class="btn" style="display: none;">League Settings</button>
                    <button id="ld-draft-btn" class="btn btn-primary" style="display: none;">Enter Draft Room</button>
                </div>
            </div>

            <!-- Non-Member Team Claim Banner -->
            <div id="ld-claim-banner" style="display: none; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                    <strong style="color: #60a5fa; font-size: 1rem;">Have a team in this league?</strong>
                    <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--text-secondary);">If your commissioner drafted or created a team for you, claim it to take control of your roster and picks!</p>
                </div>
                <button id="ld-banner-claim-btn" class="btn btn-primary" style="font-size: 0.9rem; padding: 0.5rem 1rem;">🏷️ Claim Your Team</button>
            </div>
            
            <!-- Tabs -->
            <div class="tabs" style="display: flex; gap: 1rem; border-bottom: 1px solid var(--glass-border); margin-bottom: 2rem; overflow-x: auto;">
                <button class="tab-btn active" data-tab="standings" style="background: none; border: none; color: var(--text-primary); padding: 0.5rem 1rem; cursor: pointer; border-bottom: 2px solid var(--accent-primary); font-weight: bold;">Season Standings</button>
                <button class="tab-btn" data-tab="cumulative" style="background: none; border: none; color: var(--text-secondary); padding: 0.5rem 1rem; cursor: pointer; font-weight: bold;">📊 Cumulative Scoring</button>
                <button class="tab-btn" data-tab="weekly" style="background: none; border: none; color: var(--text-secondary); padding: 0.5rem 1rem; cursor: pointer; font-weight: bold;">Weekly Performance</button>
                <button class="tab-btn" data-tab="team" style="background: none; border: none; color: var(--text-secondary); padding: 0.5rem 1rem; cursor: pointer; font-weight: bold;">Team Performance</button>
            </div>
            
            <!-- Tab Content: Standings -->
            <div id="tab-standings" class="tab-content" style="display: block;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                    <h2 style="margin: 0;">Teams & Standings</h2>
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <button id="ld-copy-claim-link-btn" class="btn" style="display: none; font-size: 0.85rem; padding: 0.4rem 0.8rem; background: rgba(255, 255, 255, 0.08); border: 1px solid var(--glass-border); color: #fff;">🔗 Copy Claim Link</button>
                        <button id="ld-add-member-btn" class="btn" style="display: none; font-size: 0.85rem; padding: 0.4rem 0.8rem; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa;">+ Add Team (No Account)</button>
                    </div>
                </div>

                <div id="ld-add-member-panel" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
                    <h4 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--accent-secondary); font-size: 1rem;">Add Offline / Non-Account Member</h4>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.4;">Add a friend or placeholder team who doesn't have an account. As commissioner, you can draft players on their behalf during the draft.</p>
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <input type="text" id="ld-new-team-name" class="form-input" placeholder="Team Name (e.g. Dave's Duds)" style="flex: 1; min-width: 220px;">
                        <button id="ld-save-new-team-btn" class="btn btn-primary">Add Team</button>
                        <button id="ld-cancel-new-team-btn" class="btn btn-secondary">Cancel</button>
                    </div>
                    <p id="ld-add-team-msg" style="margin-top: 0.5rem; font-size: 0.85rem; display: none;"></p>
                </div>

                <div id="ld-teams" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                    Loading teams...
            </div>
            
            <!-- Tab Content: Cumulative Scoring -->
            <div id="tab-cumulative" class="tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.4rem;">Cumulative Season Scoring by Team</h2>
                        <p style="margin: 0.25rem 0 0; color: var(--text-secondary); font-size: 0.85rem;">All regular season stats and scoring category breakdowns across all weeks.</p>
                    </div>
                    <a id="ld-open-full-cum-link" href="#/cumulative" class="btn btn-primary" style="font-size: 0.85rem; padding: 0.45rem 1rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
                        📊 Open Full Analytics Matrix
                    </a>
                </div>
                <div id="ld-cumulative-table" style="overflow-x: auto;">
                    <div class="loading-state" style="height: 200px; display: flex; align-items: center; justify-content: center;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
            
            <!-- Tab Content: Weekly -->
            <div id="tab-weekly" class="tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                    <h2>Weekly Dashboard</h2>
                    <div>
                        <label for="ld-week-select" style="font-weight: bold;">Select Week: </label>
                        <select id="ld-week-select" style="background: rgba(0,0,0,0.5); color: var(--text-primary); border: 1px solid var(--glass-border); padding: 0.5rem; border-radius: 4px; min-width: 100px;">
                            <option value="">Loading...</option>
                        </select>
                    </div>
                </div>
                <div id="ld-weekly-content" style="overflow-x: auto;"></div>
            </div>
            
            <!-- Tab Content: Team -->
            <div id="tab-team" class="tab-content" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                    <h2>Team Dashboard</h2>
                    <div>
                        <label for="ld-team-select" style="font-weight: bold;">Select Team: </label>
                        <select id="ld-team-select" style="background: rgba(0,0,0,0.5); color: var(--text-primary); border: 1px solid var(--glass-border); padding: 0.5rem; border-radius: 4px; min-width: 200px;">
                            <option value="">Loading...</option>
                        </select>
                    </div>
                </div>
                <div id="ld-team-content" style="overflow-x: auto;"></div>
            </div>
        </div>
            
        <!-- Settings Modal (outside view-container so fixed positioning is viewport-relative) -->
        <div id="ld-settings-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 1000; justify-content: center; align-items: flex-start; overflow-y: auto; padding: 2rem 1rem;">
                <div class="glass-panel" style="max-width: 600px; width: 100%; max-height: calc(100vh - 4rem); display: flex; flex-direction: column; padding: 0; margin: auto 0; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--glass-border); flex-shrink: 0;">
                        <h2 style="margin: 0; font-size: 1.35rem;">League Scoring Settings</h2>
                        <button id="ld-settings-close" type="button" class="btn" style="padding: 0.3rem 0.6rem; font-size: 1.1rem; line-height: 1;">✕</button>
                    </div>
                    <div style="overflow-y: auto; padding: 1.5rem; flex: 1;">
                        <form id="ld-settings-form">
                            <div>
                                <h3 style="margin-top: 0.5rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Passing</h3>
                                <div class="setting-row">
                                    <label>Pass Yds</label>
                                    <input type="number" step="0.01" id="s-pass-yds" class="form-input" style="width: 100px; text-align: right;">
                                </div>
                                <div class="setting-row">
                                    <label>Pass TDs</label>
                                    <input type="number" step="0.1" id="s-pass-tds" class="form-input" style="width: 100px; text-align: right;">
                                </div>
                                <div class="setting-row">
                                    <label>Interceptions</label>
                                    <input type="number" step="0.1" id="s-ints" class="form-input" style="width: 100px; text-align: right;">
                                </div>
                                <div class="setting-row">
                                    <label>Pick Sixes</label>
                                    <input type="number" step="0.1" id="s-pick-sixes" class="form-input" style="width: 100px; text-align: right;">
                                </div>
                                <div class="setting-row">
                                    <label>Completion % Penalty Multiplier</label>
                                    <input type="number" step="0.1" id="s-comp-mult" class="form-input" style="width: 100px; text-align: right;">
                                </div>

                                <h3 style="margin-top: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Rushing & Sacks</h3>
                                <div class="setting-row">
                                    <label>Rush Yds</label>
                                    <input type="number" step="0.01" id="s-rush-yds" class="form-input" style="width: 100px; text-align: right;">
                                </div>
                                <div class="setting-row">
                                    <label>Rush TDs</label>
                                    <input type="number" step="0.1" id="s-rush-tds" class="form-input" style="width: 100px; text-align: right;">
                                </div>
                                <div class="setting-row">
                                    <label>Fumbles Lost</label>
                                    <input type="number" step="0.1" id="s-fumbles" class="form-input" style="width: 100px; text-align: right;">
                                </div>
                                <div class="setting-row">
                                    <label>Sacks Taken</label>
                                    <input type="number" step="0.1" id="s-sacks" class="form-input" style="width: 100px; text-align: right;">
                                </div>

                                <h3 style="margin-top: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Custom Rules</h3>
                                <div class="setting-row">
                                    <label>Team Loss Bonus</label>
                                    <input type="number" step="0.1" id="s-team-loss" class="form-input" style="width: 100px; text-align: right;">
                                </div>
                                <div class="setting-row">
                                    <label>Golden Penalty (No Pass Attempts)</label>
                                    <input type="number" step="0.1" id="s-no-att" class="form-input" style="width: 100px; text-align: right;">
                                </div>

                                <h3 style="margin-top: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Draft Configuration</h3>
                                <div class="setting-row">
                                    <label for="s-draft-type">Draft Order Format</label>
                                    <select id="s-draft-type" class="form-input" style="width: 190px;">
                                        <option value="snake">Snake Draft (Default)</option>
                                        <option value="linear">Linear (Repeats)</option>
                                    </select>
                                </div>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: -0.25rem; margin-bottom: 1rem;">Snake reverses pick order in Round 2 (1st pick in Round 1 gets last pick in Round 2). Linear repeats the same order.</p>

                                <h3 style="margin-top: 2rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem; color: var(--accent-secondary); margin-bottom: 0.5rem;">Draft Order Override (Week <span id="s-draft-order-week"></span>)</h3>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Drag and drop to manually set the draft order for the current active week. Leave default to use standings.</p>
                                <ul id="s-draft-order-list" style="list-style: none; padding: 0; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                                    <!-- Draggable items injected here -->
                                </ul>
                                <button type="button" id="s-open-pop-btn" class="btn" style="width: 100%; justify-content: center; font-size: 0.85rem; padding: 0.55rem; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #fbbf24; font-weight: 600;">
                                    🎯 Open "Pick of the Picks" Selection Ceremony
                                </button>
                            </div>
                        </form>
                    </div>
                    <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--glass-border); background: var(--bg-secondary); flex-shrink: 0;">
                        <button type="submit" form="ld-settings-form" class="btn btn-primary" style="width: 100%; justify-content: center; font-weight: 600;">Save Settings & Order</button>
                    </div>
                </div>
            </div>
    `,
    init: async (params) => {
        const targetId = params?.league || params?.id;
        if (!supabase || !targetId) return;
        const leagueId = targetId;
        
        // --- State Variables ---
        LeagueDetailView.leagueId = leagueId;
        LeagueDetailView.teams = [];
        LeagueDetailView.picksByWeek = {};
        LeagueDetailView.picksByTeam = {};
        LeagueDetailView.maxWeek = 1;

        // Fetch League info
        const { data: league, error: lErr } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
        if (lErr) {
            const { data: { session: checkSession } } = await supabase.auth.getSession();
            if (!checkSession) {
                document.getElementById('ld-title').innerText = "Please Log In";
                document.getElementById('ld-status').innerText = "You must be logged in to view league details and claim a team.";
                const teamsContainer = document.getElementById('ld-teams');
                if (teamsContainer) {
                    teamsContainer.innerHTML = `
                        <div style="text-align: center; padding: 2.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 8px;">
                            <p style="margin-bottom: 1.25rem; color: var(--text-secondary); font-size: 1rem;">Log in or create an account to view this league and claim your team.</p>
                            <button onclick="document.getElementById('auth-modal').style.display='flex';" class="btn btn-primary" style="font-size: 1rem; padding: 0.6rem 1.5rem;">Log In / Create Account</button>
                        </div>
                    `;
                }
            } else {
                document.getElementById('ld-title').innerText = "Error loading league";
            }
            return;
        }
        
        document.getElementById('ld-title').innerText = league.name;
        document.getElementById('ld-status').innerText = `Week ${league.current_week} | Draft Status: ${league.draft_status}`;
        LeagueDetailView.maxWeek = league.current_week > 18 ? 18 : league.current_week;
        
        // Show Draft Button and route it via hash
        const draftBtn = document.getElementById('ld-draft-btn');
        draftBtn.style.display = 'block';
        draftBtn.addEventListener('click', () => {
            window.location.hash = `#/draft?league=${leagueId}`;
        });

        // Fetch Teams and check admin status
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session ? session.user.id : null;
        let isAdmin = false;

        const { data: teams, error: tErr } = await supabase.from('league_members')
            .select('user_id, team_name, season_points, is_admin, is_claimed')
            .eq('league_id', leagueId);
        if (teams) {
            LeagueDetailView.teams = teams;
            // Check if current user is admin (league creator or has is_admin flag)
            const myMember = teams.find(t => t.user_id === currentUserId);
            if ((league.created_by && league.created_by === currentUserId) || (myMember && myMember.is_admin)) {
                isAdmin = true;
            }
        }

        LeagueDetailView.currentUserId = currentUserId;
        LeagueDetailView.isAdmin = isAdmin;
        LeagueDetailView.isMember = Boolean(teams && teams.some(t => t.user_id === currentUserId));

        // Load claimable teams
        LeagueDetailView.claimableTeams = await ClaimManager.getClaimableTeams(leagueId);
        LeagueDetailView.claimableIds = new Set(LeagueDetailView.claimableTeams.map(t => t.user_id));

        // Setup Claim Banner for non-members
        const claimBanner = document.getElementById('ld-claim-banner');
        const bannerClaimBtn = document.getElementById('ld-banner-claim-btn');
        if (claimBanner && bannerClaimBtn) {
            if (!LeagueDetailView.isMember && LeagueDetailView.claimableTeams.length > 0) {
                claimBanner.style.display = 'flex';
                bannerClaimBtn.onclick = () => ClaimManager.openClaimModal(leagueId);
            } else {
                claimBanner.style.display = 'none';
            }
        }

        // Setup Copy Claim Link for commissioner
        const copyClaimLinkBtn = document.getElementById('ld-copy-claim-link-btn');
        if (copyClaimLinkBtn) {
            if (isAdmin) {
                copyClaimLinkBtn.style.display = 'inline-block';
                copyClaimLinkBtn.onclick = () => {
                    const claimUrl = `${window.location.origin}${window.location.pathname}#/claim?league=${leagueId}`;
                    navigator.clipboard.writeText(claimUrl);
                    alert(`Claim link copied to clipboard!\n\nShare this link with your league members to let them claim their team:\n${claimUrl}`);
                };
            } else {
                copyClaimLinkBtn.style.display = 'none';
            }
        }

        // Setup Pick of the Picks Header Button for Commissioner
        const popHeaderBtn = document.getElementById('ld-pick-picks-btn');
        if (popHeaderBtn) {
            if (isAdmin) {
                popHeaderBtn.style.display = 'inline-block';
                popHeaderBtn.onclick = () => {
                    PickOfPicks.openModal(leagueId, league.current_week);
                };
            } else {
                popHeaderBtn.style.display = 'none';
            }
        }

        // Setup Admin Settings UI and Advance Week
        if (isAdmin) {
            const settingsBtn = document.getElementById('ld-settings-btn');
            settingsBtn.style.display = 'block';
            LeagueDetailView.setupAdminSettings(league);

            const advanceBtn = document.getElementById('ld-advance-week-btn');
            advanceBtn.style.display = 'block';
            const currentWeek = league.current_week || 1;
            const nextWeek = currentWeek + 1;
            
            if (currentWeek >= 18) {
                advanceBtn.innerText = 'Season Complete (Wk 18)';
                advanceBtn.disabled = true;
                advanceBtn.style.opacity = '0.5';
                advanceBtn.style.cursor = 'not-allowed';
            } else {
                advanceBtn.innerText = `Advance to Week ${nextWeek}`;
                advanceBtn.onclick = async () => {
                    const confirmed = confirm(
                        `Are you sure you want to advance ${league.name} to Week ${nextWeek}?\n\n` +
                        `This will save all teams' current calculated season points to the database and set the active draft week to Week ${nextWeek}.`
                    );
                    if (!confirmed) return;

                    advanceBtn.disabled = true;
                    advanceBtn.innerText = 'Advancing...';

                    // 1. Save dynamic season points for all teams
                    for (const team of LeagueDetailView.teams) {
                        await supabase.from('league_members')
                            .update({ season_points: parseFloat(team.season_points.toFixed(2)) })
                            .eq('league_id', leagueId)
                            .eq('user_id', team.user_id);
                    }

                    // 2. Increment league current_week and reset draft_status
                    const { error: advErr } = await supabase.from('leagues')
                        .update({ current_week: nextWeek, draft_status: 'pending' })
                        .eq('id', leagueId);

                    if (advErr) {
                        alert("Error advancing week: " + advErr.message);
                        advanceBtn.disabled = false;
                        advanceBtn.innerText = `Advance to Week ${nextWeek}`;
                    } else {
                        alert(`Successfully advanced to Week ${nextWeek}! Season points saved.`);
                        LeagueDetailView.init({ league: leagueId });
                    }
                };
            }

            // Setup Add Member (No Account Needed) for Commissioner
            const addMemberBtn = document.getElementById('ld-add-member-btn');
            const addMemberPanel = document.getElementById('ld-add-member-panel');
            const newTeamInput = document.getElementById('ld-new-team-name');
            const saveTeamBtn = document.getElementById('ld-save-new-team-btn');
            const cancelTeamBtn = document.getElementById('ld-cancel-new-team-btn');
            const teamMsg = document.getElementById('ld-add-team-msg');

            if (addMemberBtn) {
                addMemberBtn.style.display = 'inline-block';
                addMemberBtn.onclick = () => {
                    const isOpen = addMemberPanel.style.display === 'block';
                    addMemberPanel.style.display = isOpen ? 'none' : 'block';
                    if (!isOpen) {
                        newTeamInput.focus();
                        teamMsg.style.display = 'none';
                    }
                };
                cancelTeamBtn.onclick = () => {
                    addMemberPanel.style.display = 'none';
                    newTeamInput.value = '';
                    teamMsg.style.display = 'none';
                };
                saveTeamBtn.onclick = async () => {
                    const teamName = newTeamInput.value.trim();
                    if (!teamName) {
                        teamMsg.style.display = 'block';
                        teamMsg.style.color = 'var(--danger-color)';
                        teamMsg.innerText = 'Please enter a team name.';
                        return;
                    }
                    saveTeamBtn.disabled = true;
                    saveTeamBtn.innerText = 'Adding...';

                    // Generate standard RFC4122 v4 UUID
                    const generateUUID = () => {
                        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                            return crypto.randomUUID();
                        }
                        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                            return v.toString(16);
                        });
                    };

                    const offlineUserId = generateUUID();
                    const { error: insErr } = await supabase.from('league_members').insert({
                        league_id: leagueId,
                        user_id: offlineUserId,
                        team_name: teamName,
                        season_points: 0,
                        draft_position: LeagueDetailView.teams.length + 1,
                        is_admin: false
                    });

                    if (insErr) {
                        console.error("Add team error:", insErr);
                        saveTeamBtn.disabled = false;
                        saveTeamBtn.innerText = 'Add Team';
                        teamMsg.style.display = 'block';
                        teamMsg.style.color = 'var(--danger-color)';
                        if (insErr.message && (insErr.message.includes('league_members_user_id_fkey') || insErr.code === '23503')) {
                            teamMsg.innerText = 'Database setup required: Please run schema_offline_members.sql in your Supabase SQL Editor to allow non-account members.';
                        } else {
                            teamMsg.innerText = 'Error adding team: ' + insErr.message;
                        }
                    } else {
                        addMemberPanel.style.display = 'none';
                        newTeamInput.value = '';
                        saveTeamBtn.disabled = false;
                        saveTeamBtn.innerText = 'Add Team';
                        alert(`Team "${teamName}" added to the league!`);
                        LeagueDetailView.init({ league: leagueId });
                    }
                };
            }
        }

        // Fetch Draft Picks
        const { data: picks, error: pErr } = await supabase.from('draft_picks')
            .select('week, pick_number, user_id, player_id, players(name, id)')
            .eq('league_id', leagueId)
            .order('week', { ascending: true });
            
        if (pErr) console.error("Error fetching picks:", pErr);
            
        // Fetch Regular Season Player Stats for all drafted players (targeted query avoids 1000-row limit)
        const pickedPlayerIds = [...new Set((picks || []).map(p => p.player_id).filter(Boolean))];
        const statsMap = {}; // key: "player_id_week" -> stats object
        
        if (pickedPlayerIds.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < pickedPlayerIds.length; i += chunkSize) {
                const chunk = pickedPlayerIds.slice(i, i + chunkSize);
                const { data: statsData } = await supabase.from('player_stats')
                    .select('*')
                    .in('player_id', chunk)
                    .eq('season_type', 'regular');
                if (statsData) {
                    statsData.forEach(s => {
                        statsMap[`${s.player_id}_${s.week}`] = s;
                    });
                }
            }
        }
        
        if (picks && picks.length > 0) {
            // Reset dynamic season points for recalculation
            LeagueDetailView.teams.forEach(t => t.season_points = 0);

            // Create a lookup map for team names based on user_id
            const teamMap = {};
            if (LeagueDetailView.teams) {
                LeagueDetailView.teams.forEach(t => {
                    teamMap[t.user_id] = t.team_name;
                });
            }

            // Group picks by week
            LeagueDetailView.picksByWeek = picks.reduce((acc, pick) => {
                acc[pick.week] = acc[pick.week] || [];
                // Attach dynamic points using league settings
                const stats = statsMap[`${pick.player_id}_${pick.week}`];
                pick.points = calculateLeagueScore(stats, league.scoring_settings);
                pick.team_name = teamMap[pick.user_id] || 'Unknown Team';
                acc[pick.week].push(pick);
                return acc;
            }, {});
            
            // Group picks by team and update dynamic standings
            LeagueDetailView.picksByTeam = picks.reduce((acc, pick) => {
                acc[pick.user_id] = acc[pick.user_id] || { team_name: pick.team_name, weeks: {} };
                acc[pick.user_id].weeks[pick.week] = acc[pick.user_id].weeks[pick.week] || [];
                acc[pick.user_id].weeks[pick.week].push(pick);
                
                // Add to dynamic team standings
                const teamObj = LeagueDetailView.teams.find(t => t.user_id === pick.user_id);
                if (teamObj) {
                    teamObj.season_points += pick.points;
                }
                
                return acc;
            }, {});
            
            // Re-sort teams based on newly calculated dynamic points
            LeagueDetailView.teams.sort((a, b) => b.season_points - a.season_points);
            
            // Update max week based on picks
            const draftedWeeks = Object.keys(LeagueDetailView.picksByWeek).map(Number);
            if (draftedWeeks.length > 0) {
                LeagueDetailView.maxWeek = Math.max(...draftedWeeks);
            }
        }

        // Setup Event Listeners
        LeagueDetailView.setupTabs();
        LeagueDetailView.setupSelectors();

        // Update full cumulative matrix link
        const fullCumLink = document.getElementById('ld-open-full-cum-link');
        if (fullCumLink) fullCumLink.href = `#/cumulative?league=${leagueId}`;

        // Initial Renders
        LeagueDetailView.renderStandings();
        LeagueDetailView.renderCumulativeTab(picks, statsMap, league.scoring_settings);
        LeagueDetailView.renderWeeklyView(LeagueDetailView.maxWeek);
        if (LeagueDetailView.teams.length > 0) {
            LeagueDetailView.renderTeamView(LeagueDetailView.teams[0].user_id);
        }

        // Auto-select tab if specified in URL query
        if (params?.tab) {
            const targetTabBtn = document.querySelector(`.tab-btn[data-tab="${params.tab}"]`);
            if (targetTabBtn) targetTabBtn.click();
        }
    },
    setupAdminSettings: (league) => {
        const modal = document.getElementById('ld-settings-modal');
        document.getElementById('ld-settings-btn').onclick = () => {
            const s = league.scoring_settings || {};
            document.getElementById('s-pass-yds').value = s.pass_yds ?? -0.05;
            document.getElementById('s-pass-tds').value = s.pass_tds ?? -5.0;
            document.getElementById('s-ints').value = s.ints ?? 5.0;
            document.getElementById('s-pick-sixes').value = s.pick_sixes ?? 10.0;
            document.getElementById('s-rush-yds').value = s.rush_yds ?? -0.1;
            document.getElementById('s-rush-tds').value = s.rush_tds ?? -5.0;
            document.getElementById('s-fumbles').value = s.fumbles_lost ?? 4.0;
            document.getElementById('s-sacks').value = s.sacks ?? 1.0;
            document.getElementById('s-team-loss').value = s.team_loss ?? 5.0;
            document.getElementById('s-no-att').value = s.no_attempts ?? -20.0;
            document.getElementById('s-comp-mult').value = s.completion_penalty_multiplier ?? 20.0;
            const draftTypeSelect = document.getElementById('s-draft-type');
            if (draftTypeSelect) draftTypeSelect.value = s.draft_type || 'snake';
            
            // Draft Order
            document.getElementById('s-draft-order-week').innerText = league.current_week;
            const draftList = document.getElementById('s-draft-order-list');
            const existingOverrides = s.draft_order_overrides || {};
            const currentOverride = existingOverrides[league.current_week];
            
            let orderedTeams = [...LeagueDetailView.teams];
            if (currentOverride) {
                orderedTeams.sort((a, b) => {
                    const idxA = currentOverride.indexOf(a.user_id);
                    const idxB = currentOverride.indexOf(b.user_id);
                    if (idxA === -1 && idxB === -1) return 0;
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            } else {
                orderedTeams.sort((a, b) => a.season_points - b.season_points);
            }
            
            draftList.innerHTML = orderedTeams.map((t, i) => `
                <li class="draft-order-item" draggable="true" data-userid="${t.user_id}" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 4px; display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none;">
                    <span><span class="order-num" style="color: var(--text-secondary); margin-right: 0.5rem;">${i + 1}.</span> ${t.team_name}</span>
                    <span style="color: var(--text-secondary);">☰</span>
                </li>
            `).join('');

            // Drag and Drop Logic
            let draggedItem = null;
            draftList.querySelectorAll('.draft-order-item').forEach(item => {
                item.addEventListener('dragstart', () => {
                    draggedItem = item;
                    setTimeout(() => item.style.opacity = '0.5', 0);
                });
                item.addEventListener('dragend', () => {
                    setTimeout(() => {
                        draggedItem.style.opacity = '1';
                        draggedItem = null;
                        draftList.querySelectorAll('.draft-order-item').forEach((li, idx) => {
                            li.querySelector('.order-num').innerText = `${idx + 1}.`;
                        });
                    }, 0);
                });
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const afterElement = [...draftList.querySelectorAll('.draft-order-item:not(.dragging)')].find(child => {
                        return e.clientY <= child.getBoundingClientRect().top + child.offsetHeight / 2;
                    });
                    if (afterElement == null) {
                        draftList.appendChild(draggedItem);
                    } else {
                        draftList.insertBefore(draggedItem, afterElement);
                    }
                });
            });

            modal.style.display = 'flex';
        };
        
        document.getElementById('ld-settings-close').onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };

        const sPopBtn = document.getElementById('s-open-pop-btn');
        if (sPopBtn) {
            sPopBtn.onclick = () => {
                modal.style.display = 'none';
                PickOfPicks.openModal(league.id, league.current_week);
            };
        }
        
        document.getElementById('ld-settings-form').onsubmit = async (e) => {
            e.preventDefault();
            
            const newOverrides = {};
            const draftList = document.getElementById('s-draft-order-list');
            draftList.querySelectorAll('.draft-order-item').forEach(item => {
                const uid = item.getAttribute('data-userid');
                if (!newOverrides[league.current_week]) newOverrides[league.current_week] = [];
                newOverrides[league.current_week].push(uid);
            });
            
            const existingOverrides = league.scoring_settings?.draft_order_overrides || {};
            
            const newSettings = {
                pass_yds: parseFloat(document.getElementById('s-pass-yds').value),
                pass_tds: parseFloat(document.getElementById('s-pass-tds').value),
                ints: parseFloat(document.getElementById('s-ints').value),
                pick_sixes: parseFloat(document.getElementById('s-pick-sixes').value),
                rush_yds: parseFloat(document.getElementById('s-rush-yds').value),
                rush_tds: parseFloat(document.getElementById('s-rush-tds').value),
                fumbles_lost: parseFloat(document.getElementById('s-fumbles').value),
                sacks: parseFloat(document.getElementById('s-sacks').value),
                team_loss: parseFloat(document.getElementById('s-team-loss').value),
                no_attempts: parseFloat(document.getElementById('s-no-att').value),
                completion_penalty_multiplier: parseFloat(document.getElementById('s-comp-mult').value),
                draft_type: document.getElementById('s-draft-type') ? document.getElementById('s-draft-type').value : 'snake',
                draft_order_overrides: {
                    ...existingOverrides,
                    ...newOverrides
                }
            };
            
            const { error } = await supabase.from('leagues').update({ scoring_settings: newSettings }).eq('id', league.id);
            if (error) {
                alert("Error saving settings.");
            } else {
                modal.style.display = 'none';
                LeagueDetailView.init({ league: league.id }); // Reload to recalculate
            }
        };
    },

    setupTabs: () => {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update button styles
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.color = 'var(--text-secondary)';
                    b.style.borderBottom = 'none';
                });
                e.target.classList.add('active');
                e.target.style.color = 'var(--text-primary)';
                e.target.style.borderBottom = '2px solid var(--accent-primary)';
                
                // Show content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.style.display = 'none';
                });
                const targetId = `tab-${e.target.getAttribute('data-tab')}`;
                document.getElementById(targetId).style.display = 'block';
            });
        });
    },
    
    setupSelectors: () => {
        // Week Selector
        const weekSelect = document.getElementById('ld-week-select');
        let weekOptions = '';
        for (let w = 1; w <= 18; w++) {
            const hasData = LeagueDetailView.picksByWeek[w] ? '' : ' (No Picks)';
            weekOptions += `<option value="${w}" ${w === LeagueDetailView.maxWeek ? 'selected' : ''}>Week ${w}${hasData}</option>`;
        }
        weekSelect.innerHTML = weekOptions;
        weekSelect.addEventListener('change', (e) => {
            LeagueDetailView.renderWeeklyView(parseInt(e.target.value));
        });
        
        // Team Selector
        const teamSelect = document.getElementById('ld-team-select');
        let teamOptions = '';
        LeagueDetailView.teams.forEach(t => {
            teamOptions += `<option value="${t.user_id}">${t.team_name}</option>`;
        });
        teamSelect.innerHTML = teamOptions;
        teamSelect.addEventListener('change', (e) => {
            LeagueDetailView.renderTeamView(e.target.value);
        });
    },
    
    renderStandings: () => {
        const teamsContainer = document.getElementById('ld-teams');
        if (LeagueDetailView.teams.length === 0) {
            teamsContainer.innerHTML = '<p>No teams in this league yet.</p>';
            return;
        }

        teamsContainer.innerHTML = LeagueDetailView.teams.map((t, idx) => {
            const isClaimable = LeagueDetailView.claimableIds && LeagueDetailView.claimableIds.has(t.user_id);
            const isMyTeam = LeagueDetailView.currentUserId && t.user_id === LeagueDetailView.currentUserId;
            
            let actionBadgeHtml = '';
            if (isMyTeam) {
                actionBadgeHtml = `<span style="background: rgba(56, 189, 248, 0.2); color: var(--accent-secondary); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 4px; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 600;">Your Team</span>`;
            } else if (isClaimable) {
                if (!LeagueDetailView.isMember) {
                    actionBadgeHtml = `
                        <button onclick="window.ClaimManager.openClaimModal('${LeagueDetailView.leagueId}', '${t.user_id}')" class="btn btn-primary" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; white-space: nowrap;">
                            🏷️ Claim This Team
                        </button>
                    `;
                } else if (LeagueDetailView.isAdmin) {
                    const escName = (t.team_name || 'team').replace(/'/g, "\\'");
                    actionBadgeHtml = `
                        <div style="display: flex; gap: 0.4rem; align-items: center;">
                            <span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.75rem; font-weight: 600;">⏳ Unclaimed</span>
                            <button onclick="navigator.clipboard.writeText('${window.location.origin}${window.location.pathname}#/claim?league=${LeagueDetailView.leagueId}&team=${t.user_id}'); alert('Claim link for team ${escName} copied to clipboard!');" title="Copy Claim Link for this team" class="btn" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); color: #fff; cursor: pointer;">
                                📋 Invite Link
                            </button>
                        </div>
                    `;
                }
            } else if (LeagueDetailView.isAdmin && !t.is_admin) {
                actionBadgeHtml = `<span style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.75rem;">👤 Claimed</span>`;
            }

            return `
            <div style="background: rgba(0,0,0,0.2); padding: 1.25rem 1.5rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <div style="font-size: 1.2rem;"><strong>${idx + 1}. ${t.team_name}</strong></div>
                    ${actionBadgeHtml}
                </div>
                <div style="color: var(--accent-primary); font-weight: bold; font-size: 1.5rem;">${t.season_points.toFixed(2)} pts</div>
            </div>
            `;
        }).join('');
    },
    
    renderCumulativeTab: (picks, statsMap, settings) => {
        const container = document.getElementById('ld-cumulative-table');
        if (!container) return;

        if (!picks || picks.length === 0) {
            container.innerHTML = `<div style="padding: 2.5rem; text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px; color: var(--text-secondary);">No draft picks or stats recorded yet for this league.</div>`;
            return;
        }

        // Aggregate by member
        const teamMap = {};
        (LeagueDetailView.teams || []).forEach(t => {
            teamMap[t.user_id] = {
                team_name: t.team_name,
                user_id: t.user_id,
                ints: 0,
                pick_sixes: 0,
                sacks: 0,
                fumbles_lost: 0,
                team_losses: 0,
                comp_pen: 0,
                pass_yds: 0,
                pass_tds: 0,
                rush_yds: 0,
                rush_tds: 0,
                total_pts: 0,
                starts: 0
            };
        });

        picks.forEach(p => {
            if (!teamMap[p.user_id]) {
                teamMap[p.user_id] = {
                    team_name: p.team_name || 'Team',
                    user_id: p.user_id,
                    ints: 0,
                    pick_sixes: 0,
                    sacks: 0,
                    fumbles_lost: 0,
                    team_losses: 0,
                    comp_pen: 0,
                    pass_yds: 0,
                    pass_tds: 0,
                    rush_yds: 0,
                    rush_tds: 0,
                    total_pts: 0,
                    starts: 0
                };
            }
            const tm = teamMap[p.user_id];
            const stat = statsMap?.[`${p.player_id}_${p.week}`];
            const b = calculateLeagueScoreBreakdown(stat, settings);

            tm.starts += 1;
            tm.ints += b.interceptions;
            tm.pick_sixes += b.pick_sixes;
            tm.sacks += b.sacks;
            tm.fumbles_lost += b.fumbles_lost;
            tm.team_losses += b.team_losses;
            tm.comp_pen += b.comp_penalty_pts;
            tm.pass_yds += b.passing_yards;
            tm.pass_tds += b.passing_tds;
            tm.rush_yds += b.rushing_yards;
            tm.rush_tds += b.rushing_tds;
            tm.total_pts += b.total_points;
        });

        const sortedTeams = Object.values(teamMap).sort((a, b) => b.total_pts - a.total_pts);

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; min-width: 820px; font-size: 0.9rem;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--glass-border); text-align: right; font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">
                        <th style="padding: 0.85rem 0.5rem; text-align: left;">Rank / Team</th>
                        <th style="padding: 0.85rem 0.5rem;" title="Starts">Starts</th>
                        <th style="padding: 0.85rem 0.5rem; color: #f87171;" title="Interceptions">INT</th>
                        <th style="padding: 0.85rem 0.5rem; color: #ef4444;" title="Pick Sixes">Pick-6</th>
                        <th style="padding: 0.85rem 0.5rem; color: #fb923c;" title="Sacks Taken">Sacks</th>
                        <th style="padding: 0.85rem 0.5rem; color: #fbbf24;" title="Fumbles Lost">Fum</th>
                        <th style="padding: 0.85rem 0.5rem; color: #ca8a04;" title="Team Losses">Loss</th>
                        <th style="padding: 0.85rem 0.5rem; color: #e879f9;" title="Incompletion Penalty Pts">Comp Pen</th>
                        <th style="padding: 0.85rem 0.5rem;" title="Passing Yards">Pass Yds</th>
                        <th style="padding: 0.85rem 0.5rem;" title="Passing Touchdowns">Pass TD</th>
                        <th style="padding: 0.85rem 0.5rem;" title="Rushing Yards">Rush Yds</th>
                        <th style="padding: 0.85rem 0.5rem;" title="Rushing Touchdowns">Rush TD</th>
                        <th style="padding: 0.85rem 0.75rem; color: var(--accent-primary); font-size: 0.95rem;">Total Pts</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedTeams.map((t, idx) => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 0.85rem 0.5rem; text-align: left;">
                                <div style="font-weight: 700; color: #fff;">${idx + 1}. ${t.team_name}</div>
                            </td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; color: var(--text-secondary);">${t.starts}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; font-weight: 600; color: #f87171;">${t.ints}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; font-weight: 600; color: #ef4444;">${t.pick_sixes}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; font-weight: 600; color: #fb923c;">${t.sacks}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; font-weight: 600; color: #fbbf24;">${t.fumbles_lost}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; font-weight: 600; color: #ca8a04;">${t.team_losses}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; font-weight: 600; color: #e879f9;">+${t.comp_pen.toFixed(1)}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; color: var(--text-secondary);">${t.pass_yds.toLocaleString()}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; color: var(--text-secondary);">${t.pass_tds}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; color: var(--text-secondary);">${t.rush_yds.toLocaleString()}</td>
                            <td style="padding: 0.85rem 0.5rem; text-align: right; color: var(--text-secondary);">${t.rush_tds}</td>
                            <td style="padding: 0.85rem 0.75rem; text-align: right; font-weight: 800; font-size: 1.05rem; color: var(--accent-primary);">
                                ${t.total_pts.toFixed(2)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },
    
    renderWeeklyView: (week) => {
        const container = document.getElementById('ld-weekly-content');
        const picks = LeagueDetailView.picksByWeek[week];
        
        if (!picks || picks.length === 0) {
            container.innerHTML = `<div style="padding: 2rem; text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px;">No draft picks recorded for Week ${week}.</div>`;
            return;
        }
        
        // Group by team
        const teamsData = {};
        picks.forEach(p => {
            if (!teamsData[p.user_id]) {
                teamsData[p.user_id] = { team_name: p.team_name, picks: [], totalPoints: 0 };
            }
            teamsData[p.user_id].picks.push(p);
            teamsData[p.user_id].totalPoints += p.points;
        });
        
        // Sort teams by weekly points (descending)
        const sortedTeams = Object.values(teamsData).sort((a, b) => b.totalPoints - a.totalPoints);
        
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                <span style="font-size: 0.9rem; color: var(--text-secondary);">Week ${week} Leaderboard</span>
                <a href="#/scoreboard?league=${LeagueDetailView.leagueId}&week=${week}" class="btn btn-primary" style="font-size: 0.85rem; padding: 0.4rem 0.9rem; display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none;">
                    ⚡ Open Full Live Scoreboard
                </a>
            </div>
            <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                <tr style="border-bottom: 2px solid var(--glass-border); text-align: left;">
                    <th style="padding: 1rem 0.5rem;">Rank</th>
                    <th style="padding: 1rem 0.5rem;">Team</th>
                    <th style="padding: 1rem 0.5rem;">Pick 1</th>
                    <th style="padding: 1rem 0.5rem;">Pick 2</th>
                    <th style="padding: 1rem 0.5rem; color: var(--accent-primary);">Weekly Total</th>
                </tr>
                ${sortedTeams.map((t, idx) => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 1rem 0.5rem; font-weight: bold;">${idx + 1}</td>
                        <td style="padding: 1rem 0.5rem;">${t.team_name}</td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#/player_profile?id=${t.picks[0]?.players?.id}&league=${LeagueDetailView.leagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${t.picks[0]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${t.picks[0] ? t.picks[0].points.toFixed(2) : '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#/player_profile?id=${t.picks[1]?.players?.id}&league=${LeagueDetailView.leagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${t.picks[1]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${t.picks[1] ? t.picks[1].points.toFixed(2) : '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold; font-size: 1.1rem;">${t.totalPoints.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    },
    
    renderTeamView: (userId) => {
        const container = document.getElementById('ld-team-content');
        const teamData = LeagueDetailView.picksByTeam[userId];
        
        if (!teamData) {
            container.innerHTML = `<div style="padding: 2rem; text-align: center; background: rgba(0,0,0,0.2); border-radius: 8px;">No draft history found for this team.</div>`;
            return;
        }
        
        const weeks = Object.keys(teamData.weeks).map(Number).sort((a, b) => a - b);
        let cumulativePoints = 0;
        
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                <tr style="border-bottom: 2px solid var(--glass-border); text-align: left;">
                    <th style="padding: 1rem 0.5rem;">Week</th>
                    <th style="padding: 1rem 0.5rem;">Pick 1</th>
                    <th style="padding: 1rem 0.5rem;">Pick 2</th>
                    <th style="padding: 1rem 0.5rem; color: var(--accent-primary);">Weekly Pts</th>
                    <th style="padding: 1rem 0.5rem;">Season Pts</th>
                </tr>
                ${weeks.map(w => {
                    const picks = teamData.weeks[w];
                    const wPts = picks.reduce((sum, p) => sum + p.points, 0);
                    cumulativePoints += wPts;
                    return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 1rem 0.5rem; font-weight: bold;">Week ${w}</td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#/player_profile?id=${picks[0]?.players?.id}&league=${LeagueDetailView.leagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${picks[0]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${picks[0] ? picks[0].points.toFixed(2) : '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem;">
                            <a href="#/player_profile?id=${picks[1]?.players?.id}&league=${LeagueDetailView.leagueId}" style="color: var(--text-primary); text-decoration: none; font-weight: 600;">${picks[1]?.players?.name || '-'}</a>
                            <br><span style="font-size: 0.8rem; color: var(--accent-secondary);">${picks[1] ? picks[1].points.toFixed(2) : '0.00'} pts</span>
                        </td>
                        <td style="padding: 1rem 0.5rem; color: var(--accent-primary); font-weight: bold; font-size: 1.1rem;">${wPts.toFixed(2)}</td>
                        <td style="padding: 1rem 0.5rem; font-weight: bold;">${cumulativePoints.toFixed(2)}</td>
                    </tr>
                    `;
                }).join('')}
            </table>
        `;
    }
};

window.LeagueDetailView = LeagueDetailView;

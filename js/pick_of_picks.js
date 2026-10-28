import { supabase } from './supabase.js';
import { calculateLeagueScore } from './scoring.js?v=1.8';

export const PickOfPicks = {
    state: {
        leagueId: null,
        targetWeek: 1,
        precedingWeek: 1,
        league: null,
        members: [],
        orderedChoosers: [],
        slotAssignments: {}, // slotNum (1..N) -> userId
        currentChooserIdx: 0,
        isAdmin: false,
        currentUserId: null
    },

    // Compute preceding week performance to establish selection order
    getPrecedingWeekPerformance: async (leagueId, targetWeek, leagueSettings) => {
        if (!supabase) return [];
        const pw = Math.max(1, targetWeek - 1);

        // Fetch members
        const { data: members, error: mErr } = await supabase
            .from('league_members')
            .select('user_id, team_name, season_points, draft_position, is_admin')
            .eq('league_id', leagueId);

        if (mErr || !members) return [];

        if (targetWeek <= 1) {
            // For Week 1, order by initial draft position or season points
            return members.map((m, idx) => ({
                ...m,
                preceding_week_score: null,
                choice_priority: idx + 1,
                reason: 'Week 1 Base Draft Position'
            })).sort((a, b) => (a.draft_position || 999) - (b.draft_position || 999));
        }

        // Fetch preceding week picks
        const { data: picks } = await supabase
            .from('draft_picks')
            .select('user_id, player_id')
            .eq('league_id', leagueId)
            .eq('week', pw);

        const pickedPlayerIds = [...new Set((picks || []).map(p => p.player_id).filter(Boolean))];
        const statsMap = {};
        if (pickedPlayerIds.length > 0) {
            const chunkSize = 200;
            for (let i = 0; i < pickedPlayerIds.length; i += chunkSize) {
                const chunk = pickedPlayerIds.slice(i, i + chunkSize);
                const { data: stData } = await supabase.from('player_stats')
                    .select('*')
                    .in('player_id', chunk)
                    .eq('week', pw)
                    .eq('season_type', 'regular');
                if (stData) {
                    stData.forEach(s => { statsMap[s.player_id] = s; });
                }
            }
        }

        // Calculate preceding week scores per member
        const weekScores = {};
        members.forEach(m => { weekScores[m.user_id] = 0; });

        (picks || []).forEach(p => {
            const st = statsMap[p.player_id];
            const pts = calculateLeagueScore(st, leagueSettings);
            if (weekScores[p.user_id] !== undefined) {
                weekScores[p.user_id] += pts;
            }
        });

        // In Worst QB, lowest score = worst performance the preceding week = 1st choice!
        const choosers = members.map(m => ({
            ...m,
            preceding_week_score: weekScores[m.user_id] || 0,
            has_picks: (picks || []).some(p => p.user_id === m.user_id)
        }));

        choosers.sort((a, b) => {
            // If one had picks and one didn't, the one with lower score picks first
            return a.preceding_week_score - b.preceding_week_score;
        });

        return choosers.map((m, idx) => ({
            ...m,
            choice_priority: idx + 1,
            reason: `Week ${pw} Total: ${m.preceding_week_score.toFixed(2)} pts`
        }));
    },

    // Open the Pick of the Picks Interactive Ceremony / Selection Board
    openModal: async (leagueId, overrideWeek = null) => {
        const modal = document.getElementById('pick-of-picks-modal');
        if (!modal) return;

        modal.style.display = 'flex';
        const contentEl = document.getElementById('pop-modal-content');
        contentEl.innerHTML = `
            <div style="padding: 3rem; text-align: center;">
                <div class="spinner" style="margin: 0 auto 1rem;"></div>
                <p style="color: var(--text-secondary);">Loading Pick of the Picks Board...</p>
            </div>
        `;

        // Load league and session
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session ? session.user.id : null;
        PickOfPicks.state.currentUserId = currentUserId;

        const { data: league, error: lErr } = await supabase
            .from('leagues')
            .select('*')
            .eq('id', leagueId)
            .single();

        if (lErr || !league) {
            contentEl.innerHTML = `<p style="color: var(--danger-color); padding: 2rem;">Error loading league for Pick of the Picks.</p>`;
            return;
        }

        const currentWeek = overrideWeek || league.current_week || 1;
        const precedingWeek = Math.max(1, currentWeek - 1);
        PickOfPicks.state.leagueId = leagueId;
        PickOfPicks.state.targetWeek = currentWeek;
        PickOfPicks.state.precedingWeek = precedingWeek;
        PickOfPicks.state.league = league;

        // Check Admin
        const { data: members } = await supabase.from('league_members').select('*').eq('league_id', leagueId);
        PickOfPicks.state.members = members || [];
        const isGuest = !currentUserId;
        const myMember = (members || []).find(m => m.user_id === currentUserId);
        const isAdmin = (league.created_by === currentUserId) || !!(myMember && myMember.is_admin) || isGuest;
        PickOfPicks.state.isAdmin = isAdmin;
        PickOfPicks.state.isGuest = isGuest;

        // Compute ordered choosers
        const choosers = await PickOfPicks.getPrecedingWeekPerformance(leagueId, currentWeek, league.scoring_settings);
        PickOfPicks.state.orderedChoosers = choosers;

        // Existing slot assignments (from draft_order_overrides or saved pick_of_the_picks)
        const savedPop = league.scoring_settings?.pick_of_the_picks?.[currentWeek]?.slot_assignments;
        const currentOverrides = league.scoring_settings?.draft_order_overrides?.[currentWeek];

        const slotAssignments = {};
        if (savedPop && Object.keys(savedPop).length > 0) {
            Object.assign(slotAssignments, savedPop);
        } else if (currentOverrides && Array.isArray(currentOverrides)) {
            // Reconstruct slots from existing draft override array: index i is Slot (i + 1)
            currentOverrides.forEach((uid, idx) => {
                slotAssignments[idx + 1] = uid;
            });
        }
        PickOfPicks.state.slotAssignments = slotAssignments;

        PickOfPicks.renderBoard();
    },

    // Render the interactive board
    renderBoard: () => {
        const { targetWeek, precedingWeek, orderedChoosers, slotAssignments, members, isAdmin, currentUserId, league } = PickOfPicks.state;
        const contentEl = document.getElementById('pop-modal-content');
        const teamCount = orderedChoosers.length;
        const draftType = league?.scoring_settings?.draft_type || 'snake';
        const isSnake = draftType !== 'linear';

        // Calculate which chooser is next
        const assignedUserIds = new Set(Object.values(slotAssignments).filter(Boolean));
        let nextChooser = orderedChoosers.find(c => !assignedUserIds.has(c.user_id)) || null;

        contentEl.innerHTML = `
            <div style="padding: 1.5rem 2rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h2 style="margin: 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem;">
                        🎯 <span style="background: linear-gradient(135deg, #ffffff 40%, var(--accent-primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Pick of the Picks</span>
                        <span style="font-size: 0.85rem; padding: 0.2rem 0.6rem; border-radius: 9999px; background: rgba(56, 189, 248, 0.15); color: var(--accent-secondary); border: 1px solid rgba(56, 189, 248, 0.3);">
                            Week ${targetWeek}
                        </span>
                    </h2>
                    <p style="margin: 0.35rem 0 0; color: var(--text-secondary); font-size: 0.85rem;">
                        ${targetWeek > 1 
                            ? `Teams choose their Round 1 & corresponding snake draft slot in order of Week ${precedingWeek} performance (lowest score chooses first).` 
                            : 'Teams choose their Round 1 & corresponding snake draft slot in order of selection priority.'}
                    </p>
                    ${PickOfPicks.state.isGuest ? `
                        <div style="margin-top: 0.5rem; font-size: 0.8rem; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 6px; padding: 0.35rem 0.75rem; color: #93c5fd; display: inline-flex; align-items: center; gap: 0.4rem;">
                            <span>ℹ️</span> <span>Interactive Preview / Commissioner Mode (Log in to save live changes to the league)</span>
                        </div>
                    ` : ''}
                </div>
                <button type="button" class="btn" onclick="document.getElementById('pick-of-picks-modal').style.display='none';" style="padding: 0.35rem 0.75rem; font-size: 1.1rem; line-height: 1;">✕</button>
            </div>

            <div style="padding: 1.5rem 2rem; max-height: calc(85vh - 160px); overflow-y: auto;">
                
                <!-- Status Banner: On The Clock to Choose Slot -->
                <div style="background: ${nextChooser ? 'rgba(37, 99, 235, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; border: 1px solid ${nextChooser ? 'rgba(59, 130, 246, 0.35)' : 'rgba(16, 185, 129, 0.35)'}; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        ${nextChooser ? `
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Currently Choosing Slot:</span>
                            <div style="font-size: 1.25rem; font-weight: 800; color: #fff; margin-top: 0.2rem;">
                                Choice #${nextChooser.choice_priority}: ${nextChooser.team_name}
                                <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-secondary); margin-left: 0.5rem;">(${nextChooser.reason})</span>
                            </div>
                        ` : `
                            <div style="font-size: 1.15rem; font-weight: 800; color: #10b981; display: flex; align-items: center; gap: 0.5rem;">
                                ✅ All ${teamCount} Draft Slots Have Been Selected!
                            </div>
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">Click "Save & Apply Draft Order" below to lock this draft order into the Draft Lobby.</span>
                        `}
                    </div>
                    ${isAdmin ? `
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button type="button" class="btn" onclick="PickOfPicks.autoFillSlots()" style="background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                                ⚡ Quick Auto-Fill
                            </button>
                            <button type="button" class="btn" onclick="PickOfPicks.resetSlots()" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                                🔄 Reset
                            </button>
                        </div>
                    ` : ''}
                </div>

                <!-- Two Column Layout: Choice Queue (Left) & Draft Slots Grid (Right) -->
                <div style="display: grid; grid-template-columns: minmax(260px, 320px) 1fr; gap: 1.5rem; align-items: start;">
                    
                    <!-- Selection Queue -->
                    <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--glass-border); border-radius: 8px; padding: 1.25rem;">
                        <h3 style="margin-top: 0; margin-bottom: 0.75rem; font-size: 1rem; color: var(--accent-secondary); display: flex; justify-content: space-between; align-items: center;">
                            <span>Selection Priority</span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">Wk ${precedingWeek} Result</span>
                        </h3>
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1rem;">
                            Lowest scoring team from preceding week picks their slot first:
                        </p>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${orderedChoosers.map((c, idx) => {
                                // Find assigned slot if any
                                const assignedSlot = Object.keys(slotAssignments).find(s => slotAssignments[s] === c.user_id);
                                const isCurrent = nextChooser && nextChooser.user_id === c.user_id;
                                const isYou = currentUserId && c.user_id === currentUserId;

                                const borderCol = isCurrent ? 'var(--accent-secondary)' : (assignedSlot ? 'rgba(16,185,129,0.3)' : 'var(--glass-border)');
                                const bgCol = isCurrent ? 'rgba(56, 189, 248, 0.12)' : (assignedSlot ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0,0,0,0.3)');

                                return `
                                    <div style="padding: 0.65rem 0.85rem; border-radius: 6px; border: 1px solid ${borderCol}; background: ${bgCol}; display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <div style="font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem;">
                                                <span style="color: var(--accent-primary); font-size: 0.8rem;">#${idx + 1}</span>
                                                <span>${c.team_name}</span>
                                                ${isYou ? '<span style="font-size: 0.7rem; background: rgba(56,189,248,0.2); color: var(--accent-secondary); padding: 0.1rem 0.35rem; border-radius: 3px;">You</span>' : ''}
                                            </div>
                                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.15rem;">
                                                ${c.reason}
                                            </div>
                                        </div>
                                        <div style="text-align: right;">
                                            ${assignedSlot ? `
                                                <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 700; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.4);">
                                                    Slot #${assignedSlot}
                                                </span>
                                            ` : (isCurrent ? `
                                                <span style="background: rgba(56, 189, 248, 0.2); color: var(--accent-secondary); font-weight: 700; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.4); animation: pulse 2s infinite;">
                                                    Choosing...
                                                </span>
                                            ` : `
                                                <span style="color: var(--text-secondary); font-size: 0.75rem;">Waiting</span>
                                            `)}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Available Draft Slots Grid -->
                    <div>
                        <div style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; font-size: 1.1rem;">Round 1 & Round 2 Snake Draft Slots</h3>
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">${isSnake ? '🐍 Snake Mirror: Slot k gets Round 1 Pick #k & Round 2 Pick #(2N - k + 1)' : 'Linear Draft Slots'}</span>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem;">
                            ${Array.from({ length: teamCount }, (_, i) => {
                                const slotNum = i + 1;
                                const r1Pick = slotNum;
                                const r2Pick = isSnake ? (2 * teamCount - slotNum + 1) : (teamCount + slotNum);
                                const assignedUserId = slotAssignments[slotNum];
                                const assignedMember = members.find(m => m.user_id === assignedUserId);
                                
                                const isAvailable = !assignedUserId;
                                const canChooseThis = isAvailable && (
                                    (nextChooser && nextChooser.user_id === currentUserId) || 
                                    isAdmin
                                );

                                return `
                                    <div style="background: ${assignedMember ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.03)'}; border: 2px solid ${assignedMember ? 'rgba(16, 185, 129, 0.4)' : (canChooseThis ? 'var(--accent-secondary)' : 'var(--glass-border)')}; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; min-height: 140px; transition: all 0.2s;">
                                        <div>
                                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                                                <span style="font-size: 1.15rem; font-weight: 800; color: ${assignedMember ? '#10b981' : 'var(--accent-primary)'};">
                                                    Slot #${slotNum}
                                                </span>
                                                <span style="font-size: 0.75rem; background: rgba(255,255,255,0.08); padding: 0.2rem 0.45rem; border-radius: 4px; color: var(--text-secondary);">
                                                    Round 1: #${r1Pick}
                                                </span>
                                            </div>
                                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                                                Round 2 Pick: <strong style="color: var(--accent-secondary);">#${r2Pick}</strong>
                                            </div>
                                        </div>

                                        <div>
                                            ${assignedMember ? `
                                                <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                                                    <div>
                                                        <div style="font-weight: 700; font-size: 0.85rem; color: #fff;">${assignedMember.team_name}</div>
                                                        <div style="font-size: 0.7rem; color: #10b981;">Selected</div>
                                                    </div>
                                                    ${isAdmin ? `
                                                        <button type="button" onclick="PickOfPicks.unassignSlot(${slotNum})" title="Remove team from slot" style="background: transparent; border: none; color: #f87171; cursor: pointer; font-size: 0.85rem; padding: 0.2rem;">✕</button>
                                                    ` : ''}
                                                </div>
                                            ` : (canChooseThis ? `
                                                <button type="button" class="btn btn-primary" onclick="PickOfPicks.chooseSlot(${slotNum})" style="width: 100%; justify-content: center; font-size: 0.85rem; padding: 0.5rem; font-weight: 700;">
                                                    🎯 Choose Slot #${slotNum}
                                                </button>
                                            ` : `
                                                <div style="text-align: center; font-size: 0.8rem; color: var(--text-secondary); padding: 0.5rem; border: 1px dashed var(--glass-border); border-radius: 6px;">
                                                    Available
                                                </div>
                                            `)}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                </div>

                <div id="pop-error-msg" style="display: none; margin-top: 1.5rem; color: var(--danger-color); font-size: 0.9rem; padding: 0.75rem 1rem; background: rgba(239,68,68,0.15); border-radius: 6px; border: 1px solid rgba(239,68,68,0.3);"></div>
            </div>

            <div style="padding: 1.25rem 2rem; border-top: 1px solid var(--glass-border); background: var(--bg-secondary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    ${assignedUserIds.size} of ${teamCount} slots assigned
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button type="button" class="btn" onclick="document.getElementById('pick-of-picks-modal').style.display='none';">Cancel</button>
                    ${isAdmin ? `
                        <button type="button" id="pop-save-btn" class="btn btn-primary" onclick="PickOfPicks.saveOrder()" style="font-weight: 700; padding: 0.6rem 1.25rem;">
                            💾 Save & Apply Draft Order
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // A team chooses or commissioner assigns a slot
    chooseSlot: async (slotNum) => {
        const { orderedChoosers, slotAssignments, currentUserId, isAdmin } = PickOfPicks.state;
        const assignedUserIds = new Set(Object.values(slotAssignments).filter(Boolean));
        const nextChooser = orderedChoosers.find(c => !assignedUserIds.has(c.user_id));

        if (!nextChooser) return;

        // If not admin and not the chooser, prevent
        if (!isAdmin && nextChooser.user_id !== currentUserId) {
            alert(`It is currently ${nextChooser.team_name}'s turn to choose a draft slot!`);
            return;
        }

        // Assign
        slotAssignments[slotNum] = nextChooser.user_id;
        PickOfPicks.renderBoard();
    },

    // Unassign a slot
    unassignSlot: (slotNum) => {
        delete PickOfPicks.state.slotAssignments[slotNum];
        PickOfPicks.renderBoard();
    },

    // Auto-fill slots in priority order (Slot 1 to 1st chooser, Slot 2 to 2nd, etc.)
    autoFillSlots: () => {
        const { orderedChoosers } = PickOfPicks.state;
        const newAssignments = {};
        orderedChoosers.forEach((c, idx) => {
            newAssignments[idx + 1] = c.user_id;
        });
        PickOfPicks.state.slotAssignments = newAssignments;
        PickOfPicks.renderBoard();
    },

    // Reset all slots
    resetSlots: () => {
        PickOfPicks.state.slotAssignments = {};
        PickOfPicks.renderBoard();
    },

    // Save & apply draft order into leagues.scoring_settings
    saveOrder: async () => {
        if (PickOfPicks.state.isGuest) {
            alert('Please log in as commissioner to save and apply this draft order to your league.');
            const authModal = document.getElementById('auth-modal');
            if (authModal) authModal.style.display = 'flex';
            return;
        }

        const { leagueId, targetWeek, slotAssignments, orderedChoosers, league } = PickOfPicks.state;
        const saveBtn = document.getElementById('pop-save-btn');
        const errEl = document.getElementById('pop-error-msg');
        errEl.style.display = 'none';

        const teamCount = orderedChoosers.length;
        const assignedCount = Object.keys(slotAssignments).filter(k => slotAssignments[k]).length;

        if (assignedCount < teamCount) {
            const proceed = confirm(`Only ${assignedCount} of ${teamCount} draft slots have been selected. Would you like to automatically assign remaining slots in order of selection priority?`);
            if (!proceed) return;

            // Fill unassigned slots
            const assignedUserIds = new Set(Object.values(slotAssignments).filter(Boolean));
            const remainingChoosers = orderedChoosers.filter(c => !assignedUserIds.has(c.user_id));
            let rIdx = 0;
            for (let s = 1; s <= teamCount; s++) {
                if (!slotAssignments[s] && rIdx < remainingChoosers.length) {
                    slotAssignments[s] = remainingChoosers[rIdx].user_id;
                    rIdx++;
                }
            }
        }

        // Build ordered array for Round 1: [slot1_user_id, slot2_user_id, ..., slotN_user_id]
        const draftOrderArray = [];
        for (let s = 1; s <= teamCount; s++) {
            if (slotAssignments[s]) {
                draftOrderArray.push(slotAssignments[s]);
            }
        }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving Order...';
        }

        try {
            const currentSettings = league.scoring_settings || {};
            const existingOverrides = currentSettings.draft_order_overrides || {};
            const existingPop = currentSettings.pick_of_the_picks || {};

            const updatedSettings = {
                ...currentSettings,
                draft_order_overrides: {
                    ...existingOverrides,
                    [targetWeek]: draftOrderArray
                },
                pick_of_the_picks: {
                    ...existingPop,
                    [targetWeek]: {
                        updated_at: new Date().toISOString(),
                        slot_assignments: slotAssignments,
                        ordered_choosers: orderedChoosers.map(c => ({
                            user_id: c.user_id,
                            team_name: c.team_name,
                            choice_priority: c.choice_priority,
                            preceding_week_score: c.preceding_week_score
                        }))
                    }
                }
            };

            const { error: updErr } = await supabase
                .from('leagues')
                .update({ scoring_settings: updatedSettings })
                .eq('id', leagueId);

            if (updErr) throw updErr;

            alert(`🎯 Pick of the Picks draft order successfully saved for Week ${targetWeek}!`);
            document.getElementById('pick-of-picks-modal').style.display = 'none';

            // Refresh view
            if (window.location.hash.includes('draft')) {
                window.location.reload();
            } else if (window.LeagueDetailView) {
                window.LeagueDetailView.init({ league: leagueId });
            }
        } catch (err) {
            console.error("Error saving Pick of the Picks:", err);
            errEl.style.display = 'block';
            errEl.innerText = 'Failed to save order: ' + err.message;
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = '💾 Save & Apply Draft Order';
            }
        }
    }
};

window.PickOfPicks = PickOfPicks;
window.openPickOfPicksModal = PickOfPicks.openModal;

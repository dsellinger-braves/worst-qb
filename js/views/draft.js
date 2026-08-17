import { supabase } from '../supabase.js';
import { calculateLeagueScore } from '../scoring.js';
import { PlayerProfileView } from './player_profile.js';

export const DraftView = {
    render: () => `
        <div class="view-container active">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h1 style="margin-bottom: 0;">Draft Lobby</h1>
                    <p style="color: var(--text-secondary);">Build the worst roster possible.</p>
                </div>
                <select id="draft-league-select" style="background: rgba(0,0,0,0.5); color: var(--text-primary); border: 1px solid var(--glass-border); padding: 0.5rem; border-radius: 4px; min-width: 250px; font-size: 1rem;">
                    <option value="">Loading leagues...</option>
                </select>
            </div>

            <!-- Main Layout -->
            <div style="display: grid; grid-template-columns: 1fr; gap: 2rem; align-items: start;" id="draft-grid">
                
                <!-- Left Column: Player Pool -->
                <div class="glass-panel" style="padding: 0; overflow: hidden; display: flex; flex-direction: column;" id="pool-col">
                    <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                            <h3 style="margin: 0;">Player Pool</h3>
                            <div style="display: flex; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 0.25rem;">
                                <button class="btn pool-tab active-tab" data-tab="QB" style="padding: 0.5rem 1rem; border-radius: 6px; background: var(--accent-primary); border: none; font-size: 0.9rem;">Quarterbacks</button>
                                <button class="btn pool-tab" data-tab="OTHER" style="padding: 0.5rem 1rem; border-radius: 6px; background: transparent; border: none; font-size: 0.9rem; color: var(--text-secondary);">Other Positions</button>
                            </div>
                        </div>
                        <input type="text" id="draft-search" placeholder="Search player or team..." style="padding: 0.5rem 1rem; border-radius: 20px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.5); color: white; min-width: 200px;">
                    </div>
                    
                    <div style="overflow-x: auto; max-height: 600px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; min-width: 500px;">
                            <thead style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 10;">
                                <tr style="border-bottom: 2px solid var(--glass-border);">
                                    <th style="padding: 1rem 1.5rem; cursor: pointer; user-select: none;" onclick="DraftView.setSort('name')">Player <span style="font-size: 0.8rem; opacity: 0.5;">↕</span></th>
                                    <th style="padding: 1rem 1.5rem; cursor: pointer; user-select: none;" onclick="DraftView.setSort('pts')">Proj Pts <span style="font-size: 0.8rem; opacity: 0.5;">↕</span></th>
                                    <th style="padding: 1rem 1.5rem; text-align: center;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="qb-list">
                                <tr><td colspan="3" style="padding: 2rem; text-align: center;">Loading players...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Right Column: Status & Order -->
                <div style="display: flex; flex-direction: column; gap: 1rem;" id="status-col">
                    
                    <!-- Your Picks Sticky Block -->
                    <div class="glass-panel" style="position: sticky; top: 100px; padding: 1.5rem;">
                        <h3 style="margin-bottom: 1rem; color: var(--accent-primary); display: flex; justify-content: space-between; align-items: center;">
                            Your Picks
                            <span style="font-size: 0.9rem; color: var(--text-secondary); font-weight: normal; border: 1px solid var(--glass-border); padding: 0.2rem 0.5rem; border-radius: 4px;">Week <span id="draft-week">1</span></span>
                        </h3>
                        <div id="your-picks" style="display: flex; flex-direction: column; gap: 1rem;">
                            <div id="pick-1-slot" style="padding: 1rem; border: 2px dashed var(--glass-border); text-align: center; border-radius: 8px; transition: all 0.3s ease;">
                                <span style="font-weight: bold;">Pick 1</span><br/>
                                <span style="font-size: 0.8rem; color: var(--text-secondary)">Empty</span>
                            </div>
                            <div id="pick-2-slot" style="padding: 1rem; border: 2px dashed var(--glass-border); text-align: center; border-radius: 8px; transition: all 0.3s ease;">
                                <span style="font-weight: bold;">Pick 2</span><br/>
                                <span style="font-size: 0.8rem; color: var(--text-secondary)">Empty</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Draft Order Tracker -->
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 style="margin-bottom: 0.5rem;">Draft Order</h3>
                        <p id="draft-order-label" style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Inverse Season Standings</p>
                        <div id="draft-order-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto; padding-right: 0.5rem;">
                            Loading draft order...
                        </div>
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border); font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between;">
                            <span>Realtime Sync:</span>
                            <span id="realtime-status" style="color: var(--accent-primary); font-weight: bold;">Disconnected</span>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Inset Player Profile Modal -->
            <div id="profile-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; justify-content: center; align-items: center; padding: 2rem;">
                <div style="background: var(--bg-main); width: 100%; max-width: 1000px; max-height: 90vh; overflow-y: auto; border-radius: 16px; position: relative; border: 1px solid var(--glass-border); box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
                    <button id="profile-modal-close" class="btn" style="position: absolute; top: 1.5rem; right: 1.5rem; z-index: 10; padding: 0.5rem 1rem; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border);"><span style="font-size: 1.2rem;">✕</span> Close</button>
                    <div id="profile-modal-content"></div>
                </div>
            </div>

        </div>
    `,
    init: async () => {
        if (!supabase) return;

        // Apply media query dynamically for layout
        const style = document.createElement('style');
        style.innerHTML = `
            @media(min-width: 900px) {
                #draft-grid { grid-template-columns: 3fr 1fr !important; }
            }
            .player-row:hover { background: rgba(255,255,255,0.05); }
        `;
        document.head.appendChild(style);
        
        // Setup state
        DraftView.state = {
            userId: null,
            leagueId: null,
            leagueInfo: null,
            currentWeek: 1,
            scoringType: 'individual',
            members: [],
            myPicks: [],
            players: [],
            projections: {},
            searchQuery: '',
            activeTab: 'QB',
            sortCol: 'name',
            sortAsc: true
        };

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            document.getElementById('qb-list').innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem;">Please log in to draft.</td></tr>';
            return;
        }
        DraftView.state.userId = session.user.id;

        // Fetch user's leagues
        const { data: userLeagues } = await supabase
            .from('league_members')
            .select('league_id, leagues(name, scoring_type, current_week, draft_status)')
            .eq('user_id', session.user.id);

        const selectEl = document.getElementById('draft-league-select');
        
        if (!userLeagues || userLeagues.length === 0) {
            selectEl.innerHTML = '<option value="">Not in any leagues</option>';
            document.getElementById('qb-list').innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem;">You must join a league to draft.</td></tr>';
            return;
        }

        selectEl.innerHTML = userLeagues.map(ul => 
            `<option value="${ul.league_id}">${ul.leagues?.name} (${ul.leagues?.scoring_type === 'team_qb' ? 'Team' : 'Indiv'})</option>`
        ).join('');

        // Modal Handlers
        const modal = document.getElementById('profile-modal');
        document.getElementById('profile-modal-close').onclick = () => {
            modal.style.display = 'none';
            document.getElementById('profile-modal-content').innerHTML = ''; // Clear memory
        };

        // Search Handler
        document.getElementById('draft-search').addEventListener('input', (e) => {
            DraftView.state.searchQuery = e.target.value.toLowerCase();
            DraftView.renderPlayerPool();
        });

        // Tab Handlers
        document.querySelectorAll('.pool-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.pool-tab').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                    b.classList.remove('active-tab');
                });
                const clicked = e.target;
                clicked.style.background = 'var(--accent-primary)';
                clicked.style.color = 'white';
                clicked.classList.add('active-tab');
                
                DraftView.state.activeTab = clicked.getAttribute('data-tab');
                DraftView.renderPlayerPool();
            });
        });

        // Listen for league changes
        selectEl.addEventListener('change', async () => {
            DraftView.state.leagueId = selectEl.value;
            await DraftView.loadLeagueData();
        });
        
        // Initial load
        DraftView.state.leagueId = selectEl.value;
        await DraftView.loadLeagueData();
        
        // Realtime Subscription
        await supabase.removeAllChannels();
        const channel = supabase.channel('draft_room')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'draft_picks' }, async (payload) => {
                if (payload.new.league_id === DraftView.state.leagueId) {
                    console.log('New pick detected:', payload);
                    // Refresh data quietly if it's for our league
                    await DraftView.fetchPicks();
                    DraftView.renderPlayerPool();
                }
            })
            .subscribe((status) => {
                const statusEl = document.getElementById('realtime-status');
                if (status === 'SUBSCRIBED') {
                    statusEl.innerText = 'Connected';
                    statusEl.style.color = 'var(--accent-success)';
                } else {
                    statusEl.innerText = 'Disconnected';
                    statusEl.style.color = 'var(--accent-primary)';
                }
            });
            
        window.DraftView = DraftView; // Expose for header sorting
    },

    setSort: (col) => {
        if (DraftView.state.sortCol === col) {
            DraftView.state.sortAsc = !DraftView.state.sortAsc;
        } else {
            DraftView.state.sortCol = col;
            DraftView.state.sortAsc = col === 'name';
        }
        DraftView.renderPlayerPool();
    },

    loadLeagueData: async () => {
        const { leagueId, userId } = DraftView.state;
        if (!leagueId) return;

        // Fetch full league info
        const { data: league } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
        DraftView.state.leagueInfo = league;
        DraftView.state.currentWeek = league.current_week > 18 ? 18 : league.current_week;
        DraftView.state.scoringType = league.scoring_type;
        document.getElementById('draft-week').innerText = DraftView.state.currentWeek;

        // Fetch league members for draft order
        const { data: members } = await supabase.from('league_members')
            .select('user_id, team_name, season_points')
            .eq('league_id', leagueId)
            .order('season_points', { ascending: true }); // Lowest points (worst teams) first
        
        let sortedMembers = members || [];
        
        // Apply manual override if it exists
        const overrides = league.scoring_settings?.draft_order_overrides || {};
        const currentOverride = overrides[DraftView.state.currentWeek];
        
        if (currentOverride) {
            sortedMembers.sort((a, b) => {
                const idxA = currentOverride.indexOf(a.user_id);
                const idxB = currentOverride.indexOf(b.user_id);
                if (idxA === -1 && idxB === -1) return 0;
                if (idxA === -1) return 1;
                if (idxB === -1) return -1;
                return idxA - idxB;
            });
        }
        
        DraftView.state.members = sortedMembers;
        
        await DraftView.fetchPicks();
        await DraftView.fetchPlayers();
        
        DraftView.renderDraftOrder();
        DraftView.renderPlayerPool();
    },

    fetchPicks: async () => {
        const { leagueId, currentWeek, userId } = DraftView.state;
        
        // Fetch ALL picks for this week to know who is unavailable
        const { data: allPicks } = await supabase.from('draft_picks')
            .select('player_id, user_id, pick_number, players(name)')
            .eq('league_id', leagueId)
            .eq('week', currentWeek);
            
        DraftView.state.allPicks = allPicks || [];
        DraftView.state.myPicks = DraftView.state.allPicks.filter(p => p.user_id === userId);
        DraftView.renderYourPicks();
    },

    fetchPlayers: async () => {
        const { currentWeek } = DraftView.state;
        document.getElementById('qb-list').innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center;"><div class="spinner" style="margin: 0 auto;"></div></td></tr>';

        // Fetch ALL players and projections
        const [{ data: players }, { data: projections }] = await Promise.all([
            supabase.from('players').select('*'),
            supabase.from('player_projections').select('*').eq('week', currentWeek)
        ]);
        
        DraftView.state.players = players || [];
        
        // Map projections
        const projMap = {};
        if (projections) {
            projections.forEach(p => {
                projMap[p.player_id] = p.projected_custom_points;
            });
        }
        DraftView.state.projections = projMap;
    },

    renderYourPicks: () => {
        const { myPicks } = DraftView.state;
        const p1 = myPicks.find(p => p.pick_number === 1);
        const p2 = myPicks.find(p => p.pick_number === 2);

        const renderSlot = (slotEl, pickLabel, pickData) => {
            if (pickData) {
                slotEl.innerHTML = `<span style="font-weight: bold;">${pickLabel}</span><br/><span style="color: var(--accent-success); font-weight: 600;">${pickData.players?.name}</span>`;
                slotEl.style.borderStyle = 'solid';
                slotEl.style.borderColor = 'var(--accent-success)';
                slotEl.style.background = 'rgba(16, 185, 129, 0.1)';
            } else {
                slotEl.innerHTML = `<span style="font-weight: bold;">${pickLabel}</span><br/><span style="font-size: 0.8rem; color: var(--text-secondary)">Empty</span>`;
                slotEl.style.borderStyle = 'dashed';
                slotEl.style.borderColor = 'var(--glass-border)';
                slotEl.style.background = 'transparent';
            }
        };

        renderSlot(document.getElementById('pick-1-slot'), 'Pick 1', p1);
        renderSlot(document.getElementById('pick-2-slot'), 'Pick 2', p2);
    },

    renderDraftOrder: () => {
        const listEl = document.getElementById('draft-order-list');
        const { members, allPicks, leagueInfo, userId, currentWeek } = DraftView.state;
        const isAdmin = leagueInfo?.created_by === userId;
        
        const overrides = leagueInfo?.scoring_settings?.draft_order_overrides || {};
        if (overrides[currentWeek]) {
            document.getElementById('draft-order-label').innerText = 'Manual Override Active';
            document.getElementById('draft-order-label').style.color = 'var(--accent-primary)';
        } else {
            document.getElementById('draft-order-label').innerText = 'Inverse Season Standings';
            document.getElementById('draft-order-label').style.color = 'var(--text-secondary)';
        }
        
        if (members.length === 0) {
            listEl.innerHTML = 'No teams found.';
            return;
        }

        window.undoPick = DraftView.undoPick; // Expose for inline onClick

        listEl.innerHTML = members.map((m, idx) => {
            // Check if they drafted yet
            const theirPicks = (allPicks || []).filter(p => p.user_id === m.user_id);
            const statusIcon = theirPicks.length >= 2 ? '✅' : (theirPicks.length === 1 ? '⏳' : '❌');
            
            let undoBtn = '';
            if (isAdmin && theirPicks.length > 0) {
                undoBtn = `<button class="btn" style="padding: 0.1rem 0.4rem; font-size: 0.7rem; background: var(--accent-error); border: none; margin-left: 0.5rem;" onclick="undoPick('${m.user_id}')" title="Undo latest pick">Undo</button>`;
            }

            return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <span style="font-weight: bold; color: var(--text-secondary); margin-right: 0.5rem;">${idx + 1}.</span>
                    <span style="font-size: 0.9rem;">${m.team_name}</span>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.8rem; color: var(--text-secondary);">${m.season_points.toFixed(2)} pts</span>
                    <span title="${theirPicks.length} / 2 picks made">${statusIcon}</span>
                    ${undoBtn}
                </div>
            </div>
        `}).join('');
    },

    renderPlayerPool: () => {
        const tbody = document.getElementById('qb-list');
        let { players, projections, searchQuery, allPicks, myPicks, activeTab, members } = DraftView.state;
        
        // Filter out drafted players
        const draftedIds = new Set((allPicks || []).map(p => p.player_id));
        let available = players.filter(p => !draftedIds.has(p.id));

        // Apply Tab Filter
        if (activeTab === 'QB') {
            available = available.filter(p => p.position && p.position.includes('QB'));
        } else {
            available = available.filter(p => p.position && !p.position.includes('QB') && !p.position.includes('DST'));
        }

        // Filter out TM_QB if individual scoring
        if (DraftView.state.scoringType === 'individual') {
            available = available.filter(p => !p.position || !p.position.includes('TM_QB'));
        }

        // Apply Search
        if (searchQuery) {
            available = available.filter(p => 
                p.name.toLowerCase().includes(searchQuery) || 
                (p.team && p.team.toLowerCase().includes(searchQuery))
            );
        }

        // Apply Sort
        available.sort((a, b) => {
            if (DraftView.state.sortCol === 'pts') {
                const pA = projections[a.id] || 0;
                const pB = projections[b.id] || 0;
                return DraftView.state.sortAsc ? pA - pB : pB - pA;
            } else {
                // Sort by last name
                const getLastName = (name) => {
                    const parts = name.trim().split(' ');
                    return parts[parts.length - 1].toLowerCase();
                };
                const comp = getLastName(a.name).localeCompare(getLastName(b.name));
                return DraftView.state.sortAsc ? comp : -comp;
            }
        });

        if (available.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 2rem; text-align: center;">No available players match your search.</td></tr>';
            return;
        }

        // Determine if it's the user's turn
        let isMyTurn = false;
        let waitingOn = null;
        const myIndex = members.findIndex(m => m.user_id === DraftView.state.userId);
        
        if (myIndex !== -1 && myPicks.length < 2) {
            // Check if Round 1 is complete (everyone has at least 1 pick)
            const everyoneHasRound1 = members.every(m => {
                return (allPicks || []).filter(p => p.user_id === m.user_id).length >= 1;
            });
            
            const targetPicks = everyoneHasRound1 ? 2 : 1;
            
            if (myPicks.length < targetPicks) {
                isMyTurn = true;
                for (let i = 0; i < myIndex; i++) {
                    const memberAhead = members[i];
                    const theirPicks = (allPicks || []).filter(p => p.user_id === memberAhead.user_id);
                    if (theirPicks.length < targetPicks) {
                        isMyTurn = false;
                        waitingOn = memberAhead.team_name;
                        break;
                    }
                }
            }
        }

        window.draftPlayer = DraftView.draftPlayer; // Expose for inline onClick
        window.openProfile = DraftView.openProfile; 

        tbody.innerHTML = available.map(p => {
            const proj = projections[p.id] ? projections[p.id].toFixed(2) : 'N/A';
            const headshotHtml = p.headshot_url 
                ? `<img src="${p.headshot_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #fff; border: 1px solid var(--glass-border);">`
                : `<div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">🏈</div>`;

            let draftButtonHtml = '';
            if (myPicks.length >= 2) {
                draftButtonHtml = `<button class="btn" disabled style="background: rgba(255,255,255,0.1); color: var(--text-secondary); cursor: not-allowed;">Full</button>`;
            } else if (!isMyTurn) {
                draftButtonHtml = `<button class="btn" disabled style="background: rgba(255,255,255,0.1); color: var(--text-secondary); cursor: not-allowed;" title="Waiting on ${waitingOn || 'someone else'}">Wait</button>`;
            } else {
                draftButtonHtml = `<button class="btn btn-primary" onclick="draftPlayer('${p.id}')">+ Draft</button>`;
            }

            return `
            <tr class="player-row" style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
                <td style="padding: 1rem 1.5rem; display: flex; align-items: center; gap: 1rem;">
                    ${headshotHtml}
                    <div style="display: flex; flex-direction: column;">
                        <a href="javascript:void(0)" onclick="openProfile('${p.id}')" style="color: var(--text-primary); text-decoration: none; font-weight: 600; font-size: 1.1rem;">${p.name}</a>
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">${p.position} - ${p.team || 'FA'}</span>
                    </div>
                </td>
                <td style="padding: 1rem 1.5rem; font-weight: bold; color: var(--accent-primary);">
                    ${proj}
                </td>
                <td style="padding: 1rem 1.5rem; text-align: center;">
                    ${draftButtonHtml}
                </td>
            </tr>
        `}).join('');
    },

    draftPlayer: async (playerId) => {
        const { leagueId, currentWeek, userId, myPicks, members, allPicks } = DraftView.state;
        if (myPicks.length >= 2) {
            alert("You have already drafted 2 players for this week.");
            return;
        }

        // Strict Turn Validation
        const myIndex = members.findIndex(m => m.user_id === userId);
        if (myIndex === -1) {
            alert("You are not a member of this league.");
            return;
        }

        const everyoneHasRound1 = members.every(m => {
            return (allPicks || []).filter(p => p.user_id === m.user_id).length >= 1;
        });
        const targetPicks = everyoneHasRound1 ? 2 : 1;

        if (myPicks.length < targetPicks) {
            for (let i = 0; i < myIndex; i++) {
                const memberAhead = members[i];
                const theirPicks = (allPicks || []).filter(p => p.user_id === memberAhead.user_id);
                if (theirPicks.length < targetPicks) {
                    alert(`It is not your turn yet! Waiting on ${memberAhead.team_name}.`);
                    return;
                }
            }
        }

        const pickNum = myPicks.find(p => p.pick_number === 1) ? 2 : 1;

        const pickData = {
            league_id: leagueId,
            user_id: userId,
            player_id: playerId,
            week: currentWeek,
            pick_number: pickNum
        };

        const { error } = await supabase.from('draft_picks').insert(pickData);
        
        if (error) {
            console.error(error);
            if (error.code === '23505') {
                alert("This player was just drafted by someone else! Try again.");
            } else {
                alert("Error making draft pick.");
            }
        } else {
            // Success! Refetch picks and re-render pool (or rely on realtime if it's fast enough, but manual refetch is safer)
            await DraftView.fetchPicks();
            DraftView.renderPlayerPool();
            DraftView.renderDraftOrder();
        }
    },

    undoPick: async (targetUserId) => {
        const { leagueId, currentWeek, allPicks } = DraftView.state;
        
        // Find their most recent pick
        const theirPicks = allPicks.filter(p => p.user_id === targetUserId);
        if (theirPicks.length === 0) return;
        
        // Sort by pick number descending
        theirPicks.sort((a, b) => b.pick_number - a.pick_number);
        const pickToUndo = theirPicks[0];
        
        const confirmed = confirm(`Are you sure you want to undo the pick for ${pickToUndo.players.name}?`);
        if (!confirmed) return;
        
        const { error } = await supabase.from('draft_picks')
            .delete()
            .eq('league_id', leagueId)
            .eq('user_id', targetUserId)
            .eq('week', currentWeek)
            .eq('pick_number', pickToUndo.pick_number);
            
        if (error) {
            console.error(error);
            alert("Error undoing pick.");
        } else {
            await DraftView.fetchPicks();
            DraftView.renderDraftOrder();
            DraftView.renderPlayerPool();
        }
    },

    openProfile: async (playerId) => {
        const modal = document.getElementById('profile-modal');
        const content = document.getElementById('profile-modal-content');
        
        modal.style.display = 'flex';
        content.innerHTML = '<div style="padding: 4rem; text-align: center;"><div class="spinner" style="margin: 0 auto;"></div><p>Loading Profile...</p></div>';

        const escapeListener = (e) => {
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', escapeListener);
            }
        };
        document.addEventListener('keydown', escapeListener);

        // Render the PlayerProfileView into the modal container
        content.innerHTML = PlayerProfileView.render();
        
        // Pass the league parameter so the dynamic scoring works!
        await PlayerProfileView.init({ id: playerId, league: DraftView.state.leagueId });
        
        // Minor styling tweak for modal context
        const viewContainer = content.querySelector('.view-container');
        if (viewContainer) {
            viewContainer.style.padding = '0';
            viewContainer.style.maxWidth = '100%';
        }
    }
};

import { supabase } from './supabase.js';

export const ClaimManager = {
    // Fetch claimable / offline teams in a league
    getClaimableTeams: async (leagueId) => {
        if (!supabase) return [];
        try {
            // 1. Try RPC function
            const { data, error } = await supabase.rpc('get_claimable_teams', { target_league_id: leagueId });
            if (!error && Array.isArray(data)) {
                return data;
            }
        } catch (e) {
            // RPC not available yet, proceed to fallback
        }

        // Fallback: Query league_members directly
        try {
            const { data: members, error } = await supabase
                .from('league_members')
                .select('*')
                .eq('league_id', leagueId);
            
            if (error || !members) return [];

            // Fetch league to know who created it
            const { data: league } = await supabase.from('leagues').select('created_by').eq('id', leagueId).single();
            const creatorId = league?.created_by;

            return members.filter(m => {
                if (m.is_claimed === false) return true;
                if (m.is_claimed === true) return false;
                // If is_claimed column doesn't exist, exclude commissioner/admin
                return m.user_id !== creatorId && !m.is_admin;
            });
        } catch (e) {
            console.error("Error fetching claimable teams:", e);
            return [];
        }
    },

    // Claim a team for the current authenticated user
    claimTeam: async (leagueId, offlineUserId, newTeamName = null) => {
        if (!supabase) throw new Error("Supabase not initialized");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("You must be logged in to claim a team.");

        const currentUserId = session.user.id;

        // 1. Try RPC function (most robust, atomic and bypasses RLS issues)
        try {
            const { data, error } = await supabase.rpc('claim_league_team', {
                target_league_id: leagueId,
                target_offline_user_id: offlineUserId,
                new_team_name: newTeamName || null
            });

            if (!error && data) {
                if (!data.success) {
                    throw new Error(data.error || "Failed to claim team");
                }
                return data;
            }
            if (error && error.code !== '42883') {
                throw new Error(error.message);
            }
        } catch (rpcErr) {
            if (rpcErr.message && !rpcErr.message.includes('does not exist')) {
                throw rpcErr;
            }
            // If RPC doesn't exist in DB, try direct fallback
        }

        // 2. Direct Fallback
        // Check if user is already a member
        const { data: existing } = await supabase
            .from('league_members')
            .select('user_id')
            .eq('league_id', leagueId)
            .eq('user_id', currentUserId);

        if (existing && existing.length > 0) {
            throw new Error("You already have a team in this league!");
        }

        // Update league_members row
        const updatePayload = {
            user_id: currentUserId
        };
        if (newTeamName && newTeamName.trim()) {
            updatePayload.team_name = newTeamName.trim();
        }

        const { error: lmErr } = await supabase
            .from('league_members')
            .update(updatePayload)
            .eq('league_id', leagueId)
            .eq('user_id', offlineUserId);

        if (lmErr) {
            if (lmErr.message && lmErr.message.includes('violates row-level security')) {
                throw new Error("Database setup required: Please run schema_claim_team.sql in your Supabase SQL editor to allow team claiming.");
            }
            throw new Error("Failed to update membership: " + lmErr.message);
        }

        // Update draft_picks
        await supabase
            .from('draft_picks')
            .update({ user_id: currentUserId })
            .eq('league_id', leagueId)
            .eq('user_id', offlineUserId);

        return { success: true, message: "Team claimed successfully!" };
    },

    // Open Claim Modal UI
    openClaimModal: async (preselectedLeagueId = null, preselectedOfflineUserId = null) => {
        const modal = document.getElementById('claim-team-modal');
        if (!modal) return;

        const leagueSelect = document.getElementById('claim-modal-league');
        const teamSelect = document.getElementById('claim-modal-team');
        const nameInput = document.getElementById('claim-modal-name');
        const previewDiv = document.getElementById('claim-team-preview');
        const msgDiv = document.getElementById('claim-modal-msg');
        const submitBtn = document.getElementById('claim-modal-submit');

        msgDiv.style.display = 'none';
        modal.style.display = 'flex';
        submitBtn.disabled = true;
        submitBtn.innerText = 'Loading teams...';

        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            modal.style.display = 'none';
            // Save intention so after sign up or login, it completes
            if (preselectedLeagueId) {
                localStorage.setItem('worstqb_pending_claim', JSON.stringify({
                    leagueId: preselectedLeagueId,
                    offlineUserId: preselectedOfflineUserId,
                    teamName: ''
                }));
            }
            alert("Please create an account or log in to claim your team.");
            const authModal = document.getElementById('auth-modal');
            if (authModal) authModal.style.display = 'flex';
            return;
        }

        // Load leagues
        let leagues = null;
        try {
            const { data } = await supabase.from('leagues').select('id, name').order('created_at', { ascending: false });
            if (data && data.length > 0) leagues = data;
        } catch (e) {}

        if (!leagues || leagues.length === 0) {
            try {
                const { data: rpcData } = await supabase.rpc('get_public_leagues');
                if (rpcData && rpcData.length > 0) leagues = rpcData;
            } catch (e) {}
        }

        if (!leagues || leagues.length === 0) {
            msgDiv.style.display = 'block';
            msgDiv.style.color = 'var(--accent-primary)';
            msgDiv.innerText = 'No leagues found.';
            submitBtn.innerText = 'Claim Team';
            return;
        }

        leagueSelect.innerHTML = leagues.map(l => `
            <option value="${l.id}" ${l.id === preselectedLeagueId ? 'selected' : ''}>${l.name}</option>
        `).join('');

        const updateTeamsDropdown = async (leagueId) => {
            teamSelect.innerHTML = '<option value="">Loading unclaimed teams...</option>';
            submitBtn.disabled = true;
            previewDiv.style.display = 'none';

            const claimable = await ClaimManager.getClaimableTeams(leagueId);

            if (!claimable || claimable.length === 0) {
                teamSelect.innerHTML = '<option value="">No unclaimed teams in this league</option>';
                submitBtn.disabled = true;
                submitBtn.innerText = 'No Unclaimed Teams';
                nameInput.value = '';
                return;
            }

            teamSelect.innerHTML = claimable.map(t => `
                <option value="${t.user_id}" ${t.user_id === preselectedOfflineUserId ? 'selected' : ''}>
                    ${t.team_name} (${(t.season_points || 0).toFixed(2)} pts)
                </option>
            `).join('');

            submitBtn.disabled = false;
            submitBtn.innerText = 'Claim Team & Transfer Roster';

            // Show preview
            const currentSelected = teamSelect.value;
            const targetT = claimable.find(t => t.user_id === currentSelected);
            if (targetT) {
                nameInput.value = targetT.team_name;
                previewDiv.style.display = 'block';
                previewDiv.innerHTML = `<strong>Selected Team:</strong> ${targetT.team_name} • <strong>Season Total:</strong> ${(targetT.season_points || 0).toFixed(2)} pts`;
            }
        };

        const activeLeagueId = preselectedLeagueId || leagueSelect.value;
        await updateTeamsDropdown(activeLeagueId);

        leagueSelect.onchange = (e) => {
            updateTeamsDropdown(e.target.value);
        };

        teamSelect.onchange = (e) => {
            const uid = e.target.value;
            if (!uid) {
                previewDiv.style.display = 'none';
                return;
            }
            const selText = teamSelect.options[teamSelect.selectedIndex]?.text || '';
            nameInput.value = selText.split(' (')[0];
            previewDiv.style.display = 'block';
            previewDiv.innerHTML = `<strong>Selected Team:</strong> ${selText}`;
        };

        // Close handlers
        const closeBtn = document.getElementById('claim-modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => { modal.style.display = 'none'; };
        }
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        };

        // Form submit
        const form = document.getElementById('claim-team-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const lId = leagueSelect.value;
            const offUid = teamSelect.value;
            const newName = nameInput.value.trim();

            if (!lId || !offUid) {
                alert("Please select a team to claim.");
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerText = 'Claiming Team...';
            msgDiv.style.display = 'none';

            try {
                await ClaimManager.claimTeam(lId, offUid, newName);
                modal.style.display = 'none';
                alert(`🎉 Congratulations! You have claimed team "${newName || 'your team'}". Welcome to the league!`);
                window.location.hash = `#/league_detail?league=${lId}`;
                window.location.reload();
            } catch (err) {
                console.error("Claim error:", err);
                msgDiv.style.display = 'block';
                msgDiv.style.color = 'var(--danger-color)';
                msgDiv.innerText = err.message;
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Claim Team & Transfer Roster';
            }
        };
    },

    // Check for pending claim in localStorage after signup/login
    checkPendingClaim: async () => {
        const pendingRaw = localStorage.getItem('worstqb_pending_claim');
        if (!pendingRaw) return;

        try {
            const pending = JSON.parse(pendingRaw);
            const { data: { session } } = await supabase.auth.getSession();
            if (session && pending && pending.leagueId && pending.offlineUserId) {
                localStorage.removeItem('worstqb_pending_claim');
                await ClaimManager.claimTeam(pending.leagueId, pending.offlineUserId, pending.teamName);
                alert(`🎉 Welcome! You have successfully claimed team "${pending.teamName || 'your team'}".`);
                window.location.hash = `#/league_detail?league=${pending.leagueId}`;
                window.location.reload();
            }
        } catch (e) {
            console.error("Pending claim error:", e);
            localStorage.removeItem('worstqb_pending_claim');
        }
    }
};

window.ClaimManager = ClaimManager;
window.openClaimTeamModal = ClaimManager.openClaimModal;

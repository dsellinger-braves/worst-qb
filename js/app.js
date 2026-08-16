import { DashboardView } from './views/dashboard.js';
import { LeaguesView } from './views/leagues.js';
import { LeagueDetailView } from './views/league_detail.js';
import { StatsView } from './views/stats.js';
import { PlayerProfileView } from './views/player_profile.js';
import { DraftView } from './views/draft.js';
import { Router } from './router.js';
import { supabase } from './supabase.js';

// Define Routes
const routes = {
    'dashboard': DashboardView,
    'leagues': LeaguesView,
    'league_detail': LeagueDetailView,
    'stats': StatsView,
    'player_profile': PlayerProfileView,
    'draft': DraftView,
    'matchups': {
        render: () => `<div class="view-container active glass-panel"><h1>Live Scores</h1><p>Live stats feed will appear here during games.</p></div>`,
        init: () => {}
    }
};

// Initialize Router
const router = new Router(routes);

// Default Route
router.navigate('dashboard');

// Authentication Handler
const authBtn = document.getElementById('auth-btn');

const updateAuthUI = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        authBtn.innerText = 'Logout';
        authBtn.onclick = async () => {
            await supabase.auth.signOut();
            updateAuthUI();
            router.navigate('dashboard');
        };
    } else {
        authBtn.innerText = 'Login';
        authBtn.onclick = async () => {
            const email = prompt("Enter email:");
            const password = prompt("Enter password (minimum 6 chars):");
            if (email && password) {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error && error.message.includes("Invalid login")) {
                    // Try signup if login fails for demo purposes
                    const { error: signUpError } = await supabase.auth.signUp({ email, password });
                    if (signUpError) alert(signUpError.message);
                    else alert("Signup successful! Please check email for confirmation or login if auto-confirmed.");
                } else if (error) {
                    alert(error.message);
                }
                updateAuthUI();
                router.navigate('dashboard');
            }
        };
    }
};

// Listen for auth state changes
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        updateAuthUI();
    });
    updateAuthUI();
}

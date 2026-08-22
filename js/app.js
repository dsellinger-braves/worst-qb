import { DashboardView } from './views/dashboard.js';
import { LeaguesView } from './views/leagues.js';
import { LeagueDetailView } from './views/league_detail.js';
import { ProjectionsView } from './views/projections.js';
import { StatsView } from './views/stats.js';
import { PlayerProfileView } from './views/player_profile.js';
import { DraftView } from './views/draft.js';
import { RulesView } from './views/rules.js';
import { Router } from './router.js';
import { supabase } from './supabase.js';

import { SettingsView } from './views/settings.js';

// Define Routes
const routes = {
    'dashboard': DashboardView,
    'leagues': LeaguesView,
    'league_detail': LeagueDetailView,
    'projections': ProjectionsView,
    'stats': StatsView,
    'player_profile': PlayerProfileView,
    'draft': DraftView,
    'rules': RulesView,
    'settings': SettingsView,
    'matchups': {
        render: () => `<div class="view-container active glass-panel"><h1>Live Scores</h1><p>Live stats feed will appear here during games.</p></div>`,
        init: () => {}
    }
};

// Initialize Router
const router = new Router(routes);

// Default Route
// Handle initial hash routing
router.handleHashChange();

// Authentication Handler
const authBtn = document.getElementById('auth-btn');
const settingsLink = document.getElementById('nav-settings');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchMode = document.getElementById('auth-switch-mode');
const authSwitchText = document.getElementById('auth-switch-text');
const authOptInContainer = document.getElementById('auth-opt-in-container');
const authCloseBtn = document.getElementById('auth-close-btn');

let isSignUp = false;

authSwitchMode.onclick = (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    if (isSignUp) {
        authTitle.innerText = 'Create Account';
        authSubmitBtn.innerText = 'Sign Up';
        authSwitchText.innerText = 'Already have an account?';
        authSwitchMode.innerText = 'Login';
        authOptInContainer.style.display = 'block';
    } else {
        authTitle.innerText = 'Login';
        authSubmitBtn.innerText = 'Login';
        authSwitchText.innerText = "Don't have an account?";
        authSwitchMode.innerText = 'Sign up';
        authOptInContainer.style.display = 'none';
    }
};

authCloseBtn.onclick = () => {
    authModal.style.display = 'none';
};

authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const optIn = document.getElementById('auth-opt-in').checked;
    
    if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    email_opt_in: optIn
                }
            }
        });
        if (signUpError) alert(signUpError.message);
        else {
            alert("Signup successful!");
            authModal.style.display = 'none';
        }
    } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else {
            authModal.style.display = 'none';
            router.navigate('dashboard');
        }
    }
};

const updateAuthUI = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        authBtn.innerText = 'Logout';
        settingsLink.style.display = 'inline-block';
        authBtn.onclick = async () => {
            await supabase.auth.signOut();
            updateAuthUI();
            router.navigate('dashboard');
        };
    } else {
        authBtn.innerText = 'Login';
        settingsLink.style.display = 'none';
        authBtn.onclick = () => {
            authModal.style.display = 'flex';
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

import { DashboardView } from './views/dashboard.js?v=1.6';
import { LeaguesView } from './views/leagues.js?v=1.6';
import { LeagueDetailView } from './views/league_detail.js?v=1.6';
import { ProjectionsView } from './views/projections.js?v=1.6';
import { StatsView } from './views/stats.js?v=1.6';
import { PlayerProfileView } from './views/player_profile.js?v=1.6';
import { DraftView } from './views/draft.js?v=1.6';
import { RulesView } from './views/rules.js?v=1.6';
import { Router } from './router.js';
import { supabase } from './supabase.js';

import { SettingsView } from './views/settings.js?v=1.6';
import { MatchupsView } from './views/matchups.js?v=1.6';
import { ScoreboardView } from './views/scoreboard.js?v=1.6';

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
    'matchups': MatchupsView,
    'scoreboard': ScoreboardView
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
const authForgotBtn = document.getElementById('auth-forgot-password');
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
        if (authForgotBtn) authForgotBtn.style.display = 'none';
    } else {
        authTitle.innerText = 'Login';
        authSubmitBtn.innerText = 'Login';
        authSwitchText.innerText = "Don't have an account?";
        authSwitchMode.innerText = 'Sign up';
        authOptInContainer.style.display = 'none';
        if (authForgotBtn) authForgotBtn.style.display = 'inline';
    }
};

if (authForgotBtn) {
    authForgotBtn.onclick = async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        if (!email) {
            alert("Please enter your email in the field above first, then click 'Forgot password?'.");
            return;
        }
        authForgotBtn.innerText = 'Sending...';
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname
            });
            if (error) {
                alert("Reset error: " + error.message);
            } else {
                alert("Password reset email sent! Check your inbox (and spam folder) for a link to reset your password.");
            }
        } catch (err) {
            alert("Error sending reset email: " + err.message);
        } finally {
            authForgotBtn.innerText = 'Forgot password?';
        }
    };
}

authCloseBtn.onclick = () => {
    authModal.style.display = 'none';
};

authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const optIn = document.getElementById('auth-opt-in').checked;
    
    authSubmitBtn.disabled = true;
    authSubmitBtn.innerText = isSignUp ? 'Creating Account...' : 'Logging in...';

    try {
        if (isSignUp) {
            const { data, error: signUpError } = await supabase.auth.signUp({ 
                email, 
                password,
                options: {
                    data: {
                        email_opt_in: optIn
                    }
                }
            });
            if (signUpError) {
                alert(signUpError.message);
            } else if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
                alert("An account with this email already exists! Please log in, or click 'Forgot password?' if you need to reset it.");
            } else if (!data?.session) {
                alert("Signup successful! Please check your email to confirm your account before logging in.");
                authModal.style.display = 'none';
            } else {
                alert("Signup successful!");
                authModal.style.display = 'none';
                router.navigate('dashboard');
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                alert(error.message);
            } else {
                authModal.style.display = 'none';
                router.navigate('dashboard');
            }
        }
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.innerText = isSignUp ? 'Sign Up' : 'Login';
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
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            const newPassword = prompt("Please enter your new password (at least 6 characters):");
            if (newPassword && newPassword.length >= 6) {
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                if (error) {
                    alert("Failed to update password: " + error.message);
                } else {
                    alert("Password updated successfully! You are now logged in.");
                }
            }
        }
        updateAuthUI();
    });
    updateAuthUI();
}

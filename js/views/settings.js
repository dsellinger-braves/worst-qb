import { supabase } from '../supabase.js';

export const SettingsView = {
    render: () => `
        <div class="view-container active glass-panel" style="max-width: 600px; margin: 0 auto;">
            <h1 style="color: var(--accent-primary); border-bottom: 2px solid var(--glass-border); padding-bottom: 1rem; margin-bottom: 2rem;">Account Settings</h1>
            
            <div id="settings-loading" style="text-align: center; color: var(--text-secondary);">
                <div class="spinner" style="margin: 0 auto 1rem auto;"></div>
                <p>Loading settings...</p>
            </div>
            
            <div id="settings-content" style="display: none;">
                <!-- Account Info -->
                <div style="background: rgba(0,0,0,0.3); padding: 1.25rem 1.5rem; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; display: block;">Logged In As</span>
                        <span id="settings-user-email" style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem;"></span>
                    </div>
                    <span style="background: rgba(16, 185, 129, 0.15); color: var(--accent-success); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.3);">Active</span>
                </div>

                <!-- Change Password -->
                <div style="background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 1.5rem;">
                    <h3 style="margin-top: 0; color: var(--text-primary); margin-bottom: 0.5rem;">Change Password</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Update your account password without needing an email reset link.</p>
                    
                    <form id="settings-password-form" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.4rem; color: var(--text-secondary); font-size: 0.85rem;">New Password</label>
                            <input type="password" id="setting-new-password" placeholder="Minimum 6 characters" minlength="6" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 6px; color: white; font-family: inherit;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.4rem; color: var(--text-secondary); font-size: 0.85rem;">Confirm New Password</label>
                            <input type="password" id="setting-confirm-password" placeholder="Confirm minimum 6 characters" minlength="6" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); border-radius: 6px; color: white; font-family: inherit;">
                        </div>
                        <button type="submit" id="settings-password-btn" class="btn btn-secondary" style="width: 100%; justify-content: center;">Update Password</button>
                    </form>
                    <p id="settings-password-message" style="text-align: center; margin-top: 1rem; display: none;"></p>
                </div>
            </div>
        </div>
    `,
    init: async () => {
        const loadingEl = document.getElementById('settings-loading');
        const contentEl = document.getElementById('settings-content');
        const userEmailEl = document.getElementById('settings-user-email');

        const passwordForm = document.getElementById('settings-password-form');
        const newPasswordInput = document.getElementById('setting-new-password');
        const confirmPasswordInput = document.getElementById('setting-confirm-password');
        const passwordBtn = document.getElementById('settings-password-btn');
        const passwordMessageEl = document.getElementById('settings-password-message');
        
        if (!supabase) {
            loadingEl.innerHTML = 'Supabase client not initialized.';
            return;
        }

        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            loadingEl.innerHTML = 'Please log in to view settings.';
            return;
        }

        if (userEmailEl) {
            userEmailEl.textContent = user.email || 'Unknown';
        }
        
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

        if (passwordForm) {
            passwordForm.onsubmit = async (e) => {
                e.preventDefault();
                const newPassword = newPasswordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                passwordMessageEl.style.display = 'block';

                if (!newPassword || newPassword.length < 6) {
                    passwordMessageEl.style.color = 'var(--danger-color)';
                    passwordMessageEl.innerText = 'Password must be at least 6 characters.';
                    return;
                }

                if (newPassword !== confirmPassword) {
                    passwordMessageEl.style.color = 'var(--danger-color)';
                    passwordMessageEl.innerText = 'Passwords do not match.';
                    return;
                }

                passwordBtn.disabled = true;
                passwordBtn.innerText = 'Updating Password...';

                try {
                    const { error: passError } = await supabase.auth.updateUser({
                        password: newPassword
                    });

                    if (passError) {
                        passwordMessageEl.style.color = 'var(--danger-color)';
                        passwordMessageEl.innerText = 'Failed to update password: ' + passError.message;
                    } else {
                        passwordMessageEl.style.color = 'var(--accent-success)';
                        passwordMessageEl.innerText = 'Password updated successfully!';
                        newPasswordInput.value = '';
                        confirmPasswordInput.value = '';
                        setTimeout(() => {
                            passwordMessageEl.style.display = 'none';
                        }, 4000);
                    }
                } catch (err) {
                    passwordMessageEl.style.color = 'var(--danger-color)';
                    passwordMessageEl.innerText = 'Error: ' + err.message;
                } finally {
                    passwordBtn.disabled = false;
                    passwordBtn.innerText = 'Update Password';
                }
            };
        }
    }
};

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
                <div style="background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 2rem;">
                    <h3 style="margin-top: 0; color: var(--text-primary); margin-bottom: 1rem;">Email Preferences</h3>
                    
                    <label style="display: flex; align-items: flex-start; gap: 1rem; cursor: pointer;">
                        <input type="checkbox" id="setting-email-opt-in" style="margin-top: 0.25rem;">
                        <div>
                            <span style="font-weight: bold; color: var(--text-primary); display: block; margin-bottom: 0.25rem;">Weekly Recap Emails</span>
                            <span style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4;">Receive automated weekly summaries of league performances and sports blog-style write-ups.</span>
                        </div>
                    </label>
                </div>
                
                <button id="settings-save-btn" class="btn btn-primary" style="width: 100%; justify-content: center;">Save Changes</button>
                <p id="settings-message" style="text-align: center; margin-top: 1rem; display: none;"></p>
            </div>
        </div>
    `,
    init: async () => {
        const loadingEl = document.getElementById('settings-loading');
        const contentEl = document.getElementById('settings-content');
        const optInCheckbox = document.getElementById('setting-email-opt-in');
        const saveBtn = document.getElementById('settings-save-btn');
        const messageEl = document.getElementById('settings-message');
        
        if (!supabase) {
            loadingEl.innerHTML = 'Supabase client not initialized.';
            return;
        }

        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            loadingEl.innerHTML = 'Please log in to view settings.';
            return;
        }
        
        // Default to true if not explicitly set to false
        const currentOptIn = user.user_metadata?.email_opt_in !== false;
        optInCheckbox.checked = currentOptIn;
        
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        
        saveBtn.onclick = async () => {
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving...';
            
            const newOptIn = optInCheckbox.checked;
            
            const { data, error: updateError } = await supabase.auth.updateUser({
                data: { email_opt_in: newOptIn }
            });
            
            saveBtn.disabled = false;
            saveBtn.innerText = 'Save Changes';
            messageEl.style.display = 'block';
            
            if (updateError) {
                messageEl.style.color = 'var(--danger-color)';
                messageEl.innerText = 'Failed to update settings: ' + updateError.message;
            } else {
                messageEl.style.color = 'var(--accent-primary)';
                messageEl.innerText = 'Settings updated successfully!';
                setTimeout(() => {
                    messageEl.style.display = 'none';
                }, 3000);
            }
        };
    }
};

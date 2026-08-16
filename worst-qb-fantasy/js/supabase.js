// Supabase configuration
// IMPORTANT: Replace these with your actual Supabase project URL and Anon Key
const supabaseUrl = 'https://fudkcwwfkofvcqtpjzfy.supabase.co';
const supabaseKey = 'sb_secret_v5Qc_seDMtjpHqhL4KUYSA_gyOdmDK8';

// Check if supabase is loaded from CDN
if (!window.supabase) {
    console.error("Supabase CDN script not loaded!");
}

// Create a single supabase client for interacting with your database
export const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

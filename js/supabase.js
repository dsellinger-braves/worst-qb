// Supabase configuration
// IMPORTANT: Replace these with your actual Supabase project URL and Anon Key
const supabaseUrl = 'https://fudkcwwfkofvcqtpjzfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZGtjd3dma29mdmNxdHBqemZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4ODQyNTgsImV4cCI6MjEwMjQ2MDI1OH0.sPqDKCoGZoNYM1lssZiPzEAYHSyiWQiSDUhM8Vkv5hQ';

// Check if supabase is loaded from CDN
if (!window.supabase) {
    console.error("Supabase CDN script not loaded!");
}

// Create a single supabase client for interacting with your database
export const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

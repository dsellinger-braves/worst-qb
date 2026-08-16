// Supabase configuration
// IMPORTANT: Replace these with your actual Supabase project URL and Anon Key
const supabaseUrl = 'https://fudkcwwfkofvcqtpjzfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZGtjd3dma29mdmNxdHBqemZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg4NDI1OCwiZXhwIjoyMTAyNDYwMjU4fQ.H25C4gmO9pQReWtGFPbk0cPm0PJgNkYReqpIlO8Gec8';

// Check if supabase is loaded from CDN
if (!window.supabase) {
    console.error("Supabase CDN script not loaded!");
}

// Create a single supabase client for interacting with your database
export const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

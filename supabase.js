const SUPABASE_URL = 'https://mrytsgemfksbqlsxmxkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeXRzZ2VtZmtzYnFsc3hteGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDg3NjMsImV4cCI6MjA5MTEyNDc2M30.B1ipLC0AjHgUBCx5BadMvc5WootlsF3JWWi7qeMWwpo';

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = window.supabase;

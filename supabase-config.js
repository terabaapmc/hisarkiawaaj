/**
 * HisarKiAawaj — Supabase Client Configuration
 * 
 * Replace these placeholder credentials with your actual Supabase project keys:
 * 1. Log in to https://app.supabase.com
 * 2. Select your project -> Project Settings -> API
 * 3. Copy the Project URL and Project API anon/public key below.
 */

window.SUPABASE_CONFIG = {
  // Replace with your project URL:
  url: localStorage.getItem('hisarkiaawaj_supabase_url') || 'https://your-project-id.supabase.co',
  
  // Replace with your project anon public key:
  anonKey: localStorage.getItem('hisarkiaawaj_supabase_anon_key') || 'your-supabase-anon-key'
};

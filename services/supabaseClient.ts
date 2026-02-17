
import { createClient } from '@supabase/supabase-js';

// Prefer Vite env vars (import.meta.env) and fall back to process.env or hardcoded defaults.
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Fallback to hardcoded defaults if environment variables are not provided.
const supabaseUrl = envUrl || 'https://httvyphjobriwtnnrohv.supabase.co';
const supabaseAnonKey = envAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0dHZ5cGhqb2JyaXd0bm5yb2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3ODU5ODksImV4cCI6MjA4NTM2MTk4OX0.4KtVQq0ExY18E90H6vQ74Z1_LZEEXuT9z0iLiC9Qypk';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase configuration is missing. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

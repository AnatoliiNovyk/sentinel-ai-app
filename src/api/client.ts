import { createClient } from '@supabase/supabase-js';

/* c8 ignore next */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
/* c8 ignore next */
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Centralized Supabase client for the frontend.
// It ONLY uses the Anon Key for security.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

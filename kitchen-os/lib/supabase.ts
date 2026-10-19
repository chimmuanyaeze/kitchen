import { createClient } from '@supabase/supabase-js';

// We pull the secret keys from the .env.local file you just made
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This creates the "cable" we will use throughout the app to talk to the database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
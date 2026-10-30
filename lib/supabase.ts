import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "https://rlbdgyajikbdhivwfyzk.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsYmRneWFqaWtiZGhpdndmeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjMyMjYsImV4cCI6MjEwNzYzOTIyNn0.ECDTkmjQD1d1qIeZyPEE0Z87TrjrYjWG5pk0JRZdrME";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

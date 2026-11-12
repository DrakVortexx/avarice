export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:2567";
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

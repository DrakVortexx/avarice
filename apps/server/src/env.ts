export const config = {
  port: Number.parseInt(process.env.PORT ?? "2567", 10),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  isProduction: process.env.NODE_ENV === "production",
};

export function hasSupabaseConfig(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

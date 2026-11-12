import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, hasSupabaseConfig } from "./env.js";

export interface AuthResult {
  authId: string;
  username: string;
  displayName: string;
}

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl!, config.supabaseServiceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function normalizeUsername(raw: string): string {
  const trimmed = raw.trim().slice(0, 20);
  return trimmed.length > 0 ? trimmed : "Wanderer";
}

export async function verifyAccessToken(token: string): Promise<AuthResult> {
  if (!hasSupabaseConfig()) {
    throw new Error("Auth is not configured on the server.");
  }

  const { data, error } = await getAdminClient().auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Invalid or expired session.");
  }

  const metadata = data.user.user_metadata as { username?: unknown } | undefined;
  const username =
    typeof metadata?.username === "string" && metadata.username.trim().length > 0
      ? normalizeUsername(metadata.username)
      : normalizeUsername(data.user.email?.split("@")[0] ?? "Wanderer");

  return {
    authId: data.user.id,
    username,
    displayName: username,
  };
}

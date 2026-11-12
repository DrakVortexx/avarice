import type { Session } from "@supabase/supabase-js";
import { requireSupabase } from "./supabase.js";

const EMAIL_DOMAIN = "avarice.local";

export interface Credentials {
  username: string;
  password: string;
}

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

export function validateUsername(username: string): string | null {
  const value = username.trim();
  if (value.length < 3 || value.length > 20) {
    return "Username must be 3-20 characters.";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return "Use letters, numbers, and underscores only.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) {
    return null;
  }
  return data.session;
}

export async function signIn({ username, password }: Credentials): Promise<Session> {
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data.session) {
    throw new Error("Could not start a session.");
  }
  return data.session;
}

export async function signUp({ username, password }: Credentials): Promise<Session> {
  const { data, error } = await requireSupabase().auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username: username.trim() } },
  });
  if (error) {
    throw new Error(error.message);
  }
  if (!data.session) {
    throw new Error(
      "Account created, but no session was returned. Disable email confirmation in Supabase Auth settings.",
    );
  }
  return data.session;
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut();
}

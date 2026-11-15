import { SERVER_URL } from "./config.js";

export interface Profile {
  username: string;
  displayName: string;
  coins: number;
  saved: boolean;
}

export type ProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: string };

export async function fetchProfile(accessToken: string): Promise<ProfileResult> {
  try {
    const response = await fetch(`${SERVER_URL}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      return { ok: true, profile: (await response.json()) as Profile };
    }
    if (response.status === 401) {
      return { ok: false, reason: "unauthorized" };
    }
    if (response.status === 404) {
      return { ok: false, reason: "outdated" };
    }
    return { ok: false, reason: `http-${response.status}` };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

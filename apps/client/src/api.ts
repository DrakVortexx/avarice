import { SERVER_URL } from "./config.js";

export interface Profile {
  username: string;
  displayName: string;
  coins: number;
  saved: boolean;
}

export async function fetchProfile(accessToken: string): Promise<Profile | null> {
  try {
    const response = await fetch(`${SERVER_URL}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Profile;
  } catch {
    return null;
  }
}

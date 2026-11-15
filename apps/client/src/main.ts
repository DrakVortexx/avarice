import type { Ticker } from "pixi.js";
import type { Session } from "@supabase/supabase-js";
import { formatCoins, type ChatEvent, type LootEvent } from "@avarice/shared";
import { hasSupabaseConfig } from "./config.js";
import { getCurrentSession, signIn, signOut, signUp, validatePassword, validateUsername } from "./auth.js";
import { fetchProfile } from "./api.js";
import { Game } from "./game.js";
import { createInput } from "./input.js";
import {
  connect,
  type LocalStats,
  type LootSnapshot,
  type Net,
  type PlayerSnapshot,
} from "./net.js";

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

const canvas = must<HTMLCanvasElement>("#game");
const loadingEl = must<HTMLDivElement>("#loading");
const statusEl = must<HTMLSpanElement>("#status");
const playersEl = must<HTMLSpanElement>("#players");
const logEl = must<HTMLDivElement>("#log");
const chatForm = must<HTMLFormElement>("#chat-form");
const chatInput = must<HTMLInputElement>("#chat-input");
const logoutButton = must<HTMLButtonElement>("#logout");
const coinsEl = must<HTMLSpanElement>("#coins");

const authEl = must<HTMLDivElement>("#auth");
const authForm = must<HTMLFormElement>("#auth-form");
const authUsername = must<HTMLInputElement>("#auth-username");
const authPassword = must<HTMLInputElement>("#auth-password");
const authError = must<HTMLDivElement>("#auth-error");
const authSubmit = must<HTMLButtonElement>("#auth-submit");
const authToggle = must<HTMLButtonElement>("#auth-toggle");

const dashboardEl = must<HTMLDivElement>("#dashboard");
const dashUsername = must<HTMLElement>("#dash-username");
const dashCoins = must<HTMLSpanElement>("#dash-coins");
const dashSave = must<HTMLSpanElement>("#dash-save");
const dashNote = must<HTMLDivElement>("#dash-note");
const dashPlay = must<HTMLButtonElement>("#dash-play");
const dashLogout = must<HTMLButtonElement>("#dash-logout");

const game = new Game();
const input = createInput();

let net: Net | null = null;
let mySessionId = "";
let authMode: "signin" | "signup" = "signin";
let sendAccumulator = 0;
let accessToken = "";
let currentSession: Session | null = null;

const isAuthVisible = (): boolean => !authEl.classList.contains("hidden");
const isDashboardVisible = (): boolean => !dashboardEl.classList.contains("hidden");
const isPlaying = (): boolean => !isAuthVisible() && !isDashboardVisible();

function setStatus(text: string, state: "connecting" | "connected" | "error"): void {
  statusEl.textContent = text;
  statusEl.className = `status ${state}`;
}

function addLog(kind: "chat" | "system", from: string, text: string): void {
  const entry = document.createElement("div");
  entry.className = `log-entry ${kind}`;

  if (kind === "chat") {
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = `${from}: `;
    entry.append(who, document.createTextNode(text));
  } else {
    entry.textContent = text;
  }

  logEl.append(entry);
  while (logEl.childElementCount > 8) {
    logEl.firstElementChild?.remove();
  }
}

function systemLog(text: string): void {
  addLog("system", "Avarice", text);
}

function updatePlayerCount(): void {
  const count = net ? game.remoteCount + 1 : 0;
  playersEl.textContent = `${count} online`;
}

function openChat(): void {
  chatForm.classList.remove("hidden");
  chatInput.focus();
}

function closeChat(): void {
  chatForm.classList.add("hidden");
  chatInput.blur();
  chatInput.value = "";
}

function setAuthError(message: string): void {
  authError.textContent = message;
  authError.classList.toggle("hidden", message.length === 0);
}

function clearAuthError(): void {
  setAuthError("");
}

function setBusy(busy: boolean): void {
  authSubmit.disabled = busy;
  authToggle.disabled = busy;
  authUsername.disabled = busy;
  authPassword.disabled = busy;
  authSubmit.textContent = busy
    ? "Please wait…"
    : authMode === "signin"
      ? "Sign in"
      : "Create account";
}

function showAuth(message?: string): void {
  authEl.classList.remove("hidden");
  if (message) {
    setAuthError(message);
  }
}

function hideAuth(): void {
  authEl.classList.add("hidden");
  clearAuthError();
}

function hideDashboard(): void {
  dashboardEl.classList.add("hidden");
}

function setDashNote(message: string): void {
  dashNote.textContent = message;
  dashNote.classList.toggle("hidden", message.length === 0);
}

async function showDashboard(session: Session): Promise<void> {
  currentSession = session;
  accessToken = session.access_token;
  hideAuth();
  setDashNote("");

  const meta = session.user.user_metadata as { username?: string } | undefined;
  dashUsername.textContent = meta?.username ?? session.user.email?.split("@")[0] ?? "wanderer";
  dashCoins.textContent = "…";
  dashSave.textContent = "…";
  dashSave.className = "dash-stat-value";
  dashboardEl.classList.remove("hidden");

  const profile = await fetchProfile(accessToken);
  if (!profile) {
    dashCoins.textContent = "—";
    dashSave.textContent = "Server unreachable";
    dashSave.className = "dash-stat-value bad";
    setDashNote("Could not load your profile. The server may be offline.");
    return;
  }

  dashUsername.textContent = profile.displayName;
  dashCoins.textContent = formatCoins(profile.coins);
  if (profile.saved) {
    dashSave.textContent = "Saved";
    dashSave.className = "dash-stat-value ok";
  } else {
    dashSave.textContent = "Not saved";
    dashSave.className = "dash-stat-value bad";
    setDashNote("Progress is not being saved. The server database is not connected.");
  }
}

function makeHandlers() {
  return {
    onConnected: (sessionId: string): void => {
      mySessionId = sessionId;
      setStatus("Connected", "connected");
      addLog("system", "Avarice", "You entered the world.");
      updatePlayerCount();
    },
    onDisconnected: (code: number): void => {
      net = null;
      setStatus("Disconnected", "error");
      addLog("system", "Avarice", `Disconnected (${code}).`);
      updatePlayerCount();
      if (currentSession) {
        void showDashboard(currentSession);
      }
    },
    onError: (message: string): void => {
      setStatus("Connection error", "error");
      addLog("system", "Avarice", message);
    },
    onChat: (event: ChatEvent): void => addLog(event.kind, event.from, event.text),
    onLoot: (event: LootEvent): void => {
      if (event.sessionId !== mySessionId) {
        return;
      }
      game.spawnFloatingText(event.x, event.z, `+${event.amount}c`, 0xffe9a8);
      systemLog(`Found ${formatCoins(event.amount)} (${formatCoins(event.coins)} total).`);
    },
    onLocalPosition: (x: number, z: number): void => game.setServerPosition(x, z),
    onLocalStats: (stats: LocalStats): void => {
      coinsEl.textContent = formatCoins(stats.coins);
    },
    onPlayerAdd: (player: PlayerSnapshot): void => {
      game.addRemote(player.id, player.name, player.x, player.z, player.yaw);
      updatePlayerCount();
    },
    onPlayerUpdate: (player: PlayerSnapshot): void => {
      game.updateRemote(player.id, player.x, player.z, player.yaw);
    },
    onPlayerRemove: (id: string): void => {
      game.removeRemote(id);
      updatePlayerCount();
    },
    onLootAdd: (loot: LootSnapshot): void => {
      game.addLoot(loot.id, loot.x, loot.z, loot.amount);
    },
    onLootRemove: (id: string): void => {
      game.removeLoot(id);
    },
  };
}

async function startGame(accessToken: string): Promise<void> {
  setStatus("Connecting…", "connecting");
  try {
    net = await connect(accessToken, makeHandlers());
    updatePlayerCount();
  } catch (error) {
    setStatus("Cannot reach server", "error");
    addLog(
      "system",
      "Avarice",
      error instanceof Error ? error.message : "Connection failed.",
    );
  }
}

function frame(ticker: Ticker): void {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  const movement = isPlaying() ? input.getMovement() : { x: 0, z: 0 };

  game.updateLocal(dt, movement);
  game.render(dt);

  if (net) {
    sendAccumulator += dt;
    if (sendAccumulator >= 1 / 20) {
      sendAccumulator = 0;
      net.sendInput(movement.x, movement.z, game.yaw);
    }
  }
}

async function boot(): Promise<void> {
  updatePlayerCount();

  if (!hasSupabaseConfig) {
    showAuth(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/client/.env.",
    );
    return;
  }

  try {
    const session = await getCurrentSession();
    if (session) {
      await showDashboard(session);
      return;
    }
  } catch {
    // Fall through to the login screen.
  }

  showAuth();
}

authForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = authUsername.value.trim();
  const password = authPassword.value;

  const usernameError = validateUsername(username);
  if (usernameError) {
    setAuthError(usernameError);
    return;
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    setAuthError(passwordError);
    return;
  }

  clearAuthError();
  setBusy(true);

  void (async () => {
    try {
      const session =
        authMode === "signup"
          ? await signUp({ username, password })
          : await signIn({ username, password });
      authPassword.value = "";
      await showDashboard(session);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  })();
});

authToggle.addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  clearAuthError();
  setBusy(false);
  authToggle.textContent =
    authMode === "signin" ? "Need an account? Create one" : "Have an account? Sign in";
});

logoutButton.addEventListener("click", () => {
  net?.leave();
  net = null;
  if (currentSession) {
    void showDashboard(currentSession);
  }
});

dashPlay.addEventListener("click", () => {
  if (!currentSession) {
    return;
  }
  hideDashboard();
  void startGame(currentSession.access_token);
});

dashLogout.addEventListener("click", () => {
  void signOut().finally(() => window.location.reload());
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (text.length > 0 && net) {
    net.sendChat(text);
  }
  closeChat();
});

window.addEventListener("keydown", (event) => {
  if (document.activeElement === chatInput) {
    if (event.key === "Escape") {
      closeChat();
    }
    return;
  }

  if (isAuthVisible() || isDashboardVisible()) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    openChat();
  }
});

void (async () => {
  await game.init(canvas);
  game.app.ticker.add(frame);
  loadingEl.classList.add("done");
  await boot();
})();

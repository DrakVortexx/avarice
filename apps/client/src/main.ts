import type { Ticker } from "pixi.js";
import { hasSupabaseConfig } from "./config.js";
import { getCurrentSession, signIn, signOut, signUp, validatePassword, validateUsername } from "./auth.js";
import { Game } from "./game.js";
import { createInput } from "./input.js";
import { connect, type Net, type PlayerSnapshot } from "./net.js";
import type { ChatEvent } from "@avarice/shared";

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

const authEl = must<HTMLDivElement>("#auth");
const authForm = must<HTMLFormElement>("#auth-form");
const authUsername = must<HTMLInputElement>("#auth-username");
const authPassword = must<HTMLInputElement>("#auth-password");
const authError = must<HTMLDivElement>("#auth-error");
const authSubmit = must<HTMLButtonElement>("#auth-submit");
const authToggle = must<HTMLButtonElement>("#auth-toggle");

const game = new Game();
const input = createInput();

let net: Net | null = null;
let authMode: "signin" | "signup" = "signin";
let sendAccumulator = 0;

const isAuthVisible = (): boolean => !authEl.classList.contains("hidden");

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

function updatePlayerCount(): void {
  playersEl.textContent = `${game.remoteCount + 1} online`;
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

function makeHandlers() {
  return {
    onConnected: (): void => {
      setStatus("Connected", "connected");
      addLog("system", "Avarice", "You entered the world.");
    },
    onDisconnected: (code: number): void => {
      net = null;
      setStatus("Disconnected", "error");
      addLog("system", "Avarice", `Disconnected (${code}).`);
    },
    onError: (message: string): void => {
      setStatus("Connection error", "error");
      addLog("system", "Avarice", message);
    },
    onChat: (event: ChatEvent): void => addLog(event.kind, event.from, event.text),
    onLocalPosition: (x: number, z: number): void => game.setServerPosition(x, z),
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
  };
}

async function startGame(accessToken: string): Promise<void> {
  setStatus("Connecting…", "connecting");
  try {
    net = await connect(accessToken, makeHandlers());
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
  const movement = isAuthVisible() ? { x: 0, z: 0 } : input.getMovement();

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
      hideAuth();
      await startGame(session.access_token);
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
      hideAuth();
      authPassword.value = "";
      await startGame(session.access_token);
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

  if (event.key === "Enter" && !isAuthVisible()) {
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

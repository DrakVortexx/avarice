import "./loadEnv.js";
import { defineRoom, defineServer } from "colyseus";
import { WORLD_ROOM_NAME } from "@avarice/shared";
import { WorldRoom } from "./rooms/WorldRoom.js";
import { config, hasSupabaseConfig } from "./env.js";
import { initDatabase, isDatabaseReady, loadOrCreatePlayer } from "./db.js";
import { verifyAccessToken } from "./auth.js";

interface HttpRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

interface HttpResponse {
  setHeader(name: string, value: string): void;
  sendStatus(code: number): void;
  json(body: unknown): void;
}

const server = defineServer({
  rooms: {
    [WORLD_ROOM_NAME]: defineRoom(WorldRoom),
  },
  express: (app) => {
    app.use((req: HttpRequest, res: HttpResponse, next: () => void) => {
      const origin = req.headers.origin;
      res.setHeader(
        "Access-Control-Allow-Origin",
        typeof origin === "string" ? origin : config.clientOrigin,
      );
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });

    app.get("/health", (_req: HttpRequest, res: HttpResponse) => {
      res.json({ ok: true, uptime: process.uptime(), db: isDatabaseReady() });
    });

    app.get("/profile", async (req: HttpRequest, res: HttpResponse) => {
      const header = req.headers.authorization;
      const token =
        typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!token) {
        res.sendStatus(401);
        return;
      }

      try {
        const identity = await verifyAccessToken(token);
        const profile = await loadOrCreatePlayer(
          identity.authId,
          identity.username,
          identity.displayName,
        );
        res.json({
          username: identity.username,
          displayName: identity.displayName,
          coins: profile?.coins ?? 0,
          level: profile?.level ?? 1,
          isAdmin: profile?.isAdmin ?? false,
          saved: Boolean(profile),
        });
      } catch {
        res.sendStatus(401);
      }
    });
  },
});

await initDatabase();

server.listen(config.port);
console.log(`[server] Avarice listening on http://localhost:${config.port}`);

if (!hasSupabaseConfig()) {
  console.warn(
    "[server] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing. Player joins will be rejected until they are set.",
  );
}

const shutdown = () => {
  void server.gracefullyShutdown();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

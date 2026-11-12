import "dotenv/config";
import { defineRoom, defineServer } from "colyseus";
import { WORLD_ROOM_NAME } from "@avarice/shared";
import { WorldRoom } from "./rooms/WorldRoom.js";
import { config, hasSupabaseConfig } from "./env.js";

interface HttpRequest {
  method: string;
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
      res.setHeader("Access-Control-Allow-Origin", config.clientOrigin);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });

    app.get("/health", (_req: HttpRequest, res: HttpResponse) => {
      res.json({ ok: true, uptime: process.uptime() });
    });
  },
});

server.listen(config.port);
console.log(`[server] Avarice listening on http://localhost:${config.port}`);

if (!hasSupabaseConfig()) {
  console.warn(
    "[server] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing. Player joins will be rejected until they are set.",
  );
}

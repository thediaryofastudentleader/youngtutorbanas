import { serve } from "@hono/node-server";
import app from "./app";
import { serveStaticFiles } from "./lib/vite";
import { log } from "./lib/logger";

// Local/Docker production startup. Vercel uses api/vercel.ts instead.
serveStaticFiles(app);
const port = parseInt(process.env.PORT || "3000");
serve({ fetch: app.fetch, port }, () => {
  log.info(`Server running on http://localhost:${port}/`);
});

import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { auth, googleReady, type Env } from "./auth";
import { workspaces, joining } from "./workspaces";
import { RuleError } from "../src/domain/workspace";
import { calculateLedger } from "../src/domain/accounting";

export const app = new Hono<Env>();
app.use("*", secureHeaders());
app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});
app.get("/api/health", (c) =>
  c.json({
    service: "MealKhata API",
    stage: "workspace-pilot",
    authentication: googleReady(c.env) ? "google-configured" : "not-connected",
  }),
);
app.get("/api/db-health", async (c) => {
  if (c.env.APP_ENV !== "local") return c.json({ error: "Not found" }, 404);
  try {
    const row = await c.env.DB.prepare(
      "SELECT version FROM schema_meta WHERE id = 1",
    ).first<{ version: number }>();
    return c.json(
      {
        database: row ? "ready" : "uninitialized",
        schemaVersion: row?.version ?? null,
      },
      row ? 200 : 503,
    );
  } catch {
    return c.json({ error: "Database not initialized" }, 503);
  }
});
// Stateless, local-only development harness. Never stores supplied information.
app.post(
  "/api/dev/calculate",
  bodyLimit({
    maxSize: 128 * 1024,
    onError: (c) => c.json({ error: "Request too large" }, 413),
  }),
  async (c) => {
    if (c.env.APP_ENV !== "local") return c.json({ error: "Not found" }, 404);
    if (!c.req.header("Content-Type")?.includes("application/json"))
      return c.json({ error: "Expected application/json" }, 415);
    try {
      return c.json(calculateLedger(await c.req.json()));
    } catch {
      return c.json({ error: "Invalid or unreconciled ledger input" }, 400);
    }
  },
);
app.use("/api/auth/*", bodyLimit({ maxSize: 128 * 1024 }));
app.use("/api/workspaces/*", bodyLimit({ maxSize: 128 * 1024 }));
app.use("/api/join/*", bodyLimit({ maxSize: 4096 }));
app.route("/api/auth", auth);
app.route("/api/workspaces", workspaces);
app.route("/api/join", joining);
app.all("/api/*", (c) => c.json({ error: "Route not found." }, 404));
app.onError((error, c) => {
  if (error instanceof RuleError)
    return c.json({ error: error.message }, error.status as 400);
  if (error instanceof SyntaxError)
    return c.json({ error: "Invalid JSON request." }, 400);
  if (error instanceof ZodError)
    return c.json(
      {
        error: "Please check your input.",
        details: error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      },
      400,
    );
  console.error("API request failed", error.name);
  return c.json(
    { error: "Unable to complete this request. Please retry or refresh." },
    500,
  );
});
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env["Bindings"]) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now),
      env.DB.prepare("DELETE FROM oauth_flows WHERE expires_at<?").bind(now),
      env.DB.prepare("DELETE FROM rate_buckets WHERE expires_at<?").bind(now),
    ]);
  },
};

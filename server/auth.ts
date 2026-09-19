import { Hono, type Context, type MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { RuleError } from "../src/domain/workspace";
export type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    APP_ORIGIN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    ALLOW_SANDBOX?: string;
  };
  Variables: {
    user: { id: string; name: string };
    session: {
      token_hash: string;
      user_id: string;
      csrf: string;
      expires_at: number;
    };
  };
};
export const uuid = () => crypto.randomUUID();
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
export const hash = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
const seconds = () => Math.floor(Date.now() / 1000);
export const googleReady = (env: Env["Bindings"]) =>
  !!(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.APP_ORIGIN?.startsWith("https://")
  );
export async function throttle(c: Context<Env>, scope: string, limit = 60) {
  // Repeated local QA shares one IP. Production retains the stricter supplied limits.
  if (c.env.APP_ENV === "local") limit *= 20;
  const ip = c.req.header("cf-connecting-ip") || "local";
  const slot = Math.floor(seconds() / 300);
  const key = await hash(scope + ":" + ip + ":" + slot);
  const row = await c.env.DB.prepare(
    "INSERT INTO rate_buckets(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(key, seconds() + 600)
    .first<{ count: number }>();
  if ((row?.count || 0) > limit)
    throw new RuleError(
      "Too many requests. Please try again in five minutes.",
      429,
    );
}
export function checkOrigin(c: Context<Env>) {
  const origin = c.req.header("origin");
  if (c.env.APP_ENV !== "local") {
    if (!c.env.APP_ORIGIN || origin !== c.env.APP_ORIGIN)
      throw new RuleError("Invalid request origin.", 403);
  } else if (c.req.header("sec-fetch-site") === "cross-site")
    throw new RuleError("Cross-site requests are blocked.", 403);
}
export async function sessionFor(c: Context<Env>) {
  const token = getCookie(c, "mk_session");
  if (!token) return null;
  const s = await c.env.DB.prepare(
    "SELECT sessions.*,users.display_name FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
  )
    .bind(await hash(token), seconds())
    .first<{
      token_hash: string;
      user_id: string;
      csrf: string;
      expires_at: number;
      display_name: string;
    }>();
  return s;
}
export const requireSession: MiddlewareHandler<Env> = async (c, next) => {
  const s = await sessionFor(c);
  if (!s) throw new RuleError("Please sign in to continue.", 401);
  c.set("user", { id: s.user_id, name: s.display_name });
  c.set("session", s);
  if (!["GET", "HEAD"].includes(c.req.method)) {
    checkOrigin(c);
    if (c.req.header("x-csrf-token") !== s.csrf)
      throw new RuleError("Session check failed. Refresh and try again.", 403);
    await throttle(c, "write", 120);
  }
  await next();
};
async function createSession(c: Context<Env>, userId: string) {
  const old = getCookie(c, "mk_session");
  if (old)
    await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
      .bind(await hash(old))
      .run();
  const token = randomToken(),
    csrf = randomToken();
  await c.env.DB.prepare("INSERT INTO sessions VALUES(?,?,?,?)")
    .bind(await hash(token), userId, csrf, seconds() + 7 * 86400)
    .run();
  setCookie(c, "mk_session", token, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure:
      c.env.APP_ENV !== "local" || new URL(c.req.url).protocol === "https:",
    maxAge: 7 * 86400,
  });
}
export const auth = new Hono<Env>();
auth.get("/config", (c) =>
  c.json({
    googleConfigured: googleReady(c.env),
    sandbox: c.env.APP_ENV === "local" && c.env.ALLOW_SANDBOX === "true",
  }),
);
auth.get("/me", async (c) => {
  const s = await sessionFor(c);
  return c.json(
    s
      ? { user: { id: s.user_id, name: s.display_name }, csrf: s.csrf }
      : { user: null },
  );
});
auth.post("/sandbox", async (c) => {
  if (c.env.APP_ENV !== "local" || c.env.ALLOW_SANDBOX !== "true")
    return c.json({ error: "Not found" }, 404);
  checkOrigin(c);
  await throttle(c, "sandbox", 20);
  const { name } = z
    .object({ name: z.string().trim().min(1).max(60) })
    .parse(await c.req.json());
  const id = uuid();
  await c.env.DB.prepare("INSERT INTO users VALUES(?,?,?,?)")
    .bind(id, "sandbox:" + id, name, new Date().toISOString())
    .run();
  await createSession(c, id);
  return c.json({ ok: true });
});
auth.post("/logout", requireSession, async (c) => {
  await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
    .bind(c.get("session").token_hash)
    .run();
  deleteCookie(c, "mk_session", { path: "/" });
  return c.json({ ok: true });
});
auth.get("/google", async (c) => {
  if (!googleReady(c.env))
    throw new RuleError(
      "Google sign-in is not configured by the owner yet.",
      503,
    );
  await throttle(c, "oauth", 20);
  const state = randomToken(),
    verifier = randomToken(),
    nonce = randomToken();
  await c.env.DB.prepare("INSERT INTO oauth_flows VALUES(?,?,?,?)")
    .bind(await hash(state), verifier, nonce, seconds() + 600)
    .run();
  setCookie(c, "mk_oauth", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/api/auth",
    maxAge: 600,
  });
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  const challenge = btoa(String.fromCharCode(...digest))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID!,
    redirect_uri: c.env.APP_ORIGIN + "/api/auth/callback",
    response_type: "code",
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return c.redirect(url.toString());
});
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export async function verifyGoogleIdentity(
  token: string,
  audience: string,
  nonce: string,
  keys: Parameters<typeof jwtVerify>[1] = jwks,
) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
    algorithms: ["RS256"],
  });
  if (
    payload.nonce !== nonce ||
    !payload.sub ||
    payload.email_verified !== true
  )
    throw new RuleError("Identity verification failed.", 403);
  return payload;
}

auth.get("/callback", async (c) => {
  if (!googleReady(c.env))
    throw new RuleError("Google sign-in is not configured.", 503);
  const state = c.req.query("state"),
    code = c.req.query("code");
  if (!state || !code || state !== getCookie(c, "mk_oauth"))
    throw new RuleError("Sign-in state mismatch. Start sign-in again.", 400);
  deleteCookie(c, "mk_oauth", { path: "/api/auth" });
  const flow = await c.env.DB.prepare(
    "DELETE FROM oauth_flows WHERE state_hash=? AND expires_at>? RETURNING verifier,nonce",
  )
    .bind(await hash(state), seconds())
    .first<{ verifier: string; nonce: string }>();
  if (!flow) throw new RuleError("Sign-in expired or already used.", 400);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID!,
      client_secret: c.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: c.env.APP_ORIGIN + "/api/auth/callback",
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new RuleError("Google could not complete sign-in. Try again.", 502);
  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) throw new RuleError("Missing identity token.", 502);
  const payload = await verifyGoogleIdentity(
    tokens.id_token,
    c.env.GOOGLE_CLIENT_ID!,
    flow.nonce,
  );
  const subject = "google:" + payload.sub;
  const name = String(payload.name || "Messmate").slice(0, 60);
  await c.env.DB.prepare(
    "INSERT INTO users VALUES(?,?,?,?) ON CONFLICT(provider_subject) DO UPDATE SET display_name=excluded.display_name",
  )
    .bind(uuid(), subject, name, new Date().toISOString())
    .run();
  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE provider_subject=?",
  )
    .bind(subject)
    .first<{ id: string }>();
  await createSession(c, user!.id);
  return c.redirect(c.env.APP_ORIGIN + "/workspace");
});

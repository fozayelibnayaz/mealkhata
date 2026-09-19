import { it, expect, beforeAll } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { verifyGoogleIdentity, googleReady, checkOrigin } from "../server/auth";
import { app } from "../server/app";
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
});
async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    nonce: "one-time-nonce",
    email_verified: true,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://accounts.google.com")
    .setAudience("our-client")
    .setSubject("provider-user")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);
}
it("accepts a valid signature, issuer, audience and nonce", async () =>
  expect(
    (
      await verifyGoogleIdentity(
        await token(),
        "our-client",
        "one-time-nonce",
        keys.publicKey,
      )
    ).sub,
  ).toBe("provider-user"));
it("rejects wrong audience", async () =>
  expect(
    verifyGoogleIdentity(
      await token(),
      "attacker-client",
      "one-time-nonce",
      keys.publicKey,
    ),
  ).rejects.toThrow());
it("rejects wrong nonce and unverified email", async () => {
  await expect(
    verifyGoogleIdentity(
      await token(),
      "our-client",
      "replayed-nonce",
      keys.publicKey,
    ),
  ).rejects.toThrow();
  await expect(
    verifyGoogleIdentity(
      await token({ email_verified: false }),
      "our-client",
      "one-time-nonce",
      keys.publicKey,
    ),
  ).rejects.toThrow();
});
it("rejects tokens signed by an unrelated key", async () => {
  const other = await generateKeyPair("RS256");
  await expect(
    verifyGoogleIdentity(
      await token(),
      "our-client",
      "one-time-nonce",
      other.publicKey,
    ),
  ).rejects.toThrow();
});
it("requires configured HTTPS origin and credentials", () =>
  expect(
    googleReady({
      DB: {} as D1Database,
      APP_ENV: "production",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      APP_ORIGIN: "http://insecure",
    }),
  ).toBe(false));
it("sandbox account creation cannot run in production", async () => {
  const r = await app.request(
    "/api/auth/sandbox",
    {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    },
    { APP_ENV: "production", ALLOW_SANDBOX: "true" } as never,
  );
  expect(r.status).toBe(404);
});
it("OAuth start fails closed when credentials are missing", async () => {
  const r = await app.request("/api/auth/google", {}, {
    APP_ENV: "local",
  } as never);
  expect(r.status).toBe(503);
});
it("rejects mismatched OAuth state before database or token requests", async () => {
  const r = await app.request(
    "/api/auth/callback?state=wrong&code=code",
    { headers: { cookie: "mk_oauth=right" } },
    {
      APP_ENV: "production",
      APP_ORIGIN: "https://example.com",
      GOOGLE_CLIENT_ID: "x",
      GOOGLE_CLIENT_SECRET: "x",
    } as never,
  );
  expect(r.status).toBe(400);
});

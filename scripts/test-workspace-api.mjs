import { request } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.API_BASE_URL || "http://127.0.0.1:5173";
let checks = 0;
async function user(name) {
  const ctx = await request.newContext({ baseURL: base });
  const r = await ctx.post("/api/auth/sandbox", { data: { name } });
  assert.equal(r.status(), 200, await r.text());
  const me = await (await ctx.get("/api/auth/me")).json();
  return { ctx, csrf: me.csrf, id: me.user.id };
}
const a = await user("Integration manager"),
  b = await user("Integration member"),
  outside = await user("Outside mess");
try {
  const post = (u, path, data) =>
    u.ctx.post("/api" + path, { data, headers: { "x-csrf-token": u.csrf } });
  let r = await post(a, "/workspaces", {
    name: "Integration Kitchen",
    month: "2026-09",
  });
  assert.equal(r.status(), 201, await r.text());
  let view = await r.json();
  const wid = view.workspace.id,
    aid = view.workspace.myMemberId;
  const current = async () => {
    view = await (await a.ctx.get("/api/workspaces/" + wid)).json();
    return view;
  };
  const envelope = (command) => ({
    expectedRevision: view.revision,
    operationId: crypto.randomUUID(),
    command,
  });
  const command = async (u, c, expected = 200) => {
    const r = await post(u, `/workspaces/${wid}/commands`, envelope(c));
    assert.equal(r.status(), expected, await r.text());
    checks++;
    if (expected === 200) await current();
    return r;
  };
  assert.equal((await outside.ctx.get("/api/workspaces/" + wid)).status(), 403);
  checks++;
  assert.equal(
    (
      await a.ctx.post(`/api/workspaces/${wid}/commands`, {
        data: envelope({ type: "addMember", name: "Bad CSRF" }),
      })
    ).status(),
    403,
  );
  checks++;
  const inv = await (await post(a, `/workspaces/${wid}/invites`, {})).json();
  const token = new URL("http://test" + inv.path).searchParams.get("invite");
  r = await post(b, "/join", { token });
  assert.equal(r.status(), 200, await r.text());
  assert.equal((await b.ctx.get("/api/workspaces/" + wid)).status(), 403);
  checks++;
  await current();
  await command(a, { type: "approveJoin", userId: b.id });
  const bview = await (await b.ctx.get("/api/workspaces/" + wid)).json();
  const bid = bview.workspace.myMemberId;
  await command(b, { type: "addMember", name: "Not allowed" }, 403);
  await command(
    b,
    {
      type: "meal",
      month: "2026-09",
      date: "2026-09-20",
      memberId: aid,
      slots: [1, 1, 1],
      guests: 0,
    },
    403,
  );
  const idem = envelope({ type: "addMember", name: "Added only once" });
  r = await post(a, `/workspaces/${wid}/commands`, idem);
  assert.equal(r.status(), 200, await r.text());
  const first = (await r.json()).revision;
  r = await post(a, `/workspaces/${wid}/commands`, idem);
  assert.equal(r.status(), 200);
  assert.equal((await r.json()).revision, first);
  checks++;
  r = await post(a, `/workspaces/${wid}/commands`, {
    ...idem,
    command: { type: "addMember", name: "Different payload" },
  });
  assert.equal(r.status(), 409);
  checks++;
  await current();
  const e1 = envelope({ type: "addMember", name: "Concurrent one" }),
    e2 = envelope({ type: "addMember", name: "Concurrent two" });
  const both = await Promise.all([
    post(a, `/workspaces/${wid}/commands`, e1),
    post(a, `/workspaces/${wid}/commands`, e2),
  ]);
  assert.deepEqual(both.map((r) => r.status()).sort(), [200, 409]);
  checks++;
  await current();
  await command(a, {
    type: "meal",
    month: "2026-09",
    date: "2026-09-19",
    memberId: aid,
    slots: [1, 1, 1],
    guests: 0,
    reason: "Manager verified date",
  });
  await command(a, {
    type: "transfer",
    month: "2026-09",
    from: aid,
    to: bid,
    amount: "10",
    method: "Cash",
    note: "Receipt test",
  });
  const tid = view.workspace.periods[0].transfers.at(-1).id;
  await command(
    a,
    {
      type: "transferReview",
      month: "2026-09",
      id: tid,
      status: "confirmed",
      reason: "Manager cannot confirm for recipient",
    },
    403,
  );
  await command(b, {
    type: "transferReview",
    month: "2026-09",
    id: tid,
    status: "confirmed",
    reason: "Recipient actually received money",
  });
  await command(
    a,
    {
      type: "close",
      month: "2026-09",
      cash: "0",
      reason: "Must fail for missing meals",
    },
    409,
  );
  const audit = await (await a.ctx.get(`/api/workspaces/${wid}/audit`)).json();
  assert.ok(audit.events.length >= 8);
  assert.ok(audit.events.some((e) => e.change.type === "transferReview"));
  checks++;
  await post(a, `/workspaces/${wid}/revoke-invites`, {});
  assert.equal((await post(outside, "/join", { token })).status(), 404);
  checks++;
  await command(a, { type: "handover", memberId: bid });
  await command(a, { type: "addMember", name: "Previous manager" }, 403);
  r = await post(a, "/auth/logout", {});
  assert.equal(r.status(), 200);
  assert.equal((await a.ctx.get("/api/workspaces/" + wid)).status(), 401);
  checks++;
  console.log(
    `PASS: ${checks} real Worker/D1 integration assertions; invitation, tenant authorization, CSRF, idempotency, concurrency, recipient confirmation, close blocking, audit, revocation, handover and logout.`,
  );
} finally {
  await Promise.all([a.ctx.dispose(), b.ctx.dispose(), outside.ctx.dispose()]);
}

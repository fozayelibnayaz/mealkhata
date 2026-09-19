import assert from "node:assert/strict";
const base = process.env.API_BASE_URL || "http://127.0.0.1:5173";
const health = await fetch(base + "/api/health");
assert.equal(health.status, 200);
assert.equal((await health.json()).authentication, "not-connected");
const db = await fetch(base + "/api/db-health");
assert.equal(db.status, 200);
assert.deepEqual(await db.json(), { database: "ready", schemaVersion: 2 });
const r = await fetch(base + "/api/dev/calculate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    members: [
      { id: "a", mealUnits: 100 },
      { id: "b", mealUnits: 100 },
    ],
    expenses: [
      {
        id: "bazar",
        payer: "b",
        funding: "personal",
        amount: 60000,
        approved: true,
        pool: "food",
      },
    ],
    transfers: [
      { id: "deposit", from: "a", to: "fund", amount: 100000, confirmed: true },
    ],
  }),
});
assert.equal(r.status, 200);
const data = await r.json();
assert.equal(data.fundCash, 100000);
assert.deepEqual(
  data.members.map((m) => m.position),
  [70000, 30000],
);
console.log(
  "PASS: proxied API health, actual local D1 schema query, Worker calculation.",
);

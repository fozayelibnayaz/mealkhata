import { it, expect } from "vitest";
import { app } from "../server/app";
const request = (
  path: string,
  init: RequestInit = {},
  env = { APP_ENV: "local" },
) => app.request(path, init, env as never);
it("health is truthful and not cached", async () => {
  const r = await request("/api/health");
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(await r.json()).toMatchObject({ authentication: "not-connected" });
});
it("unknown write routes are unavailable", async () =>
  expect((await request("/api/expenses", { method: "POST" })).status).toBe(
    404,
  ));
it("local calculator rejects invalid and malformed bodies", async () => {
  for (const body of ["{", "{}"])
    expect(
      (
        await request("/api/dev/calculate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        })
      ).status,
    ).toBe(400);
});
it("calculator is disabled outside local environment", async () =>
  expect(
    (
      await request(
        "/api/dev/calculate",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
        { APP_ENV: "production" },
      )
    ).status,
  ).toBe(404));
it("requires JSON and caps body size", async () => {
  expect(
    (await request("/api/dev/calculate", { method: "POST", body: "{}" }))
      .status,
  ).toBe(415);
  expect(
    (
      await request("/api/dev/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "x".repeat(140000),
      })
    ).status,
  ).toBe(413);
});
it("calculates valid input on server with no persistence", async () => {
  const r = await request("/api/dev/calculate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      members: [{ id: "a", mealUnits: 100 }],
      expenses: [],
      transfers: [],
    }),
  });
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ foodPool: 0, fundCash: 0 });
});

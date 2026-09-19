import { it, expect, describe } from "vitest";
import {
  newWorkspace,
  applyCommand,
  statement,
  closeChecks,
  type Workspace,
  type Command,
} from "../src/domain/workspace";
const now = new Date("2026-09-19T03:00:00Z"); // 09:00 Dhaka, before cutoff
const make = () =>
  newWorkspace(
    { name: "Nest", month: "2026-09" },
    { id: "user-a", name: "A" },
    "mess",
    "a",
    now,
  );
const act = (
  w: Workspace,
  c: Command,
  user = "user-a",
  id = crypto.randomUUID(),
) => applyCommand(w, user, c, id, now).workspace;
const meal = (w: Workspace) =>
  act(w, {
    type: "meal",
    month: "2026-09",
    date: "2026-09-19",
    memberId: "a",
    slots: [1, 1, 1],
    guests: 0,
  });
function withB() {
  const w = make();
  w.members.push({
    id: "b",
    userId: "user-b",
    name: "B",
    role: "member",
    active: true,
  });
  w.periods[0].roster.push("b");
  return w;
}
function ready() {
  let w = meal(make());
  w = act(w, {
    type: "fillMissing",
    month: "2026-09",
    reason: "Verified everyone was away",
  });
  return w;
}
it("creates manager and empty month without inventing meals", () => {
  const w = make();
  expect(w.members[0].role).toBe("manager");
  expect(closeChecks(w, w.periods[0]).missing).toBe(30);
});
it("rejects cross-workspace users", () =>
  expect(() =>
    act(make(), { type: "addMember", name: "B" }, "outsider"),
  ).toThrow(/not an active member/));
it("member cannot edit another person or change settings", () => {
  const w = withB();
  expect(() =>
    act(
      w,
      {
        type: "meal",
        month: "2026-09",
        date: "2026-09-19",
        memberId: "a",
        slots: [1, 1, 1],
        guests: 0,
      },
      "user-b",
    ),
  ).toThrow(/manager/);
  expect(() =>
    act(
      w,
      {
        type: "settings",
        name: "Hijack",
        weights: [100, 100, 100],
        cutoff: "10:00",
        notice: "",
      },
      "user-b",
    ),
  ).toThrow(/manager/);
});
it("applies saved weights and guests; later settings do not rewrite units", () => {
  let w = make();
  w.weights = [50, 100, 100];
  w = meal(w);
  expect(w.periods[0].meals[0].units).toBe(250);
  w = act(w, {
    type: "settings",
    name: "Nest",
    weights: [100, 100, 100],
    cutoff: "10:00",
    notice: "",
  });
  expect(w.periods[0].meals[0].units).toBe(250);
});
it("blocks self meal edits after cutoff and requires manager correction reason", () => {
  const w = withB();
  expect(() =>
    act(
      w,
      {
        type: "meal",
        month: "2026-09",
        date: "2026-09-18",
        memberId: "b",
        slots: [1, 1, 1],
        guests: 0,
      },
      "user-b",
    ),
  ).toThrow(/manager/);
  expect(() =>
    act(w, {
      type: "meal",
      month: "2026-09",
      date: "2026-09-18",
      memberId: "b",
      slots: [1, 1, 1],
      guests: 0,
    }),
  ).toThrow(/reason/);
});
it("keeps submissions pending until explicitly approved", () => {
  let w = meal(make());
  w = act(
    w,
    {
      type: "expense",
      month: "2026-09",
      title: "Rice",
      date: "2026-09-19",
      payer: "a",
      amount: "৩০০",
      funding: "personal",
      pool: "food",
    },
    "user-a",
    "e",
  );
  expect(statement(w, w.periods[0]).foodPool).toBe(0);
  w = act(w, {
    type: "expenseReview",
    month: "2026-09",
    id: "e",
    status: "approved",
    reason: "Receipt verified",
  });
  expect(statement(w, w.periods[0]).foodPool).toBe(30000);
});
it("only recipient confirms payment; confirmation cannot replay as a new action", () => {
  let w = withB();
  w = act(
    w,
    {
      type: "transfer",
      month: "2026-09",
      from: "a",
      to: "b",
      amount: "100",
      method: "Cash",
      note: "",
    },
    "user-a",
    "t",
  );
  expect(() =>
    act(w, {
      type: "transferReview",
      month: "2026-09",
      id: "t",
      status: "confirmed",
      reason: "Confirmed receipt",
    }),
  ).toThrow(/recipient/);
  w = act(
    w,
    {
      type: "transferReview",
      month: "2026-09",
      id: "t",
      status: "confirmed",
      reason: "I received the cash",
    },
    "user-b",
  );
  expect(() =>
    act(
      w,
      {
        type: "transferReview",
        month: "2026-09",
        id: "t",
        status: "confirmed",
        reason: "Again",
      },
      "user-b",
    ),
  ).toThrow(/not pending/);
});
it("close requires missing entries and actual cash reconciliation", () => {
  expect(() =>
    act(meal(make()), {
      type: "close",
      month: "2026-09",
      cash: "0",
      reason: "Closing month",
    }),
  ).toThrow(/missing/);
  expect(() =>
    act(ready(), {
      type: "close",
      month: "2026-09",
      cash: "10",
      reason: "Closing month",
    }),
  ).toThrow(/Actual cash/);
});
it("unresolved questions block month close", () => {
  let w = ready();
  w = act(w, {
    type: "dispute",
    month: "2026-09",
    text: "Please check my meals",
  });
  expect(() =>
    act(w, {
      type: "close",
      month: "2026-09",
      cash: "0",
      reason: "Closing month",
    }),
  ).toThrow(/questions/);
});
it("closed month rejects expense changes; reopen retains previous snapshot", () => {
  let w = act(ready(), {
    type: "close",
    month: "2026-09",
    cash: "0",
    reason: "Cash verified",
  });
  expect(() =>
    act(w, {
      type: "expense",
      month: "2026-09",
      title: "Rice",
      date: "2026-09-19",
      payer: "a",
      amount: "10",
      funding: "personal",
      pool: "food",
    }),
  ).toThrow(/closed/);
  w = act(w, { type: "reopen", month: "2026-09", reason: "Correcting meals" });
  expect(w.periods[0].snapshots).toHaveLength(1);
  w = act(w, {
    type: "close",
    month: "2026-09",
    cash: "0",
    reason: "Rechecked all entries",
  });
  expect(w.periods[0].snapshots).toHaveLength(2);
});
it("carries balances forward and locks old periods against double counting", () => {
  let w = ready();
  w = act(
    w,
    {
      type: "transfer",
      month: "2026-09",
      from: "a",
      to: "fund",
      amount: "100",
      method: "Cash",
      note: "",
    },
    "user-a",
    "deposit",
  );
  w = act(w, {
    type: "transferReview",
    month: "2026-09",
    id: "deposit",
    status: "confirmed",
    reason: "Actual deposit received",
  });
  w = act(w, {
    type: "close",
    month: "2026-09",
    cash: "100",
    reason: "Closing month",
  });
  w = act(w, { type: "nextMonth", month: "2026-09" });
  expect(w.periods[1].openingCash).toBe(10000);
  expect(statement(w, w.periods[1]).members[0].position).toBe(10000);
  expect(() =>
    act(w, { type: "reopen", month: "2026-09", reason: "Edit old month" }),
  ).toThrow(/Historical/);
});
it("join approval cannot claim an already-linked roster member", () => {
  const w = withB();
  w.requests.push({
    userId: "user-c",
    name: "C",
    requestedAt: now.toISOString(),
  });
  expect(() =>
    act(w, { type: "approveJoin", userId: "user-c", claimId: "b" }),
  ).toThrow(/not available/);
});
it("handover immediately removes previous manager authority", () => {
  let w = withB();
  w = act(w, { type: "handover", memberId: "b" });
  expect(() => act(w, { type: "addMember", name: "C" })).toThrow(/manager/);
  w = act(w, { type: "addMember", name: "C" }, "user-b");
  expect(w.members).toHaveLength(3);
});
it("invalid dates and out-of-period dates are rejected", () => {
  expect(() =>
    act(make(), {
      type: "meal",
      month: "2026-09",
      date: "2026-09-99",
      memberId: "a",
      slots: [0, 0, 0],
      guests: 0,
    }),
  ).toThrow();
  expect(() =>
    act(make(), {
      type: "meal",
      month: "2026-09",
      date: "2026-10-01",
      memberId: "a",
      slots: [0, 0, 0],
      guests: 0,
    }),
  ).toThrow(/selected month/);
});
it("commands do not mutate input even when rejected", () => {
  const w = make();
  expect(() =>
    act(w, {
      type: "expense",
      month: "2026-09",
      title: "Rice",
      date: "2026-09-19",
      payer: "a",
      amount: "-10",
      funding: "personal",
      pool: "food",
    }),
  ).toThrow();
  expect(w.periods[0].expenses).toHaveLength(0);
});
it("sets balanced opening positions only before the first records", () => {
  let w = make();
  w = act(w, {
    type: "opening",
    month: "2026-09",
    cash: "১০০",
    positions: [{ memberId: "a", amount: "100" }],
    reason: "Copied from verified khata",
  });
  expect(statement(w, w.periods[0]).fundCash).toBe(10000);
  w = meal(w);
  expect(() =>
    act(w, {
      type: "opening",
      month: "2026-09",
      cash: "0",
      positions: [{ memberId: "a", amount: "0" }],
      reason: "Cannot rewrite openings",
    }),
  ).toThrow(/before the first month/);
});
it("linked refund reverses the same source and cannot exceed the original", () => {
  let w = meal(make());
  w = act(
    w,
    {
      type: "expense",
      month: "2026-09",
      title: "Rice",
      date: "2026-09-19",
      payer: "a",
      amount: "300",
      funding: "personal",
      pool: "food",
    },
    "user-a",
    "original",
  );
  w = act(w, {
    type: "expenseReview",
    month: "2026-09",
    id: "original",
    status: "approved",
    reason: "Receipt checked",
  });
  w = act(
    w,
    {
      type: "refund",
      month: "2026-09",
      id: "original",
      amount: "100",
      date: "2026-09-19",
      reason: "Returned excess rice",
    },
    "user-a",
    "refund",
  );
  expect(() =>
    act(w, {
      type: "refund",
      month: "2026-09",
      id: "original",
      amount: "250",
      date: "2026-09-19",
      reason: "Too much returned",
    }),
  ).toThrow(/exceeds/);
  w = act(w, {
    type: "expenseReview",
    month: "2026-09",
    id: "refund",
    status: "approved",
    reason: "Refund received",
  });
  expect(statement(w, w.periods[0]).foodPool).toBe(20000);
  expect(statement(w, w.periods[0]).members[0].personalSpending).toBe(20000);
  expect(() =>
    act(w, {
      type: "expenseReview",
      month: "2026-09",
      id: "original",
      status: "rejected",
      reason: "Cannot void original alone",
    }),
  ).toThrow(/linked refunds/);
});

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  allocate,
  parseTaka,
  calculateLedger,
  suggestSettlements,
  type LedgerInput,
} from "../src/domain/accounting";
import { calculate } from "../src/demo/adapter";
import { initial } from "../src/demo/data";
const fixture = (): LedgerInput => ({
  members: [
    { id: "a", mealUnits: 100 },
    { id: "b", mealUnits: 100 },
  ],
  expenses: [
    {
      id: "personal",
      payer: "b",
      amount: 60000,
      funding: "personal",
      approved: true,
      pool: "food",
    },
    {
      id: "fund-expense",
      payer: "a",
      amount: 30000,
      funding: "fund",
      approved: true,
      pool: "food",
    },
  ],
  transfers: [
    { id: "deposit", from: "a", to: "fund", amount: 100000, confirmed: true },
  ],
});
describe("money input", () => {
  it.each([
    ["100", 10000],
    ["0.01", 1],
    ["১২৩.৪৫", 12345],
    [" ১০.৫ ", 1050],
  ])("parses %s exactly", (s, n) => expect(parseTaka(s)).toBe(n));
  it.each([
    "-1",
    "0",
    "1.001",
    "1e3",
    "1,000",
    "Infinity",
    "NaN",
    "",
    "10000001",
  ])("rejects %s", (s) => expect(() => parseTaka(s)).toThrow());
});
describe("allocation", () => {
  it("uses deterministic ID tie breaks regardless of input order", () => {
    expect(
      allocate(1, [
        { id: "b", weight: 1 },
        { id: "a", weight: 1 },
      ]),
    ).toEqual({ a: 1, b: 0 });
  });
  it("supports weighted half meals", () =>
    expect(
      allocate(900, [
        { id: "a", weight: 50 },
        { id: "b", weight: 100 },
      ]),
    ).toEqual({ a: 300, b: 600 }));
  it("allocates refunds symmetrically", () =>
    expect(
      allocate(-1, [
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
      ]),
    ).toEqual({ a: -1, b: 0 }));
  it("blocks nonzero costs without consumption", () =>
    expect(() => allocate(1, [{ id: "a", weight: 0 }])).toThrow());
  it("allows zero cost with zero meals", () =>
    expect(allocate(0, [{ id: "a", weight: 0 }])).toEqual({ a: 0 }));
  it("avoids unsafe intermediate multiplication", () =>
    expect(
      allocate(Number.MAX_SAFE_INTEGER, [
        { id: "a", weight: Number.MAX_SAFE_INTEGER },
      ]),
    ).toEqual({ a: Number.MAX_SAFE_INTEGER }));
  it("rejects duplicate IDs and invalid weights", () => {
    expect(() =>
      allocate(2, [
        { id: "a", weight: 1 },
        { id: "a", weight: 1 },
      ]),
    ).toThrow();
    expect(() => allocate(2, [{ id: "a", weight: -1 }])).toThrow();
    expect(() => allocate(2.5, [])).toThrow();
  });
  it("conserves every paisa over 1000 generated cases", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 100000 }), {
          minLength: 1,
          maxLength: 40,
        }),
        (total, weights) => {
          const input = weights.map((weight, i) => ({ id: `m${i}`, weight }));
          const output = allocate(total, input);
          expect(Object.values(output).reduce((a, b) => a + b, 0)).toBe(total);
          expect(allocate(total, [...input].reverse())).toEqual(output);
          for (const value of Object.values(output))
            expect(Number.isSafeInteger(value)).toBe(true);
        },
      ),
      { numRuns: 1000, seed: 20260919 },
    );
  });
});
describe("ledger", () => {
  it("matches the independently checked personal/fund fixture", () => {
    const r = calculateLedger(fixture());
    expect(r.foodPool).toBe(90000);
    expect(r.fundCash).toBe(70000);
    expect(r.members.map((m) => m.position)).toEqual([55000, 15000]);
  });
  it("matches the existing UI sample to the paisa", () => {
    const r = calculate(initial);
    expect(r.total).toBe(1687000);
    expect(r.count).toBe(253);
    expect(r.cash).toBe(618000);
    expect(r.shares[0]).toBe(300059);
    expect(r.balances[0]).toBe(304941);
  });
  it("ignores pending expenses and unconfirmed deposits", () => {
    const f = fixture();
    f.expenses[0].approved = false;
    f.transfers[0].confirmed = false;
    const r = calculateLedger(f);
    expect(r.foodPool).toBe(30000);
    expect(r.fundCash).toBe(-30000);
    expect(r.warnings).toHaveLength(1);
  });
  it("handles refunds returning to the actual funding source", () => {
    const f = fixture();
    f.expenses.push({
      id: "refund",
      payer: "b",
      amount: -10000,
      funding: "personal",
      approved: true,
      pool: "food",
    });
    const r = calculateLedger(f);
    expect(r.foodPool).toBe(80000);
    expect(r.members[1].personalSpending).toBe(50000);
    expect(r.fundCash).toBe(70000);
  });
  it("allocates utilities only to explicitly selected members", () => {
    const f = fixture();
    f.expenses.push({
      id: "utility",
      payer: "a",
      amount: 10001,
      funding: "fund",
      approved: true,
      pool: "custom",
      splits: [{ memberId: "a", weight: 1 }],
    });
    const r = calculateLedger(f);
    expect(r.members.map((m) => m.customCharge)).toEqual([10001, 0]);
    expect(r.fundCash).toBe(59999);
  });
  it("handles peer payments without changing fund cash", () => {
    const f = fixture();
    f.transfers.push({
      id: "peer",
      from: "a",
      to: "b",
      amount: 10000,
      confirmed: true,
    });
    const r = calculateLedger(f);
    expect(r.members.map((m) => m.position)).toEqual([65000, 5000]);
    expect(r.fundCash).toBe(70000);
  });
  it("reimbursement reduces personal credit and fund cash", () => {
    const f = fixture();
    f.transfers.push({
      id: "reimburse",
      from: "fund",
      to: "b",
      amount: 15000,
      confirmed: true,
    });
    const r = calculateLedger(f);
    expect(r.members[1].position).toBe(0);
    expect(r.fundCash).toBe(55000);
  });
  it("supports balanced carry-forward openings", () => {
    const f = fixture();
    f.openingCash = 1000;
    f.members[0].openingPosition = 2000;
    f.members[1].openingPosition = -1000;
    expect(calculateLedger(f).fundCash).toBe(71000);
    f.openingCash = 0;
    expect(() => calculateLedger(f)).toThrow(/Opening/);
  });
  it("rejects duplicates, unknown people and self payments", () => {
    const f = fixture();
    f.expenses.push(f.expenses[0]);
    expect(() => calculateLedger(f)).toThrow(/Duplicate/);
    const g = fixture();
    g.expenses[0].payer = "outsider";
    expect(() => calculateLedger(g)).toThrow(/Unknown/);
    const h = fixture();
    h.transfers[0].to = "a";
    expect(() => calculateLedger(h)).toThrow(/Self/);
  });
  it("rejects bad custom splits and excess food refunds", () => {
    const f = fixture();
    f.expenses[0].pool = "custom";
    expect(() => calculateLedger(f)).toThrow(/splits/);
    const g = fixture();
    g.expenses[0].amount = -100000;
    expect(() => calculateLedger(g)).toThrow(/refunds/);
  });
  it("handles empty month but blocks food cost without meals", () => {
    const f = fixture();
    f.members.forEach((m) => (m.mealUnits = 0));
    expect(() => calculateLedger(f)).toThrow(/without/);
    f.expenses = [];
    f.transfers = [];
    const r = calculateLedger(f);
    expect(r.ratePaisaPerMeal).toBeNull();
    expect(r.fundCash).toBe(0);
  });
  it("enforces schema limits and reserved fund participant", () => {
    const f = fixture();
    f.members[0].id = "fund";
    expect(() => calculateLedger(f)).toThrow();
    const g = fixture();
    g.expenses[0].amount = 1.1;
    expect(() => calculateLedger(g)).toThrow();
  });
});
describe("settlement suggestions", () => {
  it("includes the fund rather than inventing peer debts", () => {
    const r = calculateLedger(fixture());
    expect(suggestSettlements(r.members, r.fundCash)).toEqual([
      { from: "fund", to: "a", amount: 55000 },
      { from: "fund", to: "b", amount: 15000 },
    ]);
  });
  it("rejects unbalanced or negative-cash input", () => {
    expect(() => suggestSettlements([{ id: "a", position: 100 }], 0)).toThrow();
    expect(() =>
      suggestSettlements([{ id: "a", position: -100 }], -100),
    ).toThrow();
  });
  it("clears all positions over 1000 generated cases", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100000, max: 100000 }), {
          minLength: 1,
          maxLength: 30,
        }),
        (positions) => {
          const sum = positions.reduce((a, b) => a + b, 0);
          const members = positions.map((position, i) => ({
            id: `m${i}`,
            position,
          }));
          if (sum < 0) members.push({ id: "balancer", position: -sum });
          const cash = Math.max(0, sum);
          const transfers = suggestSettlements(members, cash);
          const remaining = Object.fromEntries(
            [...members, { id: "fund", position: -cash }].map((m) => [
              m.id,
              m.position,
            ]),
          );
          for (const t of transfers) {
            expect(t.amount).toBeGreaterThan(0);
            remaining[t.from] += t.amount;
            remaining[t.to] -= t.amount;
          }
          expect(Object.values(remaining).every((n) => n === 0)).toBe(true);
        },
      ),
      { numRuns: 1000, seed: 42 },
    );
  });
});

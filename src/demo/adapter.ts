import { z } from "zod";
import { calculateLedger, suggestSettlements } from "../domain/accounting";
import { people, initial, type Data } from "./data";
export const key = "mealkhata-prototype-v1";
const memberId = z.enum(["rafi", "sakib", "tanvir", "fahim", "naim", "arif"]);
const dataSchema = z
  .object({
    meals: z.record(
      memberId,
      z.array(z.union([z.literal(0), z.literal(1)])).length(3),
    ),
    guests: z.partialRecord(memberId, z.number().int().min(0).max(20)),
    expenses: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            title: z.string().trim().min(1).max(100),
            amount: z.number().int().positive().max(10_000_000),
            payer: memberId,
            fund: z.enum(["fund", "personal"]),
            date: z.string().regex(/^2026-09-(0[1-9]|[12][0-9]|30)$/),
            category: z.literal("Groceries"),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();
export function readData(): Data {
  try {
    const parsed = dataSchema.parse(
      JSON.parse(localStorage.getItem(key) || "null"),
    );
    calculate(parsed);
    return parsed;
  } catch {
    return structuredClone(initial);
  }
}
export const money = (paisa: number) =>
  "৳" +
  (paisa / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
export function calculate(data: Data) {
  const units = people.map(
    (p) =>
      p.old +
      data.meals[p.id].reduce((a, b) => a + b, 0) +
      (data.guests[p.id] || 0),
  );
  const ledger = calculateLedger({
    members: people.map((p, i) => ({ id: p.id, mealUnits: units[i] * 100 })),
    expenses: data.expenses.map((e) => ({
      id: e.id,
      payer: e.payer,
      amount: e.amount,
      funding: e.fund,
      approved: true,
      pool: "food",
    })),
    transfers: people.map((p) => ({
      id: `deposit-${p.id}`,
      from: p.id,
      to: "fund",
      amount: p.deposit * 100,
      confirmed: true,
    })),
  });
  return {
    settlements:
      ledger.fundCash >= 0
        ? suggestSettlements(ledger.members, ledger.fundCash)
        : [],
    total: ledger.foodPool,
    units,
    count: ledger.mealUnits / 100,
    shares: ledger.members.map((m) => m.foodCharge),
    personal: ledger.members.map((m) => m.personalSpending),
    balances: ledger.members.map((m) => m.position),
    cash: ledger.fundCash,
    rate: ledger.ratePaisaPerMeal ?? 0,
  };
}

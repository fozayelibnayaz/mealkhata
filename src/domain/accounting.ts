/** Pure accounting. No browser, database, auth or floating-point money arithmetic. */
import { z } from "zod";
export const MAX_PAISA = 1_000_000_000; // bounded input: ৳10 million per field
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine((x) => x !== "fund", "fund is reserved");
const amount = z.number().int().min(-MAX_PAISA).max(MAX_PAISA);
const positive = z.number().int().positive().max(MAX_PAISA);
export const ledgerSchema = z
  .object({
    members: z
      .array(
        z
          .object({
            id,
            mealUnits: z.number().int().min(0).max(10_000_000),
            openingPosition: amount.default(0),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    openingCash: amount.default(0),
    expenses: z
      .array(
        z
          .object({
            id,
            payer: id,
            amount,
            funding: z.enum(["fund", "personal"]),
            approved: z.boolean(),
            pool: z.enum(["food", "custom"]),
            splits: z
              .array(
                z
                  .object({
                    memberId: id,
                    weight: z.number().int().nonnegative().max(10_000_000),
                  })
                  .strict(),
              )
              .max(100)
              .optional(),
          })
          .strict(),
      )
      .max(2000),
    transfers: z
      .array(
        z
          .object({
            id,
            from: z.string().min(1).max(80),
            to: z.string().min(1).max(80),
            amount: positive,
            confirmed: z.boolean(),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();
export type LedgerInput = z.input<typeof ledgerSchema>;
export type Allocation = { id: string; weight: number };
function integer(n: number, name: string) {
  if (!Number.isSafeInteger(n))
    throw new Error(`${name} must be a safe integer`);
}
function unique(ids: string[], name: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${name}`);
}
function sum(xs: number[]) {
  const n = xs.reduce((a, b) => a + b, 0);
  integer(n, "Total");
  return n;
}
/** Stable largest-remainder allocation. Signed amounts allow refunds. */
export function allocate(
  total: number,
  entries: Allocation[],
): Record<string, number> {
  integer(total, "Amount");
  unique(
    entries.map((x) => x.id),
    "allocation member",
  );
  for (const e of entries) {
    integer(e.weight, "Weight");
    if (e.weight < 0) throw new Error("Negative weight");
  }
  const denominator = entries.reduce((s, e) => s + BigInt(e.weight), 0n);
  if (denominator === 0n) {
    if (total !== 0)
      throw new Error(
        "Cannot allocate costs without meal units or split weights",
      );
    return Object.fromEntries(entries.map((e) => [e.id, 0]));
  }
  const absolute = BigInt(Math.abs(total));
  const sign = total < 0 ? -1 : 1;
  const rows = entries.map((e) => ({
    id: e.id,
    share: (absolute * BigInt(e.weight)) / denominator,
    remainder: (absolute * BigInt(e.weight)) % denominator,
  }));
  let left = absolute - rows.reduce((s, r) => s + r.share, 0n);
  const ranked = [...rows].sort((a, b) =>
    a.remainder === b.remainder
      ? a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (let i = 0; left > 0n; i++, left--) ranked[i].share++;
  return Object.fromEntries(
    rows.map((r) => [r.id, r.share === 0n ? 0 : Number(r.share) * sign]),
  );
}
export function parseTaka(text: string): number {
  const normalized = text
    .trim()
    .replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)));
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error("Use an amount with at most two decimal places");
  const [whole, decimal = ""] = normalized.split(".");
  const n = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
  if (n <= 0n || n > BigInt(MAX_PAISA))
    throw new Error("Amount outside allowed range");
  return Number(n);
}
export function calculateLedger(raw: unknown) {
  const input = ledgerSchema.parse(raw);
  const ids = input.members.map((m) => m.id);
  const known = new Set(ids);
  unique(ids, "member");
  unique(
    input.expenses.map((e) => e.id),
    "expense",
  );
  unique(
    input.transfers.map((t) => t.id),
    "transfer",
  );
  if (sum(input.members.map((m) => m.openingPosition)) !== input.openingCash)
    throw new Error("Opening positions do not reconcile to opening cash");
  for (const e of input.expenses) {
    if (!known.has(e.payer)) throw new Error("Unknown payer");
    if (e.amount === 0) throw new Error("Zero expense");
    if (e.pool === "custom") {
      if (!e.splits?.length)
        throw new Error("Custom expense requires explicit splits");
      unique(
        e.splits.map((s) => s.memberId),
        "split member",
      );
      for (const s of e.splits)
        if (!known.has(s.memberId)) throw new Error("Unknown split member");
      if (!e.splits.some((s) => s.weight > 0))
        throw new Error("Custom split requires positive weight");
    } else if (e.splits) throw new Error("Food splits come from meal units");
  }
  for (const t of input.transfers) {
    if (t.from === t.to) throw new Error("Self transfer");
    if (![t.from, t.to].every((x) => x === "fund" || known.has(x)))
      throw new Error("Unknown transfer participant");
  }
  const expenses = input.expenses.filter((e) => e.approved);
  const transfers = input.transfers.filter((t) => t.confirmed);
  const foodPool = sum(
    expenses.filter((e) => e.pool === "food").map((e) => e.amount),
  );
  if (foodPool < 0) throw new Error("Food refunds exceed food costs");
  const foodShares = allocate(
    foodPool,
    input.members.map((m) => ({ id: m.id, weight: m.mealUnits })),
  );
  const mealUnits = sum(input.members.map((m) => m.mealUnits));
  const customShares = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const e of expenses.filter((e) => e.pool === "custom")) {
    const shares = allocate(
      e.amount,
      e.splits!.map((s) => ({ id: s.memberId, weight: s.weight })),
    );
    for (const id of ids) customShares[id] += shares[id] ?? 0;
  }
  const members = input.members.map((m) => {
    const personal = sum(
      expenses
        .filter((e) => e.payer === m.id && e.funding === "personal")
        .map((e) => e.amount),
    );
    const sent = sum(
      transfers.filter((t) => t.from === m.id).map((t) => t.amount),
    );
    const received = sum(
      transfers.filter((t) => t.to === m.id).map((t) => t.amount),
    );
    const charge = foodShares[m.id] + customShares[m.id];
    return {
      id: m.id,
      mealUnits: m.mealUnits,
      foodCharge: foodShares[m.id],
      customCharge: customShares[m.id],
      charge,
      personalSpending: personal,
      position: m.openingPosition + personal + sent - received - charge,
    };
  });
  const fundCash =
    input.openingCash -
    sum(expenses.filter((e) => e.funding === "fund").map((e) => e.amount)) +
    sum(transfers.filter((t) => t.to === "fund").map((t) => t.amount)) -
    sum(transfers.filter((t) => t.from === "fund").map((t) => t.amount));
  const totalCosts = sum(expenses.map((e) => e.amount));
  if (
    sum(members.map((m) => m.charge)) !== totalCosts ||
    sum(members.map((m) => m.position)) !== fundCash
  )
    throw new Error("Ledger invariant failed");
  return {
    members,
    foodPool,
    totalCosts,
    mealUnits,
    fundCash,
    ratePaisaPerMeal: mealUnits ? (foodPool * 100) / mealUnits : null,
    warnings:
      fundCash < 0
        ? [
            "Fund cash is negative: verify funding sources and receipts before closing.",
          ]
        : [],
  };
}
/** Suggestions only; applying them requires authenticated recipient confirmation later. */
export function suggestSettlements(
  members: { id: string; position: number }[],
  fundCash: number,
) {
  unique(
    members.map((m) => m.id),
    "settlement member",
  );
  integer(fundCash, "Cash");
  for (const m of members) {
    if (m.id === "fund") throw new Error("Reserved fund ID");
    integer(m.position, "Position");
  }
  if (sum(members.map((m) => m.position)) !== fundCash)
    throw new Error("Positions do not reconcile");
  if (fundCash < 0)
    throw new Error("Reconcile negative fund cash before settlement");
  const all = [...members, { id: "fund", position: -fundCash }].sort((a, b) =>
    a.id < b.id ? -1 : 1,
  );
  const debtors = all
    .filter((m) => m.position < 0)
    .map((m) => ({ id: m.id, left: -m.position }));
  const creditors = all
    .filter((m) => m.position > 0)
    .map((m) => ({ id: m.id, left: m.position }));
  const transfers: { from: string; to: string; amount: number }[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (!debtors[i].left) i++;
    if (!creditors[j].left) j++;
  }
  return transfers;
}

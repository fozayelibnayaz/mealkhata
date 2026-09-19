import { z } from "zod";
import { calculateLedger, suggestSettlements, parseTaka } from "./accounting";
export type Person = {
  id: string;
  userId: string | null;
  name: string;
  role: "manager" | "member";
  active: boolean;
};
export type Meal = {
  id: string;
  memberId: string;
  date: string;
  slots: number[];
  guests: number;
  units: number;
  confirmed: boolean;
};
export type Expense = {
  id: string;
  title: string;
  date: string;
  payer: string;
  amount: number;
  funding: "fund" | "personal";
  pool: "food" | "custom";
  splits?: { memberId: string; weight: number }[];
  status: "pending" | "approved" | "rejected";
  by: string;
  refundOf?: string;
};
export type Transfer = {
  id: string;
  from: string;
  to: string;
  amount: number;
  method: string;
  note: string;
  status: "pending" | "confirmed" | "rejected";
  by: string;
};
export type Period = {
  month: string;
  status: "open" | "closed";
  roster: string[];
  opening: Record<string, number>;
  openingCash: number;
  meals: Meal[];
  expenses: Expense[];
  transfers: Transfer[];
  disputes: {
    id: string;
    by: string;
    text: string;
    resolution: string | null;
  }[];
  snapshots: {
    at: string;
    by: string;
    version: number;
    statement: ReturnType<typeof calculateLedger>;
  }[];
};
export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  weights: number[];
  cutoff: string;
  members: Person[];
  requests: { userId: string; name: string; requestedAt: string }[];
  periods: Period[];
  tasks: {
    id: string;
    text: string;
    assignee: string;
    date: string;
    done: boolean;
  }[];
  notice: string;
};
export class RuleError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const text = z.string().trim().min(1).max(120);
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
const reason = z.string().trim().min(3).max(400);
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const date = z
  .string()
  .regex(/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid date");
const money = z.string().max(20);
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meal"),
    month,
    date,
    memberId: id,
    slots: z.array(z.number().int().min(0).max(1)).length(3),
    guests: z.number().int().min(0).max(20),
    reason: reason.optional(),
  }),
  z.object({
    type: z.literal("away"),
    month,
    memberId: id,
    start: date,
    end: date,
    reason,
  }),
  z.object({ type: z.literal("fillMissing"), month, reason }),
  z.object({
    type: z.literal("expense"),
    month,
    title: text,
    date,
    payer: id,
    amount: money,
    funding: z.enum(["personal", "fund"]),
    pool: z.enum(["food", "custom"]),
    splits: z
      .array(
        z.object({ memberId: id, weight: z.number().int().min(0).max(10000) }),
      )
      .max(100)
      .optional(),
  }),
  z.object({
    type: z.literal("refund"),
    month,
    id,
    amount: money,
    date,
    reason,
  }),
  z.object({
    type: z.literal("opening"),
    month,
    cash: money,
    positions: z.array(z.object({ memberId: id, amount: money })).max(100),
    reason,
  }),
  z.object({
    type: z.literal("expenseReview"),
    month,
    id,
    status: z.enum(["approved", "rejected"]),
    reason,
  }),
  z.object({
    type: z.literal("transfer"),
    month,
    from: id,
    to: id,
    amount: money,
    method: z.enum(["Cash", "bKash", "Nagad", "Bank"]),
    note: z.string().trim().max(120),
  }),
  z.object({
    type: z.literal("transferReview"),
    month,
    id,
    status: z.enum(["confirmed", "rejected"]),
    reason,
  }),
  z.object({ type: z.literal("dispute"), month, text: reason }),
  z.object({ type: z.literal("resolveDispute"), month, id, reason }),
  z.object({ type: z.literal("close"), month, cash: money, reason }),
  z.object({ type: z.literal("reopen"), month, reason }),
  z.object({ type: z.literal("nextMonth"), month }),
  z.object({ type: z.literal("addMember"), name: text }),
  z.object({
    type: z.literal("approveJoin"),
    userId: id,
    claimId: id.optional(),
  }),
  z.object({ type: z.literal("rejectJoin"), userId: id }),
  z.object({ type: z.literal("handover"), memberId: id }),
  z.object({ type: z.literal("leave"), memberId: id, reason }),
  z.object({
    type: z.literal("settings"),
    name: text,
    weights: z
      .array(z.number().int().min(0).max(300))
      .length(3)
      .refine((x) => x.some((n) => n > 0)),
    cutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    notice: z.string().trim().max(800),
  }),
  z.object({ type: z.literal("task"), text, assignee: id, date }),
  z.object({ type: z.literal("taskDone"), id, done: z.boolean() }),
]);
export type Command = z.infer<typeof commandSchema>;
export const createSchema = z.object({
  name: text,
  month,
  weights: z
    .array(z.number().int().min(0).max(300))
    .length(3)
    .default([100, 100, 100]),
  cutoff: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("10:00"),
});
export const dhakaDate = (now: Date) =>
  new Date(now.getTime() + 6 * 3600000).toISOString().slice(0, 10);
export function datesInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}
export function emptyPeriod(
  month: string,
  roster: string[],
  opening: Record<string, number> = {},
  openingCash = 0,
): Period {
  return {
    month,
    status: "open",
    roster,
    opening,
    openingCash,
    meals: [],
    expenses: [],
    transfers: [],
    disputes: [],
    snapshots: [],
  };
}
export function newWorkspace(
  raw: unknown,
  user: { id: string; name: string },
  wid: string,
  mid: string,
  now = new Date(),
): Workspace {
  const input = createSchema.parse(raw);
  return {
    id: wid,
    name: input.name,
    weights: input.weights,
    cutoff: input.cutoff,
    createdAt: now.toISOString(),
    members: [
      {
        id: mid,
        userId: user.id,
        name: user.name,
        role: "manager",
        active: true,
      },
    ],
    requests: [],
    periods: [emptyPeriod(input.month, [mid])],
    tasks: [],
    notice: "",
  };
}
export function actorFor(w: Workspace, userId: string) {
  const actor = w.members.find((m) => m.userId === userId && m.active);
  if (!actor)
    throw new RuleError("You are not an active member of this mess.", 403);
  return actor;
}
export function statement(w: Workspace, p: Period) {
  return calculateLedger({
    members: p.roster.map((id) => ({
      id,
      mealUnits: p.meals
        .filter((m) => m.memberId === id && m.confirmed)
        .reduce((s, m) => s + m.units, 0),
      openingPosition: p.opening[id] || 0,
    })),
    openingCash: p.openingCash,
    expenses: p.expenses.map((e) => ({
      id: e.id,
      payer: e.payer,
      amount: e.amount,
      funding: e.funding,
      pool: e.pool,
      splits: e.splits,
      approved: e.status === "approved",
    })),
    transfers: p.transfers.map((t) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      amount: t.amount,
      confirmed: t.status === "confirmed",
    })),
  });
}
export function closeChecks(w: Workspace, p: Period) {
  const dates = datesInMonth(p.month);
  const seen = new Set(
    p.meals.filter((m) => m.confirmed).map((m) => m.memberId + ":" + m.date),
  );
  const missing = p.roster.reduce(
    (n, id) => n + dates.filter((d) => !seen.has(id + ":" + d)).length,
    0,
  );
  let result: ReturnType<typeof statement> | null = null,
    error = "";
  try {
    result = statement(w, p);
  } catch (e) {
    error = e instanceof Error ? e.message : "Calculation blocked";
  }
  return {
    missing,
    pending:
      p.expenses.filter((e) => e.status === "pending").length +
      p.transfers.filter((t) => t.status === "pending").length,
    disputes: p.disputes.filter((d) => !d.resolution).length,
    error,
    result,
  };
}
export function viewWorkspace(w: Workspace, userId: string) {
  const actor = actorFor(w, userId);
  return {
    ...w,
    requests: actor.role === "manager" ? w.requests : [],
    members: w.members.map((m) => ({
      ...m,
      userId: m.id === actor.id ? m.userId : null,
    })),
    myMemberId: actor.id,
  };
}
export function applyCommand(
  original: Workspace,
  userId: string,
  raw: unknown,
  eventId: string,
  now = new Date(),
) {
  const c = commandSchema.parse(raw);
  const w = structuredClone(original);
  const actor = actorFor(w, userId);
  const manager = () => {
    if (actor.role !== "manager")
      throw new RuleError("Only the mess manager can do that.", 403);
  };
  const current = w.periods.at(-1)!;
  let p: Period | undefined;
  if ("month" in c) {
    p = w.periods.find((p) => p.month === c.month);
    if (!p) throw new RuleError("Month not found.", 404);
    if (p !== current)
      throw new RuleError(
        "Historical months are read-only. Balances have already carried forward.",
        409,
      );
    if (
      p.status === "closed" &&
      !["reopen", "nextMonth", "transfer", "transferReview"].includes(c.type)
    )
      throw new RuleError(
        "This month is closed. Reopen it with a reason first.",
        409,
      );
  }
  const target = (id: string) => {
    const m = w.members.find((m) => m.id === id);
    if (!m) throw new RuleError("Member not found.");
    return m;
  };
  const roster = (id: string) => {
    if (!p!.roster.includes(id))
      throw new RuleError("Member is not in this month.");
    return target(id);
  };
  const own = (id: string) => {
    if (actor.id !== id) manager();
  };
  const checkDate = (day: string) => {
    if (day.slice(0, 7) !== p!.month)
      throw new RuleError("Date must be in the selected month.");
  };
  const cutoff = (day: string, why?: string) => {
    const local = new Date(now.getTime() + 6 * 3600000).toISOString();
    if (
      day < local.slice(0, 10) ||
      (day === local.slice(0, 10) && local.slice(11, 16) >= w.cutoff)
    ) {
      manager();
      if (!why)
        throw new RuleError(
          "A correction reason is required after the meal cutoff.",
        );
    }
  };
  switch (c.type) {
    case "meal": {
      roster(c.memberId);
      own(c.memberId);
      checkDate(c.date);
      cutoff(c.date, c.reason);
      const meal = {
        id: `${c.memberId}_${c.date}`,
        memberId: c.memberId,
        date: c.date,
        slots: c.slots,
        guests: c.guests,
        units:
          c.slots.reduce((s, n, i) => s + n * w.weights[i], 0) + c.guests * 100,
        confirmed: true,
      };
      const idx = p!.meals.findIndex((m) => m.id === meal.id);
      if (idx < 0) p!.meals.push(meal);
      else p!.meals[idx] = meal;
      break;
    }
    case "away": {
      roster(c.memberId);
      own(c.memberId);
      checkDate(c.start);
      checkDate(c.end);
      if (c.start > c.end)
        throw new RuleError("End date must follow start date.");
      cutoff(c.start, c.reason);
      for (const day of datesInMonth(p!.month).filter(
        (d) => d >= c.start && d <= c.end,
      )) {
        const id = `${c.memberId}_${day}`;
        p!.meals = p!.meals.filter((m) => m.id !== id);
        p!.meals.push({
          id,
          memberId: c.memberId,
          date: day,
          slots: [0, 0, 0],
          guests: 0,
          units: 0,
          confirmed: true,
        });
      }
      break;
    }
    case "fillMissing": {
      manager();
      for (const memberId of p!.roster)
        for (const day of datesInMonth(p!.month)) {
          if (
            !p!.meals.some(
              (m) => m.memberId === memberId && m.date === day && m.confirmed,
            )
          )
            p!.meals.push({
              id: `${memberId}_${day}`,
              memberId,
              date: day,
              slots: [0, 0, 0],
              guests: 0,
              units: 0,
              confirmed: true,
            });
        }
      break;
    }
    case "expense": {
      roster(c.payer);
      own(c.payer);
      checkDate(c.date);
      if (p!.expenses.length >= 2000)
        throw new RuleError("Monthly expense limit reached.");
      if (c.pool === "custom") {
        if (
          !c.splits?.length ||
          new Set(c.splits.map((s) => s.memberId)).size !== c.splits.length ||
          !c.splits.some((s) => s.weight > 0)
        )
          throw new RuleError("Select a valid explicit bill split.");
        c.splits.forEach((s) => roster(s.memberId));
      } else if (c.splits)
        throw new RuleError("Food costs use meal counts, not custom splits.");
      p!.expenses.push({
        id: eventId,
        title: c.title,
        date: c.date,
        payer: c.payer,
        amount: parseTaka(c.amount),
        funding: c.funding,
        pool: c.pool,
        ...(c.splits ? { splits: c.splits } : {}),
        status: "pending",
        by: actor.id,
      });
      break;
    }
    case "opening": {
      manager();
      if (
        w.periods.length !== 1 ||
        p!.meals.length ||
        p!.expenses.length ||
        p!.transfers.length ||
        p!.snapshots.length
      )
        throw new RuleError(
          "Opening balances can only be set before the first month has entries.",
        );
      const parseSigned = (text: string) => {
        const normalized = text
          .trim()
          .replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)));
        if (/^-?0+(\.0{1,2})?$/.test(normalized)) return 0;
        return normalized.startsWith("-")
          ? -parseTaka(normalized.slice(1))
          : parseTaka(normalized);
      };
      const cash = parseSigned(c.cash);
      if (cash < 0) throw new RuleError("Opening cash cannot be negative.");
      if (
        c.positions.length !== p!.roster.length ||
        new Set(c.positions.map((x) => x.memberId)).size !== p!.roster.length
      )
        throw new RuleError("Include each member exactly once.");
      for (const item of c.positions) roster(item.memberId);
      const positions = Object.fromEntries(
        c.positions.map((x) => [x.memberId, parseSigned(x.amount)]),
      );
      if (Object.values(positions).reduce((s, n) => s + n, 0) !== cash)
        throw new RuleError(
          "Opening member positions must equal opening fund cash.",
        );
      p!.opening = positions;
      p!.openingCash = cash;
      break;
    }
    case "refund": {
      manager();
      checkDate(c.date);
      const source = p!.expenses.find((e) => e.id === c.id);
      if (!source || source.status !== "approved" || source.amount <= 0)
        throw new RuleError("Choose an approved original expense.");
      const amount = parseTaka(c.amount);
      const refunded = p!.expenses
        .filter((e) => e.refundOf === c.id && e.status !== "rejected")
        .reduce((s, e) => s - e.amount, 0);
      if (amount > source.amount - refunded)
        throw new RuleError("Refund exceeds the remaining original purchase.");
      if (p!.expenses.length >= 2000)
        throw new RuleError("Monthly expense limit reached.");
      p!.expenses.push({
        ...source,
        id: eventId,
        title: "Refund: " + source.title,
        date: c.date,
        amount: -amount,
        refundOf: source.id,
        status: "pending",
        by: actor.id,
      });
      break;
    }
    case "expenseReview": {
      manager();
      const e = p!.expenses.find((e) => e.id === c.id);
      if (!e) throw new RuleError("Expense not found.");
      if (
        c.status === "rejected" &&
        p!.expenses.some((x) => x.refundOf === e.id && x.status !== "rejected")
      )
        throw new RuleError(
          "Reject linked refunds before rejecting the original expense.",
        );
      if (c.status === "approved" && e.refundOf) {
        const source = p!.expenses.find((x) => x.id === e.refundOf);
        const otherRefunds = p!.expenses
          .filter(
            (x) =>
              x.id !== e.id &&
              x.refundOf === e.refundOf &&
              x.status !== "rejected",
          )
          .reduce((n, x) => n - x.amount, 0);
        if (
          !source ||
          source.status !== "approved" ||
          -e.amount + otherRefunds > source.amount
        )
          throw new RuleError(
            "Refund no longer matches the approved original balance.",
          );
      }
      e.status = c.status;
      break;
    }
    case "transfer": {
      if (c.from === "fund") manager();
      else {
        roster(c.from);
        own(c.from);
      }
      if (c.to !== "fund") roster(c.to);
      if (c.from === c.to)
        throw new RuleError("Sender and recipient must differ.");
      if (p!.transfers.length >= 2000)
        throw new RuleError("Monthly payment limit reached.");
      if (p!.status === "closed") {
        const s = statement(w, p!);
        const positions = new Map(s.members.map((m) => [m.id, m.position]));
        positions.set("fund", -s.fundCash);
        const cap = Math.min(
          -(positions.get(c.from) || 0),
          positions.get(c.to) || 0,
        );
        if (parseTaka(c.amount) > cap)
          throw new RuleError(
            "Payment exceeds the remaining settlement amount.",
          );
      }
      p!.transfers.push({
        id: eventId,
        from: c.from,
        to: c.to,
        amount: parseTaka(c.amount),
        method: c.method,
        note: c.note,
        status: "pending",
        by: actor.id,
      });
      break;
    }
    case "transferReview": {
      const transfer = p!.transfers.find((t) => t.id === c.id);
      if (!transfer || transfer.status !== "pending")
        throw new RuleError("Payment is not pending.", 409);
      if (transfer.to === "fund") manager();
      else if (transfer.to !== actor.id)
        throw new RuleError(
          "Only the recipient can confirm or reject this payment.",
          403,
        );
      if (c.status === "confirmed" && p!.status === "closed") {
        const s = statement(w, p!);
        const pos = new Map(s.members.map((m) => [m.id, m.position]));
        pos.set("fund", -s.fundCash);
        if (
          transfer.amount >
          Math.min(-(pos.get(transfer.from) || 0), pos.get(transfer.to) || 0)
        )
          throw new RuleError(
            "Payment exceeds the remaining settlement amount.",
          );
      }
      transfer.status = c.status;
      break;
    }
    case "dispute":
      p!.disputes.push({
        id: eventId,
        by: actor.id,
        text: c.text,
        resolution: null,
      });
      break;
    case "resolveDispute": {
      manager();
      const d = p!.disputes.find((d) => d.id === c.id);
      if (!d) throw new RuleError("Question not found.");
      d.resolution = c.reason;
      break;
    }
    case "close": {
      manager();
      const checks = closeChecks(w, p!);
      if (
        checks.missing ||
        checks.pending ||
        checks.disputes ||
        checks.error ||
        !checks.result
      )
        throw new RuleError(
          "Resolve missing meals, pending entries and open questions before closing.",
          409,
        );
      const actual = /^[০0]+([.][০0]{1,2})?$/.test(c.cash.trim())
        ? 0
        : parseTaka(c.cash);
      if (checks.result.fundCash < 0 || checks.result.fundCash !== actual)
        throw new RuleError("Actual cash must match calculated fund cash.");
      p!.snapshots.push({
        at: now.toISOString(),
        by: actor.id,
        version: p!.snapshots.length + 1,
        statement: checks.result,
      });
      p!.status = "closed";
      break;
    }
    case "reopen": {
      manager();
      if (p!.status !== "closed") throw new RuleError("Month is already open.");
      p!.status = "open";
      break;
    }
    case "nextMonth": {
      manager();
      if (p!.status !== "closed")
        throw new RuleError("Close the current month first.");
      if (p!.transfers.some((t) => t.status === "pending"))
        throw new RuleError("Resolve pending payments first.");
      if (w.periods.length >= 24)
        throw new RuleError(
          "Pilot history limit reached. Export your records and contact the operator.",
        );
      const s = statement(w, p!);
      const next = new Date(p!.month + "-01T00:00:00Z");
      next.setUTCMonth(next.getUTCMonth() + 1);
      const roster = w.members
        .filter(
          (m) =>
            m.active ||
            s.members.some((x) => x.id === m.id && x.position !== 0),
        )
        .map((m) => m.id);
      w.periods.push(
        emptyPeriod(
          next.toISOString().slice(0, 7),
          roster,
          Object.fromEntries(s.members.map((m) => [m.id, m.position])),
          s.fundCash,
        ),
      );
      break;
    }
    case "addMember": {
      manager();
      if (current.status !== "open")
        throw new RuleError("Open a month before adding members.");
      if (w.members.length >= 30)
        throw new RuleError("Pilot limit is 30 members.");
      w.members.push({
        id: eventId,
        userId: null,
        name: c.name,
        role: "member",
        active: true,
      });
      current.roster.push(eventId);
      break;
    }
    case "approveJoin": {
      manager();
      if (current.status !== "open") throw new RuleError("Open a month first.");
      const req = w.requests.find((r) => r.userId === c.userId);
      if (!req) throw new RuleError("Join request not found.");
      if (w.members.some((m) => m.userId === req.userId))
        throw new RuleError("Account already has a membership.");
      if (c.claimId) {
        const member = target(c.claimId);
        if (member.userId || !member.active)
          throw new RuleError("Roster entry is not available to claim.");
        member.userId = req.userId;
      } else {
        if (w.members.length >= 30)
          throw new RuleError("Pilot member limit reached.");
        w.members.push({
          id: eventId,
          userId: req.userId,
          name: req.name,
          role: "member",
          active: true,
        });
        current.roster.push(eventId);
      }
      w.requests = w.requests.filter((r) => r.userId !== req.userId);
      break;
    }
    case "rejectJoin":
      manager();
      w.requests = w.requests.filter((r) => r.userId !== c.userId);
      break;
    case "handover": {
      manager();
      const member = target(c.memberId);
      if (!member.active || !member.userId || member.id === actor.id)
        throw new RuleError("Choose another active, signed-in member.");
      actor.role = "member";
      member.role = "manager";
      break;
    }
    case "leave": {
      manager();
      const m = target(c.memberId);
      if (m.role === "manager")
        throw new RuleError("Hand over management before leaving.");
      const checks = closeChecks(w, current);
      if (
        !checks.result ||
        checks.result.members.some((x) => x.id === m.id && x.position !== 0) ||
        current.transfers.some(
          (t) => t.status === "pending" && (t.from === m.id || t.to === m.id),
        )
      )
        throw new RuleError(
          "Settle this member’s balance and pending payments before departure.",
        );
      m.active = false;
      break;
    }
    case "settings": {
      manager();
      if (current.status === "closed")
        throw new RuleError(
          "Open the next month or reopen before changing settings.",
        );
      w.name = c.name;
      w.weights = c.weights;
      w.cutoff = c.cutoff;
      w.notice = c.notice;
      break;
    }
    case "task": {
      manager();
      target(c.assignee);
      if (w.tasks.length >= 100)
        throw new RuleError("Pilot task limit reached.");
      w.tasks.push({
        id: eventId,
        text: c.text,
        assignee: c.assignee,
        date: c.date,
        done: false,
      });
      break;
    }
    case "taskDone": {
      const task = w.tasks.find((t) => t.id === c.id);
      if (!task) throw new RuleError("Task not found.");
      own(task.assignee);
      task.done = c.done;
      break;
    }
  }
  if (JSON.stringify(w).length > 650000)
    throw new RuleError(
      "Pilot workspace size limit reached. Export your records before adding more.",
    );
  return { workspace: w, command: c };
}
export function settlements(w: Workspace, p: Period) {
  const s = statement(w, p);
  return suggestSettlements(s.members, s.fundCash);
}

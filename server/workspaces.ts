import { Hono } from "hono";
import { z } from "zod";
import {
  type Env,
  requireSession,
  uuid,
  hash,
  randomToken,
  throttle,
} from "./auth";
import {
  type Workspace,
  RuleError,
  actorFor,
  newWorkspace,
  applyCommand,
  viewWorkspace,
  closeChecks,
} from "../src/domain/workspace";
type Row = { id: string; revision: number; data: string };
async function load(db: D1Database, id: string) {
  const row = await db
    .prepare("SELECT id,revision,data FROM workspace_documents WHERE id=?")
    .bind(id)
    .first<Row>();
  if (!row) throw new RuleError("Mess not found.", 404);
  return { row, workspace: JSON.parse(row.data) as Workspace };
}
function delta(a: Workspace, b: Workspace) {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(b) as (keyof Workspace)[]) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    if (key === "periods") {
      changes.periods = b.periods
        .filter((p, i) => JSON.stringify(p) !== JSON.stringify(a.periods[i]))
        .map((p) => {
          const old = a.periods.find((x) => x.month === p.month);
          return {
            month: p.month,
            status: { before: old?.status, after: p.status },
            changedMeals: p.meals
              .filter(
                (m) =>
                  JSON.stringify(m) !==
                  JSON.stringify(old?.meals.find((x) => x.id === m.id)),
              )
              .map((m) => ({
                before: old?.meals.find((x) => x.id === m.id),
                after: m,
              })),
            changedExpenses: p.expenses
              .filter(
                (e) =>
                  JSON.stringify(e) !==
                  JSON.stringify(old?.expenses.find((x) => x.id === e.id)),
              )
              .map((e) => ({
                before: old?.expenses.find((x) => x.id === e.id),
                after: e,
              })),
            changedTransfers: p.transfers
              .filter(
                (t) =>
                  JSON.stringify(t) !==
                  JSON.stringify(old?.transfers.find((x) => x.id === t.id)),
              )
              .map((t) => ({
                before: old?.transfers.find((x) => x.id === t.id),
                after: t,
              })),
            disputes: p.disputes,
            snapshotVersions: p.snapshots.map((s) => s.version),
            opening: p.opening,
            openingCash: p.openingCash,
          };
        });
    } else changes[key] = { before: a[key], after: b[key] };
  }
  return changes;
}
async function update(
  db: D1Database,
  row: Row,
  next: Workspace,
  userId: string,
  operationId: string,
  requestHash: string,
  change: unknown,
  requiredInviteHash: string | null = null,
) {
  const result = await db
    .prepare(
      "UPDATE workspace_documents SET revision=revision+1,data=?,actor_id=?,operation_id=?,request_hash=?,change_json=?,updated_at=? WHERE id=? AND revision=? AND (? IS NULL OR EXISTS(SELECT 1 FROM invites WHERE token_hash=? AND revoked=0 AND expires_at>?)) RETURNING revision",
    )
    .bind(
      JSON.stringify(next),
      userId,
      operationId,
      requestHash,
      JSON.stringify(change),
      new Date().toISOString(),
      row.id,
      row.revision,
      requiredInviteHash,
      requiredInviteHash,
      Math.floor(Date.now() / 1000),
    )
    .first<{ revision: number }>();
  if (!result)
    throw new RuleError(
      "Someone changed this mess while you were editing. Refresh and try again.",
      409,
    );
  return result.revision;
}
export const workspaces = new Hono<Env>();
workspaces.use("*", requireSession);
workspaces.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT d.id,d.revision,json_extract(d.data,'$.name') AS name FROM workspace_access a JOIN workspace_documents d ON d.id=a.workspace_id WHERE a.user_id=? LIMIT 30",
  )
    .bind(c.get("user").id)
    .all();
  return c.json({ workspaces: rows.results });
});
workspaces.post("/", async (c) => {
  await throttle(c, "create-mess", 10);
  const count = await c.env.DB.prepare(
    "SELECT count(*) AS n FROM workspace_access WHERE user_id=?",
  )
    .bind(c.get("user").id)
    .first<{ n: number }>();
  if ((count?.n || 0) >= 5)
    throw new RuleError("Pilot limit is five messes per account.");
  const w = newWorkspace(await c.req.json(), c.get("user"), uuid(), uuid());
  await c.env.DB.prepare(
    "INSERT INTO workspace_documents VALUES(?,1,?,?,?,?,?,?)",
  )
    .bind(
      w.id,
      JSON.stringify(w),
      c.get("user").id,
      uuid(),
      "",
      JSON.stringify({ type: "create", name: w.name }),
      new Date().toISOString(),
    )
    .run();
  return c.json(
    { workspace: viewWorkspace(w, c.get("user").id), revision: 1 },
    201,
  );
});
workspaces.get("/:id", async (c) => {
  const { row, workspace: w } = await load(c.env.DB, c.req.param("id"));
  actorFor(w, c.get("user").id);
  return c.json({
    workspace: viewWorkspace(w, c.get("user").id),
    revision: row.revision,
    checks: closeChecks(w, w.periods.at(-1)!),
  });
});
const envelope = z.object({
  expectedRevision: z.number().int().positive(),
  operationId: z.string().uuid(),
  command: z.unknown(),
});
workspaces.post("/:id/commands", async (c) => {
  const body = envelope.parse(await c.req.json());
  const { row, workspace: w } = await load(c.env.DB, c.req.param("id"));
  actorFor(w, c.get("user").id);
  const requestHash = await hash(JSON.stringify(body.command));
  const old = await c.env.DB.prepare(
    "SELECT request_hash FROM workspace_operations WHERE workspace_id=? AND actor_id=? AND operation_id=?",
  )
    .bind(w.id, c.get("user").id, body.operationId)
    .first<{ request_hash: string }>();
  if (old) {
    if (old.request_hash !== requestHash)
      throw new RuleError("Operation ID reused with different input.", 409);
    return c.json({
      workspace: viewWorkspace(w, c.get("user").id),
      revision: row.revision,
      replayed: true,
    });
  }
  if (row.revision !== body.expectedRevision)
    throw new RuleError(
      "This screen is out of date. Refresh before saving.",
      409,
    );
  const applied = applyCommand(w, c.get("user").id, body.command, uuid());
  const revision = await update(
    c.env.DB,
    row,
    applied.workspace,
    c.get("user").id,
    body.operationId,
    requestHash,
    {
      type: applied.command.type,
      actorName: c.get("user").name,
      command: applied.command,
      changes: delta(w, applied.workspace),
    },
  );
  let allowed = true;
  try {
    actorFor(applied.workspace, c.get("user").id);
  } catch {
    allowed = false;
  }
  return c.json({
    workspace: allowed
      ? viewWorkspace(applied.workspace, c.get("user").id)
      : null,
    revision,
  });
});
workspaces.get("/:id/audit", async (c) => {
  const { workspace: w } = await load(c.env.DB, c.req.param("id"));
  actorFor(w, c.get("user").id);
  const rows = await c.env.DB.prepare(
    "SELECT id,revision,change_json,created_at FROM workspace_audit WHERE workspace_id=? ORDER BY id DESC LIMIT 60",
  )
    .bind(w.id)
    .all();
  return c.json({
    events: rows.results.map((r) => ({
      ...r,
      change: JSON.parse(String(r.change_json)),
      change_json: undefined,
    })),
  });
});
workspaces.get("/:id/export", async (c) => {
  const { row, workspace: w } = await load(c.env.DB, c.req.param("id"));
  actorFor(w, c.get("user").id);
  c.header(
    "Content-Disposition",
    'attachment; filename="MealKhata-backup.json"',
  );
  return c.json({
    format: "mealkhata-v1",
    exportedAt: new Date().toISOString(),
    revision: row.revision,
    workspace: viewWorkspace(w, c.get("user").id),
  });
});
workspaces.post("/:id/invites", async (c) => {
  const { workspace: w } = await load(c.env.DB, c.req.param("id"));
  if (actorFor(w, c.get("user").id).role !== "manager")
    throw new RuleError("Manager access required.", 403);
  await throttle(c, "invite", 20);
  const token = randomToken();
  const expires = Math.floor(Date.now() / 1000) + 7 * 86400;
  await c.env.DB.prepare("INSERT INTO invites VALUES(?,?,?,?,0)")
    .bind(await hash(token), w.id, c.get("user").id, expires)
    .run();
  return c.json({ path: "/workspace?invite=" + token, expiresAt: expires });
});
workspaces.post("/:id/revoke-invites", async (c) => {
  const { workspace: w } = await load(c.env.DB, c.req.param("id"));
  if (actorFor(w, c.get("user").id).role !== "manager")
    throw new RuleError("Manager access required.", 403);
  await c.env.DB.prepare("UPDATE invites SET revoked=1 WHERE workspace_id=?")
    .bind(w.id)
    .run();
  return c.json({ ok: true });
});
export const joining = new Hono<Env>();
joining.use("*", requireSession);
joining.post("/", async (c) => {
  const { token } = z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
    .parse(await c.req.json());
  await throttle(c, "join", 20);
  const invite = await c.env.DB.prepare(
    "SELECT workspace_id FROM invites WHERE token_hash=? AND revoked=0 AND expires_at>?",
  )
    .bind(await hash(token), Math.floor(Date.now() / 1000))
    .first<{ workspace_id: string }>();
  if (!invite) throw new RuleError("Invitation expired or revoked.", 404);
  const { row, workspace: w } = await load(c.env.DB, invite.workspace_id);
  if (w.members.some((m) => m.userId === c.get("user").id))
    throw new RuleError("This account already has a membership.");
  if (w.requests.some((r) => r.userId === c.get("user").id))
    return c.json({ status: "pending", name: w.name });
  if (w.requests.length >= 50)
    throw new RuleError("This mess has too many pending requests.");
  w.requests.push({
    userId: c.get("user").id,
    name: c.get("user").name,
    requestedAt: new Date().toISOString(),
  });
  await update(
    c.env.DB,
    row,
    w,
    c.get("user").id,
    uuid(),
    "",
    { type: "joinRequest", name: c.get("user").name },
    await hash(token),
  );
  return c.json({ status: "pending", name: w.name });
});

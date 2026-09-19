import React, { useEffect, useState, useRef } from "react";
import {
  Utensils,
  LayoutDashboard,
  ShoppingBasket,
  Wallet,
  Users,
  BookOpen,
  Settings,
  ShieldCheck,
  Plus,
  ArrowRight,
  RefreshCw,
  LogOut,
  Check,
  Clock3,
  Download,
  ChevronRight,
  X,
  Menu,
  ClipboardList,
  Leaf,
  AlertCircle,
} from "lucide-react";
import {
  type Workspace,
  type Period,
  type Command,
  statement,
  closeChecks,
  settlements,
  datesInMonth,
  dhakaDate,
} from "../domain/workspace";
import { money } from "../demo/adapter";
import { api, ApiError, download, csvCell } from "./api";
import "./workspace.css";
import { storeSnapshot, readSnapshot, clearSnapshot } from "./offline";
type View = Workspace & { myMemberId: string };
type Envelope = { workspace: View | null; revision: number };
type Session = { user: { id: string; name: string } | null; csrf?: string };
const names = {
  Overview: "ওভারভিউ",
  Meals: "মিল",
  Bazar: "বাজার",
  Accounts: "হিসাব",
  Members: "সদস্য",
  Reports: "রিপোর্ট",
  Activity: "পরিবর্তন",
  Settings: "সেটিংস",
};
const icons = {
  Overview: LayoutDashboard,
  Meals: Utensils,
  Bazar: ShoppingBasket,
  Accounts: Wallet,
  Members: Users,
  Reports: BookOpen,
  Activity: ClipboardList,
  Settings,
};
const currentMonth = () => dhakaDate(new Date()).slice(0, 7);
export default function WorkspaceApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<{
    googleConfigured: boolean;
    sandbox: boolean;
  } | null>(null);
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [w, setW] = useState<View | null>(null);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<keyof typeof names>("Overview");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState("");
  const [mobile, setMobile] = useState(false);
  const [bn, setBn] = useState(false);
  const [invite, setInvite] = useState("");
  const [qr, setQr] = useState("");
  const [audit, setAudit] = useState<any[]>([]);
  const [date, setDate] = useState(dhakaDate(new Date()));
  const [member, setMember] = useState("");
  const [pending, setPending] = useState<{ id: string; envelope: any } | null>(
    null,
  );
  const saving = useRef(false);
  const [offline, setOffline] = useState(false);
  const [cacheOpt, setCacheOpt] = useState(
    localStorage.getItem("mk-cache-opt-in") === "yes",
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const p = w?.periods.find((p) => p.month === month) || w?.periods.at(-1);
  const actor = w?.members.find((m) => m.id === w.myMemberId);
  const manager = actor?.role === "manager";
  const historical = !!p && p !== w?.periods.at(-1);
  const label = (en: keyof typeof names) => (bn ? names[en] : en);
  let result: ReturnType<typeof statement> | null = null,
    calcError = "";
  if (w && p)
    try {
      result = statement(w, p);
    } catch (e) {
      calcError = (e as Error).message;
    }
  const checks = w && p ? closeChecks(w, p) : null;
  const person = (id: string) =>
    id === "fund"
      ? "Mess fund"
      : w?.members.find((m) => m.id === id)?.name || id;
  async function loadList() {
    const data = await api<{ workspaces: typeof list }>("/workspaces");
    setList(data.workspaces);
    return data.workspaces;
  }
  async function load(id: string) {
    const data = await api<Envelope>("/workspaces/" + id);
    setW(data.workspace);
    setRevision(data.revision);
    if (data.workspace) {
      setMonth((prev) =>
        data.workspace!.periods.some((p) => p.month === prev)
          ? prev
          : data.workspace!.periods.at(-1)!.month,
      );
      setMember(data.workspace.myMemberId);
      localStorage.setItem("mk-last-workspace", id);
    }
    return data;
  }
  async function boot() {
    setOffline(false);
    setError("");
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api<typeof config>("/auth/config"),
        api<Session>("/auth/me"),
      ]);
      setConfig(c);
      setSession(s);
      if (s.user) {
        const all = await loadList();
        const id = localStorage.getItem("mk-last-workspace");
        if (id && all.some((x) => x.id === id)) await load(id);
        else if (all.length) await load(all[0].id);
        const queued = sessionStorage.getItem("mk-pending-command");
        if (queued)
          try {
            setPending(JSON.parse(queued));
          } catch {
            sessionStorage.removeItem("mk-pending-command");
          }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (invite)
      import("qrcode")
        .then((q) => q.toDataURL(invite, { width: 200, margin: 2 }))
        .then(setQr)
        .catch(() => setQr(""));
  }, [invite]);
  useEffect(() => {
    const incoming = new URLSearchParams(location.search).get("invite");
    if (incoming) {
      sessionStorage.setItem("mk-invite", incoming);
      history.replaceState({}, "", location.pathname);
    }
    boot();
  }, []);
  useEffect(() => {
    if (cacheOpt && w && session?.user && !offline)
      storeSnapshot({ workspace: w, revision, user: session.user }).catch(() =>
        setError(
          "Device caching is unavailable. Your server records are unaffected.",
        ),
      );
  }, [w, revision, cacheOpt]);
  useEffect(() => {
    if (page === "Activity" && w)
      api<{ events: any[] }>("/workspaces/" + w.id + "/audit")
        .then((d) => setAudit(d.events))
        .catch((e) => setError(e.message));
  }, [page, w?.id, revision]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    const element = dialogRef.current;
    element?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setModal("");
      if (e.key === "Tab" && element) {
        const nodes = Array.from(
          element.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,select,textarea,a[href]",
          ),
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === element)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === element)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal, busy]);
  async function run(fn: () => Promise<void>) {
    if (offline) {
      setError(
        "Read-only saved view. Reconnect before sending changes. Meal drafts can still be edited.",
      );
      return;
    }
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function submit(command: Command) {
    if (!w) return;
    if (pending)
      throw new Error(
        "Resolve the interrupted save with Retry save before starting another action.",
      );
    const entry = {
      id: w.id,
      envelope: {
        expectedRevision: revision,
        operationId: crypto.randomUUID(),
        command,
      },
    };
    sessionStorage.setItem("mk-pending-command", JSON.stringify(entry));
    setPending(entry);
    await sendPending(entry);
  }
  async function sendPending(entry: NonNullable<typeof pending>) {
    try {
      const data = await api<Envelope>(
        "/workspaces/" + entry.id + "/commands",
        { method: "POST", body: JSON.stringify(entry.envelope) },
        session?.csrf,
      );
      setW(data.workspace);
      setRevision(data.revision);
      if (entry.envelope.command.type === "meal") {
        const c = entry.envelope.command;
        sessionStorage.removeItem("mk-meal-draft:" + c.memberId + ":" + c.date);
      }
      if (entry.envelope.command.type === "nextMonth" && data.workspace) {
        setMonth(data.workspace.periods.at(-1)!.month);
        setDate(data.workspace.periods.at(-1)!.month + "-01");
      }
      setModal("");
      setNotice("Saved to the workspace database.");
      sessionStorage.removeItem("mk-pending-command");
      setPending(null);
      await loadList();
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        sessionStorage.removeItem("mk-pending-command");
        setPending(null);
      }
      throw e;
    }
  }
  async function form(
    event: React.FormEvent<HTMLFormElement>,
    make: (f: FormData) => Command,
  ) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run(() => submit(make(f)));
  }
  const value = (f: FormData, key: string) => String(f.get(key) || "");
  function exportCsv() {
    if (!result || !w || !p) return;
    const rows = [
      [
        "Member",
        "Meal units",
        "Food BDT",
        "Other BDT",
        "Personal spend BDT",
        "Position BDT",
      ],
      ...result.members.map((m) => [
        person(m.id),
        m.mealUnits / 100,
        m.foodCharge / 100,
        m.customCharge / 100,
        m.personalSpending / 100,
        m.position / 100,
      ]),
    ];
    download(
      `MealKhata-${p.month}.csv`,
      "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
  }
  function shareCard() {
    if (!result || !p) return;
    const text = `${p.month} • ${result.mealUnits / 100} meals • ${money(result.totalCosts)} shared expenses`;
    const safe = text.replace(
      /[&<>"']/g,
      (x) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[x]!,
    );
    download(
      "MealKhata-month-card.svg",
      `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="640"><rect width="1080" height="640" rx="32" fill="#235443"/><text x="80" y="120" fill="#cfdfb8" font-family="sans-serif" font-size="28">MEALKHATA · OUR SHARED TABLE</text><text x="80" y="260" fill="white" font-family="sans-serif" font-size="58">Good food. Fair shares.</text><text x="80" y="350" fill="#e4edda" font-family="sans-serif" font-size="28">${safe}</text><text x="80" y="510" fill="#cfdfb8" font-family="sans-serif" font-size="22">Aggregate statistics only · ${p.status === "closed" ? "Closed statement" : "Provisional month"}</text></svg>`,
      "image/svg+xml",
    );
    setModal("");
  }
  const inputMembers = (includeFund = false) => (
    <>
      {includeFund && <option value="fund">Mess fund</option>}
      {w?.members
        .filter((m) => p?.roster.includes(m.id))
        .map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {!m.active ? " (left)" : ""}
          </option>
        ))}
    </>
  );
  const pendingInvite = sessionStorage.getItem("mk-invite");
  if (loading)
    return (
      <div className="workspace-loading">
        <span className="brand-icon">
          <Utensils />
        </span>
        <h2>Opening your khata…</h2>
        <p>Connecting to the workspace API.</p>
      </div>
    );
  if (!session?.user)
    return (
      <div className="workspace-welcome">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Utensils />
          </span>
          MealKhata.
        </a>
        <div className="welcome-layout">
          <section>
            <div className="eyebrow">A SHARED HOME. A CLEAR KHATA.</div>
            <h1>
              Your table.
              <br />
              Your people.
              <br />
              <em>One shared khata.</em>
            </h1>
            <p>
              Keep meals, bazar and money in one place. Know what changed,
              understand your bill, and close the month with confidence.
            </p>
            <div className="welcome-features">
              <span>
                <Check />
                Every taka explained
              </span>
              <span>
                <Check />
                Members see the same ledger
              </span>
              <span>
                <Check />
                No paid APIs or payment gateway
              </span>
            </div>
            <a className="text-button" href="/">
              Explore the original sample demo <ArrowRight size={16} />
            </a>
          </section>
          <section className="panel welcome-card">
            <span className="modal-mark">
              <Leaf />
            </span>
            <h2>Welcome to your workspace</h2>
            <p>Sign in to create a mess or request to join one.</p>
            {error && (
              <div role="alert" className="workspace-error">
                {error}
              </div>
            )}
            <a
              className={
                "google-button " + (!config?.googleConfigured ? "disabled" : "")
              }
              href={config?.googleConfigured ? "/api/auth/google" : undefined}
              aria-disabled={!config?.googleConfigured}
            >
              G <span>Continue with Google</span>
            </a>
            {!config?.googleConfigured && (
              <small>
                Google sign-in code is installed. The owner must configure OAuth
                credentials before it can be used.
              </small>
            )}
            {config?.sandbox && (
              <>
                <div className="or-divider">LOCAL DEVELOPMENT ONLY</div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = value(new FormData(e.currentTarget), "name");
                    run(async () => {
                      await api("/auth/sandbox", {
                        method: "POST",
                        body: JSON.stringify({ name }),
                      });
                      await boot();
                    });
                  }}
                >
                  <label>
                    Your sandbox name
                    <input
                      name="name"
                      defaultValue="Rafi Ahmed"
                      required
                      maxLength={60}
                    />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Create isolated sandbox account <ArrowRight size={16} />
                  </button>
                </form>
                <div className="info-note">
                  Sample information only. This creates a new test identity, not
                  a verified Google account. Records persist in the local API
                  database.
                </div>
              </>
            )}
            {error && cacheOpt && (
              <button
                className="outline wide"
                onClick={async () => {
                  const cached = await readSnapshot();
                  if (!cached) {
                    setError(
                      "No recent saved khata is available on this device.",
                    );
                    return;
                  }
                  setW(cached.value.workspace);
                  setRevision(cached.value.revision);
                  setSession({ user: cached.value.user });
                  setOffline(true);
                  setNotice(
                    "Read-only saved view from " +
                      new Date(cached.savedAt).toLocaleString() +
                      ". Not a live session.",
                  );
                  setError("");
                }}
              >
                View saved khata read-only
              </button>
            )}
            <button className="text-button" onClick={boot}>
              Retry connection <RefreshCw size={14} />
            </button>
          </section>
        </div>
      </div>
    );
  return (
    <div className="app workspace-app">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a className="brand" href="/">
          <span className="brand-icon">
            <Utensils size={23} />
          </span>
          MealKhata.
        </a>
        <div className="workspace workspace-select">
          <select
            aria-label="Choose mess"
            value={w?.id || ""}
            onChange={(e) => run(() => load(e.target.value).then(() => {}))}
          >
            <option value="" disabled>
              Choose your mess
            </option>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="nav-label">YOUR MESS, TOGETHER</div>
        <nav>
          {(Object.keys(names) as (keyof typeof names)[]).map((name) => {
            const Icon = icons[name];
            return (
              <button
                key={name}
                className={"nav-item " + (page === name ? "active" : "")}
                onClick={() => {
                  setPage(name);
                  setMobile(false);
                }}
              >
                <Icon size={18} />
                {label(name)}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="good-card">
            <ShieldCheck size={20} />
            <strong> A shared source of truth.</strong>
            <p>
              Server-checked permissions.
              <br />
              Visible changes. Fair numbers.
            </p>
          </div>
          <button className="nav-item" onClick={() => setModal("create")}>
            <Plus size={18} />
            Create another mess
          </button>
          <button
            className="nav-item"
            onClick={() =>
              run(async () => {
                await api("/auth/logout", { method: "POST" }, session.csrf);
                await clearSnapshot();
                setCacheOpt(false);
                sessionStorage.removeItem("mk-pending-command");
                setPending(null);
                setW(null);
                setSession({ user: null });
              })
            }
          >
            <LogOut size={18} />
            Sign out
          </button>
          <div className="profile">
            <span className="avatar">
              {session.user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{session.user.name}</strong>
              <small>
                {config?.sandbox ? "Sandbox session" : "Google account"} ·{" "}
                {actor?.role || "No mess yet"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-toggle"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <span>{w?.name || "Your workspace"}</span>
            <ChevronRight size={14} />
            <strong>{label(page)}</strong>
          </div>
          <div className="top-actions">
            <span className="local-status">
              <i />
              {busy
                ? "Saving…"
                : w
                  ? `Database · revision ${revision}`
                  : "Connected"}
            </span>
            <button className="language" onClick={() => setBn(!bn)}>
              {bn ? "English" : "বাংলা"}
            </button>
            <button
              className="icon-btn"
              aria-label="Refresh workspace"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await loadList();
                  if (w) await load(w.id);
                  setNotice("Refreshed from the server.");
                })
              }
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </header>
        <main>
          {config?.sandbox && (
            <div className="demo-strip">
              <span>
                <span className="demo-pill">LOCAL SANDBOX</span>Database-backed
                test workspace. Use sample information only. Google is{" "}
                {config.googleConfigured ? "configured" : "not configured"}.
              </span>
              <a href="/">Sample demo ↗</a>
            </div>
          )}
          {error && (
            <div className="workspace-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button
                className="icon-btn"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="workspace-success" role="status">
              <Check size={16} />
              {notice}
              <button
                className="icon-btn"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {offline && (
            <div className="info-note">
              <ShieldCheck size={18} />
              <span>
                Saved device copy — not live. You may draft meal changes, but no
                server writes are allowed.
              </span>
              <button className="outline" onClick={boot}>
                Reconnect
              </button>
              <button
                className="outline"
                onClick={() =>
                  clearSnapshot().then(() => {
                    setCacheOpt(false);
                    setW(null);
                    setSession({ user: null });
                    setOffline(false);
                  })
                }
              >
                Clear saved copy
              </button>
            </div>
          )}
          {pending && (
            <div className="info-note">
              A save has not been confirmed. Retry it safely before making
              another change.
              <button
                className="outline"
                disabled={busy}
                onClick={() => run(() => sendPending(pending))}
              >
                Retry save
              </button>
            </div>
          )}
          {pendingInvite && (
            <div className="invite-prompt">
              <Users size={22} />
              <span>
                You have an invitation. Joining requires the manager’s approval.
              </span>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const data = await api<{ name: string }>(
                      "/join",
                      {
                        method: "POST",
                        body: JSON.stringify({ token: pendingInvite }),
                      },
                      session.csrf,
                    );
                    sessionStorage.removeItem("mk-invite");
                    setNotice(
                      `Request sent to ${data.name}. Refresh after the manager approves you.`,
                    );
                  })
                }
              >
                Request to join
              </button>
            </div>
          )}
          {!w ? (
            <section className="panel onboarding">
              <span className="modal-mark">
                <Utensils />
              </span>
              <h1>Let’s start your shared khata.</h1>
              <p>
                Create a mess, add your people, and log your first day. Or open
                an invitation link to request membership.
              </p>
              <button className="primary" onClick={() => setModal("create")}>
                <Plus size={17} />
                Create your first mess
              </button>
              {list.length > 0 && (
                <div className="workspace-list">
                  {list.map((m) => (
                    <button
                      className="outline"
                      key={m.id}
                      onClick={() => run(() => load(m.id).then(() => {}))}
                    >
                      {m.name} <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {w.name.toUpperCase()} ·{" "}
                    {w.members.filter((m) => m.active).length} MESSMATES
                  </div>
                  <h1>
                    {page === "Overview"
                      ? `Good to see you, ${session.user.name.split(" ")[0]}.`
                      : label(page)}
                  </h1>
                  <p>
                    {p?.status === "closed"
                      ? "This month is closed. Its original statement is preserved."
                      : "Shared records. Clear calculations. One less thing to worry about."}
                  </p>
                </div>
                <select
                  className="month-button"
                  aria-label="Select month"
                  value={p?.month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setDate(e.target.value + "-01");
                  }}
                >
                  {w.periods.map((p) => (
                    <option key={p.month} value={p.month}>
                      {p.month} · {p.status}
                    </option>
                  ))}
                </select>
              </div>
              {historical && (
                <div className="info-note">
                  Historical month: read-only after carry-forward. Later
                  payments belong to the current month.
                </div>
              )}
              {page === "Overview" && (
                <>
                  <div className="stats">
                    <Metric
                      title="Food bazar"
                      value={money(result?.foodPool || 0)}
                      hint="Approved food only"
                      icon={<ShoppingBasket size={18} />}
                    />
                    <Metric
                      title="Confirmed meals"
                      value={String(
                        (result?.mealUnits ||
                          p!.meals.reduce((s, m) => s + m.units, 0)) / 100,
                      )}
                      hint="Guests included"
                      icon={<Utensils size={18} />}
                    />
                    <Metric
                      title="Meal rate"
                      value={
                        result?.ratePaisaPerMeal != null
                          ? money(result.ratePaisaPerMeal)
                          : "—"
                      }
                      hint="Provisional until month close"
                      icon={<BookOpen size={18} />}
                    />
                    <Metric
                      title="Calculated fund"
                      value={result ? money(result.fundCash) : "—"}
                      hint="Verify against actual cash"
                      icon={<Wallet size={18} />}
                    />
                  </div>
                  <div className="dashboard-grid">
                    <div className="left-column">
                      <section className="panel workspace-section">
                        <div className="section-heading">
                          <div>
                            <h2>Your day, organized.</h2>
                            <p>Every small entry makes month-end easier.</p>
                          </div>
                          <span className="soft-pill">
                            {dhakaDate(new Date())}
                          </span>
                        </div>
                        <div className="action-grid">
                          <button onClick={() => setPage("Meals")}>
                            <Utensils />
                            <strong>Update meals</strong>
                            <small>Breakfast, lunch & dinner</small>
                          </button>
                          <button
                            onClick={() => setModal("expense")}
                            disabled={p?.status === "closed" || historical}
                          >
                            <ShoppingBasket />
                            <strong>Add bazar</strong>
                            <small>Personal or mess fund</small>
                          </button>
                          <button
                            onClick={() => setModal("transfer")}
                            disabled={historical}
                          >
                            <Wallet />
                            <strong>Report payment</strong>
                            <small>Recipient confirms receipt</small>
                          </button>
                        </div>
                        {w.notice && (
                          <div className="notice-board">
                            <strong>From your mess manager</strong>
                            <p>{w.notice}</p>
                          </div>
                        )}
                      </section>
                      <section className="panel workspace-section">
                        <div className="section-heading">
                          <div>
                            <h2>Bazar duty & shopping list</h2>
                            <p>Keep the kitchen moving, together.</p>
                          </div>
                          {manager && (
                            <button
                              className="text-button"
                              onClick={() => setModal("task")}
                            >
                              <Plus size={15} />
                              Add task
                            </button>
                          )}
                        </div>
                        {!w.tasks.length ? (
                          <Empty text="No duties yet. Add a shopping item or a bazar run." />
                        ) : (
                          <div className="task-list">
                            {w.tasks.map((task) => (
                              <div key={task.id}>
                                <input
                                  aria-label={"Complete " + task.text}
                                  type="checkbox"
                                  checked={task.done}
                                  disabled={
                                    busy ||
                                    (!manager && task.assignee !== actor?.id)
                                  }
                                  onChange={(e) =>
                                    run(() =>
                                      submit({
                                        type: "taskDone",
                                        id: task.id,
                                        done: e.target.checked,
                                      }),
                                    )
                                  }
                                />
                                <span>
                                  <strong
                                    className={task.done ? "completed" : ""}
                                  >
                                    {task.text}
                                  </strong>
                                  <small>
                                    {person(task.assignee)} · {task.date}
                                  </small>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                    <div className="right-column">
                      <section className="balance-card">
                        <div className="balance-top">
                          YOUR MONTH AT A GLANCE <Wallet size={19} />
                        </div>
                        <div className="balance-label">
                          Your current position
                        </div>
                        <div className="big-balance">
                          {result
                            ? money(
                                Math.abs(
                                  result.members.find((m) => m.id === actor?.id)
                                    ?.position || 0,
                                ),
                              )
                            : "—"}
                        </div>
                        <p>
                          {(result?.members.find((m) => m.id === actor?.id)
                            ?.position || 0) >= 0
                            ? "Credit after your allocated costs"
                            : "Amount due after your contributions"}
                        </p>
                        <button onClick={() => setPage("Accounts")}>
                          Explain everyone’s bill <ArrowRight size={16} />
                        </button>
                        <small>
                          <ShieldCheck size={13} />
                          Calculated on the server and in your view
                        </small>
                      </section>
                      <section className="panel quick-panel">
                        <h2>Month-close readiness</h2>
                        <div className="readiness">
                          <span>Missing daily entries</span>
                          <strong>{checks?.missing}</strong>
                        </div>
                        <div className="readiness">
                          <span>Pending records</span>
                          <strong>{checks?.pending}</strong>
                        </div>
                        <div className="readiness">
                          <span>Unresolved questions</span>
                          <strong>{checks?.disputes}</strong>
                        </div>
                        <button onClick={() => setPage("Reports")}>
                          Review your month <ArrowRight size={16} />
                        </button>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {page === "Meals" && (
                <section className="panel workspace-section">
                  <div className="section-heading">
                    <div>
                      <h2>Daily meal khata</h2>
                      <p>
                        Weights: {w.weights.map((n) => n / 100).join(" / ")} ·
                        cutoff {w.cutoff} Asia/Dhaka
                      </p>
                    </div>
                    {!historical && p?.status === "open" && (
                      <button
                        className="outline"
                        onClick={() => setModal("away")}
                      >
                        Away dates
                      </button>
                    )}
                  </div>
                  <div className="inline-fields">
                    <label>
                      Business date
                      <input
                        aria-label="Meal date"
                        type="date"
                        min={p!.month + "-01"}
                        max={datesInMonth(p!.month).at(-1)}
                        value={
                          date.slice(0, 7) === p!.month
                            ? date
                            : p!.month + "-01"
                        }
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </label>
                    <label>
                      Member
                      <select
                        value={member}
                        onChange={(e) => setMember(e.target.value)}
                      >
                        {w.members
                          .filter(
                            (m) =>
                              p!.roster.includes(m.id) &&
                              (manager || m.id === actor?.id),
                          )
                          .map((m) => (
                            <option value={m.id} key={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <MealForm
                    key={`${member}-${date}-${revision}`}
                    day={
                      date.slice(0, 7) === p!.month ? date : p!.month + "-01"
                    }
                    memberId={member || actor!.id}
                    period={p!}
                    disabled={busy || historical || p!.status === "closed"}
                    manager={!!manager}
                    onSubmit={(c) => run(() => submit(c))}
                  />
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>MEMBER</th>
                          <th>BREAKFAST</th>
                          <th>LUNCH</th>
                          <th>DINNER</th>
                          <th>GUESTS</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.members
                          .filter((m) => p!.roster.includes(m.id))
                          .map((m) => {
                            const entry = p!.meals.find(
                              (e) =>
                                e.memberId === m.id &&
                                e.date ===
                                  (date.slice(0, 7) === p!.month
                                    ? date
                                    : p!.month + "-01"),
                            );
                            return (
                              <tr key={m.id}>
                                <td>{m.name}</td>
                                {[0, 1, 2].map((i) => (
                                  <td key={i}>
                                    {entry
                                      ? entry.slots[i]
                                        ? "On"
                                        : "Off"
                                      : "—"}
                                  </td>
                                ))}
                                <td>{entry?.guests ?? "—"}</td>
                                <td>
                                  <span
                                    className={
                                      "status-pill " +
                                      (entry ? "approved" : "pending")
                                    }
                                  >
                                    {entry ? "Confirmed" : "Missing"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {page === "Bazar" && (
                <section className="panel workspace-section">
                  <div className="section-heading">
                    <div>
                      <h2>Every kitchen run, recorded.</h2>
                      <p>
                        Only approved expenses affect official totals.
                        Corrections stay in Activity.
                      </p>
                    </div>
                    <button
                      className="primary"
                      disabled={historical || p!.status === "closed"}
                      onClick={() => setModal("expense")}
                    >
                      <Plus size={16} />
                      Add expense
                    </button>
                  </div>
                  {!p!.expenses.length ? (
                    <Empty text="Your first bazar entry starts here." />
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>EXPENSE</th>
                            <th>PAYER / SOURCE</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                            <th>REVIEW</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...p!.expenses].reverse().map((e) => (
                            <tr key={e.id}>
                              <td>
                                <strong>{e.title}</strong>
                                <small className="cell-small">
                                  {e.date} ·{" "}
                                  {e.pool === "food"
                                    ? "Meal pool"
                                    : "Explicit bill split"}
                                </small>
                              </td>
                              <td>
                                {person(e.payer)}
                                <small className="cell-small">
                                  {e.funding === "fund"
                                    ? "Mess fund"
                                    : "Personal pocket"}
                                </small>
                              </td>
                              <td>{money(e.amount)}</td>
                              <td>
                                <span className={"status-pill " + e.status}>
                                  {e.status}
                                </span>
                              </td>
                              <td>
                                {manager &&
                                  !historical &&
                                  p!.status === "open" && (
                                    <div className="button-group">
                                      <button
                                        className="outline compact"
                                        onClick={() =>
                                          setModal("review-expense:" + e.id)
                                        }
                                      >
                                        Review
                                      </button>
                                      {e.status === "approved" &&
                                        e.amount > 0 && (
                                          <button
                                            className="text-button"
                                            onClick={() =>
                                              setModal("refund:" + e.id)
                                            }
                                          >
                                            Refund
                                          </button>
                                        )}
                                    </div>
                                  )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
              {page === "Accounts" && (
                <>
                  <section className="panel workspace-section">
                    <div className="section-heading">
                      <div>
                        <h2>One khata. No guesswork.</h2>
                        <p>
                          Positive position = credit; negative position = amount
                          due.
                        </p>
                      </div>
                      <button
                        className="primary"
                        disabled={historical}
                        onClick={() => setModal("transfer")}
                      >
                        <Plus size={16} />
                        Report payment
                      </button>
                    </div>
                    {calcError ? (
                      <div className="info-note">
                        {calcError}. Confirm meal entries before calculating
                        food shares.
                      </div>
                    ) : (
                      <>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>MEMBER</th>
                                <th>MEALS</th>
                                <th>FOOD</th>
                                <th>OTHER BILLS</th>
                                <th>POSITION</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result?.members.map((m) => (
                                <tr key={m.id}>
                                  <td>
                                    <button
                                      className="member-button"
                                      onClick={() => setModal("bill:" + m.id)}
                                    >
                                      {person(m.id)} ↗
                                    </button>
                                  </td>
                                  <td>{m.mealUnits / 100}</td>
                                  <td>{money(m.foodCharge)}</td>
                                  <td>{money(m.customCharge)}</td>
                                  <td
                                    className={
                                      m.position >= 0 ? "credit" : "due"
                                    }
                                  >
                                    {money(Math.abs(m.position))}{" "}
                                    {m.position >= 0 ? "credit" : "due"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="reconciled">
                          <ShieldCheck size={18} />
                          <span>
                            Member positions = calculated fund cash:{" "}
                            {money(result?.fundCash || 0)}. This verifies
                            arithmetic, not actual receipts.
                          </span>
                        </div>
                      </>
                    )}
                  </section>
                  <section className="panel workspace-section section-space">
                    <div className="section-heading">
                      <div>
                        <h2>Deposits, refunds & peer payments</h2>
                        <p>
                          Reported is not received. The recipient must confirm.
                        </p>
                      </div>
                    </div>
                    {!p!.transfers.length ? (
                      <Empty text="No payments reported yet." />
                    ) : (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>PAYMENT</th>
                              <th>METHOD</th>
                              <th>AMOUNT</th>
                              <th>STATUS</th>
                              <th>RECEIPT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...p!.transfers].reverse().map((t) => (
                              <tr key={t.id}>
                                <td>
                                  {person(t.from)} → {person(t.to)}
                                  <small className="cell-small">
                                    {t.note || "No reference"}
                                  </small>
                                </td>
                                <td>{t.method}</td>
                                <td>{money(t.amount)}</td>
                                <td>
                                  <span className={"status-pill " + t.status}>
                                    {t.status}
                                  </span>
                                </td>
                                <td>
                                  {t.status === "pending" &&
                                    !historical &&
                                    ((t.to === "fund" && manager) ||
                                      t.to === actor?.id) && (
                                      <button
                                        className="outline compact"
                                        onClick={() =>
                                          setModal("review-transfer:" + t.id)
                                        }
                                      >
                                        Review receipt
                                      </button>
                                    )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                  <div className="trust-strip">
                    <ShieldCheck />
                    <div>
                      <strong>Understand the settlement.</strong>
                      <p>
                        Suggestions include the mess fund. No payments happen
                        automatically.
                      </p>
                    </div>
                    <button onClick={() => setModal("settle")}>
                      Preview transfers <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {page === "Members" && (
                <>
                  <section className="panel workspace-section">
                    <div className="section-heading">
                      <div>
                        <h2>The people around your table</h2>
                        <p>
                          Roster-only members can be claimed after an approved
                          join request.
                        </p>
                      </div>
                      {manager && (
                        <div className="button-group">
                          <button
                            className="outline"
                            onClick={() => setModal("member")}
                          >
                            <Plus size={15} />
                            Add name
                          </button>
                          <button
                            className="primary"
                            onClick={() =>
                              run(async () => {
                                const data = await api<{ path: string }>(
                                  "/workspaces/" + w.id + "/invites",
                                  { method: "POST" },
                                  session.csrf,
                                );
                                setInvite(location.origin + data.path);
                                setModal("invite");
                              })
                            }
                          >
                            Invite link
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="members-grid">
                      {w.members.map((m) => (
                        <div className="member-tile" key={m.id}>
                          <span className="avatar large">
                            {m.name.slice(0, 2).toUpperCase()}
                          </span>
                          <h3>{m.name}</h3>
                          <span className="soft-pill">
                            {m.role} · {m.active ? "active" : "left"}
                          </span>
                          {manager && m.active && m.id !== actor?.id && (
                            <div>
                              <button
                                onClick={() => setModal("handover:" + m.id)}
                              >
                                Hand over manager role
                              </button>
                              <button onClick={() => setModal("leave:" + m.id)}>
                                Mark departed
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                  {manager && (
                    <section className="panel workspace-section section-space">
                      <div className="section-heading">
                        <div>
                          <h2>Join requests</h2>
                          <p>An invitation does not grant financial access.</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setModal("revoke")}
                        >
                          Revoke all links
                        </button>
                      </div>
                      {!w.requests.length ? (
                        <Empty text="No pending join requests. Refresh to check again." />
                      ) : (
                        w.requests.map((r) => (
                          <div className="request-row" key={r.userId}>
                            <span>
                              <strong>{r.name}</strong>
                              <small>Requested membership</small>
                            </span>
                            <button
                              className="outline"
                              onClick={() => setModal("join:" + r.userId)}
                            >
                              Review request
                            </button>
                          </div>
                        ))
                      )}
                    </section>
                  )}
                </>
              )}
              {page === "Reports" && (
                <>
                  <section className="panel workspace-section">
                    <div className="section-heading">
                      <div>
                        <h2>A calm month-end starts here.</h2>
                        <p>
                          {p!.month} · {p!.status} · {p!.snapshots.length}{" "}
                          preserved closing version(s)
                        </p>
                      </div>
                      <span
                        className={
                          "status-pill " +
                          (p!.status === "closed" ? "approved" : "pending")
                        }
                      >
                        {p!.status}
                      </span>
                    </div>
                    <div className="report-checks">
                      <CheckItem
                        ok={checks!.missing === 0}
                        title={`${checks!.missing} missing daily entries`}
                        detail="Every member-day must explicitly be on or off."
                      />
                      <CheckItem
                        ok={checks!.pending === 0}
                        title={`${checks!.pending} pending records`}
                        detail="Review expense approvals and payment receipts."
                      />
                      <CheckItem
                        ok={checks!.disputes === 0}
                        title={`${checks!.disputes} unresolved questions`}
                        detail="Resolve concerns before freezing a statement."
                      />
                      <CheckItem
                        ok={!checks!.error && !!result && result.fundCash >= 0}
                        title={checks!.error || "Verify the actual cash"}
                        detail={
                          result
                            ? `Calculated cash: ${money(result.fundCash)}. Count the money before confirming close.`
                            : "Add confirmed meal entries to calculate a statement."
                        }
                      />
                    </div>
                    <div className="report-actions">
                      {manager &&
                        !historical &&
                        (p!.status === "open" ? (
                          <>
                            <button
                              className="outline"
                              onClick={() => setModal("fill")}
                            >
                              Mark missing entries as off
                            </button>
                            <button
                              className="primary"
                              onClick={() => setModal("close")}
                            >
                              Reconcile & close month
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="outline"
                              onClick={() => setModal("reopen")}
                            >
                              Reopen with a reason
                            </button>
                            <button
                              className="primary"
                              onClick={() => setModal("next")}
                            >
                              Start next month
                            </button>
                          </>
                        ))}
                    </div>
                    <div className="report-actions">
                      {manager &&
                        w.periods.length === 1 &&
                        !p!.meals.length &&
                        !p!.expenses.length &&
                        !p!.transfers.length && (
                          <button
                            className="outline"
                            onClick={() => setModal("opening")}
                          >
                            Set opening balances
                          </button>
                        )}
                      <button
                        className="outline"
                        disabled={!result}
                        onClick={exportCsv}
                      >
                        <Download size={15} />
                        CSV statement
                      </button>
                      <button
                        className="outline"
                        onClick={() =>
                          run(async () => {
                            const data = await api(
                              "/workspaces/" + w.id + "/export",
                            );
                            download(
                              `MealKhata-${p!.month}-backup.json`,
                              JSON.stringify(data, null, 2),
                            );
                            setNotice(
                              "Backup exported. Store it privately; it contains your shared ledger.",
                            );
                          })
                        }
                      >
                        <Download size={15} />
                        JSON export
                      </button>
                      <button
                        className="outline"
                        onClick={() => window.print()}
                      >
                        Print / Save PDF
                      </button>
                      <button
                        className="outline"
                        disabled={!result}
                        onClick={() => setModal("share")}
                      >
                        Monthly share card
                      </button>
                    </div>
                  </section>
                  <section className="panel workspace-section section-space">
                    <div className="section-heading">
                      <div>
                        <h2>Questions & corrections</h2>
                        <p>Make concerns visible, not personal.</p>
                      </div>
                      <button
                        className="outline"
                        disabled={historical || p!.status === "closed"}
                        onClick={() => setModal("question")}
                      >
                        Raise a question
                      </button>
                    </div>
                    {!p!.disputes.length ? (
                      <Empty text="No questions raised for this month." />
                    ) : (
                      p!.disputes.map((d) => (
                        <div className="question-row" key={d.id}>
                          <strong>{person(d.by)}</strong>
                          <p>{d.text}</p>
                          {d.resolution ? (
                            <div className="credit">
                              Resolved: {d.resolution}
                            </div>
                          ) : (
                            manager && (
                              <button
                                className="outline compact"
                                onClick={() => setModal("resolve:" + d.id)}
                              >
                                Resolve with explanation
                              </button>
                            )
                          )}
                        </div>
                      ))
                    )}
                  </section>
                  <section className="print-only">
                    <h2>
                      {w.name} · {p!.month}
                    </h2>
                    <p>
                      {p!.status} statement. Generated{" "}
                      {new Date().toLocaleString()}.
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Meals</th>
                          <th>Charge</th>
                          <th>Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result?.members.map((m) => (
                          <tr key={m.id}>
                            <td>{person(m.id)}</td>
                            <td>{m.mealUnits / 100}</td>
                            <td>{money(m.charge)}</td>
                            <td>{money(m.position)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      Fund cash:{" "}
                      {result ? money(result.fundCash) : "Calculation blocked"}
                    </p>
                  </section>
                  {p!.snapshots.length > 0 && (
                    <section className="panel workspace-section section-space">
                      <div className="section-heading">
                        <h2>Preserved closing snapshots</h2>
                      </div>
                      {p!.snapshots.map((s) => (
                        <details className="snapshot" key={s.version}>
                          <summary>
                            Version {s.version} ·{" "}
                            {new Date(s.at).toLocaleString()} ·{" "}
                            {s.version === p!.snapshots.length &&
                            p!.status === "closed"
                              ? "Final closing statement"
                              : "Superseded / reopened"}
                          </summary>
                          {s.statement.members.map((m) => (
                            <div className="readiness" key={m.id}>
                              <span>{person(m.id)}</span>
                              <strong>{money(m.position)}</strong>
                            </div>
                          ))}
                        </details>
                      ))}
                    </section>
                  )}
                </>
              )}
              {page === "Activity" && (
                <section className="panel workspace-section">
                  <div className="section-heading">
                    <div>
                      <h2>A khata with a memory.</h2>
                      <p>
                        Latest 60 changes. Server-recorded actors, versions and
                        before/after details.
                      </p>
                    </div>
                    <ShieldCheck size={23} />
                  </div>
                  {audit.length ? (
                    audit.map((e) => (
                      <details className="audit-row" key={e.id}>
                        <summary>
                          <span className="audit-dot" />
                          <span>
                            <strong>{e.change.type}</strong>
                            <small>
                              {e.change.actorName ||
                                e.change.name ||
                                "Workspace created"}{" "}
                              · {new Date(e.created_at).toLocaleString()}
                            </small>
                          </span>
                          <span className="soft-pill">v{e.revision}</span>
                        </summary>
                        <pre>
                          {JSON.stringify(
                            e.change.changes || e.change,
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ))
                  ) : (
                    <Empty text="No activity to show yet." />
                  )}
                </section>
              )}
              {page === "Settings" && (
                <section className="panel workspace-section">
                  <div className="section-heading">
                    <div>
                      <h2>Simple rules. Fair shares.</h2>
                      <p>
                        New weights apply to future edits; saved meal units do
                        not change silently.
                      </p>
                    </div>
                  </div>
                  <form
                    className="settings-form"
                    onSubmit={(e) =>
                      form(e, (f) => ({
                        type: "settings",
                        name: value(f, "name"),
                        weights: ["breakfast", "lunch", "dinner"].map((k) =>
                          Math.round(Number(value(f, k)) * 100),
                        ),
                        cutoff: value(f, "cutoff"),
                        notice: value(f, "notice"),
                      }))
                    }
                  >
                    <label>
                      Mess name
                      <input
                        name="name"
                        defaultValue={w.name}
                        required
                        maxLength={120}
                      />
                    </label>
                    <div className="form-grid three">
                      {["Breakfast", "Lunch", "Dinner"].map((slot, i) => (
                        <label key={slot}>
                          {slot} weight
                          <input
                            name={slot.toLowerCase()}
                            type="number"
                            min="0"
                            max="3"
                            step="0.5"
                            defaultValue={w.weights[i] / 100}
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Meal cutoff (Asia/Dhaka)
                      <input
                        type="time"
                        name="cutoff"
                        defaultValue={w.cutoff}
                        required
                      />
                    </label>
                    <label>
                      Notice to your mess
                      <textarea
                        name="notice"
                        defaultValue={w.notice}
                        maxLength={800}
                        placeholder="Tomorrow’s bazar, a kitchen reminder…"
                      />
                    </label>
                    <button className="primary" disabled={busy || !manager}>
                      Save mess rules
                    </button>
                    {!manager && (
                      <p>Only the manager can change these rules.</p>
                    )}
                  </form>
                  <div className="info-note">
                    <label
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={cacheOpt}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCacheOpt(checked);
                          if (checked)
                            localStorage.setItem("mk-cache-opt-in", "yes");
                          else clearSnapshot().catch(() => {});
                        }}
                      />
                      Remember the last khata on this device for offline viewing
                      (7 days)
                    </label>
                    <small>
                      Only enable on a private device. Stored records are not
                      encrypted by MealKhata. Signing out clears the saved copy.
                    </small>
                  </div>
                  <div className="info-note">
                    Privacy: records are shared within this mess. Do not enter
                    government IDs, passwords or bank credentials. This pilot
                    does not hold or transfer money. For account deletion or
                    data export assistance, contact your mess manager and
                    deployment operator.
                  </div>
                </section>
              )}
            </>
          )}
          <footer>
            <span className="footer-brand">
              <Utensils size={13} />
              MealKhata
            </span>
            <span>Made for shared tables, not shared worries.</span>
            <span>Workspace pilot · v0.3</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop">
          <div
            ref={dialogRef}
            className="modal workspace-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-modal-title"
            tabIndex={-1}
          >
            <button
              className="modal-close icon-btn"
              aria-label="Close dialog"
              disabled={busy}
              onClick={() => setModal("")}
            >
              <X size={20} />
            </button>
            <span className="modal-mark">
              <BookOpen />
            </span>
            {modal === "create" ? (
              <>
                <h2 id="workspace-modal-title">Make room for your people.</h2>
                <p>Create a mess. You become its first manager.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    run(async () => {
                      const data = await api<Envelope>(
                        "/workspaces",
                        {
                          method: "POST",
                          body: JSON.stringify({
                            name: value(f, "name"),
                            month: value(f, "month"),
                          }),
                        },
                        session.csrf,
                      );
                      setW(data.workspace);
                      setRevision(data.revision);
                      setMonth(value(f, "month"));
                      setMember(data.workspace!.myMemberId);
                      setDate(value(f, "month") + "-01");
                      setModal("");
                      await loadList();
                      localStorage.setItem(
                        "mk-last-workspace",
                        data.workspace!.id,
                      );
                    });
                  }}
                >
                  <label>
                    Mess name
                    <input
                      name="name"
                      placeholder="Bachelor’s Nest"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    First accounting month
                    <input
                      name="month"
                      type="month"
                      defaultValue={currentMonth()}
                      required
                    />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Create mess <ArrowRight size={16} />
                  </button>
                </form>
              </>
            ) : modal === "member" ? (
              <>
                <h2 id="workspace-modal-title">Add a name to the table.</h2>
                <p>You can keep records for this person before they sign in.</p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: "addMember",
                      name: value(f, "name"),
                    }))
                  }
                >
                  <label>
                    Member name
                    <input name="name" required maxLength={120} />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Add roster member
                  </button>
                </form>
              </>
            ) : modal === "expense" ? (
              <>
                <h2 id="workspace-modal-title">Record a kitchen run.</h2>
                <p>
                  New expenses wait for manager approval—even when submitted by
                  the manager.
                </p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => {
                      const pool = value(f, "pool") as "food" | "custom";
                      return {
                        type: "expense",
                        month: p!.month,
                        title: value(f, "title"),
                        date: value(f, "date"),
                        payer: value(f, "payer"),
                        amount: value(f, "amount"),
                        funding: value(f, "funding") as "fund" | "personal",
                        pool,
                        ...(pool === "custom"
                          ? {
                              splits: p!.roster
                                .filter((id) => f.has("split-" + id))
                                .map((memberId) => ({
                                  memberId,
                                  weight:
                                    Number(value(f, "weight-" + memberId)) || 1,
                                })),
                            }
                          : {}),
                      };
                    })
                  }
                >
                  <label>
                    What was purchased?
                    <input name="title" required maxLength={120} />
                  </label>
                  <div className="form-grid">
                    <label>
                      Amount (৳)
                      <input
                        name="amount"
                        inputMode="decimal"
                        placeholder="৬৮০ or 680"
                        required
                        maxLength={20}
                      />
                    </label>
                    <label>
                      Date
                      <input
                        name="date"
                        type="date"
                        min={p!.month + "-01"}
                        max={datesInMonth(p!.month).at(-1)}
                        defaultValue={
                          dhakaDate(new Date()).startsWith(p!.month)
                            ? dhakaDate(new Date())
                            : p!.month + "-01"
                        }
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Paid by
                    <select name="payer" defaultValue={actor?.id}>
                      {manager ? (
                        inputMembers()
                      ) : (
                        <option value={actor?.id}>{actor?.name}</option>
                      )}
                    </select>
                  </label>
                  <label>
                    Money source
                    <select name="funding">
                      <option value="personal">
                        Personal pocket — credit the payer
                      </option>
                      <option value="fund">
                        Mess fund — reduce shared cash
                      </option>
                    </select>
                  </label>
                  <label>
                    Cost category
                    <select name="pool">
                      <option value="food">
                        Food — divide by weighted meals
                      </option>
                      <option value="custom">
                        Household / personal bill — explicit split below
                      </option>
                    </select>
                  </label>
                  <details className="split-details">
                    <summary>
                      Bill split (used only for household / personal bills)
                    </summary>
                    {p!.roster.map((id) => (
                      <label className="split-row" key={id}>
                        <input
                          type="checkbox"
                          name={"split-" + id}
                          defaultChecked
                        />
                        <span>{person(id)}</span>
                        <input
                          aria-label={"Split weight " + person(id)}
                          name={"weight-" + id}
                          type="number"
                          defaultValue="1"
                          min="1"
                          max="10000"
                        />
                      </label>
                    ))}
                    <small>
                      Same weights = equal shares. Select one person for a
                      personal charge.
                    </small>
                  </details>
                  <button className="primary wide" disabled={busy}>
                    Submit expense for review
                  </button>
                </form>
              </>
            ) : modal === "opening" ? (
              <>
                <h2 id="workspace-modal-title">
                  Bring your old khata forward.
                </h2>
                <p>
                  Positive = member credit. Negative = amount owed. These
                  positions must add up to actual opening fund cash.
                </p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: "opening",
                      month: p!.month,
                      cash: value(f, "cash"),
                      positions: p!.roster.map((memberId) => ({
                        memberId,
                        amount: value(f, memberId),
                      })),
                      reason: value(f, "reason"),
                    }))
                  }
                >
                  <label>
                    Opening fund cash (৳)
                    <input
                      name="cash"
                      defaultValue="0"
                      required
                      maxLength={20}
                    />
                  </label>
                  {p!.roster.map((id) => (
                    <label key={id}>
                      {person(id)} position (৳)
                      <input
                        name={id}
                        defaultValue="0"
                        required
                        maxLength={20}
                      />
                    </label>
                  ))}
                  <label>
                    Source / verification note
                    <textarea
                      name="reason"
                      required
                      minLength={3}
                      maxLength={400}
                    />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Set balanced opening records
                  </button>
                </form>
              </>
            ) : modal.startsWith("refund:") ? (
              <>
                <h2 id="workspace-modal-title">Return money to its source.</h2>
                <p>
                  A linked refund reverses the original funding source and bill
                  split. It still requires approval.
                </p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: "refund",
                      month: p!.month,
                      id: modal.split(":")[1],
                      amount: value(f, "amount"),
                      date: value(f, "date"),
                      reason: value(f, "reason"),
                    }))
                  }
                >
                  <label>
                    Refund amount (৳)
                    <input name="amount" required maxLength={20} />
                  </label>
                  <label>
                    Date
                    <input
                      name="date"
                      type="date"
                      defaultValue={p!.month + "-01"}
                      required
                    />
                  </label>
                  <label>
                    Reason
                    <textarea
                      name="reason"
                      required
                      minLength={3}
                      maxLength={400}
                    />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Submit linked refund
                  </button>
                </form>
              </>
            ) : modal === "transfer" ? (
              <>
                <h2 id="workspace-modal-title">
                  Report money received or sent.
                </h2>
                <p>
                  The recipient confirms actual receipt. A bKash reference alone
                  is not proof.
                </p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: "transfer",
                      month: p!.month,
                      from: value(f, "from"),
                      to: value(f, "to"),
                      amount: value(f, "amount"),
                      method: value(f, "method") as
                        "Cash" | "bKash" | "Nagad" | "Bank",
                      note: value(f, "note"),
                    }))
                  }
                >
                  <div className="form-grid">
                    <label>
                      From
                      <select name="from" defaultValue={actor?.id}>
                        {manager ? (
                          inputMembers(true)
                        ) : (
                          <option value={actor?.id}>{actor?.name}</option>
                        )}
                      </select>
                    </label>
                    <label>
                      To
                      <select name="to" defaultValue="fund">
                        {inputMembers(true)}
                      </select>
                    </label>
                  </div>
                  <label>
                    Amount (৳)
                    <input
                      name="amount"
                      required
                      inputMode="decimal"
                      maxLength={20}
                    />
                  </label>
                  <label>
                    Method
                    <select name="method">
                      {["Cash", "bKash", "Nagad", "Bank"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reference / note (optional)
                    <input name="note" maxLength={120} />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Report payment
                  </button>
                </form>
              </>
            ) : modal.startsWith("review-") ? (
              <>
                <h2 id="workspace-modal-title">Review the actual record.</h2>
                <p>
                  Confirm only after checking the expense or receipt. Your
                  explanation is recorded.
                </p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) =>
                      modal.startsWith("review-expense")
                        ? {
                            type: "expenseReview",
                            month: p!.month,
                            id: modal.split(":")[1],
                            status: value(f, "status") as
                              "approved" | "rejected",
                            reason: value(f, "reason"),
                          }
                        : {
                            type: "transferReview",
                            month: p!.month,
                            id: modal.split(":")[1],
                            status: value(f, "status") as
                              "confirmed" | "rejected",
                            reason: value(f, "reason"),
                          },
                    )
                  }
                >
                  <label>
                    Decision
                    <select name="status">
                      <option
                        value={
                          modal.startsWith("review-expense")
                            ? "approved"
                            : "confirmed"
                        }
                      >
                        {modal.startsWith("review-expense")
                          ? "Approve expense"
                          : "Confirm actual receipt"}
                      </option>
                      <option value="rejected">Reject / correct expense</option>
                    </select>
                  </label>
                  <label>
                    Explanation
                    <textarea
                      name="reason"
                      required
                      minLength={3}
                      maxLength={400}
                    />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Save review
                  </button>
                </form>
              </>
            ) : modal === "away" ? (
              <>
                <h2 id="workspace-modal-title">Going away for a while?</h2>
                <p>
                  Explicitly set all meals off for this date range. Existing
                  entries in the range will be replaced.
                </p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: "away",
                      month: p!.month,
                      memberId: value(f, "member"),
                      start: value(f, "start"),
                      end: value(f, "end"),
                      reason: value(f, "reason"),
                    }))
                  }
                >
                  <label>
                    Member
                    <select name="member">
                      {manager ? (
                        inputMembers()
                      ) : (
                        <option value={actor?.id}>{actor?.name}</option>
                      )}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      From
                      <input name="start" type="date" required />
                    </label>
                    <label>
                      Through
                      <input name="end" type="date" required />
                    </label>
                  </div>
                  <label>
                    Reason
                    <textarea
                      name="reason"
                      required
                      minLength={3}
                      maxLength={400}
                    />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Confirm away dates
                  </button>
                </form>
              </>
            ) : modal === "invite" ? (
              <>
                <h2 id="workspace-modal-title">Good things are shared.</h2>
                <p>
                  This link expires in seven days. People must sign in and
                  request manager approval.
                </p>
                <label>
                  Invitation link
                  <input readOnly value={invite} />
                </label>
                {qr && (
                  <img
                    src={qr}
                    width="200"
                    height="200"
                    alt="Scan this invitation to request membership"
                    style={{ display: "block", margin: "18px auto 0" }}
                  />
                )}
                <button
                  className="primary wide"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(invite)
                      .then(() => setNotice("Invitation copied."))
                      .catch(() =>
                        setError(
                          "Copy is unavailable. Select and copy the link manually.",
                        ),
                      )
                  }
                >
                  Copy invitation link
                </button>
              </>
            ) : modal.startsWith("join:") ? (
              <>
                <h2 id="workspace-modal-title">Approve a new messmate.</h2>
                <p>
                  Choose a new membership or link this account to an existing
                  roster name.
                </p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: "approveJoin",
                      userId: modal.split(":")[1],
                      ...(value(f, "claim")
                        ? { claimId: value(f, "claim") }
                        : {}),
                    }))
                  }
                >
                  <label>
                    Roster entry
                    <select name="claim">
                      <option value="">Create new member</option>
                      {w!.members
                        .filter((m) => m.id !== actor?.id && m.active)
                        .map((m) => (
                          <option value={m.id} key={m.id}>
                            {m.name} (server checks availability)
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Approve membership
                  </button>
                  <button
                    type="button"
                    className="outline wide"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        submit({
                          type: "rejectJoin",
                          userId: modal.split(":")[1],
                        }),
                      )
                    }
                  >
                    Reject request
                  </button>
                </form>
              </>
            ) : modal.startsWith("bill:") ? (
              (() => {
                const id = modal.split(":")[1],
                  m = result?.members.find((m) => m.id === id);
                const sent = p!.transfers
                    .filter((t) => t.from === id && t.status === "confirmed")
                    .reduce((s, t) => s + t.amount, 0),
                  received = p!.transfers
                    .filter((t) => t.to === id && t.status === "confirmed")
                    .reduce((s, t) => s + t.amount, 0);
                return (
                  <>
                    <h2 id="workspace-modal-title">Every taka has a story.</h2>
                    <p>
                      {person(id)} · {p!.month}
                    </p>
                    <div className="bill-lines">
                      {[
                        ["Opening position", p!.opening[id] || 0],
                        ["Personal spending", m?.personalSpending || 0],
                        ["Confirmed payments sent", sent],
                        ["Payments received", -received],
                        ["Food allocation", -(m?.foodCharge || 0)],
                        ["Other bill allocation", -(m?.customCharge || 0)],
                        ["Current position", m?.position || 0],
                      ].map(([title, n]) => (
                        <div key={title}>
                          <span>{title}</span>
                          <strong>{money(Number(n))}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="formula">
                      Food allocation: {money(result?.foodPool || 0)} ×{" "}
                      {m?.mealUnits} / {result?.mealUnits} weighted units.
                      Largest-remainder rounding makes the final total exact.
                    </div>
                  </>
                );
              })()
            ) : modal === "settle" ? (
              <>
                <h2 id="workspace-modal-title">
                  Suggested transfers, explained.
                </h2>
                <p>
                  Paying out all fund cash would clear these positions. You may
                  instead carry balances forward. This preview changes no
                  records.
                </p>
                {(() => {
                  try {
                    return (
                      <div className="bill-lines">
                        {settlements(w!, p!).map((t, i) => (
                          <div key={i}>
                            <span>
                              {person(t.from)} → {person(t.to)}
                            </span>
                            <strong>{money(t.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    );
                  } catch (e) {
                    return (
                      <div className="info-note">{(e as Error).message}</div>
                    );
                  }
                })()}
                <button
                  className="primary wide"
                  onClick={() => setModal("transfer")}
                >
                  Report a payment separately
                </button>
              </>
            ) : modal === "share" ? (
              <>
                <h2 id="workspace-modal-title">
                  A little pride, no private balances.
                </h2>
                <p>
                  Your downloadable card contains only the month, total meals
                  and shared expenses. No member names, debts, address or invite
                  token.
                </p>
                <div className="share-card-preview">
                  <Utensils />
                  <h2>Good food. Fair shares.</h2>
                  <p>
                    {p!.month} · {(result?.mealUnits || 0) / 100} meals
                  </p>
                  <strong>
                    {money(result?.totalCosts || 0)} shared expenses
                  </strong>
                </div>
                <button className="primary wide" onClick={shareCard}>
                  Download aggregate card
                </button>
              </>
            ) : modal === "task" ? (
              <>
                <h2 id="workspace-modal-title">Keep the kitchen moving.</h2>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => ({
                      type: "task",
                      text: value(f, "text"),
                      assignee: value(f, "assignee"),
                      date: value(f, "date"),
                    }))
                  }
                >
                  <label>
                    Shopping item / duty
                    <input name="text" required maxLength={120} />
                  </label>
                  <label>
                    Assigned to<select name="assignee">{inputMembers()}</select>
                  </label>
                  <label>
                    Due date
                    <input
                      name="date"
                      type="date"
                      defaultValue={dhakaDate(new Date())}
                      required
                    />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Add task
                  </button>
                </form>
              </>
            ) : modal === "revoke" ? (
              <>
                <h2 id="workspace-modal-title">Revoke all invitation links?</h2>
                <p>
                  Existing members keep their access. Previously shared links
                  will no longer accept new requests.
                </p>
                <button
                  className="primary wide"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api(
                        "/workspaces/" + w!.id + "/revoke-invites",
                        { method: "POST" },
                        session.csrf,
                      );
                      setModal("");
                      setNotice("All previous invitations revoked.");
                    })
                  }
                >
                  Revoke links
                </button>
              </>
            ) : (
              <>
                <h2 id="workspace-modal-title">
                  {modal === "close"
                    ? "Count the cash. Close with confidence."
                    : modal === "fill"
                      ? "Confirm missing entries are all off."
                      : modal === "next"
                        ? "Carry forward, without double counting."
                        : modal === "reopen"
                          ? "Reopen this month transparently."
                          : modal.startsWith("handover:")
                            ? "Hand over the manager seat?"
                            : modal.startsWith("leave:")
                              ? "Record this member’s departure?"
                              : modal === "question"
                                ? "What needs a second look?"
                                : "Resolve with an explanation."}
                </h2>
                <p>
                  {modal === "fill"
                    ? `This will explicitly record ${checks?.missing} missing member-days as zero meals, including future dates. Only do this after verifying every missing day.`
                    : modal === "next"
                      ? "The current live balances and fund cash become next month’s opening balances. This month then becomes read-only."
                      : modal === "close"
                        ? "The month must have no missing entries, pending records or unresolved questions. A versioned closing snapshot will be retained."
                        : modal === "reopen"
                          ? "The previous snapshot is retained and marked superseded. Re-closing creates a new version."
                          : "This action will appear in the shared audit history."}
                </p>
                <form
                  onSubmit={(e) =>
                    form(e, (f) => {
                      const reason = value(f, "reason");
                      if (modal === "fill")
                        return { type: "fillMissing", month: p!.month, reason };
                      if (modal === "close")
                        return {
                          type: "close",
                          month: p!.month,
                          cash: value(f, "cash"),
                          reason,
                        };
                      if (modal === "next")
                        return { type: "nextMonth", month: p!.month };
                      if (modal === "reopen")
                        return { type: "reopen", month: p!.month, reason };
                      if (modal.startsWith("handover:"))
                        return {
                          type: "handover",
                          memberId: modal.split(":")[1],
                        };
                      if (modal.startsWith("leave:"))
                        return {
                          type: "leave",
                          memberId: modal.split(":")[1],
                          reason,
                        };
                      if (modal === "question")
                        return {
                          type: "dispute",
                          month: p!.month,
                          text: reason,
                        };
                      return {
                        type: "resolveDispute",
                        month: p!.month,
                        id: modal.split(":")[1],
                        reason,
                      };
                    })
                  }
                >
                  {modal === "close" && (
                    <label>
                      Actual fund cash (৳)
                      <input
                        name="cash"
                        required
                        inputMode="decimal"
                        maxLength={20}
                      />
                    </label>
                  )}
                  {modal !== "next" && !modal.startsWith("handover:") && (
                    <label>
                      {modal === "question"
                        ? "Your question"
                        : "Reason / explanation"}
                      <textarea
                        name="reason"
                        minLength={3}
                        maxLength={400}
                        required
                      />
                    </label>
                  )}
                  <button className="primary wide" disabled={busy}>
                    {busy ? "Saving…" : "Confirm action"}
                  </button>
                </form>
              </>
            )}
            {error && (
              <div className="workspace-error" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Metric({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon green">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <p>{hint}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Leaf size={25} />
      <p>{text}</p>
    </div>
  );
}
function CheckItem({
  ok,
  title,
  detail,
}: {
  ok: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className="check-item">
      {ok ? <Check className="credit" size={20} /> : <Clock3 size={20} />}
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}
function MealForm({
  day,
  memberId,
  period,
  disabled,
  manager,
  onSubmit,
}: {
  day: string;
  memberId: string;
  period: Period;
  disabled: boolean;
  manager: boolean;
  onSubmit: (c: Command) => void;
}) {
  const found = period.meals.find(
    (m) => m.date === day && m.memberId === memberId,
  );
  const key = "mk-meal-draft:" + memberId + ":" + day;
  const saved = () => {
    try {
      const d = JSON.parse(sessionStorage.getItem(key) || "null");
      return d &&
        Array.isArray(d.slots) &&
        d.slots.length === 3 &&
        d.slots.every((n: number) => n === 0 || n === 1) &&
        Number.isInteger(d.guests) &&
        d.guests >= 0 &&
        d.guests <= 20 &&
        typeof d.reason === "string"
        ? d
        : null;
    } catch {
      return null;
    }
  };
  const [slots, setSlots] = useState<number[]>(
    () => saved()?.slots || found?.slots || [0, 0, 0],
  );
  const [guests, setGuests] = useState<number>(
    () => saved()?.guests ?? found?.guests ?? 0,
  );
  const [reason, setReason] = useState<string>(() => saved()?.reason || "");
  const [dirty, setDirty] = useState(!!saved());
  useEffect(() => {
    if (dirty)
      try {
        sessionStorage.setItem(key, JSON.stringify({ slots, guests, reason }));
      } catch {}
  }, [slots, guests, reason, dirty, key]);
  return (
    <form
      className="workspace-meal-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          type: "meal",
          month: period.month,
          date: day,
          memberId,
          slots,
          guests,
          ...(reason ? { reason } : {}),
        });
      }}
    >
      <div className="meal-cards">
        {["Breakfast", "Lunch", "Dinner"].map((slot, i) => (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={!!slots[i]}
            className={"meal-card " + (slots[i] ? "on" : "")}
            key={slot}
            onClick={() => {
              setDirty(true);
              setSlots(slots.map((n, j) => (i === j ? 1 - n : n)));
            }}
          >
            <Utensils size={21} />
            <span className="meal-title">{slot}</span>
            <span className="meal-state">
              {slots[i] ? "Meal on" : "Meal off"}
              <span className="switch">
                <i />
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="inline-fields">
        <label>
          Guest meals
          <input
            name="guests"
            type="number"
            min="0"
            max="20"
            value={guests}
            onChange={(e) => {
              setDirty(true);
              setGuests(Number(e.target.value));
            }}
          />
        </label>
        {manager && (
          <label>
            Correction reason (required after cutoff)
            <input
              name="reason"
              minLength={3}
              maxLength={400}
              value={reason}
              onChange={(e) => {
                setDirty(true);
                setReason(e.target.value);
              }}
              placeholder="e.g. Confirmed with the member"
            />
          </label>
        )}
        <button className="primary" disabled={disabled}>
          Confirm daily meals
        </button>
      </div>
      <p className="form-hint">
        {dirty
          ? "Local draft saved for this tab. "
          : "Changes are drafts until confirmed. "}
        Missing is not the same as off.{" "}
        <button
          type="button"
          className="text-button"
          onClick={() => {
            sessionStorage.removeItem(key);
            setDirty(false);
            setSlots(found?.slots || [0, 0, 0]);
            setGuests(found?.guests || 0);
            setReason("");
          }}
        >
          Discard local draft
        </button>
      </p>
    </form>
  );
}

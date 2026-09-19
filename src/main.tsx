import React, { useState, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Utensils,
  ShoppingBasket,
  Wallet,
  Users,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Bell,
  HelpCircle,
  Leaf,
  MoreHorizontal,
  ReceiptText,
  Download,
  ShieldCheck,
  CheckCheck,
  Menu,
  RotateCcw,
  LogOut,
  Coffee,
  Sun,
  Moon,
  Info,
  BookOpen,
  CircleCheck,
  Clock3,
} from "lucide-react";
import "./style.css";
import { people, initial, type Expense, type Data } from "./demo/data";
import { key, readData, calculate, money } from "./demo/adapter";
import { parseTaka } from "./domain/accounting";
const WorkspaceApp = lazy(() => import("./workspace/WorkspaceApp"));
const nav = [
  { name: "Overview", bn: "ওভারভিউ", icon: LayoutDashboard },
  { name: "Meals", bn: "মিল", icon: Utensils },
  { name: "Bazar", bn: "বাজার", icon: ShoppingBasket },
  { name: "Accounts", bn: "হিসাব", icon: Wallet },
  { name: "Members", bn: "সদস্য", icon: Users },
];
function App() {
  const [data, setData] = useState<Data>(readData);
  const [page, setPage] = useState("Overview");
  const [bn, setBn] = useState(false);
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState("rafi");
  const [filter, setFilter] = useState("All spending");
  const [saved, setSaved] = useState(true);
  const c = calculate(data);
  const t = (en: string, bangla: string) => (bn ? bangla : en);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [data]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    document.documentElement.lang = bn ? "bn" : "en";
  }, [bn]);
  useEffect(() => {
    if (!modal) return;
    const old = document.activeElement as HTMLElement;
    const box = document.querySelector<HTMLElement>(".modal");
    box?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal("");
      if (e.key === "Tab" && box) {
        const list = Array.from(
          box.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,[tabindex="0"]',
          ),
        ).filter((x) => !x.hasAttribute("disabled"));
        if (!list.length) return;
        const first = list[0],
          last = list[list.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === box)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === box)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      old?.focus();
    };
  }, [modal]);
  const go = (name: string) => {
    setPage(name);
    setMobile(false);
  };
  const toggle = (id: string, i: number) =>
    setData((d) => ({
      ...d,
      meals: {
        ...d.meals,
        [id]: d.meals[id].map((n, j) => (j === i ? 1 - n : n)),
      },
    }));
  function exportCsv() {
    const rows = [
      [
        "Member",
        "Meal units",
        "Deposit BDT",
        "Personal bazar BDT",
        "Allocated food BDT",
        "Credit BDT",
      ],
      ...people.map((p, i) => [
        p.name,
        c.units[i],
        p.deposit,
        c.personal[i] / 100,
        c.shares[i] / 100,
        c.balances[i] / 100,
      ]),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((r) => r.join(",")).join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    a.download = "MealKhata-demo-September-2026.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("Sample statement exported");
  }
  function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!String(f.get("title")).trim()) {
      setToast("Please describe your purchase");
      return;
    }
    if (data.expenses.length >= 2000) {
      setToast("This sample month has reached its 2,000 expense limit");
      return;
    }
    let amount: number;
    try {
      amount = parseTaka(String(f.get("amount"))) / 100;
    } catch {
      setToast("Enter a valid amount with up to two decimal places");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      setToast("Enter an amount between ৳0.01 and ৳100,000");
      return;
    }
    const date = String(f.get("date"));
    if (!date.startsWith("2026-09-")) {
      setToast("This prototype is limited to September 2026");
      return;
    }
    setData((d) => ({
      ...d,
      expenses: [
        ...d.expenses,
        {
          id: crypto.randomUUID(),
          title: String(f.get("title")).trim(),
          amount: Math.round(amount * 100),
          payer: String(f.get("payer")),
          fund: f.get("fund") as "fund" | "personal",
          date,
          category: "Groceries",
        },
      ],
    }));
    setModal("");
    setToast("Bazar added to your local demo");
  }
  const today = data.meals.rafi.reduce((a, b) => a + b, 0);
  const memberIndex = people.findIndex((p) => p.id === selected);
  const expenseList = [...data.expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(
      (e) =>
        filter === "All spending" ||
        (filter === "Mess fund" ? e.fund === "fund" : e.fund === "personal"),
    );
  return (
    <div className="app">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-icon">
            <Utensils size={23} />
          </span>
          <span>
            MealKhata<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <div className="house">B</div>
          <div>
            <strong>Bachelor’s Nest</strong>
            <small>Dhaka · 6 members</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">YOUR MESS, ORGANIZED</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              aria-label={bn ? n.bn : n.name}
              className={page === n.name ? "nav-item active" : "nav-item"}
              onClick={() => go(n.name)}
            >
              <n.icon size={19} />
              {bn ? n.bn : n.name}
              {n.name === "Meals" && <span className="nav-badge">Today</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="good-card">
            <span className="tiny-leaf">
              <Leaf size={19} />
            </span>
            <strong>A little less mess.</strong>
            <p>
              A little more peace of mind.
              <br />
              Your khata, together.
            </p>
            <button onClick={() => setModal("guide")}>
              Get to know MealKhata <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="nav-item" onClick={() => setModal("settings")}>
            <Settings size={18} />
            Mess settings
          </button>
          <button className="nav-item" onClick={() => setModal("guide")}>
            <HelpCircle size={18} />
            Help & getting started
          </button>
          <div className="profile">
            <span className="avatar" style={{ background: "#e8dacc" }}>
              RA
            </span>
            <div>
              <strong>Rafi Ahmed</strong>
              <small>Mess manager · Demo</small>
            </div>
            <button
              className="icon-btn"
              aria-label="About this demo account"
              onClick={() => setModal("demo")}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span>Your workspace</span>
            <ChevronRight size={13} />
            <strong>
              {t(page, nav.find((n) => n.name === page)?.bn || page)}
            </strong>
          </div>
          <div className="top-actions">
            <span className="local-status">
              <i />
              {saved
                ? "Saved on this device"
                : "Not saved — storage unavailable"}
            </span>
            <button className="language" onClick={() => setBn(!bn)}>
              {bn ? "English" : "বাংলা"}
              <span>⇄</span>
            </button>
            <span className="divider" />
            <button
              className="icon-btn bell"
              aria-label="Open notifications"
              onClick={() => setModal("notifications")}
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="avatar top-avatar">RA</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {t(
                  "A SHARED HOME. A CLEAR KHATA.",
                  "একসাথে থাকা। পরিষ্কার হিসাব।",
                )}
              </div>
              <h1>
                {page === "Overview"
                  ? t("A little less mess, Rafi.", "হিসাব থাকুক সহজ, রাফি।")
                  : t(page, nav.find((n) => n.name === page)?.bn || page)}{" "}
                <span className="greeting">
                  {page === "Overview" ? "✳" : ""}
                </span>
              </h1>
              <p>
                {t(
                  "Good food, fair shares. Here’s how your mess is doing.",
                  "ভালো খাবার, ন্যায্য হিসাব। দেখে নিন আপনার মেসের অবস্থা।",
                )}
              </p>
            </div>
            <button className="month-button" onClick={() => setModal("month")}>
              <span className="calendar-icon">SEP</span> September 2026{" "}
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="demo-strip">
            <span>
              <span className="demo-pill">INTERACTIVE DEMO</span>
              <a
                href="/workspace"
                style={{ fontWeight: 700, textDecoration: "underline" }}
              >
                Open database workspace ↗
              </a>{" "}
              {t(
                "A safe space to try things. Sample data, saved only in this browser.",
                "নমুনা তথ্য দিয়ে চেষ্টা করুন। শুধু এই ব্রাউজারেই সংরক্ষিত।",
              )}
            </span>
            <button onClick={() => setModal("reset")}>
              <RotateCcw size={13} /> Reset demo
            </button>
          </div>
          {c.cash < 0 && (
            <div className="info-note" role="status">
              <Info size={17} />
              Calculated fund cash is negative. Check funding sources and
              unrecorded deposits before closing or settling. This is not a
              verified cash balance.
            </div>
          )}
          {page === "Overview" && (
            <>
              <section className="stats">
                <Stat
                  label={t("Total bazar", "মোট বাজার")}
                  value={money(c.total)}
                  icon={<ShoppingBasket size={18} />}
                  detail="Approved food expenses"
                  tone="peach"
                />
                <Stat
                  label={t("Total meals", "মোট মিল")}
                  value={c.count.toString()}
                  icon={<Utensils size={18} />}
                  detail="Across 6 members this month"
                  tone="green"
                />
                <Stat
                  label={t("Meal rate", "মিল রেট")}
                  value={money(c.rate)}
                  icon={<ReceiptText size={18} />}
                  detail="Per meal · updates as you go"
                  badge="Provisional"
                  tone="purple"
                />
                <Stat
                  label={t("Mess fund balance", "মেস ফান্ড")}
                  value={money(c.cash)}
                  icon={<Wallet size={18} />}
                  detail="Deposits minus fund spending"
                  tone="yellow"
                />
              </section>
              <div className="dashboard-grid">
                <div className="left-column">
                  <section className="panel today-panel">
                    <div className="section-heading">
                      <div>
                        <h2>
                          {t("Your meals today", "আজকের মিল")}{" "}
                          <span className="soft-pill">19 SEP · SAT</span>
                        </h2>
                        <p>
                          {t(
                            "Staying in? Let your mess know what’s cooking.",
                            "আজ থাকছেন? আপনার মিলের তথ্য দিন।",
                          )}
                        </p>
                      </div>
                      <span className="round-icon">
                        <Utensils size={19} />
                      </span>
                    </div>
                    <div className="meal-cards">
                      {[
                        {
                          name: t("Breakfast", "সকালের খাবার"),
                          time: "Morning",
                          Icon: Coffee,
                        },
                        {
                          name: t("Lunch", "দুপুরের খাবার"),
                          time: "Afternoon",
                          Icon: Sun,
                        },
                        {
                          name: t("Dinner", "রাতের খাবার"),
                          time: "Evening",
                          Icon: Moon,
                        },
                      ].map((m, i) => (
                        <button
                          key={i}
                          className={
                            "meal-card " + (data.meals.rafi[i] ? "on" : "")
                          }
                          onClick={() => toggle("rafi", i)}
                          aria-label={
                            "Toggle " + ["breakfast", "lunch", "dinner"][i]
                          }
                          aria-pressed={!!data.meals.rafi[i]}
                        >
                          <m.Icon size={23} />
                          <span className="meal-title">{m.name}</span>
                          <span className="meal-time">{m.time}</span>
                          <span className="meal-state">
                            {data.meals.rafi[i] ? (
                              <>
                                <span className="mini-check">
                                  <Check size={10} />
                                </span>{" "}
                                Meal on
                              </>
                            ) : (
                              <>Meal off</>
                            )}
                            <span className="switch">
                              <i />
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="meal-footer">
                      <span>
                        <CircleCheck size={15} />
                        {today} meals on today{" "}
                        <span className="subtle">· Tap a card to change</span>
                      </span>
                      <button onClick={() => setModal("guest")}>
                        <Plus size={14} /> Add guest meal
                        {data.guests.rafi ? ` (${data.guests.rafi})` : ""}
                      </button>
                    </div>
                  </section>
                  <section className="panel bazar-panel">
                    <div className="section-heading">
                      <div>
                        <h2>{t("Recent bazar", "সাম্প্রতিক বাজার")}</h2>
                        <p>The little things that keep your kitchen going.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => go("Bazar")}
                      >
                        View all <ArrowRight size={14} />
                      </button>
                    </div>
                    <ExpenseTable
                      expenses={expenseList.slice(0, 4)}
                      onClick={(id) => setModal("expense:" + id)}
                    />
                    <button className="add-row" onClick={() => setModal("add")}>
                      <Plus size={16} /> Add a bazar expense
                    </button>
                  </section>
                </div>
                <div className="right-column">
                  <section className="balance-card">
                    <div className="balance-top">
                      <span>YOUR MONTH AT A GLANCE</span>
                      <span className="balance-symbol">
                        <Wallet size={18} />
                      </span>
                    </div>
                    <div className="balance-label">
                      {c.balances[0] >= 0
                        ? "You have credit"
                        : "Your amount due"}
                    </div>
                    <div className="big-balance">
                      {money(Math.abs(c.balances[0]))}
                      <ArrowUpRight size={27} />
                    </div>
                    <p>
                      {c.balances[0] >= 0
                        ? "A little ahead. You’re all good for now."
                        : "Your current share exceeds your contributions."}
                    </p>
                    <div className="balance-breakdown">
                      <div>
                        <span>Your deposits</span>
                        <strong>{money(people[0].deposit * 100)}</strong>
                      </div>
                      <div>
                        <span>Paid from your pocket</span>
                        <strong>+ {money(c.personal[0])}</strong>
                      </div>
                      <div>
                        <span>Your meal cost · {c.units[0]} meals</span>
                        <strong>− {money(c.shares[0])}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelected("rafi");
                        setModal("bill");
                      }}
                    >
                      Explain my bill <ArrowRight size={16} />
                    </button>
                    <small>
                      <ShieldCheck size={13} />
                      Every taka, accounted for. Provisional.
                    </small>
                  </section>
                  <section className="panel quick-panel">
                    <h2>{t("A few handy shortcuts", "কিছু দরকারি কাজ")}</h2>
                    <button onClick={() => setModal("add")}>
                      <span className="shortcut-icon orange">
                        <ShoppingBasket size={18} />
                      </span>
                      <span>
                        <strong>Add bazar</strong>
                        <small>Log today’s kitchen run</small>
                      </span>
                      <Plus size={17} />
                    </button>
                    <button onClick={() => go("Accounts")}>
                      <span className="shortcut-icon green">
                        <Wallet size={18} />
                      </span>
                      <span>
                        <strong>View deposits</strong>
                        <small>See who has contributed</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                    <button onClick={() => setModal("invite")}>
                      <span className="shortcut-icon purple">
                        <Users size={18} />
                      </span>
                      <span>
                        <strong>Invite a messmate</strong>
                        <small>Good things are shared</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  </section>
                </div>
              </div>
              <section className="trust-strip">
                <span className="trust-icon">
                  <ShieldCheck size={24} />
                </span>
                <div>
                  <strong>Same numbers. For everyone.</strong>
                  <p>
                    Shared records, clear calculations, and no surprises at
                    month-end.
                  </p>
                </div>
                <button onClick={() => setModal("close")}>
                  See the month-close checklist <ArrowRight size={15} />
                </button>
              </section>
            </>
          )}
          {page === "Meals" && (
            <section className="panel full-panel">
              <div className="section-heading">
                <div>
                  <h2>Today’s meal khata</h2>
                  <p>
                    September 19, 2026 · Sample manager view · each slot = 1
                    meal
                  </p>
                </div>
                <span className="soft-pill">LOCAL DEMO</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>MEMBER</th>
                      <th>BREAKFAST</th>
                      <th>LUNCH</th>
                      <th>DINNER</th>
                      <th>GUEST MEALS</th>
                      <th>MONTH TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p, i) => (
                      <tr key={p.id}>
                        <td>
                          <Member person={p} />
                        </td>
                        {data.meals[p.id].map((n, j) => (
                          <td key={j}>
                            <button
                              className={"meal-toggle " + (n ? "selected" : "")}
                              onClick={() => toggle(p.id, j)}
                              aria-label={`${p.name} ${["breakfast", "lunch", "dinner"][j]}`}
                              aria-pressed={!!n}
                            >
                              {n ? (
                                <>
                                  <Check size={14} /> On
                                </>
                              ) : (
                                "Off"
                              )}
                            </button>
                          </td>
                        ))}
                        <td>{data.guests[p.id] || 0}</td>
                        <td>
                          <strong>{c.units[i]}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="info-note">
                <Info size={17} />
                <span>
                  Earlier meals are seeded totals. This prototype edits
                  September 19 only. Production will add date selection, cutoffs
                  and confirmation states.
                </span>
              </div>
            </section>
          )}
          {page === "Bazar" && (
            <section className="panel full-panel">
              <div className="section-heading">
                <div>
                  <h2>Your shared shopping ledger</h2>
                  <p>
                    {data.expenses.length} sample expenses · food costs only
                  </p>
                </div>
                <button className="primary" onClick={() => setModal("add")}>
                  <Plus size={17} /> Add bazar
                </button>
              </div>
              <div className="filter-row">
                {["All spending", "Mess fund", "Personal money"].map((f) => (
                  <button
                    key={f}
                    className={filter === f ? "chosen" : ""}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <ExpenseTable
                expenses={expenseList}
                onClick={(id) => setModal("expense:" + id)}
              />
              <div className="info-note">
                <ShieldCheck size={17} /> Personal spending gives the payer
                credit. Fund spending does not.
              </div>
            </section>
          )}
          {page === "Accounts" && (
            <>
              <section className="stats account-stats">
                <Stat
                  label="Total deposits"
                  value={money(people.reduce((a, p) => a + p.deposit * 100, 0))}
                  detail="Seeded confirmed contributions"
                  tone="green"
                  icon={<Wallet size={19} />}
                />
                <Stat
                  label="Meal pool"
                  value={money(c.total)}
                  detail="All recorded food expenses"
                  tone="peach"
                  icon={<ShoppingBasket size={19} />}
                />
                <Stat
                  label="Available fund"
                  value={money(c.cash)}
                  detail="Not a bank or mobile wallet balance"
                  tone="purple"
                  icon={<ShieldCheck size={19} />}
                />
              </section>
              <section className="panel full-panel">
                <div className="section-heading">
                  <div>
                    <h2>One khata. No guesswork.</h2>
                    <p>
                      Provisional September statements · tap a member to see
                      their calculation
                    </p>
                  </div>
                  <button className="outline" onClick={exportCsv}>
                    <Download size={16} /> Export CSV
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>MEMBER</th>
                        <th>MEALS</th>
                        <th>DEPOSIT</th>
                        <th>PERSONAL BAZAR</th>
                        <th>MEAL COST</th>
                        <th>POSITION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((p, i) => (
                        <tr key={p.id}>
                          <td>
                            <button
                              className="member-button"
                              onClick={() => {
                                setSelected(p.id);
                                setModal("bill");
                              }}
                            >
                              <Member person={p} />
                            </button>
                          </td>
                          <td>{c.units[i]}</td>
                          <td>{money(p.deposit * 100)}</td>
                          <td>{money(c.personal[i])}</td>
                          <td>{money(c.shares[i])}</td>
                          <td>
                            <span
                              className={c.balances[i] >= 0 ? "credit" : "due"}
                            >
                              {money(Math.abs(c.balances[i]))}{" "}
                              {c.balances[i] >= 0 ? "credit" : "due"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="reconciled">
                  <ShieldCheck size={19} />
                  <span>
                    <strong>Numbers reconcile to the paisa.</strong> Member
                    positions total{" "}
                    {money(c.balances.reduce((a, b) => a + b, 0))} = mess fund{" "}
                    {money(c.cash)}.
                  </span>
                </div>
              </section>
              <section className="trust-strip">
                <span className="trust-icon">
                  <BookOpen size={23} />
                </span>
                <div>
                  <strong>Ready for month-end?</strong>
                  <p>
                    Review the checklist before turning estimates into final
                    statements.
                  </p>
                </div>
                <button onClick={() => setModal("close")}>
                  Review checklist <ArrowRight size={16} />
                </button>
                <button onClick={() => setModal("settlement")}>
                  Preview settlement <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
          {page === "Members" && (
            <section className="panel full-panel">
              <div className="section-heading">
                <div>
                  <h2>The people around your table</h2>
                  <p>Bachelor’s Nest · 6 sample members</p>
                </div>
                <button className="primary" onClick={() => setModal("invite")}>
                  <Plus size={16} /> Invite member
                </button>
              </div>
              <div className="members-grid">
                {people.map((p, i) => (
                  <div className="member-tile" key={p.id}>
                    <span
                      className="avatar large"
                      style={{ background: p.color }}
                    >
                      {p.initial}
                    </span>
                    <h3>{p.name}</h3>
                    <span className="soft-pill">
                      {i === 0 ? "Manager · You" : "Member"}
                    </span>
                    <div>
                      <span>{c.units[i]} meals</span>
                      <button
                        onClick={() => {
                          setSelected(p.id);
                          setModal("bill");
                        }}
                      >
                        View statement <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <footer>
            <span className="footer-brand">
              <Utensils size={13} />
              MealKhata
            </span>
            <span>Made for shared tables, not shared worries.</span>
            <span>
              Prototype v0.2 <i /> September 2026
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal("");
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            tabIndex={-1}
          >
            <button
              className="modal-close icon-btn"
              aria-label="Close dialog"
              onClick={() => setModal("")}
            >
              <X size={20} />
            </button>
            {modal === "add" ? (
              <>
                <span className="modal-mark">
                  <ShoppingBasket />
                </span>
                <h2 id="modal-title">A little kitchen run?</h2>
                <p>Add a food expense. Your sample ledger updates instantly.</p>
                <form onSubmit={addExpense}>
                  <label>
                    What did you buy?
                    <input
                      name="title"
                      placeholder="e.g. Rice, eggs & fresh vegetables"
                      required
                      maxLength={100}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Amount (৳)
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        max="100000"
                        step="0.01"
                        placeholder="680"
                        required
                      />
                    </label>
                    <label>
                      Date
                      <input
                        name="date"
                        type="date"
                        defaultValue="2026-09-19"
                        min="2026-09-01"
                        max="2026-09-30"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Who made the purchase?
                    <select name="payer">
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Where did the money come from?
                    <select name="fund">
                      <option value="fund">
                        Mess fund — no personal credit
                      </option>
                      <option value="personal">
                        Personal pocket — credit the payer
                      </option>
                    </select>
                  </label>
                  <div className="info-note">
                    <Info size={16} />
                    This demo adds approved food expenses only. Real approval
                    workflows come later.
                  </div>
                  <button className="primary wide" type="submit">
                    Add bazar expense <ArrowRight size={17} />
                  </button>
                </form>
              </>
            ) : modal === "bill" ? (
              <>
                <span className="modal-mark">
                  <ReceiptText />
                </span>
                <h2 id="modal-title">Every taka has a story.</h2>
                <p>{people[memberIndex].name} · September 2026 · provisional</p>
                <div className="bill-lines">
                  <div>
                    <span>Confirmed deposits (sample)</span>
                    <strong>{money(people[memberIndex].deposit * 100)}</strong>
                  </div>
                  <div>
                    <span>Personal bazar spending</span>
                    <strong>+ {money(c.personal[memberIndex])}</strong>
                  </div>
                  <div>
                    <span>Allocated food cost</span>
                    <strong>− {money(c.shares[memberIndex])}</strong>
                  </div>
                  <div className="bill-total">
                    <span>
                      {c.balances[memberIndex] >= 0
                        ? "Remaining credit"
                        : "Amount due"}
                    </span>
                    <strong>{money(Math.abs(c.balances[memberIndex]))}</strong>
                  </div>
                </div>
                <div className="formula">
                  <strong>How the food cost is calculated</strong>
                  <p>
                    {money(c.total)} total food × {c.units[memberIndex]} /{" "}
                    {c.count} meals = {money(c.shares[memberIndex])}
                  </p>
                  <small>
                    Shares are allocated in whole paisa; leftover paisa follow
                    largest-remainder rounding. The displayed meal rate is not
                    used to calculate your bill.
                  </small>
                </div>
                <button
                  className="primary wide"
                  onClick={() => {
                    setModal("");
                    go("Accounts");
                  }}
                >
                  See everyone’s statement <ArrowRight size={16} />
                </button>
              </>
            ) : modal === "settlement" ? (
              <>
                <span className="modal-mark">
                  <Wallet />
                </span>
                <h2 id="modal-title">If you settled the sample today.</h2>
                <p>
                  Suggestions only, based on provisional sample entries. This
                  pays out all fund cash rather than carrying it forward. No
                  money is sent or marked as paid.
                </p>
                {c.cash < 0 ? (
                  <div className="info-note">
                    The calculated fund is negative. Correct the funding sources
                    and receipts before suggesting payments.
                  </div>
                ) : (
                  <div className="bill-lines">
                    {c.settlements.map((transfer, i) => (
                      <div key={i}>
                        <span>
                          {transfer.from === "fund"
                            ? "Mess fund"
                            : people.find((p) => p.id === transfer.from)
                                ?.name}{" "}
                          →{" "}
                          {transfer.to === "fund"
                            ? "Mess fund"
                            : people.find((p) => p.id === transfer.to)?.name}
                        </span>
                        <strong>{money(transfer.amount)}</strong>
                      </div>
                    ))}
                    {!c.settlements.length && (
                      <p>All sample positions are already settled.</p>
                    )}
                  </div>
                )}
                <div className="info-note">
                  <Info size={17} />
                  The mess fund is included as a participant. A manager holding
                  shared cash is not personally owed that money.
                </div>
                <button className="primary wide" onClick={() => setModal("")}>
                  Back to the khata
                </button>
              </>
            ) : modal === "guest" ? (
              <>
                <span className="modal-mark">
                  <Users />
                </span>
                <h2 id="modal-title">There’s room at the table.</h2>
                <p>
                  Guest meals count toward Rafi’s September 19 total. One guest
                  meal = one meal unit.
                </p>
                <div className="guest-counter">
                  <button
                    className="outline"
                    disabled={!data.guests.rafi}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        guests: {
                          ...d.guests,
                          rafi: Math.max(0, (d.guests.rafi || 0) - 1),
                        },
                      }))
                    }
                  >
                    −
                  </button>
                  <strong>{data.guests.rafi || 0}</strong>
                  <button
                    className="outline"
                    disabled={(data.guests.rafi || 0) >= 20}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        guests: { ...d.guests, rafi: (d.guests.rafi || 0) + 1 },
                      }))
                    }
                  >
                    +
                  </button>
                </div>
                <button className="primary wide" onClick={() => setModal("")}>
                  Done <Check size={17} />
                </button>
              </>
            ) : modal === "reset" ? (
              <>
                <span className="modal-mark">
                  <RotateCcw />
                </span>
                <h2 id="modal-title">Start with a clean khata?</h2>
                <p>
                  This resets only the sample data in this browser. Your added
                  expenses and meal changes will be removed.
                </p>
                <button
                  className="primary wide"
                  onClick={() => {
                    setData(structuredClone(initial));
                    setModal("");
                    setToast("Demo restored to its original sample data");
                  }}
                >
                  Reset sample data
                </button>
                <button className="outline wide" onClick={() => setModal("")}>
                  Keep my changes
                </button>
              </>
            ) : modal === "close" ? (
              <>
                <span className="modal-mark">
                  <CheckCheck />
                </span>
                <h2 id="modal-title">A calm month-end starts here.</h2>
                <p>
                  Preview of the production checklist. Closing is not enabled in
                  this interface prototype.
                </p>
                <div className="checklist">
                  {[
                    [
                      "pass",
                      "Check the arithmetic",
                      `Member positions equal ${money(c.cash)} of fund cash.`,
                    ],
                    [
                      "pending",
                      "Confirm every meal",
                      "Resolve missing entries and cutoff corrections.",
                    ],
                    [
                      "pending",
                      "Review expenses & deposits",
                      "Approve submissions and reconcile actual cash.",
                    ],
                    [
                      "pending",
                      "Resolve open questions",
                      "Members verify their statements before finalizing.",
                    ],
                    [
                      "pending",
                      "Lock a versioned statement",
                      "The backend will preserve a closing snapshot.",
                    ],
                  ].map(([s, title, desc]) => (
                    <div key={title}>
                      {s === "pass" ? (
                        <CircleCheck className="credit" size={21} />
                      ) : (
                        <Clock3 size={21} />
                      )}
                      <span>
                        <strong>{title}</strong>
                        <small>{desc}</small>
                      </span>
                    </div>
                  ))}
                </div>
                <button disabled className="primary wide">
                  Month close available in a later component
                </button>
              </>
            ) : modal.startsWith("expense:") ? (
              (() => {
                const e = data.expenses.find(
                  (x) => x.id === modal.split(":")[1],
                )!;
                return (
                  <>
                    <span className="modal-mark">
                      <ShoppingBasket />
                    </span>
                    <h2 id="modal-title">{e.title}</h2>
                    <p>Sample approved expense · {e.date}</p>
                    <div className="bill-lines">
                      <div>
                        <span>Amount</span>
                        <strong>{money(e.amount)}</strong>
                      </div>
                      <div>
                        <span>Purchased by</span>
                        <strong>
                          {people.find((p) => p.id === e.payer)?.name}
                        </strong>
                      </div>
                      <div>
                        <span>Funding source</span>
                        <strong>
                          {e.fund === "fund" ? "Mess fund" : "Personal pocket"}
                        </strong>
                      </div>
                      <div>
                        <span>Pool</span>
                        <strong>Shared food</strong>
                      </div>
                    </div>
                    <div className="info-note">
                      <Info size={17} />
                      {e.fund === "fund"
                        ? "This reduces fund cash. The purchaser receives no personal credit."
                        : "This credits the purchaser, and does not reduce fund cash."}
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <span className="modal-mark">
                  {modal === "invite" ? (
                    <Users />
                  ) : modal === "notifications" ? (
                    <Bell />
                  ) : (
                    <BookOpen />
                  )}
                </span>
                <h2 id="modal-title">
                  {
                    (
                      {
                        invite: "Your people. One shared khata.",
                        guide: "Welcome to your shared khata.",
                        settings: "Simple rules. Fair shares.",
                        month: "One sample month, for now.",
                        notifications: "Nothing needs your attention.",
                        demo: "A preview, not a real account.",
                      } as Record<string, string>
                    )[modal]
                  }
                </h2>
                <p>
                  {
                    (
                      {
                        invite:
                          "Secure invitation links arrive with the membership component. We won’t create a link that pretends to work.",
                        guide:
                          "Try these three steps to explore the interface. All changes stay in this browser.",
                        settings:
                          "These are the sample mess settings. Editing and rule versioning will be added with the backend.",
                        month:
                          "This demo covers September 2026. Month switching, historical statements and carry-forward will be added in later components.",
                        notifications:
                          "This is a local demo. Shared notifications, approval requests and alerts are not connected yet.",
                        demo: "You are viewing seeded data as Rafi, a sample manager. Google sign-in is approved for the pilot, but it is not connected in this prototype.",
                      } as Record<string, string>
                    )[modal]
                  }
                </p>
                {modal === "guide" && (
                  <div className="checklist">
                    {[
                      [
                        "1",
                        "Set your meals",
                        "Tap breakfast, lunch or dinner on the overview.",
                      ],
                      [
                        "2",
                        "Record a bazar run",
                        "Choose personal money or mess fund and see the difference.",
                      ],
                      [
                        "3",
                        "Understand the bill",
                        "Open Accounts and click any member’s name.",
                      ],
                    ].map(([n, title, desc]) => (
                      <div key={n}>
                        <span className="step-num">{n}</span>
                        <span>
                          <strong>{title}</strong>
                          <small>{desc}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {modal === "settings" && (
                  <div className="bill-lines">
                    <div>
                      <span>Business timezone</span>
                      <strong>Asia/Dhaka</strong>
                    </div>
                    <div>
                      <span>Currency</span>
                      <strong>BDT · ৳</strong>
                    </div>
                    <div>
                      <span>Meal weights</span>
                      <strong>1 / 1 / 1</strong>
                    </div>
                    <div>
                      <span>Accounting</span>
                      <strong>Shared food pool</strong>
                    </div>
                  </div>
                )}
                {modal === "invite" && (
                  <div className="info-note">
                    <ShieldCheck size={18} />
                    Planned flow: Google sign-in → request to join → manager
                    approval → shared ledger access.
                  </div>
                )}
                <button className="primary wide" onClick={() => setModal("")}>
                  Got it <Check size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
  tone,
  badge,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
  badge?: string;
}) {
  return (
    <section className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className={"stat-icon " + tone}>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        {badge && <span className="provisional">{badge}</span>}
      </div>
      <p>{detail}</p>
    </section>
  );
}
function Member({ person: p }: { person: (typeof people)[0] }) {
  return (
    <span className="member">
      <span className="avatar" style={{ background: p.color }}>
        {p.initial}
      </span>
      <span>
        {p.name}
        {p.id === "rafi" && <small>you</small>}
      </span>
    </span>
  );
}
function ExpenseTable({
  expenses,
  onClick,
}: {
  expenses: Expense[];
  onClick: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="expense-table">
        <thead>
          <tr>
            <th>EXPENSE</th>
            <th>PAID BY</th>
            <th>AMOUNT</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>
                <button className="expense-name" onClick={() => onClick(e.id)}>
                  <span className="basket-small">
                    <ShoppingBasket size={17} />
                  </span>
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {new Date(e.date + "T12:00:00").toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "short" },
                      )}{" "}
                      <span>·</span>{" "}
                      {e.fund === "fund" ? "Mess fund" : "Personal pocket"}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <span className="payer">
                  <span
                    className="avatar tiny"
                    style={{
                      background: people.find((p) => p.id === e.payer)?.color,
                    }}
                  >
                    {people.find((p) => p.id === e.payer)?.initial}
                  </span>
                  {people.find((p) => p.id === e.payer)?.name.split(" ")[0]}
                </span>
              </td>
              <td>
                <strong>{money(e.amount)}</strong>
              </td>
              <td>
                <button
                  className="icon-btn"
                  aria-label={"View " + e.title}
                  onClick={() => onClick(e.id)}
                >
                  <ChevronRight size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  location.pathname.startsWith("/workspace") ? (
    <Suspense
      fallback={<p style={{ padding: 40 }}>Opening MealKhata workspace…</p>}
    >
      <WorkspaceApp />
    </Suspense>
  ) : (
    <App />
  ),
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}

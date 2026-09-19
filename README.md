# MealKhata · v0.3 local pilot

A mobile-friendly meal, bazar and shared-money khata for small messes.

**Working locally, not production-final.** Start with [the handover guide](docs/HANDOVER.md). Google sign-in and production deployment still require owner configuration; complete Bangla coverage and real-user validation remain release gates.

## Open the app

- `/` — original interactive sample demo (browser-only records).
- `/workspace` — new database-backed application. Choose **Open database workspace** in the demo banner.

The sandbox account option is for local development only. Use sample data. It creates an isolated unverified identity, not a real Google account. Records survive refresh in the local D1 database. A new sandbox account does not recover an old one after sign-out.

## Run from zero

Install **Node.js 22 LTS**, npm and Python 3 (for schema tests).

```sh
npm ci
npm run db:migrate
```

Terminal 1:
```sh
npm run dev:api
```

Terminal 2:
```sh
npm run dev
```

Open the Vite address and choose `/workspace`. In the hosted sandbox, use the live preview instead of your computer's localhost. The browser sends same-origin `/api` requests; Vite proxies them to port 8787. The development Node binary dependency supports this workspace's older system Node, but Node 22 is recommended on your computer.

## Learn the flow

Create mess → add or invite members → confirm meals → submit bazar → approve expenses → report payment → recipient confirms → review bills/questions → reconcile actual cash → close → settle or carry forward.

The interface and API use `src/domain/accounting.ts`; permissions and state transitions live in `src/domain/workspace.ts`. Server saves use revision checks and operation IDs, so a stale browser cannot silently overwrite another member's work.

## Test and build

```sh
npx playwright install chromium
# Linux, if needed: npx playwright install-deps chromium
npm run build
npm test
```

`npm test` runs unit tests, SQLite tests and browser tests. Playwright starts the local API/frontend if they are not running.

With the API and frontend running:
```sh
npm run test:integration
npm run test:smoke
npm run test:a11y
```

To test the production PWA:
```sh
npm run build
npm exec vite preview -- --host 0.0.0.0 --port 4173
# In a second terminal, with the API running:
npm run test:pwa
```

No private API responses are cached by the service worker. Optional offline financial snapshots are stored in IndexedDB only after explicit device consent, expire from the app's offline view after seven days, and clear on sign-out. This is not application-level encryption or a shared backup. Meal drafts use sessionStorage and must be explicitly confirmed online.

## Project map

| Path | Purpose |
|---|---|
| `src/main.tsx`, `src/demo/` | Original sample prototype |
| `src/workspace/` | Database-backed screens, client API, offline storage |
| `src/domain/accounting.ts` | Integer-paisa allocation, ledger and settlements |
| `src/domain/workspace.ts` | Validated workflow commands and role rules |
| `server/auth.ts` | Google OAuth, sessions, CSRF/origin checks, rate buckets |
| `server/workspaces.ts` | Authorized reads, conditional writes, invites, audit/export |
| `migrations/` | D1 schema and trigger migrations |
| `unit-tests/`, `tests/`, `scripts/` | Unit, browser, integration, restore and accessibility checks |
| `public/sw.js`, `scripts/build-sw.mjs` | Public-only production PWA shell/cache manifest |
| `docs/HANDOVER.md` | Walkthrough, implemented scope and release gates |
| `docs/DEPLOYMENT.md` | Owner account setup, secrets, deployment and recovery |
| `docs/ADR-002.md` | Bounded aggregate architecture and trade-offs |
| `docs/TEST-REPORT.md` | Actual results and limitations |

## Important limits

No money is processed or verified with banks/bKash/Nagad. Payment method names are manual labels. Reports reflect entered/approved records. Sandbox identities, original browser demo and local databases are unsuitable for real financial reliance.

The local workspace uses bounded D1 aggregates with explicit pilot limits; it is not an unlimited-scale hosted service. Google configuration, real-device/pilot QA, complete Bangla localization, production limits and privacy/contact policies must be finished before launch. See the handover for a complete, honest backlog.

Historical lesson documents describe earlier milestones, not current limitations. Current status is v0.3 in `HANDOVER.md` and `PROJECT-STATUS.md`.

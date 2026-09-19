# Lesson 2 — The engine behind your khata

**MealKhata v0.2 · Design retained · Accounting and local backend foundation**

## What changed on screen?

The approved green/cream design is unchanged. Open **Accounts → Preview settlement** for a new sample transfer list. It includes the mess fund, not just member-to-member payments. It does not send money, confirm payments or close a month.

There is also a warning if the calculated fund becomes negative. That usually means the funding source or a deposit needs checking; the app must not pretend negative cash is normal cash on hand.

## The lesson: three separate jobs

| Part | Plain-English job | Code |
|---|---|---|
| Interface | Show buttons, entries and statements | `src/main.tsx` |
| Accounting engine | Validate numbers and calculate fair shares | `src/domain/accounting.ts` |
| Backend | Eventually authorize and store shared records | `server/app.ts`, `migrations/` |

The sample interface now uses the extracted accounting engine. The Worker API imports that same engine. However, **the interface still saves sample data in this browser**, not in the database. Real shared writes must wait for authentication and authorization.

## Why store paisa instead of taka decimals?

Computers do not represent every decimal exactly. We store ৳10.25 as the integer **1,025 paisa**. Half a meal is **50 meal units**, and one meal is **100 units**. For proportional calculations, `BigInt` avoids overflowing intermediate multiplications.

If ৳100 must be shared equally by three people, the charges cannot all be exactly ৳33.33: that leaves one paisa. Our allocation gives one person ৳33.34 and the other two ৳33.33. A stable member-ID rule resolves ties so the result does not change when the table is sorted.

## Personal pocket versus mess fund

Example:
- A deposits ৳1,000 into the fund.
- B spends ৳600 personally on food.
- Another ৳300 of food is paid from the fund.
- A and B eat equal shares.

Each member's charge is ৳450. A has ৳550 credit; B has ৳150 credit. The fund contains ৳700. The check is:

**৳550 + ৳150 = ৳700**

Returning ৳550 to A and ৳150 to B clears the accounts. The fund-funded purchase does not give its shopper personal credit.

## Tests are executable questions

- Does every allocated paisa add back up to the original expense?
- Does personal spending leave fund cash unchanged?
- Do unconfirmed payments stay out of official totals?
- Do refunds reverse the correct kind of spending?
- Are opening balances actually balanced?
- Can a member from mess B be used in a meal entry for mess A?
- Can a closed period's meals be changed?
- Does the old interface still work after the code is reorganized?

Current final checks: **42 unit/API tests + 8 SQLite schema tests + 9 browser tests passed**. The unit tests include 2,000 generated allocation/settlement cases. A separate actual Worker/local D1 smoke test passed through the frontend API proxy.

An initial refund test found `-0` versus `0`. The engine now normalizes that case. This is why we test before adding real users.

## What the engine supports now

Integer money parsing, Bengali numerals at parser level, weighted units, exact allocation, food refunds, explicit custom utility splits, pending/approved expenses, confirmed/unconfirmed transfers, personal/fund spending, opening balances, reimbursements, peer transfers and settlement suggestions including the fund.

Not all of these have interface forms yet. Refund provenance, payment confirmation permissions, immutable posting IDs across requests, final close/reopen state and database transactions belong to subsequent workflow components. The engine is not a payment verification service.

## What the local database proves—and what it doesn't

The initial schema defines users, messes, memberships, periods, meals, operation keys and audit events. Composite foreign keys prevent a record referring to a member in a different mess. Triggers reject edits to closed-period meals and changes to audit events.

Eight SQLite tests check these constraints, including a rollback example. The actual local D1 smoke test confirms the migration and schema query work. It does **not** yet prove every transaction under production D1 concurrency. Database administrators can change schema/triggers; this is not cryptographically tamper-proof storage.

## Run it yourself

Use **Node.js 22 LTS** and Python 3 for schema checks. The project also pins a development Node 22 binary for this workspace's older system Node.

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

Checks:
```sh
npm run build
npm test
npm run test:smoke
```

`npm test` starts the frontend automatically when needed. The smoke test requires both frontend (5173) and API (8787). First-time Playwright setup: `npx playwright install chromium`; Linux may also need `npx playwright install-deps chromium`.

The browser calls `/api/...`; Vite forwards that to the local Worker. Browser code never uses localhost to reach the server in a remote preview.

## Google sign-in is next—not connected yet

We will add provider identity verification, secure sessions, role checks, mess creation and approved invitations before enabling real record writes. You will own the Google/Cloudflare accounts. OAuth secrets must go in local secret configuration, never in chat or frontend code.

No Cloudflare production database, Google client credentials or paid services were created in this step. The current Wrangler configuration uses a placeholder database ID and is for local development only. Do not deploy it as a production service.

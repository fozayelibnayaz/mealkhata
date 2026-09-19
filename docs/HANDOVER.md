# MealKhata v0.3 — local pilot handover

## What you can use now

Open the live **MealKhata — interactive preview**. In the sample-demo banner, choose **Open database workspace**.

1. Enter a sandbox name and create an isolated test account.
2. Create your mess and select its first month.
3. Add roster members, or create an invitation link/QR for another signed-in sandbox account.
4. Set opening balances before recording the first transaction if moving from an old khata.
5. Confirm daily meals. Use a correction reason after the cutoff; missing entries are not silently zero.
6. Submit bazar, then explicitly approve it. Choose personal pocket versus mess fund correctly.
7. Report deposits/payments; the recipient confirms receipt. The manager confirms payments into the mess fund, not payments received by other members.
8. Read each bill, raise questions and inspect Activity.
9. In Reports, resolve missing entries/pending records/questions, count actual cash and close the month.
10. Download statements or carry live balances into the next month. Prior months become read-only after carry-forward.

**Use sample information only in this sandbox.** Sandbox identity is intentionally not verified; signing out and creating another sandbox account makes a new identity, not a recovery of the old one. Google sign-in code exists but needs owner configuration for real identities.

## Implemented workflows

| Area | Working implementation |
|---|---|
| Workspace | Persistent local D1 records; sessions; create/select mess |
| Membership | Expiring/revocable link + QR; join request; approval; roster claim; manager handover; settled departure |
| Meals | Three slots, configurable weights, guest meals, cutoff/reason checks, away dates, explicit missing-entry resolution |
| Money | Food and explicit weighted/equal/personal bill splits; expense approval/rejection; linked partial refunds; opening balances |
| Payments | Cash/bKash/Nagad/bank labels; sender report; recipient confirmation; pending/rejected/confirmed states |
| Statements | Exact-paisa bills, fund reconciliation, non-mutating transfer suggestions |
| Month-end | Checks, counted cash, versioned close, reopen with reason, preserved snapshots, next-month carry-forward |
| Transparency | Shared questions/resolutions; actor/version audit with before/after details |
| Coordination | Notice board, assigned shopping/bazar tasks, completion state |
| Exports | CSV with formula-injection escaping; JSON ledger export; print / browser Save as PDF; opt-in aggregate SVG share card |
| Resilience | Revision conflicts; idempotent retry; saved meal drafts; optional 7-day IndexedDB snapshot; read-only offline mode |
| PWA | Manifest/icon; production service worker caches public shell/assets, never private API responses |
| Google | Authorization-code/PKCE flow, state cookie, one-use server flow, verified JWT claims, secure-session code; not live-configured |

## Tests actually run

- 67 unit/API/auth/domain tests, including 2,000 generated allocation/settlement cases.
- 13 SQLite schema/trigger tests.
- 12 Chromium browser tests, including full close/carry-forward and offline drafts.
- 19 actual local Worker/D1 integration assertions: authorization, CSRF, invites, idempotency, concurrency, recipient confirmation, audit, revocation, handover, logout.
- Actual local API/D1 smoke test.
- Automated axe WCAG A/AA scan: zero reported rule violations on the tested welcome + eight workspace screens after fixes. This is not comprehensive accessibility certification.
- Production-build PWA test: offline reload, read-only saved view, no API responses in shell cache, reconnect.
- Local database export/restore: eight selected tables match exactly; integrity check passes.
- Type-check/build passed. npm audit reports zero known vulnerabilities at final check, not a full security audit.

See `TEST-REPORT.md` for failures encountered, fixes and caveats.

## What is NOT finished / release gates

This is a working **local pilot**, not a production-final launch or proof of virality.

1. Owner Google/Cloudflare setup, actual live Google login and remote deployment remain undone.
2. Complete Bangla translation is still pending; current toggle covers primary navigation/headings. English forms and errors remain. This is not yet the fully Bangla-first release promised in the plan.
3. Real Android/iPhone/screen-reader validation and a full month of manager/member pilot feedback remain.
4. Remote Worker Free-tier CPU fit, quota behavior, abuse tuning and production backup restore remain unverified.
5. The live ledger is a bounded D1 aggregate, not the original fully normalized design. See ADR-002 for limits and future migration.
6. Meal records represent explicitly confirmed daily counts; a separate cook-facing planned-versus-consumed workflow is not implemented.
7. Dedicated duplicate-expense warnings, broader bulk-entry preview, in-app account-deletion requests/operator console and full multilingual report QA remain backlog items.
8. SVG share cards do not post automatically. Notifications are pull/refresh-based; no push/SMS/automated WhatsApp.
9. No payment processing, bank verification, receipt images/OCR or AI features. Payment-method labels do not connect to bKash/Nagad.
10. A real privacy/retention/contact policy and name/domain/trademark checks are required before public launch.

## Beginner map

- **React screens** ask for information and display the result.
- **API middleware** proves who is making the request and checks CSRF/origin.
- **Domain commands** decide whether that person is allowed to change a particular record.
- **Accounting engine** allocates every paisa exactly.
- **D1 conditional update** refuses stale revisions.
- **Database triggers** write the operation receipt, audit event and access index together.
- **Tests** try allowed flows and forbidden actions; they do not prove the app has no bugs.

## Your next external step

Follow `DEPLOYMENT.md` using accounts you own. Do not send secrets in chat. We should complete the remaining release gates before any real mess relies on this for its official accounts.

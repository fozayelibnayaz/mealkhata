# MealKhata · v0.3 status

## Approved
Scope, MealKhata name, Google sign-in for pilot, beginner teaching and green/cream interface design. Name/trademark checks remain unverified.

## Implemented locally
- Original sample demo retained; a separate persistent `/workspace` follows the same design.
- Auth/session/OAuth code; local isolated sandbox identity; role-authorized D1 workspace API.
- Creation, invitations/QR, requests/approval/claim, roster, handover/departure.
- Meals, weights, guests, cutoffs/corrections, away ranges, explicit missing resolution.
- Pending/approved expenses, bill splits, linked refunds, opening positions.
- Reported/confirmed/rejected payments with recipient checks.
- Bill explanation, disputes, audit, versioned close/reopen, settlement preview, carry-forward.
- Notice/tasks, reports, safe exports, aggregate share card.
- Saved drafts, optional read-only device copy, public-only PWA shell.
- Automated tests, real local D1 integration, local restore drill, accessibility pass and deployment guides.

## Not a production completion claim
Google credentials/real-provider integration and external deployment have not been configured or verified. Complete Bangla copy, real-device checks, operator privacy/contact policy, production Free-tier CPU/quota validation and actual month-end pilot feedback are open. Dedicated planned-consumption workflow, duplicate-expense hints and broader bulk-entry UX remain backlog.

Architecture changed from fully normalized ledger tables to bounded per-mess D1 aggregates for this pilot. Rationale and limits: ADR-002.

## QA snapshot
67 unit/domain/auth/API tests, 13 SQLite schema tests, 12 browser tests, 19 actual local D1 integration assertions. Nine scanned workspace/welcome screens have zero reported axe WCAG A/AA violations in the final scan. Local restore comparison and production-build offline test pass. See TEST-REPORT for limitations and issues found.

## Next actions
1. Finish remaining localization/copy and run staged pilot acceptance with actual managers.
2. Owner configures Google OAuth and Cloudflare using DEPLOYMENT.md; no secrets in chat.
3. Verify remote security, CPU/quota behavior, backups, mobile install/offline and actual provider flow.
4. Run one full month with five messes before growing the pilot.

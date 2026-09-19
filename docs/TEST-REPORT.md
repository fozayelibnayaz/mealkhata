# QA / QC report — v0.3 local pilot
Date: 19 September 2026

## Executed results
| Check | Final observed result |
|---|---|
| Frontend + Worker TypeScript and Vite build | PASS |
| Unit/accounting/domain/auth/API tests | 67 PASS |
| Generated cases inside unit tests | 1,000 allocation + 1,000 settlement cases |
| SQLite schema/trigger tests | 13 PASS |
| Chromium browser tests | 12 PASS |
| Actual local Worker/D1 integration script | 19 assertions PASS |
| API/D1/same-origin proxy smoke | PASS |
| axe WCAG A/AA scan | 0 reported rule violations on welcome + 8 workspace screens |
| Production-build PWA offline/reconnect check | PASS |
| Local SQL export/import into separate D1 | PASS; 8 selected tables matched exactly; integrity check passed |
| Final npm dependency audit | 0 reported known vulnerabilities |

These are scoped test results, not a declaration of complete security, accessibility or bug-free operation. CI configuration exists but has not been run on a remote GitHub repository.

## Important coverage

### Money / workflow
Integer money and Bengali digits; exact-paisa rounding/tie order; half-weight units; zero-meal guard; refunds; custom bill splits; pending entries excluded; personal versus fund spending; deposits/reimbursements/peer transfers; opening reconciliation; carry-forward; close/reopen snapshots; missing meals/disputes/pending records block closing; historical months lock after carry-forward; linked refunds cannot exceed original purchase; stale confirmations cannot overpay a closed settlement.

### Identity / authorization
JWT signature, audience and nonce validation, verified-email check, unknown signing-key rejection; missing Google config fails closed; callback state mismatch rejected; sandbox route disabled in production. The real provider's live token exchange and consent flow remain untested.

Actual local API tests prove: outsiders cannot read the mess; invite possession does not grant access; approval enables membership; members cannot mutate other people's meals or manager-only records; CSRF token required; only payment recipient may confirm; previous manager loses privileges after handover; logout revokes the session.

### Storage / concurrency
Optimistic revision check rejects stale input. Repeated operation ID with identical payload returns without duplicating the record; different payload is rejected. Two simultaneous writes at one revision produce one success and one conflict. SQL triggers atomically persist operation receipt/audit/access index. Trigger collision rollback and append-only audit checked in SQLite. Financial writes were exercised against actual local D1, not just mocked storage.

### UI / resilience
Original demo regression tests; persistent create/meal/expense/approval/close/next-month workflow; reload persistence; corrupted old demo recovery; mobile welcome width; modal keyboard behavior; saved snapshot opens read-only during API outage; meal draft survives reload.

Production service-worker test verifies public asset caching, absence of `/api/*` responses from cache, full offline page reload, opt-in IndexedDB view and reconnect. Saved financial snapshots are not application-encrypted. Actual mobile PWA installation remains untested.

## Issues found and addressed

- Old prototype refund allocator produced negative zero; normalized and regression tested.
- Shallow browser-cache validation replaced with schema validation.
- Missing JSONC parser in deployment guard would reject the prettified example's trailing commas; replaced with a JSONC parser.
- Refund reapproval/original rejection needed linkage guards; added.
- Invite revocation could race the join update; invite validity is now checked in the conditional SQL update too.
- Low-contrast muted text flagged by axe; darkened text without changing the approved visual style. A newly added cache-consent label also failed and was corrected before final scan.
- Initial production PWA test failed on offline reload: install cached HTML but not all lazy-loaded assets. Build now emits a public-only asset manifest. Preview server's `Vary: Origin` also caused static-cache misses; matching ignores Vary only for public assets/fonts. Final production offline test passes.
- Repeated QA hit production-like per-IP create limits in local development; added a 20× multiplier only under APP_ENV=local. Production keeps strict limits.
- A browser workflow run timed out waiting for the meal screen following development changes. Isolated and complete subsequent runs passed without test retries; continue watching this under CI/real devices.
- Scheduled-worker wrapper changed the default export; tests were updated to use the named Hono app export and rerun.

## Evidence files
`accessibility-report.json`, `pwa-test-results.txt`, `restore-test-results.txt`, `dependency-audit.json`. Executable commands are listed in README.

## Open release gates / limitations

No external deployment, real Google consent/token exchange, remote D1 restore or production Worker CPU profile. No full month of independent real-manager reconciliation. Full Bangla translation/report glyph QA and actual Android/iPhone/screen-reader validation remain. Privacy contact/retention/deletion operations need owner decisions. The bounded aggregate design requires profiling/migration before large-scale adoption; see ADR-002. User-facing JSON export is not a complete SQL backup or automatic restore mechanism.

Build has two non-failing third-party Zod comment-annotation warnings; Rollup removes those comments. Current front-end initial JS is about 113 KB gzip, plus a ~18 KB workspace chunk and an on-demand ~10 KB QR chunk, excluding fonts/CSS. No low-end-device loading-time promise has been verified.

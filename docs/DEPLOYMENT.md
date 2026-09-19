# Deployment and Google sign-in — owner checklist

**Status:** Local workspace works. No cloud resources or Google client credentials have been created by the assistant. Live Google end-to-end login, production limits and public deployment are not verified.

## 1. Accounts you own

You need a Cloudflare account and a Google Cloud project you control. Keep the project on free infrastructure during the pilot; do not enable paid products by accident. A custom domain is optional: a free `workers.dev` host can be used.

Install Node.js 22 LTS. From this project folder:

```sh
npm ci
npx wrangler login
npx wrangler d1 create mealkhata-pilot
```

The first command opens Cloudflare authorization in your own browser. The last creates a database in **your** account; do it only when ready. Copy the returned database UUID, not a password.

## 2. Production configuration

Copy `wrangler.pilot.example.jsonc` to `wrangler.pilot.jsonc`.

Fill in:
- `name`: your chosen unique Worker name.
- `database_id`: the UUID Cloudflare returned.
- `APP_ORIGIN`: exact HTTPS origin, no path or trailing slash, e.g. `https://mealkhata-pilot.YOUR-SUBDOMAIN.workers.dev`.
- `GOOGLE_CLIENT_ID`: from the next step.

Keep `APP_ENV: production` and `ALLOW_SANDBOX: false`. The deployment guard refuses local/sandbox configuration. Static assets and `/api/*` share one origin; no separate browser-facing localhost URL is needed.

The example contains JSONC trailing commas; the guard uses a JSONC parser. Do not deploy the development `wrangler.jsonc` to production.

## 3. Google OAuth client

In your Google Cloud project, configure the OAuth consent screen / Google Auth Platform branding and audience. Use the actual app name, owner support contact and accurate privacy/data-use information. Request only OpenID profile/email for sign-in.

Create an OAuth client of type **Web application**. Set:

- Authorized JavaScript origin: your exact `APP_ORIGIN`.
- Authorized redirect URI: `APP_ORIGIN/api/auth/callback`.

While Google is in testing mode, add your actual pilot testers as test users. Review the console's current requirements for publishing, verified domains and consent; those are account-specific and may change. Do not claim the app has passed Google verification until it has.

Paste the public client ID into the configuration. Store the client secret only through Wrangler's secret prompt:

```sh
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.pilot.jsonc
```

**Never put the secret in React code, git, screenshots or chat.** For a private local OAuth test with an HTTPS callback, use ignored `.dev.vars` and configure the exact corresponding origin. The rotating sandbox preview hostname is not a durable production OAuth address.

## 4. Migrate, build, deploy

Back up any existing remote database before changing it. For a newly created pilot database:

```sh
npx wrangler d1 migrations apply mealkhata-pilot --remote --config wrangler.pilot.jsonc
npm run deploy:pilot
```

These are real external changes; the assistant has **not** run them. The deployment script checks configuration, type-checks, builds the app/PWA manifest and invokes Wrangler. If Wrangler requires an initial deployment before secret creation, deploy without the secret first: Google remains disabled until the secret is set. Never substitute a fake secret and call it connected.

## 5. Production acceptance before real records

- Test Google sign-in with two permitted real test accounts.
- Confirm `/api/auth/config` says `sandbox: false`.
- Confirm POST `/api/auth/sandbox` returns 404.
- Confirm cookies are Secure, HttpOnly and SameSite=Lax.
- Check callback state, nonce, audience and expiry behavior against the live provider.
- Create one test mess; invite the second account; verify it has no access before approval.
- Repeat cross-mess, recipient-confirmation, duplicate-save and stale-revision checks in staging.
- Confirm PWA static asset routing and offline view on an actual Android phone/iPhone; private API responses must never enter the service-worker cache.
- Check Worker CPU, D1 storage/read/write usage, cold starts and month-close time at representative sizes. The Free plan may reject workloads that exceed its limits.
- Test production-origin CSRF rejection and sign-out/session revocation.
- Supply a real operator contact, privacy/deletion process and retention policy before public launch.
- Finish Bangla copy coverage and have Bangla-speaking pilot users review it.
- Run a complete real month against an independent khata and record user feedback.

## 6. Operation and maintenance

The production example schedules cleanup of expired sessions, OAuth flow records and rate-limit buckets every six hours. Financial data is not deleted by this job. Check that the cron is deployed and running.

Production limits are per IP per five-minute bucket: 10 mess creations, 20 OAuth starts/invites/join requests by scope, 120 authenticated mutations. Local development allows a 20× multiplier because automated tests share one IP. Shared-campus IP behavior needs pilot observation; adjust carefully, not by removing abuse controls.

Review storage and request quotas weekly. Pause onboarding near capacity; never silently remove financial history. Bounded aggregate architecture is documented in `ADR-002.md`.

## 7. Backups and restore

Member JSON exports are portable statements, **not** a full operator database backup or a trusted automatic import format.

Operator backup:

```sh
npx wrangler d1 export mealkhata-pilot --remote --config wrangler.pilot.jsonc --output=backup.sql
```

An SQL export contains private user records, session hashes and OAuth metadata. Encrypt it, keep it out of git/public folders, restrict access and define retention. For a disaster restore, use a separate empty database first, import there, compare records and then switch bindings under maintenance. Revoke restored sessions if the backup/security incident warrants it.

A **local** export/import drill was actually completed: eight selected tables matched exactly and SQLite integrity passed. See `restore-test-results.txt`. Remote recovery is still untested.

Never run untrusted SQL supplied by a regular member. `scripts/verify-restore.py` is for operator-owned exports and a restored local database.

## 8. Rollback

Keep the last known-good source release and database export. Avoid destructive schema changes. If a release fails, restore the previous Worker version and inspect migration compatibility before changing the database. Do not roll back financial data casually: post-release records could be lost. Enter maintenance/read-only mode and reconcile what was written first.

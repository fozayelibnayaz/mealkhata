# MealKhata — connect the pilot from a phone

This supersedes PHONE-DEPLOYMENT.md for the next deployment. That older guide intentionally deploys only the setup interface.

## Target and current status

- Worker: mealkhata
- Origin: https://mealkhata.ayazwork2026.workers.dev
- GitHub repository: https://github.com/fozayelibnayaz/mealkhata
- D1 name: mealkhata-pilot
- D1 ID: 33e73aae-04c3-4cda-8035-ffa668dd7c5e
- Google client ID: 982453680372-3ootgt3la58if8vtct88s8e7grljd4u3.apps.googleusercontent.com
- Owner reports GOOGLE_CLIENT_SECRET saved as a Cloudflare runtime Secret and own Google account added as a test user. The assistant cannot inspect or verify the secret.

These identifiers are configuration, not credentials. The Google Client Secret is not in this package. No authenticated remote deployment or database migration was performed by the assistant. Public setup was previously reachable; real OAuth and shared writes remain unverified until deployment and owner testing.

## 1. Download

Download **mealkhata-live-upload.zip**. Do not extract or rename it. If the phone appends `(1)` or similar, rename the downloaded file back to the exact filename before uploading.

## 2. Allow database initialization

In Cloudflare, open My Profile → API Tokens (https://dash.cloudflare.com/profile/api-tokens). Find the existing token used by the mealkhata Worker build (check Worker → Settings → Build → API token if unsure). Use its menu → Edit. Keep the existing permissions and add **Account → D1 → Edit**, limited to the same Cloudflare account hosting MealKhata. Save/update the token.

Do not regenerate, revoke, copy or share the token. Do not add all-account permissions. The default Workers Builds token documented by Cloudflare does not include D1 Edit. If Edit is unavailable, stop and share a screenshot with any credential values hidden; do not create a broad token.

## 3. Change the Worker build settings

Worker mealkhata → Settings → Build → Build configuration.

Production branch: main. Root directory: /.

Build command:

```sh
unzip -o mealkhata-live-upload.zip && cd mealkhata && npm ci --include=dev && npm run build
```

Deploy command:

```sh
cd mealkhata && npm run deploy:live
```

Keep these ordinary BUILD variables:

| Variable | Value |
|---|---|
| NODE_VERSION | 22.23.2 |
| SKIP_DEPENDENCY_INSTALL | 1 |

Leave non-production/preview branch builds disabled for now: the live config targets the pilot database and canonical production origin, not isolated preview data.

The deploy script validates configuration, applies the two pending migrations to the named remote D1 database, then deploys the full API and frontend. A failed migration stops deployment. Wrangler records migrations, so successful migrations are skipped on later retries. Do not manually paste or re-run individual CREATE TABLE statements.

This assumes the newly created D1 database is empty or already initialized using these exact Wrangler migrations. If it already contains unrelated tables/data, stop before deploying; do not reset or delete it.

## 4. Upload to GitHub

Open the repository, then Add file → Upload files. Choose mealkhata-live-upload.zip and commit to main with message `Connect MealKhata pilot database and Google login`. Use the phone browser's Desktop site if controls are hidden.

The older mealkhata-phone-upload.zip can stay. The new build command uses only mealkhata-live-upload.zip. Save build settings before committing the new ZIP. If changing settings triggers an early build before the ZIP is uploaded, that build may fail harmlessly; retry after the file is committed.

Check Cloudflare Builds/Deployments. A successful log should show the configuration check, migrations applied or no migrations pending, the DB binding, and successful Worker deployment. Send the first error lines if it fails; hide secrets.

## 5. Verify before inviting others

After the deployment succeeds, open:

https://mealkhata.ayazwork2026.workers.dev/workspace

Use a normal browser tab, not a browser embedded inside another app. If an old page remains, reload it or close and reopen the tab.

1. Confirm Google sign-in is available.
2. Sign in with the Google test account.
3. Create a disposable test mess and a small test entry.
4. Reload: the mess and entry should remain.
5. Sign out: private workspace access should require login again.
6. Sign in again: confirm the test records still belong to the same account.

Use test data only until these checks pass. A successful deployment or `googleConfigured: true` only means configuration is present, not that the secret is correct or OAuth completed.

Expected public configuration after deployment:

- GET /api/health: stage workspace-pilot; authentication google-configured when required Google environment values exist.
- GET /api/auth/config: googleConfigured true; sandbox false.
- GET /api/auth/me while signed out: no signed-in user.
- /api/db-health remains disabled outside local development by design.

Google client must be a Web application with:

Authorized JavaScript origin:
https://mealkhata.ayazwork2026.workers.dev

Authorized redirect URI:
https://mealkhata.ayazwork2026.workers.dev/api/auth/callback

If Google reports redirect_uri_mismatch, verify the exact URI on the same client ID. If it reports invalid_client, check the runtime secret belongs to this client; never paste it into chat. If Cloudflare reports missing secret, verify GOOGLE_CLIENT_SECRET is a runtime Secret on Worker mealkhata, not a Build secret. If migrations report authorization failure, check D1 Edit on the token actually selected for this build.

## Checks completed on this package

- Production type-check/frontend build: passed.
- Unit tests: 77 passed, including seven deployment guard tests.
- SQLite schema/constraint tests: 13 passed.
- Wrangler full-worker deploy dry-run: passed; 22 assets; DB binding present; production origin and sandbox disabled.
- Local Wrangler migrations: both applied successfully to a fresh isolated local database; repeat reported no migrations pending; schema version 2 and zero users confirmed.
- No remote migration, secret inspection, authenticated owner-account access, real Google callback or remote financial write was performed here.
- Previous browser/integration/accessibility/PWA evidence is historical; those full suites were not rerun for this configuration-only update.

This remains a bounded free-tier pilot, not an unlimited-free guarantee or a fully audited public financial product. See HANDOVER.md and PROJECT-STATUS.md for remaining privacy operations, localization, device checks, quota/load and restore work.

Official references:
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/d1/get-started/
- https://developers.google.com/identity/openid-connect/openid-connect

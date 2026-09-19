# Phone-only deployment — first public setup

This is a staged deployment for the existing Cloudflare Worker named **mealkhata**. It publishes the app interface/sample demo but does NOT enable real login, sandbox account creation, sessions, database access or shared financial writes. Those require the next configuration step.

The repository was publicly empty when checked on 19 September 2026. An empty repository cannot supply the configured `main` source commit. Populating it is the first fix; GitHub app permissions may also need checking if cloning still fails afterwards.

## Download and settings

Download `mealkhata-phone-upload.zip`. Do not extract or rename it on your phone. The GitHub repository root should contain this exact ZIP filename. Cloudflare will unpack it during its build; uploading a ZIP alone without this build command would not work.

Cloudflare → Workers & Pages → mealkhata → Settings → Build → Build configuration:

- Production branch: `main`
- Root directory: `/`
- Build command:

```sh
unzip -o mealkhata-phone-upload.zip && cd mealkhata && npm ci --include=dev && npm run build
```

- Deploy command:

```sh
cd mealkhata && npx wrangler deploy --config wrangler.setup.jsonc
```

Build Variables and Secrets (plain build variables, not runtime secrets):

| Name | Value |
|---|---|
| NODE_VERSION | 22.23.2 |
| SKIP_DEPENDENCY_INSTALL | 1 |

Keep the existing Cloudflare-managed build token. No token needs to be copied or shared. Leave non-production/preview branch builds disabled for this initial setup.

## Upload from phone

1. Sign in to GitHub and open `fozayelibnayaz/mealkhata`.
2. For the empty repository, use **uploading an existing file**. For an initialized repository, use **Add file → Upload files**. Enable your phone browser's Desktop site if controls are missing.
3. Select `mealkhata-phone-upload.zip` from Downloads.
4. Commit the upload to `main`, e.g. with message `Add MealKhata setup package`.
5. Confirm the repo now displays the ZIP and an actual commit.
6. Cloudflare should start a new build. If needed, choose Retry build after the commit exists and the saved settings above are present.

## After successful deployment

Open the public `workers.dev` address shown under the Worker's Domains or Settings. Send that URL to the assistant. The first page can show the sample demo, and `/workspace` intentionally shows Google login as unavailable. That is expected at this stage, not proof the whole financial service is live.

`/api/health` should report `phase: setup`, `productionReady: false`, `authentication: disabled`, `database: not-connected`.

Next: create/bind D1, apply schema, configure exact-origin Google OAuth, add the Google secret directly in Cloudflare, and switch from the setup handler to the full authenticated backend. Do not enable the development sandbox routes on a public Worker.

## If cloning still fails

Open GitHub → Settings → Applications → Installed GitHub Apps → Cloudflare Workers and Pages → Configure. Under repository access, ensure only the intended `mealkhata` repository is included; Save, then retry. Do not delete the Cloudflare account or share API tokens. Send the first new error lines with secrets redacted.

## Validation performed here

Frontend and server type-check/build passed. 70 unit tests passed. Wrangler's setup deployment dry-run successfully found 22 public asset files and bundled the small setup handler with no database binding or secrets. No deployment into the owner's account was performed.

Official references checked:
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
- https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/

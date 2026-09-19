import fs from "node:fs";
import {parse} from "jsonc-parser";
const path = process.argv[2] || "wrangler.pilot.jsonc";
if (!fs.existsSync(path))
  throw new Error(
    "Copy wrangler.pilot.example.jsonc to wrangler.pilot.jsonc and follow docs/DEPLOYMENT.md first.",
  );
const raw = fs.readFileSync(path, "utf8");
if (raw.includes("REPLACE_"))
  throw new Error("Deployment config still contains placeholders.");
const errors=[];
const cfg = parse(raw,errors,{allowTrailingComma:true});
if(errors.length) throw new Error("Deployment configuration contains invalid JSONC.");
if (cfg.vars?.APP_ENV !== "production" || cfg.vars?.ALLOW_SANDBOX !== "false")
  throw new Error("Production must disable sandbox identities.");
if (
  !cfg.vars?.APP_ORIGIN?.startsWith("https://") ||
  new URL(cfg.vars.APP_ORIGIN).origin !== cfg.vars.APP_ORIGIN
)
  throw new Error("Set an exact HTTPS app origin without a trailing slash.");
if (!cfg.vars?.GOOGLE_CLIENT_ID?.endsWith(".apps.googleusercontent.com"))
  throw new Error("Set a Google OAuth web Client ID, not a URL or secret.");
const db = cfg.d1_databases?.find(binding => binding.binding === "DB");
if (!db?.database_name || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(db.database_id || ""))
  throw new Error("Set a real D1 database ID for the DB binding.");
if (Object.hasOwn(cfg.vars, "GOOGLE_CLIENT_SECRET"))
  throw new Error("Keep the Google Client Secret in Cloudflare runtime secrets, not config vars.");
console.log(
  "Basic deployment config check passed. OAuth secret, limits, real sign-in and staging checks are still required.",
);

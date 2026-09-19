import { it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const valid = JSON.parse(readFileSync('wrangler.live.jsonc', 'utf8'));
function check(change: (cfg: any) => void = () => {}, raw?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'mk-config-'));
  try {
    const cfg = structuredClone(valid); change(cfg);
    const path = join(dir, 'config.jsonc');
    writeFileSync(path, raw ?? JSON.stringify(cfg));
    return spawnSync(process.execPath, ['scripts/check-deploy.mjs', path], {encoding:'utf8'}).status;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
it('accepts owner live config without secret values', () => expect(check()).toBe(0));
it('accepts JSONC comments and trailing commas', () => expect(check(undefined, '// comment\n' + JSON.stringify(valid).replace(/}$/, ',}'))).toBe(0));
it('rejects sandbox and local settings', () => {
  expect(check(c => c.vars.ALLOW_SANDBOX = 'true')).not.toBe(0);
  expect(check(c => c.vars.APP_ENV = 'local')).not.toBe(0);
});
it('rejects insecure or non-exact origins', () => {
  expect(check(c => c.vars.APP_ORIGIN = 'http://example.com')).not.toBe(0);
  expect(check(c => c.vars.APP_ORIGIN += '/')).not.toBe(0);
});
it('rejects missing or invalid database and OAuth identifiers', () => {
  expect(check(c => c.d1_databases = [])).not.toBe(0);
  expect(check(c => c.d1_databases[0].database_id = 'invalid')).not.toBe(0);
  expect(check(c => c.vars.GOOGLE_CLIENT_ID = 'invalid')).not.toBe(0);
});
it('rejects placeholders, malformed config and plaintext secrets', () => {
  expect(check(c => c.vars.GOOGLE_CLIENT_ID = 'REPLACE_ME')).not.toBe(0);
  expect(check(undefined, '{')).not.toBe(0);
  expect(check(c => c.vars.GOOGLE_CLIENT_SECRET = 'test-only-not-a-real-secret')).not.toBe(0);
});
it('live config targets the owner worker and requires the private secret', () => {
  expect(valid.name).toBe('mealkhata');
  expect(valid.main).toBe('server/app.ts');
  expect(valid.secrets.required).toContain('GOOGLE_CLIENT_SECRET');
  expect(valid.vars.APP_ORIGIN).toBe('https://mealkhata.ayazwork2026.workers.dev');
  expect(valid.d1_databases[0].database_id).toBe('33e73aae-04c3-4cda-8035-ffa668dd7c5e');
});

import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const config = JSON.parse(readFileSync(new URL('wrangler.jsonc', root), 'utf8'));
assert.equal(config.name, 'contact-vendas-online');
assert.equal(config.assets.binding, 'ASSETS');
assert.ok(statSync(new URL(config.assets.directory + '/', root)).isDirectory());
execFileSync(process.execPath, ['--check', new URL(config.main, root).pathname]);
execFileSync(process.execPath, ['--check', new URL('public/cobrancas-central.js', root).pathname]);
for (const file of ['campaign-progress.js', 'campaign-live-monitor.js', 'birth-date-mask.js', 'script.js', 'fpd-data.js', 'fpd-grid.js', 'fpd.js', 'vendor/xlsx-0.20.3.full.min.js']) {
  execFileSync(process.execPath, ['--check', new URL('public/' + file, root).pathname]);
}
execFileSync(process.execPath, ['--test', new URL('scripts/tests/fpd.test.mjs', root).pathname, new URL('scripts/tests/birth-date.test.mjs', root).pathname, new URL('scripts/tests/campaign-progress.test.mjs', root).pathname]);
const html = readFileSync(new URL('public/cobrancas.html', root), 'utf8');
assert.match(html, /data-collections-tab="historico"[^>]*>Histórico<\/button><button[^>]*data-collections-tab="fpd"/);
assert.match(html, /id="collectionsFpd"/);
for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
  const path = match[1];
  if (/^(?:https?:|data:|#|\/)/.test(path)) continue;
  assert.ok(statSync(new URL('public/' + path, root)).isFile(), `Missing asset: ${path}`);
}
console.log('Validated Worker configuration, syntax, collections assets and FPD entry.');

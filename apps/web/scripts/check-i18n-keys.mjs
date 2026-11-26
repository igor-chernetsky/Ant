#!/usr/bin/env node
/**
 * Fails when the interface asks for a translation key that the dictionaries do not
 * define — the reason raw `common.next` / `common.back` appeared in the publish
 * modal instead of button labels.
 *
 * Run: node scripts/check-i18n-keys.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function keysOf(file) {
  const text = readFileSync(file, 'utf8');
  const keys = new Set();
  const namespaceRe = /^ {2}([A-Za-z0-9_]+): \{/gm;
  let match;
  while ((match = namespaceRe.exec(text)) !== null) {
    const namespace = match[1];
    const start = match.index + match[0].length;
    const end = text.indexOf('\n  },', start);
    if (end === -1) continue;
    const block = text.slice(start, end);
    // `en.ts` destructures `homePage` out of the extended dictionary and spreads it
    // into `home`, so those keys are addressed as `home.*` at runtime.
    const prefix = namespace === 'homePage' ? 'home' : namespace;
    for (const key of block.matchAll(/^ {4}([A-Za-z0-9_]+):/gm)) {
      keys.add(`${prefix}.${key[1]}`);
    }
  }
  return keys;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

const dictionaries = join(ROOT, 'src', 'lib', 'i18n', 'messages');
const known = new Set();
for (const file of readdirSync(dictionaries)) {
  if (!file.endsWith('.ts')) continue;
  for (const key of keysOf(join(dictionaries, file))) known.add(key);
}

const used = new Set();
for (const file of walk(join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/t\('([a-z][A-Za-z0-9_-]*\.[A-Za-z0-9_]+)'/g)) {
    used.add(match[1]);
  }
}

const missing = [...used].filter((key) => !known.has(key)).sort();

if (missing.length > 0) {
  console.error(`Missing translation keys (${missing.length}):`);
  for (const key of missing) console.error('  •', key);
  process.exit(1);
}

console.log(`OK: ${used.size} used keys are all defined.`);

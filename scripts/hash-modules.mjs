#!/usr/bin/env node
/**
 * Content-hash the ES module graph, so JS can be cached forever and a browser
 * can never assemble a half-old graph.
 *
 *     node scripts/hash-modules.mjs           write hashed copies + import maps
 *     node scripts/hash-modules.mjs --check   verify they're current; exit 1 if not
 *
 * WHY
 * ---
 * assets/*.js import each other by bare absolute path. When a shared export
 * moved between two modules, browsers holding one stale sibling got "does not
 * provide an export named X", the module aborted, and the quiz sat on "Loading…"
 * forever. `no-cache` fixed that by revalidating every module every load — safe,
 * but it pays a conditional request per module forever.
 *
 * HOW
 * ---
 * Each module is copied to assets/m/<name>.<hash>.js and every page that loads
 * one gets an <script type="importmap"> mapping the plain path to the hashed
 * one. The module SOURCE is never rewritten — it still says
 * `import … from "/assets/paddle-ratings.js"`, and the import map redirects it.
 * That keeps the source readable and diffable, and means a hash change never
 * cascades into rewriting its importers.
 *
 * The import map lives in the HTML, which is short-cached (max-age=300). That is
 * what makes skew impossible: a document resolves EVERY specifier through the
 * one map it was served with, so you get either a wholly-new graph or a wholly-
 * old one — never a mix. The entry <script src> is hashed for the same reason;
 * left unhashed it would always be fresh and could pair a new entry with the old
 * deps a stale HTML pinned — reintroducing the exact bug.
 *
 * Hashed files are immutable (see firebase.json), so a name that exists is
 * always the same bytes. Unhashed originals stay on disk and stay no-cache, so
 * a browser too old for import maps still resolves the plain paths and works.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');
const HASH_DIR = path.join(ASSETS, 'm');
const CHECK = process.argv.includes('--check');

const START = '<!-- importmap:start · generated: node scripts/hash-modules.mjs -->';
const END = '<!-- importmap:end -->';

/** A module is any asset that uses top-level import/export — detected, not
 *  listed, so a new module joins the scheme automatically. */
function moduleFiles() {
  return fs
    .readdirSync(ASSETS)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /^\s*(import|export)\s/m.test(fs.readFileSync(path.join(ASSETS, f), 'utf8')))
    .sort();
}

const hashOf = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

/** Pages that load one of these modules as an entry point. */
function pagesWithModuleEntry(names) {
  const pages = [];
  const walk = (dir, rel = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const abs = path.join(dir, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (['assets', 'scripts', 'audit', 'partials', 'pickleheads-research'].includes(e.name)) continue;
        if (e.name.startsWith('design_handoff')) continue;
        walk(abs, r);
      } else if (e.name.endsWith('.html')) {
        const src = fs.readFileSync(abs, 'utf8');
        if (names.some((n) => new RegExp(`<script type="module" src="/assets/(?:m/)?${n.replace('.js', '')}[^"]*\\.js"`).test(src))) {
          pages.push(r);
        }
      }
    }
  };
  walk(ROOT);
  return pages.sort();
}

function main() {
  const names = moduleFiles();
  if (!names.length) throw new Error('no ES modules found in assets/ — did the detection break?');

  // name -> { hash, hashedRel }
  const map = new Map();
  for (const n of names) {
    const buf = fs.readFileSync(path.join(ASSETS, n));
    const h = hashOf(buf);
    map.set(n, { hash: h, hashedRel: `/assets/m/${n.replace(/\.js$/, '')}.${h}.js`, buf });
  }

  const wanted = new Set([...map.values()].map((v) => path.basename(v.hashedRel)));
  const drift = [];

  // ---- hashed copies -------------------------------------------------------
  if (!CHECK) fs.mkdirSync(HASH_DIR, { recursive: true });
  const existing = fs.existsSync(HASH_DIR) ? fs.readdirSync(HASH_DIR).filter((f) => f.endsWith('.js')) : [];

  for (const [n, v] of map) {
    const dest = path.join(HASH_DIR, path.basename(v.hashedRel));
    const ok = fs.existsSync(dest) && fs.readFileSync(dest).equals(v.buf);
    if (ok) continue;
    if (CHECK) drift.push(`missing/stale hashed copy for ${n} (expected ${path.basename(v.hashedRel)})`);
    else fs.writeFileSync(dest, v.buf);
  }
  // Stale hashes would otherwise pile up forever, and an immutable URL that no
  // page references is just dead weight in the deploy.
  for (const f of existing) {
    if (wanted.has(f)) continue;
    if (CHECK) drift.push(`stale hashed file should be removed: assets/m/${f}`);
    else fs.unlinkSync(path.join(HASH_DIR, f));
  }

  // ---- import map + entry rewrite per page ---------------------------------
  const imports = {};
  for (const [n, v] of map) imports[`/assets/${n}`] = v.hashedRel;
  const block = [
    START,
    `<script type="importmap">${JSON.stringify({ imports }, null, 0)}</script>`,
    END,
  ].join('\n');

  const pages = pagesWithModuleEntry(names);
  let changed = 0;
  for (const rel of pages) {
    const abs = path.join(ROOT, rel);
    let src = fs.readFileSync(abs, 'utf8');
    const before = src;

    // 1. entry <script src> -> hashed URL (idempotent: matches hashed or plain)
    for (const [n, v] of map) {
      const stem = n.replace(/\.js$/, '');
      src = src.replace(
        new RegExp(`(<script type="module" src=")/assets/(?:m/)?${stem}(?:\\.[0-9a-f]{6,})?\\.js(")`, 'g'),
        `$1${v.hashedRel}$2`
      );
    }

    // 2. import map, immediately before the first module script so it is
    //    guaranteed to be parsed first (the spec requires it precede any module).
    const existingBlock = new RegExp(`[ \\t]*${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`);
    src = src.replace(existingBlock, '');
    const firstModule = src.search(/<script type="module"/);
    if (firstModule === -1) continue;
    src = src.slice(0, firstModule) + block + '\n' + src.slice(firstModule);

    if (src !== before) {
      if (CHECK) drift.push(`import map / entry src out of date in ${rel}`);
      else {
        fs.writeFileSync(abs, src);
        changed++;
      }
    }
  }

  if (CHECK) {
    if (drift.length) {
      console.error('✘ hashed modules are stale — run: node scripts/hash-modules.mjs');
      for (const d of drift.slice(0, 10)) console.error(`   ${d}`);
      if (drift.length > 10) console.error(`   …and ${drift.length - 10} more`);
      process.exit(1);
    }
    console.log(`✔ hashed modules current: ${map.size} modules, ${pages.length} pages`);
    return;
  }

  console.log(`✔ hashed ${map.size} modules -> assets/m/, updated ${changed}/${pages.length} pages`);
  for (const [n, v] of map) console.log(`   ${n} -> ${path.basename(v.hashedRel)}`);
}

main();
